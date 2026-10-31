"""Pack, verify and install MC archives without publishing or choosing an active version."""
import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[2]
CONTENT = ROOT / 'metriccanvas-authoring/mc-content'
FORMAT = 'metriccanvas-mc-release/1'
sys.dont_write_bytecode = True


def digest(content):
    return hashlib.sha256(content).hexdigest()


def inventory(root):
    files = {}
    for file in sorted(root.rglob('*')):
        if file.is_symlink():
            raise ValueError('MC distribution contains a symlink')
        if file.is_dir():
            continue
        if not file.is_file() or file.suffix == '.pyc':
            raise ValueError('MC distribution contains bytecode or a special file')
        files[file.relative_to(root).as_posix()] = digest(file.read_bytes())
    return files


def run_mc(root, *args):
    result = subprocess.run([sys.executable, '-B', str(root / 'scripts/mc_content.py'), *args],
        capture_output=True, encoding='utf-8', timeout=90, check=False, cwd=root.parent)
    if result.returncode:
        raise ValueError('Installed MC command failed: ' + result.stdout[:1200])
    return json.loads(result.stdout)


def probe(root):
    checks = run_mc(root, 'preflight')
    if checks['status'] != 'ok':
        raise ValueError('Installed MC environment is unavailable')
    knowledge = run_mc(root, 'query', '--topic', 'knowledge', '--key', 'table.width')
    if knowledge['truncated'] or knowledge['content'] is None:
        raise ValueError('Installed knowledge probe returned an incomplete result')
    schema = run_mc(root, 'schema', '--input', str(root / 'examples/business-report.json'))
    if not schema['readable']:
        raise ValueError('Installed page example cannot be read')
    return ['verify', 'preflight:all', 'knowledge:table.width', 'schema:business-report']


def extract_archive(archive, destination):
    with tarfile.open(archive, 'r:gz') as source:
        seen = set()
        for member in source.getmembers():
            path = PurePosixPath(member.name)
            if (not member.isfile() or not path.parts or path.parts[0] != 'mc-content'
                    or path.is_absolute() or '..' in path.parts or str(path) != member.name
                    or '\\' in member.name or ':' in member.name or member.name.casefold() in seen):
                raise ValueError('Invalid MC archive entry')
            seen.add(member.name.casefold())
            target = destination.joinpath(*path.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('xb') as output:
                shutil.copyfileobj(source.extractfile(member), output)
    return destination / 'mc-content'


def check_source(receipt):
    expected = os.environ.get('GITHUB_SHA')
    if expected and receipt['sourceRevision'] != expected:
        raise ValueError('MC release differs from CI SHA')
    if os.environ.get('GITHUB_ACTIONS') == 'true' and receipt['uncommitted']:
        raise ValueError('CI release source contains uncommitted changes')


def verify_tree(root, receipt):
    if inventory(root) != receipt['files']:
        raise ValueError('Installed MC files differ from release receipt')
    manifest = run_mc(root, 'verify')
    if (manifest['contentSha256'] != receipt['contentSha256']
            or manifest['contentVersion'] != receipt['contentVersion']
            or json.loads((root / 'runtime/source-identity.json').read_bytes()) != receipt['sourceIdentity']):
        raise ValueError('Installed MC identity differs from release receipt')
    return probe(root)


def verify_archive(archive, receipt):
    archive = Path(archive)
    if receipt.get('format') != FORMAT or digest(archive.read_bytes()) != receipt['archiveSha256']:
        raise ValueError('MC archive digest or receipt format mismatch')
    check_source(receipt)
    with tempfile.TemporaryDirectory(prefix='mc-installed-') as directory:
        root = extract_archive(archive, Path(directory))
        checks = verify_tree(root, receipt)
    return {'verified': True, 'contentSha256': receipt['contentSha256'], 'archiveSha256': receipt['archiveSha256'],
        'checks': checks, 'deployment': 'not_run'}


def write_archive(root, output):
    with output.open('xb') as destination, gzip.GzipFile(fileobj=destination, mode='wb', filename='', mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w') as archive:
            for relative in inventory(root):
                content = (root / relative).read_bytes()
                item = tarfile.TarInfo('mc-content/' + relative)
                item.size, item.mode, item.mtime = len(content), 0o644, 0
                archive.addfile(item, io.BytesIO(content))


def publish_files(archive, output, receipt):
    created = []
    try:
        with output.open('xb') as destination:
            created.append(output)
            receipt_path = Path(str(output) + '.release.json')
            with receipt_path.open('xb') as report:
                created.append(receipt_path)
                destination.write(archive.read_bytes())
                report.write((json.dumps(receipt, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))
    except BaseException:
        for path in created:
            path.unlink(missing_ok=True)
        raise


def pack(output):
    output = Path(output).absolute()
    receipt_path = Path(str(output) + '.release.json')
    if output.exists() or output.is_symlink() or receipt_path.exists() or receipt_path.is_symlink():
        raise ValueError('Release output or receipt already exists')
    run_mc(CONTENT, 'verify')
    with tempfile.TemporaryDirectory(prefix='mc-release-') as folder:
        staged = Path(folder) / 'mc-content'
        shutil.copytree(CONTENT, staged)
        manifest = run_mc(staged, 'verify')
        archive = Path(folder) / 'mc-content.tar.gz'
        write_archive(staged, archive)
        receipt = {'format': FORMAT, 'archive': str(output), 'archiveSha256': digest(archive.read_bytes()),
            'sourceRevision': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, encoding='utf-8').strip(),
            'uncommitted': bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, encoding='utf-8')),
            'contentSha256': manifest['contentSha256'], 'contentVersion': manifest['contentVersion'],
            'files': inventory(staged), 'sourceIdentity': json.loads((staged / 'runtime/source-identity.json').read_bytes()),
            'deployment': 'not_run; archive verifies local MC content only'}
        receipt['checks'] = verify_archive(archive, receipt)['checks']
        publish_files(archive, output, receipt)
    return receipt


def promote_version(staged, destination):
    if os.name == 'nt':
        # Windows rename refuses any existing target, including an empty directory.
        staged.rename(destination)
        return
    destination.mkdir()
    try:
        staged.replace(destination)
    except OSError:
        try:
            destination.rmdir()
        except OSError:
            pass
        raise


def install_archive(archive, receipt, destination):
    destination = Path(destination).absolute()
    if destination.exists() or destination.is_symlink():
        raise ValueError('Installation destination already exists; use a new version directory')
    verify_archive(archive, receipt)
    with tempfile.TemporaryDirectory(prefix='.mc-stage-', dir=destination.parent) as folder:
        staged = extract_archive(Path(archive), Path(folder))
        verify_tree(staged, receipt)
        if os.name == 'posix':
            for file in staged.rglob('*'):
                file.chmod(0o555 if file.is_dir() else 0o444)
        promote_version(staged, destination)
        if os.name == 'posix':
            destination.chmod(0o555)
    return {'installed': str(destination), 'contentSha256': receipt['contentSha256'],
        'readOnly': os.name == 'posix', 'permissionsAction': 'On Windows, configure a read-only deployment ACL.',
        'activation': 'caller-owned; start a new process and retain the previous version', 'deployment': 'not_run'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', nargs='?', choices=['pack', 'verify', 'install'], default='pack')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--archive', type=Path)
    parser.add_argument('--receipt', type=Path)
    parser.add_argument('--destination', type=Path)
    args = parser.parse_args()
    try:
        if args.operation == 'pack':
            if args.output is None:
                parser.error('--output is required')
            report = pack(args.output)
        else:
            if args.archive is None:
                parser.error('--archive is required')
            receipt = json.loads((args.receipt or Path(str(args.archive) + '.release.json')).read_bytes())
            if args.operation == 'install':
                if args.destination is None:
                    parser.error('--destination is required')
                report = install_archive(args.archive, receipt, args.destination)
            else:
                report = verify_archive(args.archive, receipt)
        print(json.dumps({key: value for key, value in report.items() if key not in {'sourceIdentity', 'files'}}, ensure_ascii=False))
        return 0
    except (OSError, ValueError, KeyError, tarfile.TarError, subprocess.SubprocessError) as error:
        print(json.dumps({'status': 'invalid', 'message': str(error)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    sys.exit(main())
