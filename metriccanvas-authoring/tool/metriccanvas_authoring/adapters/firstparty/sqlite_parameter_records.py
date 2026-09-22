"""Durable immutable process records, separate from assets and authoring candidates.

The host owns the private database directory, encryption/backup policy and cleanup
of expired records. No file path or retention setting is accepted from the model.
"""
import json
import sqlite3
import os
from pathlib import Path


class SqliteParameterRecords:
    def __init__(self, path):
        path = Path(path)
        if not path.is_absolute() or path.is_symlink() or path.parent.stat().st_mode & 0o077:
            raise ValueError('Parameter records require a private absolute directory')
        fd = os.open(path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        try:
            if os.fstat(fd).st_mode & 0o077: raise ValueError('Parameter database must be private')
        finally:
            os.close(fd)
        self.path = str(path)
        with sqlite3.connect(self.path) as db:
            db.execute('CREATE TABLE IF NOT EXISTS parameter_records (ref TEXT PRIMARY KEY, payload TEXT NOT NULL)')

    async def put(self, record):
        with sqlite3.connect(self.path) as db:
            db.execute('INSERT INTO parameter_records VALUES (?, ?)',
                       (record['ref'], json.dumps(record, allow_nan=False)))

    async def get(self, ref):
        with sqlite3.connect(self.path) as db:
            row = db.execute('SELECT payload FROM parameter_records WHERE ref = ?', (ref,)).fetchone()
        return json.loads(row[0]) if row else None
