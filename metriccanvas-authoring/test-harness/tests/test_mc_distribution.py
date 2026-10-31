"""Failure boundaries of the actual installed MC entrypoint and release archive."""
import importlib.util
import io
import json
import os
from pathlib import Path
import py_compile
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

BUNDLE = Path(__file__).resolve().parents[2]
REPO = BUNDLE.parent
CONTENT = BUNDLE / 'mc-content'
sys.path.insert(0, str(CONTENT / 'scripts'))
import mc_content as mc
from mc_resources import ContentError


def cli(root, *arguments, env=None, value=None):
    return subprocess.run([sys.executable, '-B', str(root / 'scripts/mc_content.py'), *arguments],
        input=value, capture_output=True, encoding='utf-8', env=env, timeout=30, check=False)


class DistributionTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='mc-distribution-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / '中文 安装'
        shutil.copytree(CONTENT, self.root, ignore=shutil.ignore_patterns('__pycache__'))

    def test_diagnostics_distinguish_missing_extra_and_transformed_bytes(self):
        (self.root / 'layouts/report.md').unlink()
        (self.root / '.DS_Store').write_bytes(b'finder')
        report = mc.diagnose_package(self.root)
        self.assertEqual(report['status'], 'invalid')
        facts = report['issues'][0]
        self.assertIn('layouts/report.md', facts['missing'])
        self.assertIn('.DS_Store', facts['extra'])
        self.assertIn('action', facts)

    def test_crlf_is_diagnosed_but_never_accepted(self):
        file = self.root / 'layouts/report.md'
        file.write_bytes(file.read_bytes().replace(b'\n', b'\r\n'))
        with self.assertRaises(ContentError):
            mc.query_content('version', root=self.root)
        report = mc.diagnose_package(self.root)
        self.assertEqual(report['issues'][0]['changed'][0]['hint'], 'line-endings')

    def test_manifest_identity_and_bom_have_actionable_errors(self):
        resource = self.root / 'layouts/report.md'
        content = resource.read_bytes()
        resource.write_bytes(b'\xef\xbb\xbf' + content)
        self.assertEqual(mc.diagnose_package(self.root)['issues'][0]['changed'][0]['hint'], 'utf8-bom')
        resource.write_bytes(content)
        path = self.root / 'mc-content.version.json'
        original = path.read_bytes()
        manifest = json.loads(original)
        manifest['contentVersion'] = '1-incorrect'
        path.write_text(json.dumps(manifest), encoding='utf-8')
        with self.assertRaises(ContentError):
            mc.verify_package(self.root)
        path.write_bytes(b'\xef\xbb\xbf' + original)
        self.assertEqual(mc.diagnose_package(self.root)['issues'][0]['hint'], 'utf8-bom')

    def test_node_uses_utf8_under_gbk_locale(self):
        with patch('locale.getencoding', return_value='cp936'):
            result = mc.query_content('node', '#/definitions/tableComponent', root=self.root)
        self.assertGreater(result['requiredBytes'], 0)

    def test_cli_error_is_utf8_even_with_legacy_stdout_encoding(self):
        result = cli(self.root, 'query', '--topic', 'layout', '--key', '不存在😀',
            env={**os.environ, 'PYTHONIOENCODING': 'cp936'})
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(result.stdout)['issues'][0]['path'], 'layout/不存在😀')

    def test_entry_refuses_timestamp_and_hash_bytecode_before_loading(self):
        for mode in py_compile.PycInvalidationMode:
            with self.subTest(mode=mode):
                script = self.root / 'scripts/mc_resources.py'
                py_compile.compile(str(script), doraise=True, invalidation_mode=mode)
                result = cli(self.root, 'verify')
                self.assertEqual(result.returncode, 1)
                self.assertEqual(json.loads(result.stdout)['issues'][0]['code'], 'CONTENT_BYTECODE_PRESENT')
                shutil.rmtree(script.parent / '__pycache__')

    def test_entry_rejects_preloaded_module_from_another_package(self):
        probe = ("import sys,types;from pathlib import Path;"
            "sys.path.insert(0,sys.argv[1]+'/scripts');"
            "m=types.ModuleType('mc_resources');m.__file__='/wrong/mc_resources.py';"
            "sys.modules['mc_resources']=m;import mc_content")
        result = subprocess.run([sys.executable, '-B', '-c', probe, str(self.root)],
            capture_output=True, encoding='utf-8', timeout=30, check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('CONTENT_MODULE_ORIGIN_MISMATCH', result.stderr)

    def test_missing_dependencies_and_node_are_structured(self):
        probe = ("import sys,json;sys.path.insert(0,sys.argv[1]+'/scripts');"
            "from mc_content import compile_layout;"
            "\ntry: compile_layout({})"
            "\nexcept Exception as e: print(json.dumps(e.issue))")
        result = subprocess.run([sys.executable, '-B', '-S', '-c', probe, str(self.root)],
            capture_output=True, encoding='utf-8', timeout=30, check=False)
        self.assertEqual(json.loads(result.stdout)['code'], 'CONTENT_DEPENDENCY_UNAVAILABLE')
        with patch.dict(os.environ, {'PATH': ''}):
            result = cli(self.root, 'upgrade', '--input', str(self.root / 'examples/business-report.json'))
        self.assertEqual(json.loads(result.stdout)['issues'][0]['code'], 'CONTENT_RUNTIME_UNAVAILABLE')

    def test_preflight_and_business_status_are_separate(self):
        report = mc.preflight('all', root=self.root)
        self.assertEqual(report['status'], 'ok', report)
        result = cli(self.root, 'compile', value='{}')
        self.assertEqual(result.returncode, 0)
        self.assertEqual(json.loads(result.stdout)['status'], 'invalid')

    def test_damaged_entry_code_returns_installation_recovery(self):
        (self.root / 'scripts/mc_resources.py').write_bytes(b'!invalid Python')
        result = cli(self.root, 'verify')
        self.assertEqual(json.loads(result.stdout)['issues'][0]['code'], 'CONTENT_ENTRY_UNAVAILABLE')
        self.assertEqual(result.returncode, 1)

    def test_node_timeout_and_invalid_json_are_environment_errors(self):
        from mc_runtime import run_node
        with self.assertRaises(ContentError) as failure:
            run_node(['-e', 'setTimeout(() => {}, 10000)'], timeout=0.1)
        self.assertEqual(failure.exception.issue['code'], 'CONTENT_RUNTIME_TIMEOUT')
        with self.assertRaises(ContentError) as failure:
            run_node(['-e', "process.stdout.write('not-json')"])
        self.assertEqual(failure.exception.issue['code'], 'CONTENT_RUNTIME_OUTPUT_INVALID')

    def test_diagnostics_bound_extra_file_samples(self):
        for index in range(25):
            (self.root / f'extra-{index}.txt').write_bytes(b'output')
        facts = mc.diagnose_package(self.root)['issues'][0]
        self.assertEqual(facts['extraCount'], 25)
        self.assertEqual(len(facts['extra']), 20)
        self.assertTrue(facts['truncated'])


class ReleaseTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('mc_release', REPO / 'tools/scripts/mc-content-pack.py')
        cls.release = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.release)

    def test_windows_promotion_uses_an_absent_target(self):
        with tempfile.TemporaryDirectory() as folder:
            staged, destination = Path(folder) / 'staged', Path(folder) / 'new-version'
            staged.mkdir()
            (staged / 'value').write_bytes(b'verified')
            rename = Path.rename
            def exclusive_rename(path, target):
                if target.exists():
                    raise FileExistsError('Windows rename requires an absent target')
                return rename(path, target)
            with patch.object(self.release.os, 'name', 'nt'), patch.object(Path, 'rename', exclusive_rename), patch.object(
                    Path, 'replace', side_effect=OSError('Windows directory replacement is unavailable')):
                self.release.promote_version(staged, destination)
            self.assertEqual((destination / 'value').read_bytes(), b'verified')

    def test_git_checkout_preserves_manifest_bytes_with_autocrlf_enabled(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / 'source'
            root.mkdir()
            subprocess.run(['git', 'init', str(root)], capture_output=True, check=True)
            (root / '.gitattributes').write_bytes((REPO / '.gitattributes').read_bytes())
            files = ['metriccanvas-authoring/mc-content/value.json', 'contracts/metriccanvas/value.json', 'tools/mc-content/value.md']
            content = '中文\nsecond line\n'.encode('utf-8')
            for name in files:
                file = root / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(content)
            subprocess.run(['git', '-C', str(root), '-c', 'core.autocrlf=false', 'add', '.'], capture_output=True, check=True)
            output = Path(folder) / 'checkout'
            subprocess.run(['git', '-C', str(root), '-c', 'core.autocrlf=true', 'checkout-index', '--all',
                '--prefix=' + output.as_posix() + '/'], capture_output=True, check=True)
            for name in files:
                self.assertEqual((output / name).read_bytes(), content)

    def test_existing_receipt_is_preserved_before_pack(self):
        with tempfile.TemporaryDirectory() as folder:
            archive = Path(folder) / 'mc.tar.gz'
            receipt = Path(str(archive) + '.release.json')
            receipt.write_bytes(b'existing')
            with self.assertRaises(ValueError):
                self.release.pack(archive)
            self.assertEqual(receipt.read_bytes(), b'existing')
            self.assertFalse(archive.exists())

    def test_publish_failure_does_not_leave_an_archive_without_receipt(self):
        with tempfile.TemporaryDirectory() as folder:
            archive = Path(folder) / 'staged.tar.gz'
            archive.write_bytes(b'staged')
            output = Path(folder) / 'output.tar.gz'
            receipt_path = Path(str(output) + '.release.json')
            original_open = Path.open
            def fail_receipt(path, *args, **kwargs):
                if path == receipt_path:
                    raise OSError('simulated receipt write failure')
                return original_open(path, *args, **kwargs)
            with patch.object(Path, 'open', fail_receipt):
                with self.assertRaises(OSError):
                    self.release.publish_files(archive, output, {})
            self.assertFalse(output.exists())
            self.assertFalse(receipt_path.exists())
            self.assertEqual(archive.read_bytes(), b'staged')

    def test_archive_roundtrip_corruption_and_source_identity(self):
        with tempfile.TemporaryDirectory() as folder:
            archive = Path(folder) / 'mc.tar.gz'
            receipt = self.release.pack(archive)
            self.assertTrue(self.release.verify_archive(archive, receipt)['verified'])
            destination = Path(folder) / 'new-version'
            self.release.install_archive(archive, receipt, destination)
            self.assertEqual(cli(destination, 'verify').returncode, 0)
            with self.assertRaises(ValueError):
                self.release.install_archive(archive, receipt, destination)
            with patch.dict(os.environ, {'GITHUB_SHA': '0' * 40}):
                with self.assertRaisesRegex(ValueError, 'CI SHA'):
                    self.release.verify_archive(archive, receipt)
            archive.write_bytes(archive.read_bytes() + b'corrupt')
            with self.assertRaises(ValueError):
                self.release.verify_archive(archive, receipt)

    def test_archive_extraction_rejects_unsafe_and_duplicate_entries(self):
        for names in [['mc-content/../escape'], ['mc-content/a', 'mc-content/a'], ['mc-content/C:drive'], ['mc-content/link']]:
            with self.subTest(names=names), tempfile.TemporaryDirectory() as folder:
                archive = Path(folder) / 'bad.tar.gz'
                with tarfile.open(archive, 'w:gz') as output:
                    for name in names:
                        entry = tarfile.TarInfo(name)
                        entry.size = 1
                        if name.endswith('link'):
                            entry.type, entry.linkname = tarfile.SYMTYPE, '../outside'
                        output.addfile(entry, io.BytesIO(b'x'))
                with self.assertRaises(ValueError):
                    self.release.extract_archive(archive, Path(folder) / 'installed')
