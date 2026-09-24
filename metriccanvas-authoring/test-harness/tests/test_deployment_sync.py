"""Behavior checks for destructive public updates and internal preservation."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

BUNDLE = Path(__file__).resolve().parents[2]
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
