"""Resolve a complete Bundle inventory from legacy flat or SHA256-linked owner locks."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path, PurePosixPath
import re
from typing import Callable


def _path(value):
    if not isinstance(value, str) or not value:
        raise ValueError('Invalid bundle lock path')
    path = PurePosixPath(value)
    if not path.parts or path.is_absolute() or '..' in path.parts or str(path) != value or '\\' in value:
        raise ValueError('Unsafe bundle lock path: ' + value)
    if '.git' in path.parts or ':' in value:
        raise ValueError('Unsafe bundle lock path: ' + value)
    return value


def _entry(value, seen):
    if not isinstance(value, dict):
        raise ValueError('Invalid bundle lock entry')
    name = _path(value.get('file'))
    sha = value.get('sha256')
    if name == 'bundle.lock.json' or name in seen:
        raise ValueError('Duplicate or self-referencing bundle lock path: ' + name)
    if not isinstance(sha, str) or re.fullmatch('[0-9a-f]{64}', sha) is None:
        raise ValueError('Invalid bundle lock digest: ' + name)
    seen.add(name)
    return {'file': name, 'sha256': sha}


def _artifacts(lock, seen):
    values = lock.get('artifacts')
    if not isinstance(values, list):
        raise ValueError('Bundle lock artifacts must be an array')
    return [_entry(value, seen) for value in values]


def _group(index, reference, read, seen):
    entry = _entry(reference, seen)
    group_id = reference.get('id')
    if not isinstance(group_id, str) or re.fullmatch('[a-z0-9-]+', group_id) is None:
        raise ValueError('Invalid bundle lock group')
    if entry['file'] != f'bundle-locks/{group_id}.json':
        raise ValueError('Invalid bundle lock group path')
    content = read(entry['file'])
    if hashlib.sha256(content).hexdigest() != entry['sha256']:
        raise ValueError('Bundle group digest mismatch: ' + entry['file'])
    group = json.loads(content)
    if not isinstance(group, dict) or group.get('lockVersion') != 2 or 'groups' in group:
        raise ValueError('Invalid nested bundle lock')
    if any(group.get(key) != index.get(key) for key in ('bundleVersion', 'pageSchemaVersion')):
        raise ValueError('Bundle group version mismatch: ' + entry['file'])
    artifacts = _artifacts(group, seen)
    if any(item['file'].startswith('bundle-locks/') for item in artifacts):
        raise ValueError('Bundle groups cannot contain lock files')
    return [entry, *artifacts]


def resolve_bundle_lock(content: bytes, read: Callable[[str], bytes]) -> dict:
    """Validate every shard before returning the same flat inventory consumers expect."""
    lock = json.loads(content)
    if not isinstance(lock, dict):
        raise ValueError('Bundle lock must be an object')
    seen = set()
    version = lock.get('lockVersion', 1)
    if type(version) is not int:
        raise ValueError('Invalid bundle lock version')
    if version == 1 and 'groups' not in lock:
        return {**lock, 'artifacts': _artifacts(lock, seen)}
    if version != 2 or 'artifacts' in lock:
        raise ValueError('Unsupported or ambiguous bundle lock version')
    if any(not isinstance(lock.get(key), str) or not lock[key] for key in ('bundleVersion', 'pageSchemaVersion')):
        raise ValueError('Invalid bundle lock identity')
    groups = lock.get('groups')
    if not isinstance(groups, list) or not groups or len(groups) > 64:
        raise ValueError('Bundle groups must be a bounded nonempty array')
    artifacts = [item for group in groups for item in _group(lock, group, read, seen)]
    return {**lock, 'artifacts': artifacts}


def load_bundle_lock(root: Path) -> dict:
    root = root.resolve()
    def read(name):
        path = root / _path(name)
        if path.resolve() != path:
            raise ValueError('Symlink in bundle lock path: ' + name)
        return path.read_bytes()
    return resolve_bundle_lock(read('bundle.lock.json'), read)
