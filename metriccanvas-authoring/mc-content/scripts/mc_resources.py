"""Read and verify a complete MC resource installation. No session state."""
import hashlib
import json
from pathlib import Path
import re


class ContentError(ValueError):
    def __init__(self, code, path='', message='', **facts):
        super().__init__(message or code)
        self.issue = {'code': code, 'path': path, 'message': message or code, **facts}


def digest(content):
    return hashlib.sha256(content).hexdigest()


def value_digest(value):
    return digest(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode())


def issue(code, path='', **facts):
    return {'code': code, 'path': path, **facts}


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
        hint = 'utf8-bom' if 'UTF-8 BOM' in str(error) else 'unreadable-resource'
        raise ContentError('CONTENT_RESOURCE_UNAVAILABLE', name, 'The installed JSON resource cannot be read.',
            hint=hint, action='Reinstall the complete verified archive without editing its files.') from error


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
    if manifest.get('contentVersion') != '1-' + manifest['contentSha256'][:16]:
        raise ContentError('CONTENT_MANIFEST_INVALID', 'contentVersion',
            'The content version does not match its manifest digest.', action='Regenerate and replace the complete package.')
    return files


# Process-local code identity is not workflow state. A live module must not consume replaced code.
LOADED_CODE = {file.name: digest(file.read_bytes()) for file in Path(__file__).resolve().parent.glob('*.py')}


def verify_file_set(root, files):
    names = [item['file'] for item in files]
    if len(names) != len(set(names)):
        raise ContentError('CONTENT_MANIFEST_INVALID')
    actual = {file.relative_to(root).as_posix() for file in root.rglob('*')
        if file.is_file() and '__pycache__' not in file.parts and file != root / 'mc-content.version.json'}
    if actual != set(names):
        missing, extra = sorted(set(names) - actual), sorted(actual - set(names))
        raise ContentError('CONTENT_RESOURCE_SET_MISMATCH', message='The installed package has missing or extra files.',
            missing=missing[:20], extra=extra[:max(0, 20 - len(missing[:20]))], missingCount=len(missing), extraCount=len(extra),
            truncated=len(missing) + len(extra) > 20, action='Install the verified archive in a new empty directory. Keep outputs outside it; preserve unknown extra files.')


def verify_loaded_code(root):
    for name, expected in LOADED_CODE.items():
        actual = digest(resource(root, 'scripts/' + name).read_bytes())
        if actual != expected:
            raise ContentError('CONTENT_CODE_VERSION_MISMATCH', name,
                'The loaded code differs from this installation. Reload all MC modules or start a new process.',
                expectedSha256=expected, actualSha256=actual,
                action='Start a new process using one complete verified version directory.')


def verify_clean_cache(root):
    caches = sorted(file.relative_to(root).as_posix() for file in (root / 'scripts').rglob('*.pyc'))
    if caches:
        raise ContentError('CONTENT_BYTECODE_PRESENT', 'scripts', 'The installation contains bytecode caches.',
            files=caches[:20], count=len(caches), truncated=len(caches) > 20,
            action='Install the verified archive in a new empty directory and disable bytecode writes before loading it.')


def change_hint(content, expected):
    if content.startswith(b'\xef\xbb\xbf') and digest(content[3:]) == expected:
        return 'utf8-bom'
    if digest(content.replace(b'\r\n', b'\n')) == expected:
        return 'line-endings'
    return 'changed-bytes'


def changed_files(root, files):
    changed, count = [], 0
    for item in files:
        file = resource(root, item['file'])
        content = file.read_bytes()
        actual = digest(content)
        if actual != item['sha256']:
            count += 1
            if len(changed) < 20:
                changed.append({'file': item['file'], 'expectedSha256': item['sha256'], 'actualSha256': actual,
                    'hint': change_hint(content, item['sha256'])})
    if count:
        raise ContentError('CONTENT_RESOURCE_MISMATCH', changed[0]['file'], 'Installed resource bytes differ from the release.',
            changed=changed, changedCount=count, truncated=count > 20,
            action='Reinstall the complete verified archive without newline conversion. Do not patch digest or rewrite the installed manifest.')


def verify_alignment(root, manifest):
    if digest(resource(root, 'mc-closed-sets/snapshot.json').read_bytes()) != manifest.get('snapshotSha256'):
        raise ContentError('CONTENT_SNAPSHOT_MISMATCH')
    if read_json(root, 'runtime/contract-alignment.json') != manifest.get('alignedWith'):
        raise ContentError('CONTENT_ALIGNMENT_MISMATCH')


def verify_package(root=None):
    root = package_root(root)
    try:
        verify_clean_cache(root)
        manifest = read_json(root, 'mc-content.version.json')
        files = manifest_files(manifest)
        verify_file_set(root, files)
        verify_loaded_code(root)
        changed_files(root, files)
        verify_alignment(root, manifest)
        return root, manifest
    except OSError as error:
        raise ContentError('CONTENT_RESOURCE_UNAVAILABLE', message='Installed files cannot be read.',
            action='Check installation file access or reinstall the complete verified archive.') from error


def diagnose_package(root=None):
    root = package_root(root)
    try:
        verify_clean_cache(root)
        manifest = read_json(root, 'mc-content.version.json')
        files = manifest_files(manifest)
        verify_file_set(root, files)
        changed_files(root, files)
        verify_loaded_code(root)
        verify_alignment(root, manifest)
        return {'status': 'ok', 'contentVersion': manifest['contentVersion'], 'contentSha256': manifest['contentSha256'],
            'issues': [], 'scope': 'disk files and loaded-module baseline; not authentication or deployment'}
    except (ContentError, OSError) as error:
        diagnostic = error.issue if isinstance(error, ContentError) else issue('CONTENT_RESOURCE_UNAVAILABLE', message='Installed files cannot be read.', action='Check file access or reinstall the verified archive.')
        return {'status': 'invalid', 'issues': [diagnostic]}


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



def canonical_key(index, topic, key):
    entries = index.get(topic)
    if entries is None:
        raise ContentError('CONTENT_TOPIC_UNKNOWN', topic)
    if key in entries:
        return key
    candidates = [name for name in entries if '/' not in key and name.rsplit('/', 1)[-1] == key]
    if len(candidates) == 1:
        return candidates[0]
    error = ContentError('CONTENT_KEY_AMBIGUOUS' if candidates else 'CONTENT_KEY_UNKNOWN',
                         f'{topic}/{key}', 'Use a canonical key returned by query_content(index, topic).')
    error.issue['candidates'] = candidates[:20]
    error.issue['truncated'] = len(candidates) > 20
    raise error


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
    if 'pointer' in options:
        from mc_schema_selection import schema_selection
        schema = content.get('inputSchema') if topic == 'tool' else content
        content = schema_selection(schema, options['pointer'])
    elif topic == 'tool' and not options.get('includeSchema', False):
        content = {k: v for k, v in content.items() if k not in {'requestSchema', 'inputSchema'}}
    return content, file


def node_content(root, key):
    from mc_runtime import run_node
    return run_node([str(resource(root, 'scripts/read-knowledge.mjs'))],
        {'pointers': [key]}, failure_code='CONTENT_NODE_UNKNOWN'), 'references/authoring-knowledge/model.json'


def query_content(topic, key='', options=None, *, root=None):
    root, manifest = verify_package(root)
    options = {} if options is None else options
    if not isinstance(topic, str) or not isinstance(key, str):
        raise ContentError('QUERY_ARGUMENTS_INVALID')
    if not isinstance(options, dict) or set(options) - {'maxBytes', 'includeSchema', 'offset', 'limit', 'pointer'}:
        raise ContentError('QUERY_OPTIONS_INVALID')
    if 'includeSchema' in options and type(options['includeSchema']) is not bool:
        raise ContentError('QUERY_OPTIONS_INVALID')
    if topic not in {'version', 'index', 'node'}:
        key = canonical_key(read_json(root, 'index.json'), topic, key)
    content, file = node_content(root, key) if topic == 'node' else atom_content(root, manifest, topic, key, options)
    budget = options.get('maxBytes', 32768)
    if type(budget) is not int or not 128 <= budget <= 4 * 1024 * 1024:
        raise ContentError('QUERY_OPTIONS_INVALID')
    size = len(json.dumps(content, ensure_ascii=False).encode())
    return {'topic': topic, 'key': key, 'content': content if size <= budget else None,
        'truncated': size > budget, 'requiredBytes': size, 'source': file,
        'contentSha256': manifest['contentSha256'], 'cached': False,
        'continuation': {'topic': topic, 'key': key, 'options': {**options, 'maxBytes': min(4 * 1024 * 1024, max(size, budget))}},
        'note': 'Oversized atoms are withheld intact. Increase maxBytes or page the index; no partial contract is represented as complete.'}
