"""Explicit local durable adapters; never selected by production configuration.

Transactions serialize local state only. They cannot establish Relay authority,
remote save idempotency, or durability guarantees of the page service.
"""
from contextlib import contextmanager
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import stat
import re
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from uuid import uuid4

from metriccanvas_authoring.application.content_ports import ContentBaselineError
from metriccanvas_authoring.application.lifecycle_ports import LifecycleError
from metriccanvas_authoring.application.authoring_turns import TURN_VALIDATOR
from metriccanvas_authoring.application.lifecycle import VALIDATOR as COMMAND_VALIDATOR
from metriccanvas_authoring.domain.idempotency import canonical_json
from metriccanvas_authoring.domain.page_validation import validate_page_document
from metriccanvas_authoring.runtime_assets import bundle_root

_RECORD_KEYS = {'candidateRef', 'rootBinding', 'operationId', 'command', 'programToken', 'status', 'result'}
_SNAPSHOT_KEYS = {'formatVersion', 'recordVersion', 'commandSha256', 'record', 'control', 'saveReceipt', 'verificationState', 'previewState'}
_STATUSES = {'selected', 'sending', 'unknown', 'pending', 'saved', 'rejected', 'not-applied', 'unchanged'}
_TERMINAL = {'saved', 'rejected', 'not-applied', 'unchanged'}
_IMMUTABLE = ('candidateRef', 'rootBinding', 'operationId', 'command')
_CONTRACTS = bundle_root() / 'contracts/authored'
_TURN_SCHEMA = json.loads((_CONTRACTS / 'authoring-turn.schema.json').read_text())
_CANDIDATE_VALIDATOR = Draft202012Validator(json.loads((_CONTRACTS / 'authoring-candidate.schema.json').read_text()),
    registry=Registry().with_resource(_TURN_SCHEMA['$id'], Resource.from_contents(_TURN_SCHEMA)))


def _require(condition, code='EXECUTION_RECORD_INVALID'):
    if not condition: raise LifecycleError(code)


def _text(value):
    return isinstance(value, str) and bool(value) and len(value) <= 256


def _dump(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)


def _hash(value):
    return hashlib.sha256(canonical_json(value).encode('utf-8')).hexdigest()


def _key(key):
    _require(isinstance(key, tuple) and len(key) == 5 and all(_text(v) for v in key))
    return _dump(key)


def _record(key, value):
    _require(isinstance(value, dict) and set(value) == _RECORD_KEYS)
    b = value['rootBinding']
    _require(TURN_VALIDATOR.is_valid(b))
    _require(tuple(b[k] for k in ('actorId', 'workspaceId', 'runId', 'turnId', 'pageId')) == key)
    command = value['command']
    _require(COMMAND_VALIDATOR.is_valid(command) and command['kind'] == 'save')
    _require(command['context']['operationId'] == value['operationId'] and _text(value['candidateRef']))
    _require(command['context']['actorId'] == b['actorId'] and command['context']['workspaceId'] == b['workspaceId'])
    _require(command['context']['origin'].get('runId') == b['runId'] and command['pageId'] == b['pageId'] and command['base'] == b['baseRef'])
    _require(value['status'] in _STATUSES and (value['programToken'] is None or _text(value['programToken'])))
    _require(value['result'] is None or isinstance(value['result'], dict))
    _dump(value)


def _snapshot(key, value):
    _require(isinstance(value, dict) and set(value) == _SNAPSHOT_KEYS)
    _require(value['formatVersion'] == '1.0', 'EXECUTION_FORMAT_UNSUPPORTED')
    _require(type(value['recordVersion']) is int and value['recordVersion'] >= 1)
    _record(key, value['record'])
    _require(value['commandSha256'] == _hash(value['record']['command']))
    control = value['control']
    _require(isinstance(control, dict) and set(control) == {'cancelRequested', 'attemptIds', 'maxAttempts', 'deadlineEpochMs'})
    _require(type(control['cancelRequested']) is bool and type(control['maxAttempts']) is int and control['maxAttempts'] > 0)
    _require(control['deadlineEpochMs'] is None or type(control['deadlineEpochMs']) is int and control['deadlineEpochMs'] >= 0)
    attempts = control['attemptIds']
    _require(isinstance(attempts, list) and all(_text(v) for v in attempts) and len(attempts) == len(set(attempts)) and len(attempts) <= control['maxAttempts'])
    _require(value['verificationState'] in {'pending', 'verified'} and value['previewState'] in {'not-requested', 'failed', 'ready'})
    receipt = value['saveReceipt']
    _require(receipt is None or isinstance(receipt, dict))
    if receipt is not None:
        _require(receipt.get('operationId') == value['record']['operationId'] and receipt.get('status') == 'saved')
        ref = receipt.get('ref')
        _require(isinstance(ref, dict) and set(ref) == {'pageId', 'revisionId', 'resourceId'} and all(_text(v) for v in ref.values()))
        _require(ref['pageId'] == value['record']['rootBinding']['pageId'])
        _require('base' in receipt and receipt['base'] == value['record']['command']['base'])
        _require(isinstance(receipt.get('contentHash'), str) and re.fullmatch('[a-f0-9]{64}', receipt['contentHash']))
        _require(_text(receipt.get('canonicalization')) and type(receipt.get('revisionNumber')) is int and receipt['revisionNumber'] > 0)
    _require(value['verificationState'] != 'verified' or receipt is not None)
    _dump(value)


def _transition(old, new, *, compatibility=False):
    a, b = old['record'], new['record']
    _require(all(a[k] == b[k] for k in _IMMUTABLE) and old['commandSha256'] == new['commandSha256'], 'EXECUTION_IMMUTABLE')
    _require(a['programToken'] is None or a['programToken'] == b['programToken'], 'EXECUTION_IMMUTABLE')
    if a['status'] in _TERMINAL:
        retry = (not compatibility and a['status'] == 'not-applied' and b['status'] == 'sending'
                 and not new['control']['cancelRequested'] and isinstance(a['result'], dict) and a['result'].get('retrySafe') is True)
        evidence = not compatibility and a['status'] == 'not-applied' and b['status'] in {'not-applied', 'pending', 'unknown', 'saved', 'rejected'}
        _require(retry or evidence or (b['status'] == a['status'] and b['result'] == a['result']), 'EXECUTION_TERMINAL')
    x, y = old['control'], new['control']
    _require(x['maxAttempts'] == y['maxAttempts'] and x['deadlineEpochMs'] == y['deadlineEpochMs'], 'EXECUTION_IMMUTABLE')
    _require(not x['cancelRequested'] or y['cancelRequested'], 'EXECUTION_CONTROL_REGRESSION')
    _require(y['attemptIds'][:len(x['attemptIds'])] == x['attemptIds'], 'EXECUTION_CONTROL_REGRESSION')
    _require(old['saveReceipt'] is None or old['saveReceipt'] == new['saveReceipt'], 'EXECUTION_RECEIPT_IMMUTABLE')
    _require(old['verificationState'] != 'verified' or new['verificationState'] == 'verified', 'EXECUTION_VERIFICATION_REGRESSION')
    if new['saveReceipt'] is not None:
        _require(b['status'] not in {'selected', 'sending', 'rejected', 'not-applied', 'unchanged'}, 'EXECUTION_RECEIPT_IMMUTABLE')


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
                     and _hash(record['document']) == record['documentSha256']
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
            snapshot = {'formatVersion': '1.0', 'recordVersion': 1, 'commandSha256': _hash(record['command']),
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
            _snapshot(key, value); _transition(previous, value, compatibility=True)
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
            _transition(previous, value)
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
