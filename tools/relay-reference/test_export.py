"""Negative build gates use fixtures and do not advertise product operations."""
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest

from export import resolved_descriptions, write_json
from python_closure import closure
from release import ReleaseError, read_json


class ExportGates(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.relative = "mc-tool/resources/contracts/exported/temporal-evaluation.schema.json"
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
        report = read_json(self.root / "mc-tool/_impl/schema-bindings.json")
        self.assertEqual(report[0]["operations"], ["test"])
        self.assertEqual(len(report[0]["sha256"]), 64)

    def test_online_python_dependency_is_rejected_without_importing_it(self):
        package = self.root / "metriccanvas_authoring"
        package.mkdir()
        (package / "online.py").write_text("import httpx\n")
        with self.assertRaises(ReleaseError) as raised:
            closure(self.root, ["metriccanvas_authoring.online"])
        self.assertEqual(raised.exception.code, "PRODUCT_IMPORT_FORBIDDEN")


if __name__ == "__main__":
    unittest.main()
