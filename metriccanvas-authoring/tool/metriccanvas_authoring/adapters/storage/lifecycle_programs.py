"""Explicit local durable adapters; never selected by production configuration.

Transactions serialize local state only. They cannot establish Relay authority,
remote save idempotency, or durability guarantees of the page service.
"""
from contextlib import contextmanager
import json
import os
from pathlib import Path
import sqlite3
import stat
from uuid import uuid4

from metriccanvas_authoring.assets.lifecycle_ports import LifecycleError
from metriccanvas_authoring.canonical import canonical_json


def _text(value):
    return isinstance(value, str) and bool(value.strip())


def _require(condition, code='EXECUTION_RECORD_INVALID'):
    if not condition: raise LifecycleError(code)


def _dump(value):
    """Persisted bytes: canonical, so a stored row reads back as the same value."""
    return canonical_json(value)


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
