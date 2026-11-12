"""Behavior checks for destructive public updates and internal preservation."""
import importlib.util
from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

BUNDLE = Path(__file__).resolve().parents[2]
lock_spec = importlib.util.spec_from_file_location('bundle_lock', BUNDLE/'scripts/bundle_lock.py')
lock_module = importlib.util.module_from_spec(lock_spec)
lock_spec.loader.exec_module(lock_module)
sys.modules['bundle_lock'] = lock_module
spec = importlib.util.spec_from_file_location('sync_upstream', BUNDLE/'scripts/sync_upstream.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


def source_files(**files):
    data = {name: value.encode() for name, value in files.items()}
    data['ownership.json'] = json.dumps({'internalRoot':sync.INTERNAL,'templateRoot':sync.TEMPLATE}).encode()
    data[sync.TEMPLATE+'/factory.py'] = b'from adapter_template.relay import something\n'
    lock = {'artifacts':[{'file':name,'sha256':sync.digest(value)} for name,value in data.items()]}
    data['bundle.lock.json'] = json.dumps(lock).encode()
    return data


def install(root, incoming):
    changes, deletes = sync.plan(root, incoming)
    sync.apply(root, incoming, changes, deletes)


class SyncTest(unittest.TestCase):
    def test_cli_does_not_confirm_application_before_it_succeeds(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = io.StringIO()
            arguments = ['sync_upstream.py', '--source', tmp, '--ref', 'main', '--target', tmp, '--apply']
            with patch.object(sys, 'argv', arguments), patch.object(
                    sync, 'snapshot', return_value=('a' * 40, {})), patch.object(sync, 'apply', side_effect=ValueError('interrupted')):
                with redirect_stdout(output), self.assertRaises(ValueError):
                    sync.main()
            self.assertNotIn('"applied": true', output.getvalue())

    def test_interrupted_update_preserves_old_lock_and_reports_recovery(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            install(root, source_files(**{'a.py': 'old-a', 'b.py': 'old-b'}))
            old_lock = (root / 'bundle.lock.json').read_bytes()
            incoming = source_files(**{'a.py': 'new-a', 'b.py': 'new-b'})
            changes, deletes = sync.plan(root, incoming)
            replace = Path.replace
            def fail_second(path, target):
                if path.name == 'b.py.sync-tmp':
                    raise OSError('simulated disk interruption')
                return replace(path, target)
            with patch.object(Path, 'replace', fail_second):
                with self.assertRaises(ValueError) as failure:
                    sync.apply(root, incoming, changes, deletes)
            report = json.loads(str(failure.exception))
            self.assertEqual(report['completed'], ['a.py'])
            self.assertIn('b.py', report['pending'])
            self.assertEqual((root / 'bundle.lock.json').read_bytes(), old_lock)
            self.assertTrue((root / 'b.py.sync-tmp').exists())
            with self.assertRaisesRegex(ValueError, 'fresh sibling directory'):
                sync.plan(root, incoming)

    def test_upgrade_removes_retired_public_files_and_preserves_internal_exactly(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            install(root, source_files(**{'public.py':'old','retired.py':'retired'}))
            factory = root/sync.INTERNAL/'factory.py'
            self.assertIn('metriccanvas_authoring.adapters.relay', factory.read_text())
            factory.write_bytes(b'company code\x00\n')
            extra = root/sync.INTERNAL/'new.py'; extra.write_text('internal')
            runtime = root/'work.db'; runtime.write_text('untracked runtime')
            install(root, source_files(**{'public.py':'new'}))
            self.assertEqual(factory.read_bytes(), b'company code\x00\n')
            self.assertEqual(extra.read_text(), 'internal')
            self.assertEqual(runtime.read_text(), 'untracked runtime')
            self.assertFalse((root/'retired.py').exists())
            self.assertEqual((root/'public.py').read_text(), 'new')
            self.assertEqual(sync.plan(root, source_files(**{'public.py':'new'})), ([],[]))

    def test_public_modification_and_new_file_collision_stop_before_changes(self):
        for name in ('public.py','new.py'):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as tmp:
                root=Path(tmp); install(root, source_files(**{'public.py':'old'}))
                (root/name).write_text('company modification')
                before={str(p.relative_to(root)):p.read_bytes() for p in root.rglob('*') if p.is_file()}
                with self.assertRaisesRegex(ValueError,'conflicts'):
                    sync.plan(root, source_files(**{'public.py':'new','new.py':'upstream'}))
                self.assertEqual(before,{str(p.relative_to(root)):p.read_bytes() for p in root.rglob('*') if p.is_file()})

    def test_deleted_internal_file_is_not_reinitialized(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); data=source_files(**{'public.py':'old'}); install(root,data)
            (root/sync.INTERNAL/'factory.py').unlink()
            install(root,data)
            self.assertFalse((root/sync.INTERNAL/'factory.py').exists())

    def test_rejects_traversal_and_symlinks(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            for name in ('../escape','/absolute','.git/config'):
                with self.assertRaises(ValueError): sync.target_path(root,name)
            (root/'nested').symlink_to(root, target_is_directory=True)
            with self.assertRaises(ValueError): sync.plan(root, {'nested/file.py':b'bad'})

    def test_pinned_git_snapshot_checks_public_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo=Path(tmp)
            def git(*args):
                return subprocess.check_output(['git','-C',str(repo),*args],stderr=subprocess.DEVNULL,text=True).strip()
            git('init'); git('config','user.email','test@example.invalid'); git('config','user.name','Fixture')
            for name,data in source_files(**{'public.py':'original'}).items():
                target=repo/'metriccanvas-authoring'/name; target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(data)
            git('add','metriccanvas-authoring'); git('commit','-m','fixture'); original=git('rev-parse','HEAD')
            _, files=sync.snapshot(repo,original)
            self.assertEqual(files['public.py'],b'original')
            (repo/'metriccanvas-authoring/public.py').write_text('tampered')
            git('add','metriccanvas-authoring/public.py'); git('commit','-m','bad lock')
            with self.assertRaisesRegex(ValueError,'digest mismatch'): sync.snapshot(repo,'HEAD')
            self.assertEqual(sync.snapshot(repo,original)[1]['public.py'],b'original')

    def test_split_lock_sync_and_rollback_preserve_internal_files(self):
        from test_bundle_lock import split_files
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            legacy = source_files(**{'public.py': 'legacy'})
            install(root, legacy)
            internal = root / sync.INTERNAL / 'factory.py'
            original = internal.read_bytes()
            incoming = {**split_files(), 'ownership.json': legacy['ownership.json']}
            # Public ownership participates in the same signed inventory.
            group = json.loads(incoming['bundle-locks/runtime.json'])
            group['artifacts'].append({'file':'ownership.json','sha256':sync.digest(incoming['ownership.json'])})
            incoming['bundle-locks/runtime.json'] = json.dumps(group).encode()
            lock = json.loads(incoming['bundle.lock.json'])
            lock['groups'][0]['sha256'] = sync.digest(incoming['bundle-locks/runtime.json'])
            incoming['bundle.lock.json'] = json.dumps(lock).encode()
            install(root, incoming)
            self.assertEqual(internal.read_bytes(), original)
            self.assertTrue((root/'scripts/page-validation-bridge.mjs').is_file())
            install(root, legacy)
            self.assertEqual((root/'public.py').read_bytes(), b'legacy')
            self.assertFalse((root/'bundle-locks/runtime.json').exists())
            self.assertEqual(internal.read_bytes(), original)

    def test_pinned_git_snapshot_resolves_split_inventory_before_copying(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            data = source_files(**{'public.py': 'versioned'})
            group = json.dumps({'lockVersion':2,'bundleVersion':'test','pageSchemaVersion':'6.114',
                'artifacts':json.loads(data['bundle.lock.json'])['artifacts']}).encode()
            data['bundle-locks/distribution.json'] = group
            data['bundle.lock.json'] = json.dumps({'lockVersion':2,'bundleVersion':'test','pageSchemaVersion':'6.114',
                'groups':[{'id':'distribution','file':'bundle-locks/distribution.json','sha256':sync.digest(group)}]}).encode()
            for name, content in data.items():
                file=repo/'metriccanvas-authoring'/name
                file.parent.mkdir(parents=True,exist_ok=True);file.write_bytes(content)
            def git(*args):
                return subprocess.check_output(['git','-C',str(repo),*args],stderr=subprocess.DEVNULL)
            git('init');git('config','user.name','Bundle test');git('config','user.email','bundle@example.test')
            git('add','.');git('commit','-m','split lock')
            self.assertEqual(sync.snapshot(repo,'HEAD')[1],data)
            (repo/'metriccanvas-authoring/bundle-locks/distribution.json').write_bytes(b'{}')
            git('add','.');git('commit','-m','tampered shard')
            with self.assertRaisesRegex(ValueError,'digest mismatch'):
                sync.snapshot(repo,'HEAD')


class DeploymentFingerprintTest(unittest.TestCase):
    def test_actual_import_digest_drift_and_sensitive_files(self):
        from types import SimpleNamespace
        from unittest.mock import patch
        spec = importlib.util.spec_from_file_location('fingerprint', BUNDLE/'scripts/deployment_fingerprint.py')
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            installed = root/'installed.py'; installed.write_text('old package')
            source = root/'tool/metriccanvas_authoring/work/state.py'
            source.parent.mkdir(parents=True); source.write_text('expected package')
            skill = root/'skill/example/SKILL.md'; skill.parent.mkdir(parents=True); skill.write_text('skill')
            lock = {'bundleVersion': 'test', 'artifacts': [
                {'file': str(p.relative_to(root)), 'sha256': module.digest(p)} for p in (source, skill)]}
            (root/'bundle.lock.json').write_text(json.dumps(lock))
            adapter = root/'plugin'; adapter.mkdir()
            (adapter/'factory.py').write_text('private source')
            (adapter/'.env').write_text('SECRET token')
            (adapter/'work.db').write_text('SECRET rows')
            with patch.object(module, 'MODULES', ('metriccanvas_authoring.work.state',)), patch.object(
                    module.importlib.util, 'find_spec', return_value=SimpleNamespace(origin=str(installed.resolve()))):
                report = module.fingerprint(root, adapter)
                self.assertFalse(report['modules'][0]['matchesBundle'])
                self.assertEqual(report['modules'][0]['path'], str(installed.resolve()))
                self.assertEqual(report['bundleDrift'], [])
                self.assertEqual([f['file'] for f in report['adapter']['files']], ['factory.py'])
                self.assertNotIn('SECRET', json.dumps(report))
                self.assertNotIn('private source', json.dumps(report))
                skill.write_text('changed skill')
                report = module.fingerprint(root)
                self.assertEqual(report['bundleDrift'], [{'file': 'skill/example/SKILL.md', 'status': 'digest_mismatch'}])
