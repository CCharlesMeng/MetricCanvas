"""SQLite atomic JSON records; authoring policy belongs to work/state.py.

Separate tables preserve every legacy candidate/execution record. Explicit host
construction only; no default global database or fallback identity.
"""
import json
import os
from pathlib import Path
import sqlite3


class SqlitePlatformState:
    def __init__(self, path):
        self.path = str(Path(path))
        fd = os.open(self.path, os.O_CREAT | os.O_RDWR, 0o600)
        os.close(fd)
        with sqlite3.connect(self.path) as db:
            db.execute('CREATE TABLE IF NOT EXISTS platform_state (namespace TEXT, key TEXT, version INTEGER NOT NULL, value TEXT NOT NULL, PRIMARY KEY(namespace,key))')

    async def read(self, namespace, key):
        with sqlite3.connect(self.path) as db:
            row = db.execute('SELECT version,value FROM platform_state WHERE namespace=? AND key=?', (namespace, key)).fetchone()
        return (row[0], json.loads(row[1])) if row else (0, None)

    async def compare_and_swap(self, namespace, key, version, value):
        encoded = json.dumps(value, ensure_ascii=False, allow_nan=False)
        with sqlite3.connect(self.path, timeout=5) as db:
            db.execute('BEGIN IMMEDIATE')
            if version == 0:
                result = db.execute('INSERT OR IGNORE INTO platform_state VALUES (?,?,1,?)', (namespace, key, encoded))
            else:
                result = db.execute('UPDATE platform_state SET version=version+1,value=? WHERE namespace=? AND key=? AND version=?', (encoded, namespace, key, version))
            return result.rowcount == 1
