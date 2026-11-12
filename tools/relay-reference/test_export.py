"""Negative build gates use fixtures and do not advertise product operations."""
import hashlib
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest

from export import copy_lock_groups, resolved_descriptions, write_examples, write_json
from python_closure import closure
from release import ReleaseError, read_json


class ExportGates(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.relative = "mc-tools/resources/contracts/exported/temporal-evaluation.schema.json"
        self.module = SimpleNamespace(__name__="test.provider", SCHEMA_BINDINGS={"evaluation": "authoring.evaluation"},
            OPERATIONS={"test": {"inputSchema": {"properties": {"evaluation": {}, "arbitrary": {}}}}})

    def test_missing_shared_schema_is_rejected(self):
        with self.assertRaises(FileNotFoundError):
            resolved_descriptions(self.root, self.module)

    def test_unknown_schema_binding_is_rejected(self):
        self.module.SCHEMA_BINDINGS = {"evaluation": "unknown"}
        with self.assertRaises(ReleaseError) as raised:
            resolved_descriptions(self.root, self.module)
        self.assertEqual(raised.exception.code, "PRODUCT_SCHEMA_BINDING_UNKNOWN")

    def test_unresolved_declared_path_and_empty_shared_schema_are_rejected(self):
        write_json(self.root / self.relative, {})
        with self.assertRaises(ReleaseError):
            resolved_descriptions(self.root, self.module)
        write_json(self.root / self.relative, {"type": "object"})
        self.module.SCHEMA_BINDINGS = {"absent": "authoring.evaluation"}
        with self.assertRaises(ReleaseError) as raised:
            resolved_descriptions(self.root, self.module)
        self.assertEqual(raised.exception.code, "PRODUCT_SCHEMA_BINDING_UNRESOLVED")

    def test_only_declared_binding_is_resolved_and_its_digest_recorded(self):
        shared = {"type": "object", "required": ["instant", "timeZone"]}
        write_json(self.root / self.relative, shared)
        result = resolved_descriptions(self.root, self.module)
        self.assertEqual(result["test"]["inputSchema"]["properties"], {"evaluation": shared, "arbitrary": {}})
        self.assertEqual(self.module.OPERATIONS["test"]["inputSchema"]["properties"]["evaluation"], {})
        report = read_json(self.root / "mc-tools/_impl/schema-bindings.json")
        self.assertEqual(report[0]["operations"], ["test"])
        self.assertEqual(len(report[0]["sha256"]), 64)

    def test_online_python_dependency_is_rejected_without_importing_it(self):
        package = self.root / "metriccanvas_authoring"
        package.mkdir()
        (package / "online.py").write_text("import httpx\n")
        with self.assertRaises(ReleaseError) as raised:
            closure(self.root, ["metriccanvas_authoring.online"])
        self.assertEqual(raised.exception.code, "PRODUCT_IMPORT_FORBIDDEN")

    def test_public_examples_preserve_frozen_input_and_expected_diagnostic(self):
        samples = [{"operation": "page.validate", "input": {"document": None},
                    "expectedStatus": "error", "expectedDiagnostic": "SCHEMA_ERROR"}]
        write_examples(self.root, samples)
        index = read_json(self.root / "mc-tools/examples/index.json")
        entry = index["examples"][0]
        request = read_json(self.root / "mc-tools" / entry["request"])
        self.assertEqual(request, {"format": "metriccanvas-mc-request/1", "requestId": "example-0001",
                                   "input": {"document": None}})
        self.assertEqual(entry["operation"], "page.validate")
        self.assertEqual(entry["expectedStatus"], "error")
        self.assertEqual(entry["expectedDiagnostic"], "SCHEMA_ERROR")

    def test_validator_import_closure_includes_the_shared_lock_reader(self):
        root=Path(__file__).resolve().parents[2]/'metriccanvas-authoring/tool'
        files, _ = closure(root, ['metriccanvas_authoring.pages.validation.node_validator'])
        self.assertIn('metriccanvas_authoring.bundle_lock', files)


class BundleLockResources(unittest.TestCase):
    def test_copies_split_lock_closure_and_rejects_a_corrupted_shard(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);bundle=root/'source';target=root/'target'
            (bundle/'bundle-locks').mkdir(parents=True);target.mkdir()
            content=b'{"artifacts":[]}'
            (bundle/'bundle-locks/runtime.json').write_bytes(content)
            write_json(bundle/'bundle.lock.json',{'groups':[{'file':'bundle-locks/runtime.json','sha256':hashlib.sha256(content).hexdigest()}]})
            copy_lock_groups(bundle,target)
            self.assertEqual((target/'bundle-locks/runtime.json').read_bytes(),content)
            (bundle/'bundle-locks/runtime.json').write_bytes(b'changed')
            with self.assertRaises(ReleaseError):copy_lock_groups(bundle,target)

    def test_group_reference_cannot_escape_the_resource_target(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);bundle=root/'source';target=root/'target'
            bundle.mkdir();target.mkdir();content=b'{}'
            (bundle/'group.json').write_bytes(content)
            write_json(bundle/'bundle.lock.json',{'groups':[{'file':'../source/group.json','sha256':hashlib.sha256(content).hexdigest()}]})
            with self.assertRaises(ReleaseError):copy_lock_groups(bundle,target)


if __name__ == "__main__":
    unittest.main()
