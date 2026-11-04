"""Real Content reader tests for metadata routes, not product-operation stubs."""
from copy import deepcopy
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

from export import install_private
from interface_resources import publish_interface
from relay_content import annotate
from release import canonical, digest, read_json

ROOT = Path(__file__).resolve().parents[2]


class InterfaceResourceTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="offline-resource-metadata-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / "references"
        shutil.copytree(ROOT / "metriccanvas-authoring/mc-content", self.root / "mc-content")
        annotate(self.root / "mc-content")
        install_private(self.root)
        old = read_json(Path(__file__).with_name("fixtures") / "consumer-0.1.0.json")["interface"]
        self.interface = deepcopy(old)
        self.interface["version"] = "1.1.0"
        description = deepcopy(old["operations"]["page.validate"])
        description["errorCodes"] = ["NEW_METADATA_DIAGNOSTIC"]
        self.interface["operations"]["test.metadata.only"] = description
        (self.root / "mc-tools/interface.json").write_bytes(canonical(self.interface) + b"\n")

    def inventory(self):
        return {path.relative_to(self.root).as_posix(): digest(path.read_bytes())
                for path in self.root.rglob("*") if path.is_file()}

    def test_adds_real_lookup_routes_without_changing_existing_resources(self):
        before = self.inventory()
        index = read_json(self.root / "mc-content/index.json")
        publish_interface(self.root / "mc-content", self.interface)
        after = self.inventory()
        for name, checksum in before.items():
            if name not in {"mc-content/index.json", "mc-content/mc-content.version.json"}:
                self.assertEqual(after[name], checksum, name)
        projected = read_json(self.root / "mc-content/index.json")
        for topic, entries in index.items():
            for key, path in entries.items():
                self.assertEqual(projected[topic][key], path)
        self.assertEqual(projected["runtime"]["offline-interface"], "runtime/offline-interface.json")
        node = read_json(self.root / "mc-content" / projected["error"]["NEW_METADATA_DIAGNOSTIC"])
        self.assertEqual(node["operations"], ["test.metadata.only"])
        self.assertEqual(node["interfacePath"], "mc-tools/interface.json")
        summary = read_json(self.root / "mc-content/runtime/offline-interface.json")
        self.assertEqual(summary["legacyCoverage"]["scope"], "legacy MC/source graph")
        self.assertNotIn("inputSchema", summary["operations"]["page.validate"])

    def test_generated_metadata_is_byte_stable_and_reader_resolves_new_code(self):
        publish_interface(self.root / "mc-content", self.interface)
        first = self.inventory()
        publish_interface(self.root / "mc-content", self.interface)
        self.assertEqual(self.inventory(), first)
        bootstrap = ("import runpy,sys;sys.path.insert(0,sys.argv[1]);sys.argv=sys.argv[2:];"
                     "runpy.run_path(sys.argv[0],run_name='__main__')")
        scripts = self.root / "mc-content/scripts"
        child = subprocess.run([sys.executable, "-I", "-B", "-c", bootstrap, str(scripts), str(scripts / "mc_content.py"),
            "query", "--topic", "error", "--key", "NEW_METADATA_DIAGNOSTIC"], capture_output=True, timeout=30)
        self.assertEqual(child.returncode, 0, child.stdout + child.stderr)
        result = json.loads(child.stdout)
        self.assertFalse(result["truncated"])
        self.assertEqual(result["content"]["code"], "NEW_METADATA_DIAGNOSTIC")

    def test_operation_guide_is_bounded_and_does_not_embed_validation_schemas(self):
        publish_interface(self.root / "mc-content", self.interface)
        index = read_json(self.root / "mc-content/index.json")
        card = read_json(self.root / "mc-content" / index["runtime"]["operation.page.validate"])
        self.assertEqual(card["operation"], "page.validate")
        self.assertEqual(card["required"], self.interface["operations"]["page.validate"]["inputSchema"]["required"])
        self.assertEqual(card["schemas"]["input"], "#/operations/page.validate/inputSchema")
        self.assertNotIn("inputSchema", card)
        self.assertNotIn("definitions", card)
        self.assertLess(len(canonical(card)), 2048)


if __name__ == "__main__":
    unittest.main()
