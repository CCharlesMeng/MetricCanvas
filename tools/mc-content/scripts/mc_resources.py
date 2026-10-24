"""Read and verify a complete MC resource installation. No session state."""
import hashlib
import json
from pathlib import Path
import re


class ContentError(ValueError):
    def __init__(self, code, path='', message=''):
        super().__init__(message or code)
        self.issue = {'code': code, 'path': path, 'message': message or code}


def digest(content):
    return hashlib.sha256(content).hexdigest()


def package_root(root=None):
    return Path(root).resolve() if root is not None else Path(__file__).resolve().parents[1]


def resource(root, name):
    if not isinstance(name, str):
        raise ContentError('RESOURCE_PATH_INVALID')
    file = root / name
    if not file.resolve().is_relative_to(root) or file.is_symlink():
        raise ContentError('RESOURCE_PATH_INVALID', name)
    return file


def read_json(root, name):
    try:
        return json.loads(resource(root, name).read_text(encoding='utf-8'))
    except (OSError, ValueError) as error:
        raise ContentError('CONTENT_RESOURCE_UNAVAILABLE', name, str(error)) from error


def manifest_files(manifest):
    if not isinstance(manifest, dict) or manifest.get('interfaceVersion') != '1.0':
        raise ContentError('CONTENT_INTERFACE_UNSUPPORTED')
    files = manifest.get('files')
    if not isinstance(files, list) or not files:
        raise ContentError('CONTENT_MANIFEST_INVALID')
    for item in files:
        if not isinstance(item, dict) or not isinstance(item.get('file'), str):
            raise ContentError('CONTENT_MANIFEST_INVALID')
        if not re.fullmatch('[0-9a-f]{64}', str(item.get('sha256'))):
            raise ContentError('CONTENT_MANIFEST_INVALID')
    serialized = (json.dumps(files, ensure_ascii=False, indent=2) + '\n').encode()
    if digest(serialized) != manifest.get('contentSha256'):
        raise ContentError('CONTENT_MANIFEST_INVALID')
    return files


def verify_package(root=None):
    root = package_root(root)
    manifest = read_json(root, 'mc-content.version.json')
    files = manifest_files(manifest)
    names = [item['file'] for item in files]
    if len(names) != len(set(names)):
        raise ContentError('CONTENT_MANIFEST_INVALID')
    actual = {file.relative_to(root).as_posix() for file in root.rglob('*')
        if file.is_file() and '__pycache__' not in file.parts and file != root / 'mc-content.version.json'}
    if actual != set(names):
        raise ContentError('CONTENT_RESOURCE_SET_MISMATCH')
    for item in files:
        file = resource(root, item['file'])
        if not file.is_file() or digest(file.read_bytes()) != item['sha256']:
            raise ContentError('CONTENT_RESOURCE_MISMATCH', item['file'])
    if digest(resource(root, 'mc-closed-sets/snapshot.json').read_bytes()) != manifest.get('snapshotSha256'):
        raise ContentError('CONTENT_SNAPSHOT_MISMATCH')
    if read_json(root, 'runtime/contract-alignment.json') != manifest.get('alignedWith'):
        raise ContentError('CONTENT_ALIGNMENT_MISMATCH')
    return root, manifest


def index_page(index, key, options):
    entries = index.get(key)
    if entries is None:
        raise ContentError('CONTENT_TOPIC_UNKNOWN', key)
    offset, limit = options.get('offset', 0), options.get('limit', 30)
    if type(offset) is not int or type(limit) is not int or offset < 0 or not 1 <= limit <= 200:
        raise ContentError('QUERY_OPTIONS_INVALID')
    pairs = list(entries.items())
    return {'entries': dict(pairs[offset:offset + limit]), 'total': len(pairs),
        'nextOffset': offset + limit if offset + limit < len(pairs) else None}


def atom_content(root, manifest, topic, key, options):
    if topic == 'version':
        return {k: v for k, v in manifest.items() if k != 'files'}, 'mc-content.version.json'
    index = read_json(root, 'index.json')
    if topic == 'index':
        return index_page(index, key, options), 'index.json'
    file = index.get(topic, {}).get(key)
    if file is None:
        raise ContentError('CONTENT_KEY_UNKNOWN', f'{topic}/{key}')
    content = read_json(root, file) if file.endswith('.json') else resource(root, file).read_text(encoding='utf-8')
    if topic == 'tool' and not options.get('includeSchema', False):
        content = {k: v for k, v in content.items() if k != 'requestSchema'}
    return content, file


def query_content(topic, key='', options=None, *, root=None):
    root, manifest = verify_package(root)
    options = {} if options is None else options
    if not isinstance(topic, str) or not isinstance(key, str):
        raise ContentError('QUERY_ARGUMENTS_INVALID')
    if not isinstance(options, dict) or set(options) - {'maxBytes', 'includeSchema', 'offset', 'limit'}:
        raise ContentError('QUERY_OPTIONS_INVALID')
    if 'includeSchema' in options and type(options['includeSchema']) is not bool:
        raise ContentError('QUERY_OPTIONS_INVALID')
    content, file = atom_content(root, manifest, topic, key, options)
    budget = options.get('maxBytes', 32768)
    if type(budget) is not int or not 128 <= budget <= 4 * 1024 * 1024:
        raise ContentError('QUERY_OPTIONS_INVALID')
    size = len(json.dumps(content, ensure_ascii=False).encode())
    return {'topic': topic, 'key': key, 'content': content if size <= budget else None,
        'truncated': size > budget, 'requiredBytes': size, 'source': file,
        'contentSha256': manifest['contentSha256'], 'cached': False,
        'note': 'Oversized atoms are withheld intact. Increase maxBytes or page the index; no partial contract is represented as complete.'}
