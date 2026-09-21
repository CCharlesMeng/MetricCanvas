"""Explicit local durable adapters; never selected by production configuration.

Transactions serialize local state only. They cannot establish Relay authority,
remote save idempotency, or durability guarantees of the page service.
"""
from contextlib import contextmanager
from copy import deepcopy
import json
import os
from pathlib import Path
import sqlite3
import stat
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from uuid import uuid4

from metriccanvas_authoring.work.content_ports import ContentBaselineError
from metriccanvas_authoring.assets.lifecycle_ports import LifecycleError
from metriccanvas_authoring.canonical import canonical_json, canonical_sha256
from metriccanvas_authoring.domain.page_validation import validate_page_document
from metriccanvas_authoring.runtime_assets import bundle_root
from metriccanvas_authoring.work.submission_records import (
    FORMAT_VERSION,
    text as _text,
    validate_record,
    validate_scope,
    validate_snapshot,
    validate_transition,
)

_CONTRACTS = bundle_root() / 'contracts/authored'
_TURN_SCHEMA = json.loads((_CONTRACTS / 'authoring-turn.schema.json').read_text())
_CANDIDATE_VALIDATOR = Draft202012Validator(json.loads((_CONTRACTS / 'authoring-candidate.schema.json').read_text()),
    registry=Registry().with_resource(_TURN_SCHEMA['$id'], Resource.from_contents(_TURN_SCHEMA)))


def _require(condition, code='EXECUTION_RECORD_INVALID'):
    if not condition: raise LifecycleError(code)


def _dump(value):
    """Persisted bytes: canonical, so a stored row reads back as the same value."""
    return canonical_json(value)


def _key(key):
    _require(isinstance(key, tuple) and len(key) == 5 and all(_text(v) for v in key))
    return _dump(key)


def _record(key, value):
    _require(isinstance(value, dict) and 'rootBinding' in value)
    validate_scope(value, key, invalid='EXECUTION_RECORD_INVALID')
    validate_record(value, value['rootBinding'], invalid='EXECUTION_RECORD_INVALID')
    _dump(value)


def _snapshot(key, value):
    validate_snapshot(value, key, invalid='EXECUTION_RECORD_INVALID', unsupported='EXECUTION_FORMAT_UNSUPPORTED')
    _dump(value)


class _Database:
    def __init__(self, path):
        self.path = str(Path(path))
        self._initializing = True
        try:
            fd = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            pass
        else:
            os.close(fd)
        self._file_identity = self._secure_file()
        with self._transaction() as db:
            version = db.execute('PRAGMA user_version').fetchone()[0]
            if version == 0:
                _require(not db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall(), 'AUTHORING_STORE_VERSION_UNSUPPORTED')
                db.execute('CREATE TABLE candidates (ref TEXT PRIMARY KEY, payload TEXT NOT NULL)')
                db.execute('CREATE TABLE executions (key TEXT PRIMARY KEY, payload TEXT NOT NULL)')
                db.execute('CREATE TABLE programs (token TEXT PRIMARY KEY, actor TEXT NOT NULL, workspace TEXT NOT NULL, payload TEXT NOT NULL)')
                db.execute('PRAGMA user_version=1')
            else:
                _require(version == 1, 'AUTHORING_STORE_VERSION_UNSUPPORTED')
        self._initializing = False

    def _secure_file(self):
        info = os.lstat(self.path)
        _require(stat.S_ISREG(info.st_mode) and info.st_uid == os.getuid() and not info.st_mode & 0o077,
                 'AUTHORING_STORE_FILE_UNSAFE')
        identity = (info.st_dev, info.st_ino)
        _require(not hasattr(self, '_file_identity') or identity == self._file_identity, 'AUTHORING_STORE_FILE_UNSAFE')
        return identity

    @contextmanager
    def _transaction(self):
        self._secure_file()
        db = sqlite3.connect(self.path, timeout=5, isolation_level=None)
        try:
            self._secure_file()
            db.execute('PRAGMA synchronous=FULL')
            db.execute('BEGIN IMMEDIATE')
            if not self._initializing:
                _require(db.execute('PRAGMA user_version').fetchone()[0] == 1, 'AUTHORING_STORE_VERSION_UNSUPPORTED')
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()


class SqliteCandidateStore(_Database):
    def _validate(self, record):
        try:
            valid = (_CANDIDATE_VALIDATOR.is_valid(record)
                     and record['document'].get('id') == record['rootBinding']['pageId']
                     and canonical_sha256(record['document']) == record['documentSha256']
                     and not validate_page_document(record['document']))
            if not valid: raise ValueError()
            return _dump(record)
        except Exception:
            raise ContentBaselineError('CANDIDATE_RECORD_INVALID') from None

    async def put(self, record):
        payload = self._validate(record)
        with self._transaction() as db:
            previous = db.execute('SELECT payload FROM candidates WHERE ref=?', (record['candidateRef'],)).fetchone()
            if previous is not None and previous[0] != payload:
                raise ContentBaselineError('CANDIDATE_IMMUTABLE')
            db.execute('INSERT OR IGNORE INTO candidates VALUES (?,?)', (record['candidateRef'], payload))

    async def get(self, candidate_ref):
        with self._transaction() as db:
            row = db.execute('SELECT payload FROM candidates WHERE ref=?', (candidate_ref,)).fetchone()
        if row is None: raise ContentBaselineError('CANDIDATE_NOT_FOUND')
        try:
            value = json.loads(row[0])
        except ValueError:
            raise ContentBaselineError('CANDIDATE_RECORD_INVALID') from None
        self._validate(value)
        return value


class SqliteExecutionRecords(_Database):
    def __init__(self, path, max_attempts=20, deadline_epoch_ms=None):
        _require(type(max_attempts) is int and max_attempts > 0)
        _require(deadline_epoch_ms is None or type(deadline_epoch_ms) is int and deadline_epoch_ms >= 0)
        self.max_attempts, self.deadline_epoch_ms = max_attempts, deadline_epoch_ms
        super().__init__(path)

    def _read(self, db, key):
        row = db.execute('SELECT payload FROM executions WHERE key=?', (_key(key),)).fetchone()
        if row is None: return None
        value = json.loads(row[0]); _snapshot(key, value)
        return value

    async def claim(self, key, record):
        _key(key); _record(key, record)
        with self._transaction() as db:
            current = self._read(db, key)
            if current is not None: return deepcopy(current['record']), False
            snapshot = {'formatVersion': FORMAT_VERSION, 'recordVersion': 1, 'commandSha256': canonical_sha256(record['command']),
                        'record': deepcopy(record), 'control': {'cancelRequested': False, 'attemptIds': [],
                        'maxAttempts': self.max_attempts, 'deadlineEpochMs': self.deadline_epoch_ms},
                        'saveReceipt': None, 'verificationState': 'pending', 'previewState': 'not-requested'}
            _snapshot(key, snapshot)
            db.execute('INSERT INTO executions VALUES (?,?)', (_key(key), _dump(snapshot)))
            return deepcopy(record), True

    async def get(self, key):
        with self._transaction() as db: return self._read(db, key)

    async def update(self, key, record):
        with self._transaction() as db:
            previous = self._read(db, key)
            _require(previous is not None, 'EXECUTION_NOT_FOUND')
            value = deepcopy(previous); value['record'] = deepcopy(record)
            _snapshot(key, value); validate_transition(previous, value, compatibility=True)
            value['recordVersion'] += 1
            db.execute('UPDATE executions SET payload=? WHERE key=?', (_dump(value), _key(key)))

    async def compare_and_swap(self, key, expected_version, replacement_snapshot):
        with self._transaction() as db:
            previous = self._read(db, key)
            _require(previous is not None, 'EXECUTION_NOT_FOUND')
            _require(type(expected_version) is int and previous['recordVersion'] == expected_version, 'EXECUTION_VERSION_CONFLICT')
            value = deepcopy(replacement_snapshot)
            _snapshot(key, value)
            _require(value['recordVersion'] == expected_version, 'EXECUTION_VERSION_CONFLICT')
            validate_transition(previous, value)
            value['recordVersion'] += 1
            db.execute('UPDATE executions SET payload=? WHERE key=?', (_dump(value), _key(key)))
            return value


class SqliteLifecyclePrograms(_Database):
    async def store(self, value, identity):
        _require(_text(identity.actor_id) and _text(identity.workspace_id), 'UNAUTHENTICATED')
        _require(isinstance(value, dict), 'PROGRAM_TOKEN_INVALID')
        token = 'program-' + uuid4().hex
        with self._transaction() as db:
            db.execute('INSERT INTO programs VALUES (?,?,?,?)', (token, identity.actor_id, identity.workspace_id, _dump(value)))
        return token

    async def load(self, token, identity):
        with self._transaction() as db:
            row = db.execute('SELECT actor,workspace,payload FROM programs WHERE token=?', (token,)).fetchone()
        _require(row is not None, 'PROGRAM_NOT_FOUND')
        _require((row[0], row[1]) == (identity.actor_id, identity.workspace_id), 'FORBIDDEN')
        return json.loads(row[2])
