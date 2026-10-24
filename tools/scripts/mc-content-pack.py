"""Archive only a verified, staged MC tree; no runtime publication or adoption."""
import argparse
import gzip
import io
import json
from pathlib import Path
import shutil
import sys
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'metriccanvas-authoring/mc-content/scripts'))
from mc_resources import verify_package, digest


def pack(output):
    source, manifest = verify_package()
    output = Path(output).resolve()
    with tempfile.TemporaryDirectory(prefix='mc-release-') as folder:
        staged = Path(folder) / 'mc-content'
        shutil.copytree(source, staged, ignore=shutil.ignore_patterns('__pycache__'))
        verify_package(staged)
        with output.open('xb') as destination, gzip.GzipFile(fileobj=destination, mode='wb', filename='', mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode='w') as archive:
                for file in sorted(staged.rglob('*')):
                    if not file.is_file():
                        continue
                    content = file.read_bytes()
                    item = tarfile.TarInfo('mc-content/' + file.relative_to(staged).as_posix())
                    item.size, item.mode, item.mtime = len(content), 0o644, 0
                    archive.addfile(item, io.BytesIO(content))
    return {'archive': str(output), 'archiveSha256': digest(output.read_bytes()),
        'sourceRevision': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'uncommitted': bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True)),
        'contentSha256': manifest['contentSha256'], 'sourceIdentity': json.loads((source / 'runtime/source-identity.json').read_text()),
        'deployment': 'not_run; archive verifies local MC content only'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    report = pack(args.output)
    Path(args.output + '.release.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: value for key, value in report.items() if key != 'sourceIdentity'}))
