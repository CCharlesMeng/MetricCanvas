"""Preview/apply a pinned Git snapshot, preserving internal adapters and local data.

Run from the trusted upstream snapshot. No network, git index, reset or checkout
mutation. All conflicts are checked before writes; rollback uses another ref.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import subprocess
import tarfile

INTERNAL = 'tool/metriccanvas_authoring/adapters'
TEMPLATE = 'examples/adapter_template'
PREFIX = 'metriccanvas-authoring/'


def digest(value):
    return hashlib.sha256(value).hexdigest()


def safe_name(name):
    path = PurePosixPath(name)
    if not name or path.is_absolute() or '..' in path.parts or any(part in {'.git', '.', '..'} for part in path.parts) or str(path) != name:
        raise ValueError(f'Unsafe public path: {name}')
    return name


def protected(name):
    return name == INTERNAL or name.startswith(INTERNAL + '/')


def entries(lock):
    result = {}
    for entry in lock['artifacts']:
        name = safe_name(entry['file'])
        if name in result:
            raise ValueError(f'Duplicate lock path: {name}')
        result[name] = entry['sha256']
    return result


def snapshot(repo, ref):
    commit = subprocess.check_output(['git', '-C', str(repo), 'rev-parse', '--verify', ref + '^{commit}'], text=True).strip()
    archive = subprocess.check_output(['git', '-C', str(repo), 'archive', commit, PREFIX.rstrip('/')])
    files = {}
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        for member in tar:
            if member.isdir():
                continue
            if not member.name.startswith(PREFIX):
                raise ValueError('Unexpected archive root')
            name = safe_name(member.name[len(PREFIX):])
            if protected(name):
                continue
            if not member.isfile():
                raise ValueError(f'Symlink/special file not supported: {name}')
            files[name] = tar.extractfile(member).read()
    lock = json.loads(files['bundle.lock.json'])
    names = entries(lock)
    if any(protected(name) for name in names):
        raise ValueError('Source predates adapter ownership; use a migrated release')
    for name, expected in names.items():
        if name not in files or digest(files[name]) != expected:
            raise ValueError(f'Upstream digest mismatch: {name}')
    ownership = json.loads(files['ownership.json'])
    if ownership['internalRoot'] != INTERNAL or ownership['templateRoot'] != TEMPLATE:
        raise ValueError('Unsupported ownership migration')
    selected = {name: files[name] for name in names}
    selected['bundle.lock.json'] = files['bundle.lock.json']
    return commit, selected


def target_path(root, name):
    safe_name(name)
    path = root / name
    for item in (path, *path.parents):
        if item.is_symlink():
            raise ValueError(f'Symlink in target path: {name}')
        if item != path and item.exists() and not item.is_dir():
            raise ValueError(f'Non-directory ancestor in target: {name}')
        if item == root:
            break
    return path


def initialize(root):
    """Create the whole adapter tree only when absent; never fill/overwrite owned files."""
    target = target_path(root, INTERNAL)
    if target.exists():
        return False
    template = root / TEMPLATE
    for source in sorted(template.rglob('*')):
        if source.is_symlink():
            raise ValueError('Adapter template contains a symlink')
        if not source.is_file() or '__pycache__' in source.parts or source.suffix == '.pyc':
            continue
        destination = target / source.relative_to(template)
        destination.parent.mkdir(parents=True, exist_ok=True)
        data = source.read_bytes()
        if source.suffix == '.py':
            data = data.replace(b'from adapter_template.', b'from metriccanvas_authoring.adapters.')
        destination.write_bytes(data)
    return True


def plan(root, incoming):
    target_path(root, INTERNAL)
    old_lock = target_path(root, 'bundle.lock.json')
    previous = entries(json.loads(old_lock.read_bytes())) if old_lock.exists() else {}
    previous = {name: sha for name, sha in previous.items() if not protected(name)}
    conflicts = []
    # Validate ALL tracked public files, even unchanged or deleted upstream.
    for name, expected in previous.items():
        path = target_path(root, name)
        if not path.is_file() or digest(path.read_bytes()) != expected:
            conflicts.append(name)
    changes, deletes = [], []
    for name, data in incoming.items():
        if protected(name):
            raise ValueError('Attempt to update internal adapters')
        path = target_path(root, name)
        temporary = path.with_name(path.name + '.sync-tmp')
        if temporary.exists() or temporary.is_symlink():
            conflicts.append(name + '.sync-tmp')
        if path.exists() and not path.is_file():
            conflicts.append(name)
        elif path.exists() and path.read_bytes() == data:
            continue
        elif path.exists() and name not in previous and name != 'bundle.lock.json':
            conflicts.append(name)
        changes.append(name)
    for name in previous.keys() - incoming.keys():
        deletes.append(name)
    if conflicts:
        raise ValueError('Public/local conflicts; no files changed: ' + ', '.join(sorted(set(conflicts))))
    return sorted(changes), sorted(deletes)


def apply(root, incoming, changes, deletes):
    # Recheck after preview and update the lock only after all public operations.
    if plan(root, incoming) != (changes, deletes):
        raise ValueError('Target changed since preview; rerun synchronization')
    def write(name):
        path = target_path(root, name)
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(path.name + '.sync-tmp')
        with temporary.open('xb') as handle:
            handle.write(incoming[name])
        temporary.replace(path)
    for name in changes:
        if name != 'bundle.lock.json':
            write(name)
    for name in deletes:
        target_path(root, name).unlink()
    initialize(root)
    if 'bundle.lock.json' in changes:
        write('bundle.lock.json')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, help='Upstream Git checkout (already fetched)')
    parser.add_argument('--ref', help='Pinned upstream commit/tag; required for synchronization')
    parser.add_argument('--target', type=Path, required=True, help='Destination metriccanvas-authoring directory')
    parser.add_argument('--apply', action='store_true', help='Without this flag, preview only')
    parser.add_argument('--init', action='store_true', help='Initialize adapters from templates without updating public files')
    args = parser.parse_args()
    root = args.target.absolute()
    if args.init:
        if args.apply:
            print('initialized' if initialize(root) else 'adapters already exist; preserved')
        else:
            print('Would initialize adapters only if absent; pass --apply')
        return
    if not args.source or not args.ref:
        parser.error('--source and --ref are required')
    commit, incoming = snapshot(args.source, args.ref)
    changes, deletes = plan(root, incoming)
    print(json.dumps({'upstreamCommit': commit, 'write': changes, 'delete': deletes,
                     'preserved': INTERNAL, 'applied': args.apply}, ensure_ascii=False, indent=2))
    if args.apply:
        apply(root, incoming, changes, deletes)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error)) from None
