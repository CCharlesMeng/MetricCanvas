"""Pack and verify the complete standalone local-authoring Skill, without deployment."""
import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[2]
NAME = 'metriccanvas-local-authoring'
FORMAT = 'metriccanvas-skill-release/1'


def digest(content):
    return hashlib.sha256(content).hexdigest()


def inventory(folder):
    files = {}
    for file in sorted(folder.rglob('*')):
        if file.is_symlink():
            raise ValueError('Skill distribution contains a symlink')
        if file.is_dir():
            continue
        if not file.is_file():
            raise ValueError('Skill distribution contains a special file')
        files[file.relative_to(folder).as_posix()] = digest(file.read_bytes())
    return files


def check_tree(folder):
    files = inventory(folder)
    knowledge = json.loads((folder / 'references/knowledge.json').read_text())
    entries = knowledge['files']
    names = [entry['file'] for entry in entries]
    if len(names) != len(set(names)):
        raise ValueError('Duplicate knowledge manifest entries')
    for entry in entries:
        if files.get(entry['file']) != entry['sha256']:
            raise ValueError('Knowledge digest mismatch: ' + entry['file'])
    match = re.search(r'^  version: "([^"]+)"$', (folder / 'SKILL.md').read_text(), re.MULTILINE)
    if not match or knowledge['skill'] != NAME:
        raise ValueError('Invalid Skill identity or version')
    return files, {'skillVersion': match[1], 'schemaVersion': knowledge['schemaVersion'],
        'productVersion': knowledge['productContractVersion'],
        'knowledgeSha256': files['references/knowledge.json']}


def run_validator(folder, args, expected, cwd):
    result = subprocess.run(['node', str(folder / 'scripts/validate-page.mjs'), *args],
        cwd=cwd, text=True, capture_output=True, timeout=30, check=False)
    if result.returncode != expected:
        raise ValueError('Standalone validation failed: ' + result.stderr[:1000])
    return json.loads(result.stdout)


def probe(folder, schema):
    with tempfile.TemporaryDirectory(prefix='skill-consumer-') as directory:
        version = run_validator(folder, ['--version'], 0, directory)
        if version['schemaVersion'] != schema:
            raise ValueError('Validator and knowledge Schema versions differ')
        example = run_validator(folder, [str(folder / 'assets/layouts/overview-map-led.json')], 0, directory)
        invalid = Path(directory) / 'invalid.json'
        invalid.write_text('{}')
        rejected = run_validator(folder, [str(invalid)], 1, directory)
        if not example['ok'] or rejected['ok'] or not rejected['errors']:
            raise ValueError('Unexpected standalone validation receipt')
    return [{'command': 'node scripts/validate-page.mjs --version', 'exitCode': 0},
        {'command': 'node scripts/validate-page.mjs assets/layouts/overview-map-led.json', 'exitCode': 0},
        {'command': 'node scripts/validate-page.mjs <invalid-document>', 'exitCode': 1}]


def extract(archive, destination):
    with tarfile.open(archive, 'r:gz') as source:
        members = source.getmembers()
        seen = set()
        for member in members:
            path = PurePosixPath(member.name)
            if (not member.isfile() or path.is_absolute() or '..' in path.parts
                    or not path.parts or path.parts[0] != NAME or member.name in seen):
                raise ValueError('Invalid Skill archive entry')
            seen.add(member.name)
        source.extractall(destination, members=members, filter='data')


def verify_archive(archive, receipt):
    if receipt['format'] != FORMAT or receipt['skill'] != NAME or digest(archive.read_bytes()) != receipt['archiveSha256']:
        raise ValueError('Archive digest or receipt format mismatch')
    expected = os.environ.get('GITHUB_SHA')
    if expected and receipt['source']['commit'] != expected:
        raise ValueError('Downloaded release differs from CI SHA')
    if os.environ.get('GITHUB_ACTIONS') == 'true' and receipt['source']['uncommitted']:
        raise ValueError('CI release source contains uncommitted changes')
    with tempfile.TemporaryDirectory(prefix='skill-installed-') as directory:
        extract(archive, directory)
        folder = Path(directory) / NAME
        files, metadata = check_tree(folder)
        if files != receipt['files'] or metadata != receipt['metadata']:
            raise ValueError('Installed Skill differs from release receipt')
        checks = probe(folder, metadata['schemaVersion'])
    return {'verified': True, 'archiveSha256': receipt['archiveSha256'],
        'checks': checks, 'deployment': 'not_run'}


def write_archive(folder, output):
    with output.open('xb') as destination:
        with gzip.GzipFile(fileobj=destination, mode='wb', filename='', mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode='w') as archive:
                for relative in inventory(folder):
                    content = (folder / relative).read_bytes()
                    item = tarfile.TarInfo(NAME + '/' + relative)
                    item.size, item.mode, item.mtime = len(content), 0o644, 0
                    archive.addfile(item, io.BytesIO(content))


def revision(source):
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    if os.environ.get('GITHUB_SHA', commit) != commit:
        raise ValueError('CI SHA differs from checked out source')
    kind = 'repository-skill' if source == ROOT / 'metriccanvas-authoring/skill' / NAME else 'external-copy'
    dirty = kind == 'external-copy' or bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True))
    if os.environ.get('GITHUB_ACTIONS') == 'true' and dirty:
        raise ValueError('CI release source contains uncommitted changes')
    return {'commit': commit, 'uncommitted': dirty, 'kind': kind}


def pack(source, output):
    receipt_path = Path(str(output) + '.release.json')
    if output.exists() or receipt_path.exists():
        raise ValueError('Release output already exists')
    check_tree(source)
    with tempfile.TemporaryDirectory(prefix='skill-staged-') as directory:
        staged = Path(directory) / NAME
        shutil.copytree(source, staged)
        files, metadata = check_tree(staged)
        archive = Path(directory) / 'skill.tar.gz'
        write_archive(staged, archive)
        receipt = {'format': FORMAT, 'skill': NAME, 'source': revision(source),
            'metadata': metadata, 'files': files, 'archiveSha256': digest(archive.read_bytes()),
            'deployment': 'not_run'}
        receipt['checks'] = verify_archive(archive, receipt)['checks']
        with output.open('xb') as destination:
            destination.write(archive.read_bytes())
        with receipt_path.open('x') as destination:
            destination.write(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    return {'archive': str(output), 'receipt': str(receipt_path), 'metadata': metadata,
        'source': receipt['source'], 'archiveSha256': receipt['archiveSha256'], 'deployment': 'not_run'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    packing = commands.add_parser('pack')
    packing.add_argument('--source', type=Path, default=ROOT / 'metriccanvas-authoring/skill' / NAME)
    packing.add_argument('--output', type=Path, required=True)
    verification = commands.add_parser('verify')
    verification.add_argument('--archive', type=Path, required=True)
    verification.add_argument('--receipt', type=Path)
    args = parser.parse_args()
    try:
        if args.command == 'pack':
            report = pack(args.source.resolve(), args.output.resolve())
        else:
            receipt_path = args.receipt or Path(str(args.archive) + '.release.json')
            report = verify_archive(args.archive.resolve(), json.loads(receipt_path.read_text()))
        print(json.dumps(report, ensure_ascii=False))
        return 0
    except (OSError, ValueError, KeyError, tarfile.TarError, subprocess.SubprocessError) as error:
        print(json.dumps({'error': str(error)}), file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
