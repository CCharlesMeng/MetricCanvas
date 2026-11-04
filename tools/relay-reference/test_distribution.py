"""Real product probes in a clean non-repository directory with preinstalled deps."""
from __future__ import annotations
from copy import deepcopy
import json
import importlib.metadata
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

from compatibility import compare
from export import build
from relay_content import annotate
from release import canonical, read_json, seal, verify

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
MODULES = ("metriccanvas_authoring.data.product_operations", "metriccanvas_authoring.pages.product_operations",
           "metriccanvas_authoring.work.product_operations")


class DistributionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sandbox = tempfile.TemporaryDirectory(prefix="mc-four-artifacts-test-")
        cls.external = Path(cls.sandbox.name)
        cls.node = cls.external / "node-build"
        script = """import {exportRelayReference} from './tools/scripts/export-relay-reference.ts';
        await exportRelayReference(process.cwd(),process.argv[1],'0.1.0',process.argv.slice(2));"""
        cls.candidate = cls.external / "candidate"
        subprocess.run(["node", "--import", "tsx", "--input-type=module", "-e", script,
                        str(cls.candidate), *MODULES], cwd=ROOT, check=True, capture_output=True, timeout=120,
                        env={**os.environ, "METRICCANVAS_PYTHON": sys.executable})
        cls.frozen = read_json(HERE / "fixtures/frozen-page.json")

    @classmethod
    def tearDownClass(cls):
        cls.sandbox.cleanup()

    def cli(self, args, value=None, root=None, python_args=(), environment=None):
        env = {**os.environ, "PYTHONPATH": "", "NODE_PATH": "", "NODE_OPTIONS": "",
               "METRICCANVAS_BUNDLE_ROOT": "/does-not-exist", "METRICCANVAS_PRODUCT_ROOT": "/wrong"}
        env.update(environment or {})
        result = subprocess.run([sys.executable, "-I", "-B", *python_args,
            str((root or self.candidate) / "mc-tools/cli.py"), *args],
            input=None if value is None else canonical(value), capture_output=True,
            cwd=self.external, env=env, timeout=60)
        return result.returncode, json.loads(result.stdout)

    def invoke(self, operation, value, root=None):
        request = {"format": "metriccanvas-mc-request/1", "requestId": "frozen-consumer-1", "input": value}
        return self.cli(["invoke", operation], request, root)

    def test_real_facade_self_test_and_closed_inventory(self):
        self.assertEqual({p.name for p in self.candidate.iterdir()},
                         {"mc-content", "mc-content.md", "mc-tools", "mc-tools.md"})
        self.assertEqual(self.cli(["self-test"])[0], 0)
        code, interface = self.cli(["describe"])
        self.assertEqual(code, 0)
        old = read_json(HERE / "fixtures/consumer-0.1.0.json")["interface"]["operations"]
        self.assertTrue(set(old) <= set(interface["operations"]))
        self.assertEqual(verify(self.candidate)["manifest"]["runtime"]["dependencies"], {
            "attrs": "==26.1.0", "jsonschema": "==4.26.0", "jsonschema-specifications": "==2025.9.1",
            "referencing": "==0.37.0", "rpds-py": "==2026.6.3", "typing-extensions": "==4.16.0"})
        self.assertFalse(list(self.candidate.rglob("*.pyc")))
        self.assertFalse(list(self.candidate.rglob("node_modules")))

    def test_shared_installation_preserves_host_files_but_staging_remains_strict(self):
        installed = self.external / "shared-references"
        shutil.copytree(self.candidate, installed)
        host = installed / "relay-owned.md"
        host.write_bytes(b"Relay configuration\r\n")
        (installed / "relay-owned").mkdir()
        (installed / "relay-owned/cache.pyc").write_bytes(b"host-owned runtime data")
        expected = verify(self.candidate)["manifest"]
        self.assertEqual(verify(installed, installed=True)["manifest"], expected)
        self.assertEqual(self.cli(["check-release"], root=installed)[0], 0)
        self.assertEqual(self.cli(["self-test"], root=installed)[0], 0)
        self.assertEqual(host.read_bytes(), b"Relay configuration\r\n")
        with self.assertRaises(ValueError):
            verify(installed)

    def test_shared_installation_still_rejects_changes_inside_product_artifacts(self):
        installed = self.external / "shared-negative"
        shutil.copytree(self.candidate, installed)
        host = installed / "relay-owned.md"
        host.write_bytes(b"keep me")
        extra = installed / "mc-tools/unlisted.py"
        extra.write_bytes(b"unlisted product file")
        self.assertEqual(self.cli(["check-release"], root=installed)[0], 3)
        extra.unlink()
        guide = installed / "mc-tools.md"
        guide.write_bytes(guide.read_bytes().replace(b"\n", b"\r\n"))
        self.assertEqual(self.cli(["check-release"], root=installed)[0], 3)
        self.assertEqual(host.read_bytes(), b"keep me")

    def test_exported_example_request_executes_through_public_facade(self):
        index = read_json(self.candidate / "mc-tools/examples/index.json")
        entry = next(item for item in index["examples"]
                     if item["operation"] == "page.compose" and item["expectedStatus"] == "ok")
        request = read_json(self.candidate / "mc-tools" / entry["request"])
        code, result = self.cli(["invoke", entry["operation"]], request)
        self.assertEqual(code, 0, result)
        self.assertEqual(result["status"], entry["expectedStatus"])
        self.assertEqual(result["requestId"], request["requestId"])

    def test_archived_cli_uses_utf8_with_windows_legacy_locale(self):
        # Reproduce Windows' legacy defaults without changing explicit encodings.
        dependencies = self.external / "windows-dependencies"
        pins = verify(self.candidate)["manifest"]["runtime"]["dependencies"]
        self.copy_dependencies(pins, dependencies)
        bootstrap = (
            "import functools,pathlib,runpy,subprocess,sys;"
            "pathlib.Path.read_text=functools.partialmethod(pathlib.Path.read_text,encoding='cp1252');"
            "subprocess._text_encoding=lambda:'cp1252';"
            "sys.path.insert(0,sys.argv[1]);sys.argv=sys.argv[2:];"
            "runpy.run_path(sys.argv[0],run_name='__main__')"
        )
        result = subprocess.run([sys.executable, "-I", "-S", "-B", "-c", bootstrap, str(dependencies),
                                 str(self.candidate / "mc-tools/cli.py"), "self-test"],
                                capture_output=True, cwd=self.external, timeout=120)
        self.assertEqual(result.returncode, 0, result.stdout.decode("utf-8"))
        receipt = json.loads(result.stdout)
        self.assertEqual(receipt["status"], "ok")
        self.assertTrue(all(check["passed"] for check in receipt["checks"]))

    def test_frozen_page_read_validate_upgrade_parameters(self):
        document = deepcopy(self.frozen)
        for operation in ("page.project", "page.validate"):
            code, receipt = self.invoke(operation, {"document": document})
            self.assertEqual(code, 0, receipt)
            self.assertEqual(receipt["requestId"], "frozen-consumer-1")
        code, result = self.invoke("page.upgrade", {"document": document})
        self.assertEqual(code, 0, result)
        self.assertEqual(result["data"]["document"]["schemaVersion"],
                         verify(self.candidate)["manifest"]["defaultPageSchema"])
        code, result = self.invoke("page.parameters", {"action": "resolve", "document": document})
        self.assertEqual(code, 0, result)
        self.assertEqual(document, self.frozen)

    def test_product_rejection_and_request_validation(self):
        code, receipt = self.invoke("page.validate", {"document": None})
        self.assertEqual(code, 2)
        self.assertTrue(receipt["diagnostics"])
        self.assertEqual(self.invoke("page.unknown", {})[0], 2)
        code, receipt = self.cli(["invoke", "page.validate"], {"format": "wrong"})
        self.assertEqual(code, 2)
        self.assertEqual(receipt["diagnostics"][0]["code"], "PRODUCT_REQUEST_INVALID")

    def test_missing_dependencies_and_missing_files_are_environment_errors(self):
        self.assertEqual(self.cli(["describe"], python_args=("-S",))[0], 3)
        self.assertEqual(self.cli(["check-release"], python_args=("-S",))[0], 0)
        broken = self.external / "broken"
        shutil.copytree(self.candidate, broken)
        (broken / "mc-content/index.json").unlink()
        self.assertEqual(self.cli(["self-test"], root=broken)[0], 3)
        (broken / "mc-tools/_impl/product_runtime.py").unlink()
        code, result = self.cli(["self-test"], root=broken)
        self.assertEqual(code, 3)
        self.assertEqual(result["diagnostics"][0]["code"], "PRODUCT_ENTRY_UNAVAILABLE")

    def test_real_content_resource_and_budget(self):
        code, receipt = self.invoke("content.read", {"topic": "index", "key": "knowledge"})
        self.assertEqual(code, 0, receipt)
        self.assertTrue(receipt["data"]["content"])
        self.assertEqual(self.invoke("content.read", {"topic": "missing"})[0], 2)
        code, rejected = self.invoke("content.read", {"topic": "node", "key": "#/does-not-exist"})
        self.assertEqual(code, 2, rejected)
        descriptor = read_json(self.candidate / "mc-tools/interface.json")["operations"]["content.read"]
        self.assertIn(rejected["diagnostics"][0]["code"], descriptor["errorCodes"])

    def test_legacy_mcp_resources_are_marked_without_renaming_ids(self):
        index = read_json(self.candidate / "mc-content/index.json")
        original = read_json(ROOT / "metriccanvas-authoring/mc-content/index.json")
        expected = self.external / "legacy-content"
        shutil.copytree(ROOT / "metriccanvas-authoring/mc-content", expected)
        annotate(expected)
        for topic, entries in original.items():
            for key, path in entries.items():
                self.assertEqual(index[topic][key], path)
                if path in {"index.json", "mc-content.version.json"}:
                    continue
                self.assertEqual((self.candidate / "mc-content" / path).read_bytes(),
                                 (expected / path).read_bytes(), topic + ":" + key)
        self.assertEqual(index["runtime"]["offline-interface"], "runtime/offline-interface.json")
        for file in (self.candidate / "mc-content/tool-contracts").glob("*.json"):
            self.assertEqual(read_json(file)["referenceScope"]["executionOwner"], "Relay")
        behavior = (self.candidate / "mc-content/runtime/tool-behavior.md").read_text()
        self.assertTrue(behavior.startswith("> 迁移参考："))
        manifest = read_json(self.candidate / "mc-content/mc-content.version.json")
        self.assertTrue(manifest["relayProjection"]["annotatedFiles"])

    def test_frozen_query_result_compose_and_edit_chain(self):
        vector = read_json(HERE / "fixtures/frozen-normalize.json")
        original = deepcopy(vector["input"])
        code, result = self.invoke("results.normalize", vector["input"])
        self.assertEqual(code, 0, result)
        self.assertEqual(result["data"]["execution"], "not-run")
        source = result["data"]["sources"]["result"]
        rows = vector["input"]["executions"][0]["rows"]
        self.assertEqual(source["source"]["initial"]["rows"], rows)
        request = {"title": "冻结查询候选", "sources": {"result": "explicit-result"}, "sections": [
            {"id": "main", "pattern": "custom", "blocks": [{"id": "chart", "type": "data",
                "source": "result", "component": "barChart", "fields": list(source["fields"]), "title": "区域"}]}]}
        code, composed = self.invoke("page.compose", {"pageId": "frozen-result", "request": request,
            "resultRecords": {"result": {"source": source, "rows": rows, "totalCount": len(rows)}}})
        self.assertEqual(code, 0, composed)
        document = composed["data"]["document"]
        code, edited = self.invoke("page.edit", {"baseline": document, "resultRecords": {}, "request": {
            "operations": [{"id": "title", "type": "set_title", "componentId": "chart", "title": "已修改"}]}})
        self.assertEqual(code, 0, edited)
        self.assertEqual(edited["data"]["document"]["dataSources"], document["dataSources"])
        self.assertEqual(edited["data"]["saveStatus"], "not_requested")
        self.assertEqual(vector["input"], original)

    def test_two_compatible_updates_jump_and_explicit_rollback(self):
        versions = []
        for version in ("0.1.1", "0.1.2"):
            candidate = self.external / version
            shutil.copytree(self.candidate, candidate)
            guide = candidate / "mc-tools.md"
            guide.write_text(guide.read_text() + "\nCompatibility fixture " + version + "\n")
            self.reseal(candidate, version)
            versions.append(candidate)
        self.assertEqual(compare(self.candidate, versions[0])["status"], "ok")
        self.assertEqual(compare(versions[0], versions[1])["status"], "ok")
        self.assertEqual(compare(self.candidate, versions[1])["status"], "ok")
        self.assertEqual(compare(versions[1], self.candidate)["status"], "needs_migration")
        for candidate in [self.candidate, *versions, self.candidate]:
            self.assertEqual(self.invoke("page.validate", {"document": self.frozen}, candidate)[0], 0)

    def test_identical_source_exports_identical_paths_and_bytes(self):
        second = self.external / "second-export"
        script = """import {exportRelayReference} from './tools/scripts/export-relay-reference.ts';
        await exportRelayReference(process.cwd(),process.argv[1],'0.1.0',process.argv.slice(2));"""
        subprocess.run(["node", "--import", "tsx", "--input-type=module", "-e", script, str(second), *MODULES],
                       cwd=ROOT, env={**os.environ, "METRICCANVAS_PYTHON": sys.executable},
                       check=True, capture_output=True, timeout=120)
        self.assertEqual(verify(self.candidate)["manifest"], verify(second)["manifest"])
        for file in sorted(self.candidate.rglob("*")):
            if file.is_file():
                self.assertEqual(file.read_bytes(), (second / file.relative_to(self.candidate)).read_bytes())

    def test_offline_guards_block_actual_attempts(self):
        code = """import sys;sys.path.insert(0,sys.argv[1]);from product_runtime import offline_audit
import socket;sys.addaudithook(offline_audit);socket.create_connection(('127.0.0.1',9))"""
        python = subprocess.run([sys.executable, "-I", "-B", "-c", code,
            str(self.candidate / "mc-tools/_impl")], capture_output=True, cwd=self.external)
        self.assertNotEqual(python.returncode, 0)
        self.assertIn(b"PRODUCT_NETWORK_FORBIDDEN", python.stderr)
        node = subprocess.run(["node", "--import", str(self.candidate / "mc-tools/_impl/network_guard.mjs"),
            "--input-type=module", "-e", "import net from 'node:net';net.connect(9,'127.0.0.1')"],
            capture_output=True, cwd=self.external)
        self.assertNotEqual(node.returncode, 0)
        self.assertIn(b"PRODUCT_NETWORK_FORBIDDEN", node.stderr)

    def test_only_declared_initial_dependencies_without_site_packages(self):
        dependencies = self.external / "initial-dependencies"
        pins = verify(self.candidate)["manifest"]["runtime"]["dependencies"]
        self.copy_dependencies(pins, dependencies)
        bootstrap = """import runpy,sys;sys.path.insert(0,sys.argv[1]);sys.argv=sys.argv[2:];runpy.run_path(sys.argv[0],run_name='__main__')"""
        result = subprocess.run([sys.executable, "-I", "-S", "-B", "-c", bootstrap, str(dependencies),
            str(self.candidate / "mc-tools/cli.py"), "self-test"], cwd=self.external,
            env={**os.environ, "PYTHONPATH": "", "NODE_PATH": "", "NODE_OPTIONS": ""}, capture_output=True, timeout=60)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(json.loads(result.stdout)["status"], "ok")
        self.assertFalse((dependencies / "metriccanvas_authoring").exists())
        self.assertFalse((dependencies / "httpx").exists())
        self.assertFalse((dependencies / "fastmcp").exists())

    def copy_dependencies(self, names, target):
        for name in names:
            distribution = importlib.metadata.distribution(name)
            base = Path(distribution.locate_file("")).resolve()
            for file in distribution.files:
                source = Path(distribution.locate_file(file)).resolve()
                if not source.is_relative_to(base) or not source.is_file() or source.suffix == ".pyc":
                    continue
                destination = target / source.relative_to(base)
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, destination)

    def test_generated_programs_have_no_developer_absolute_paths(self):
        for file in self.candidate.rglob("*.mjs"):
            source = file.read_text()
            self.assertNotIn("/Users/moon/", source, str(file))
            self.assertNotIn("/var/folders/", source, str(file))
            self.assertNotIn("/private/var/folders/", source, str(file))

    def test_missing_node_is_an_environment_error(self):
        self.assertEqual(self.cli(["self-test"], environment={"PATH": "/not-a-runtime"})[0], 3)

    def test_evaluation_structure_semantics_and_process_timezone(self):
        document = read_json(HERE / "fixtures/frozen-temporal-page.json")
        code, missing = self.invoke("page.validate", {"document": document})
        self.assertEqual(code, 2)
        self.assertEqual(missing["diagnostics"][0]["code"], "EVALUATION_CONTEXT_REQUIRED")
        for evaluation in [None, {}, {"instant": "2026-01-01T00:00:00Z"},
            {"timeZone": "UTC"}, {"instant": "2026-01-01T00:00:00Z", "timeZone": "UTC", "extra": 1},
            {"instant": "2026-02-30T00:00:00Z", "timeZone": "UTC"},
            {"instant": "2026-01-01T00:00:00Z", "timeZone": "Not/AZone"}]:
            code, rejected = self.invoke("page.validate", {"document": document, "evaluation": evaluation})
            self.assertEqual(code, 2, rejected)
            self.assertEqual(rejected["diagnostics"][0]["code"], "INVALID_EVALUATION_CONTEXT")
        request = {"format": "metriccanvas-mc-request/1", "requestId": "frozen-clock", "input": {
            "document": document, "evaluation": {"instant": "2026-12-31T16:30:00Z", "timeZone": "Asia/Shanghai"}}}
        receipts = [self.cli(["invoke", "page.validate"], request, environment={"TZ": zone})
                    for zone in ("UTC", "Pacific/Honolulu", "Asia/Tokyo")]
        self.assertEqual(receipts[0], receipts[1])
        self.assertEqual(receipts[0], receipts[2])
        self.assertEqual(receipts[0][0], 0, receipts)

    def test_shared_evaluation_schema_is_inlined_from_one_build_output(self):
        interface = read_json(self.candidate / "mc-tools/interface.json")
        shared = read_json(self.candidate / "mc-tools/resources/contracts/exported/temporal-evaluation.schema.json")
        for name in ("page.compose", "page.edit", "receipt.check", "page.validate"):
            self.assertEqual(interface["operations"][name]["inputSchema"]["properties"]["evaluation"], shared)
        self.assertNotIn("evaluation", interface["operations"]["work.check"]["inputSchema"]["properties"])

    def test_python_bound_operations_reject_invalid_context_even_without_page_validation(self):
        for operation in ("page.compose", "page.edit", "receipt.check"):
            for evaluation in (None, {}, {"instant": "2026-01-01T00:00:00Z", "timeZone": "Not/AZone"}):
                code, result = self.invoke(operation, {"evaluation": evaluation})
                self.assertEqual(code, 2, result)
                self.assertEqual(result["diagnostics"][0]["code"], "INVALID_EVALUATION_CONTEXT")

    def test_success_data_is_checked_without_replacing_error_diagnostics(self):
        candidate = self.external / "output-contract-negative"
        shutil.copytree(self.candidate, candidate)
        target = candidate / "mc-tools/interface.json"
        interface = read_json(target)
        interface["operations"]["page.validate"]["outputSchema"] = {"type": "object", "required": ["missing-output"]}
        target.write_bytes(canonical(interface) + b"\n")
        self.reseal(candidate, "0.1.1")
        code, failure = self.invoke("page.validate", {"document": self.frozen}, candidate)
        self.assertEqual(code, 3)
        self.assertEqual(failure["diagnostics"][0]["code"], "PRODUCT_OUTPUT_INVALID")
        code, rejected = self.invoke("page.validate", {"document": None}, candidate)
        self.assertEqual(code, 2)
        self.assertTrue(rejected["diagnostics"])
        self.assertNotEqual(rejected["diagnostics"][0].get("code"), "PRODUCT_OUTPUT_INVALID")

    def test_internal_relocation_keeps_frozen_consumer(self):
        moved = self.external / "relocated"
        shutil.copytree(self.candidate, moved)
        (moved / "mc-tools/python").rename(moved / "mc-tools/product-python")
        runtime = moved / "mc-tools/_impl/product_runtime.py"
        runtime.write_text(runtime.read_text().replace('"python"', '"product-python"'))
        self.reseal(moved, "0.1.1")
        self.assertEqual(compare(self.candidate, moved)["status"], "ok")
        sample = next(item for item in read_json(moved / "mc-tools/_impl/self-tests.json") if item["operation"] == "page.compose")
        code, receipt = self.invoke("page.compose", sample["input"], moved)
        self.assertEqual(code, 0, receipt)

    def reseal(self, root, version):
        old = read_json(root / "mc-tools/release.json")
        metadata = {key: old[key] for key in ("releaseVersion", "resourceIndexVersion", "runtime",
                                              "pageSchemaVersions", "defaultPageSchema")}
        metadata["releaseVersion"] = version
        (root / "mc-tools/release.json").unlink()
        seal(root, metadata)


if __name__ == "__main__":
    unittest.main()
