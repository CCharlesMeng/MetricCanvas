"""Inventory closure across legacy and owner-scoped Bundle locks."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from metriccanvas_authoring.bundle_lock import load_bundle_lock, resolve_bundle_lock


def encoded(value):
    return json.dumps(value).encode()


def entry(name, content):
    return {'file': name, 'sha256': hashlib.sha256(content).hexdigest()}


def split_files():
    payload = b'validator'
    artifact = entry('scripts/page-validation-bridge.mjs', payload)
    identity = {'lockVersion': 2, 'bundleVersion': 'test', 'pageSchemaVersion': '6.114'}
    group = encoded({**identity, 'artifacts': [artifact]})
    reference = {**entry('bundle-locks/runtime.json', group), 'id': 'runtime'}
    root = encoded({**identity, 'groups': [reference]})
    return {'bundle.lock.json': root, reference['file']: group, artifact['file']: payload}


def resolve(files):
    return resolve_bundle_lock(files['bundle.lock.json'], files.__getitem__)


class BundleLockTest(unittest.TestCase):
    def test_legacy_and_split_have_the_same_resource_inventory(self):
        files = split_files()
        result = resolve(files)
        self.assertEqual(result['artifacts'], [entry('bundle-locks/runtime.json', files['bundle-locks/runtime.json']),
            entry('scripts/page-validation-bridge.mjs', b'validator')])
        flat = encoded({'artifacts': result['artifacts']})
        self.assertEqual(resolve_bundle_lock(flat, files.__getitem__)['artifacts'], result['artifacts'])

    def test_shard_is_required_and_its_bytes_are_verified_before_use(self):
        files = split_files()
        del files['bundle-locks/runtime.json']
        with self.assertRaises(KeyError):
            resolve(files)
        files['bundle-locks/runtime.json'] = b'{}'
        with self.assertRaisesRegex(ValueError, 'digest mismatch'):
            resolve(files)

    def test_duplicate_paths_versions_and_recursive_shards_are_rejected(self):
        for mutation in ('duplicate', 'version', 'recursive'):
            with self.subTest(mutation=mutation):
                files = split_files()
                group = json.loads(files['bundle-locks/runtime.json'])
                if mutation == 'duplicate':
                    group['artifacts'] *= 2
                elif mutation == 'version':
                    group['pageSchemaVersion'] = '6.113'
                else:
                    group['artifacts'] = [entry('bundle-locks/another.json', b'{}')]
                files['bundle-locks/runtime.json'] = encoded(group)
                root = json.loads(files['bundle.lock.json'])
                root['groups'][0]['sha256'] = hashlib.sha256(files['bundle-locks/runtime.json']).hexdigest()
                files['bundle.lock.json'] = encoded(root)
                with self.assertRaises(ValueError):
                    resolve(files)

    def test_unknown_version_ambiguous_shape_and_unsafe_paths_are_rejected(self):
        for value in ({'lockVersion': 3}, {'lockVersion': 2, 'artifacts': []},
                {'artifacts': [entry('../outside', b'a')]}, {'artifacts': [entry('C:/outside', b'a')]},
                {'artifacts': [entry('bundle.lock.json', b'a')]}):
            with self.subTest(value=value), self.assertRaises(ValueError):
                resolve_bundle_lock(encoded(value), lambda name: b'{}')

    def test_filesystem_loader_rejects_symlinked_shards(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            files = split_files()
            (root/'bundle.lock.json').write_bytes(files['bundle.lock.json'])
            (root/'bundle-locks').mkdir()
            (root/'actual.json').write_bytes(files['bundle-locks/runtime.json'])
            (root/'bundle-locks/runtime.json').symlink_to(root/'actual.json')
            with self.assertRaisesRegex(ValueError, 'Symlink'):
                load_bundle_lock(root)
