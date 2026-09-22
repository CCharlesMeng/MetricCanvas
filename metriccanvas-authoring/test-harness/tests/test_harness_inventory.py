from pathlib import Path
import importlib.util
import json
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('harness_runner', ROOT / 'run_tests.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class HarnessInventoryTest(unittest.TestCase):
    def test_every_test_is_classified_once(self):
        inventory = runner.read_inventory()
        self.assertEqual(set(inventory), set(runner.LAYERS))

    def test_new_deleted_and_duplicate_tests_fail_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'tests').mkdir()
            target = root / 'tests/test_example.py'
            target.write_text('')
            data = {'version': 1, 'layers': {layer: [] for layer in runner.LAYERS}}
            def write():
                (root / 'test-layers.json').write_text(json.dumps(data))
            write()
            with self.assertRaisesRegex(ValueError, 'unclassified'):
                runner.read_inventory(root)
            data['layers']['rules'] = ['tests/test_example.py']
            write()
            runner.read_inventory(root)
            data['layers']['delivery'] = ['tests/test_example.py']
            write()
            with self.assertRaisesRegex(ValueError, 'more than once'):
                runner.read_inventory(root)
            data['layers']['delivery'] = []
            target.unlink()
            write()
            with self.assertRaisesRegex(ValueError, 'missing'):
                runner.read_inventory(root)
