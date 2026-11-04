"""Release fixtures are deliberately not product distributions or Relay integration."""
from __future__ import annotations

from copy import deepcopy
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

from compatibility import compare
from release import (INTERFACE_FORMAT, MANIFEST, PUBLIC_PATHS, ReleaseError,
                     canonical, read_json, seal, verify)

CHECKER = Path(__file__).with_name("cli.py")
BASE_METADATA = {"releaseVersion": "1.0.0", "resourceIndexVersion": "1.0.0",
                 "runtime": {"python": ">=3.12", "node": ">=22", "dependencies": {}},
                 "pageSchemaVersions": ["6.80"], "defaultPageSchema": "6.80"}
# Independently authored old consumer contract; do not regenerate from new code.
OLD_OPERATION = {"inputSchema": {"type": "object", "required": ["document"],
                                "properties": {"document": {"type": "object"}}, "additionalProperties": False},
                 "outputSchema": {"type": "object", "required": ["valid"],
                                  "properties": {"valid": {"type": "boolean"}}, "additionalProperties": False},
                 "errorCodes": ["PAGE_INVALID"], "sideEffects": "none"}


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")


def fixture(root):
    (root / "mc-content").mkdir(parents=True)
    (root / "mc-tool").mkdir()
    (root / "mc-content.md").write_text("Resource guide\n")
    (root / "mc-tool.md").write_text("Tool guide\n")
    # Structural placeholder only; no real page operation is claimed here.
    (root / "mc-tool/cli.py").write_text("# structural release fixture\n")
    (root / "mc-content/page.md").write_text("Page resource\n")
    write_json(root / "mc-content/index.json", {"reference": {"page": "page.md"}})
    write_json(root / "mc-tool/interface.json", {"format": INTERFACE_FORMAT, "version": "1.0.0",
               "entrypoint": "mc-tool/cli.py", "publicPaths": sorted(PUBLIC_PATHS),
               "operations": {"validate": deepcopy(OLD_OPERATION)}})


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.current, self.candidate = self.root / "current", self.root / "candidate"
        fixture(self.current)
        fixture(self.candidate)
        seal(self.current, deepcopy(BASE_METADATA))
        self.metadata = {**deepcopy(BASE_METADATA), "releaseVersion": "1.0.1"}

    def interface(self, change):
        path = self.candidate / "mc-tool/interface.json"
        value = read_json(path)
        change(value)
        write_json(path, value)

    def outcome(self):
        seal(self.candidate, self.metadata)
        return compare(self.current, self.candidate)

    def test_manifest_is_reproducible_and_has_no_self_hash(self):
        one = seal(self.candidate, deepcopy(BASE_METADATA))
        self.assertEqual(one, verify(self.candidate)["manifest"])
        self.assertEqual(one, read_json(self.current / MANIFEST))
        self.assertEqual((self.candidate / MANIFEST).read_bytes(), (self.current / MANIFEST).read_bytes())
        self.assertNotIn(MANIFEST, one["files"])
        raw = {key: value for key, value in one.items() if key != "releaseId"}
        expected = hashlib.sha256(json.dumps(raw, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()
        self.assertEqual(expected, one["releaseId"])
        self.assertEqual(b'{"a":1,"b":2}', canonical({"b": 2, "a": 1}))

    def test_sealing_does_not_modify_inputs_or_overwrite_other_release(self):
        before = deepcopy(self.metadata)
        seal(self.candidate, self.metadata)
        self.assertEqual(before, self.metadata)
        (self.candidate / "mc-tool.md").write_text("Changed guide\n")
        with self.assertRaisesRegex(ReleaseError, "Existing manifest differs"):
            seal(self.candidate, self.metadata)

    def test_private_restructure_and_resource_relocation_allow_smoke(self):
        (self.candidate / "mc-tool/private-v2.py").write_text("# private implementation\n")
        (self.candidate / "mc-content/page.md").rename(self.candidate / "mc-content/internal-page.md")
        write_json(self.candidate / "mc-content/index.json", {"reference": {"page": "internal-page.md"}})
        result = self.outcome()
        self.assertTrue(result["eligibleForSmoke"])
        self.assertFalse(result["unchanged"])
        self.assertEqual([], result["details"])
        self.assertEqual(OLD_OPERATION, read_json(self.current / "mc-tool/interface.json")["operations"]["validate"])

    def test_new_operation_requires_minor_version_and_keeps_old_operation(self):
        self.interface(lambda value: value["operations"].update(inspect=deepcopy(OLD_OPERATION)))
        self.assertIn("minor version", self.outcome()["details"][0])
        (self.candidate / MANIFEST).unlink()
        self.interface(lambda value: value.update(version="1.1.0"))
        self.assertTrue(self.outcome()["eligibleForSmoke"])

    def test_removed_operation_and_changed_output_are_not_auto_compatible(self):
        changes = [lambda value: value["operations"].pop("validate"),
                   lambda value: value["operations"]["validate"]["outputSchema"].update(required=[]),
                   lambda value: value["operations"]["validate"]["inputSchema"]["properties"].update(optional={"type": "string"}),
                   lambda value: value["operations"]["validate"]["errorCodes"].append("NEW_ERROR")]
        for change in changes:
            with self.subTest(change=changes.index(change)):
                if (self.candidate / MANIFEST).exists():
                    (self.candidate / MANIFEST).unlink()
                original = read_json(self.current / "mc-tool/interface.json")
                write_json(self.candidate / "mc-tool/interface.json", original)
                self.interface(change)
                result = self.outcome()
                self.assertEqual("needs_migration", result["status"])
                self.assertIn("operation:validate", result["details"][0])

    def test_resource_and_public_alias_removal_require_migration(self):
        write_json(self.candidate / "mc-content/index.json", {"reference": {}})
        self.assertIn("resource:reference:page", self.outcome()["details"][0])
        (self.candidate / MANIFEST).unlink()
        # A removed optional public path is detected even if its file still exists.
        path = self.current / "mc-tool/interface.json"
        old = read_json(path)
        old["publicPaths"].append("mc-content/page.md")
        write_json(path, old)
        (self.current / MANIFEST).unlink()
        seal(self.current, deepcopy(BASE_METADATA))
        self.assertTrue(any("publicPaths" in reason for reason in self.outcome()["details"]))

    def test_runtime_schema_and_version_migrations(self):
        variants = [({"runtime": {**BASE_METADATA["runtime"], "node": ">=24"}}, "runtime"),
                    ({"runtime": {**BASE_METADATA["runtime"], "dependencies": {"jsonschema": "==4.26.0"}}}, "runtime"),
                    ({"defaultPageSchema": "6.81", "pageSchemaVersions": ["6.80", "6.81"]}, "defaultPageSchema"),
                    ({"releaseVersion": "0.9.0"}, "downgrade"),
                    ({"releaseVersion": "1.0.0"}, "immutable"),
                    ({"resourceIndexVersion": "2.0.0"}, "resourceIndexVersion")]
        (self.candidate / "mc-content.md").write_text("new guide\n")
        for overrides, reason in variants:
            with self.subTest(reason=reason):
                if (self.candidate / MANIFEST).exists():
                    (self.candidate / MANIFEST).unlink()
                self.metadata = {**deepcopy(BASE_METADATA), "releaseVersion": "1.0.1", **overrides}
                self.assertTrue(any(reason in item for item in self.outcome()["details"]))

    def test_major_change_and_removed_page_support_are_migrations(self):
        self.interface(lambda value: value.update(version="2.0.0"))
        self.assertTrue(any("interfaceVersion" in reason for reason in self.outcome()["details"]))
        (self.candidate / MANIFEST).unlink()
        self.metadata.update(pageSchemaVersions=["6.81"], defaultPageSchema="6.81")
        self.assertTrue(any("previous support" in reason for reason in self.outcome()["details"]))

    def test_integrity_detects_bytes_extra_files_and_manifest_tamper(self):
        seal(self.candidate, self.metadata)
        tests = [("mc-content/page.md", b"changed"), ("mc-tool/extra.py", b"extra")]
        for name, content in tests:
            with self.subTest(name=name):
                path = self.candidate / name
                previous = path.read_bytes() if path.exists() else None
                path.write_bytes(content)
                with self.assertRaises(ReleaseError):
                    verify(self.candidate)
                if previous is None:
                    path.unlink()
                else:
                    path.write_bytes(previous)
        manifest = read_json(self.candidate / MANIFEST)
        manifest["releaseId"] = "0" * 64
        write_json(self.candidate / MANIFEST, manifest)
        with self.assertRaises(ReleaseError):
            verify(self.candidate)

    def test_manifest_canonical_bytes_and_utf8_are_checked(self):
        seal(self.candidate, self.metadata)
        path = self.candidate / MANIFEST
        manifest = read_json(path)
        path.write_text(json.dumps(manifest, indent=2))
        with self.assertRaises(ReleaseError):
            verify(self.candidate)
        other = self.root / "utf16.json"
        other.write_bytes('{"valid":true}'.encode('utf-16'))
        with self.assertRaises(UnicodeError):
            read_json(other)

    def test_four_artifact_boundary_and_missing_resources(self):
        (self.candidate / "fifth-file.txt").write_text("not a delivery input")
        with self.assertRaises(ReleaseError):
            seal(self.candidate, self.metadata)
        (self.candidate / "fifth-file.txt").unlink()
        (self.candidate / "mc-content/page.md").unlink()
        with self.assertRaisesRegex(ReleaseError, "Resource missing"):
            seal(self.candidate, self.metadata)

    def test_symlinks_and_case_collisions_are_rejected(self):
        link = self.candidate / "mc-tool/link.py"
        link.symlink_to(self.current / "mc-tool/cli.py")
        with self.assertRaisesRegex(ReleaseError, "Symlink"):
            seal(self.candidate, self.metadata)
        link.unlink()
        interface = read_json(self.candidate / "mc-tool/interface.json")
        interface["publicPaths"].append("mc-content/Page.md")
        (self.candidate / "mc-content/Page.md").write_text("case duplicate")
        write_json(self.candidate / "mc-tool/interface.json", interface)
        # On case-insensitive macOS the write aliases page.md; the public path
        # still cannot claim both spellings. Case-sensitive hosts reject inventory.
        with self.assertRaises(ReleaseError):
            seal(self.candidate, self.metadata)

    def test_json_duplicate_nonfinite_and_cache_rejection(self):
        for source in ('{"x":1,"x":2}', '{"x":NaN}', '{"x":1e999}'):
            with self.subTest(source=source):
                path = self.root / "bad.json"
                path.write_text(source)
                with self.assertRaises(ReleaseError):
                    read_json(path)
        for name in ("mc-tool/__pycache__", "mc-content/.DS_Store", "mc-tool/cache.pyc"):
            with self.subTest(name=name):
                path = self.candidate / name
                path.write_text("not distributable")
                with self.assertRaises(ReleaseError):
                    seal(self.candidate, self.metadata)
                path.unlink()

    def test_cli_independent_cwd_and_stdlib_only_copy(self):
        checker = self.root / "checker"
        checker.mkdir()
        for name in ("cli.py", "release.py", "compatibility.py"):
            shutil.copyfile(CHECKER.parent / name, checker / name)
        program = checker / "cli.py"
        seal(self.candidate, self.metadata)
        result = subprocess.run([sys.executable, "-S", "-B", str(program), "compare",
                                 str(self.current), str(self.candidate)], cwd=self.root,
                                capture_output=True, text=True, check=False, env={"PATH": "/usr/bin:/bin"})
        self.assertEqual(0, result.returncode, result.stderr)
        receipt = json.loads(result.stdout)
        self.assertTrue(receipt["eligibleForSmoke"])
        self.assertFalse(receipt["automaticPromotion"])
        self.assertEqual("ok", receipt["status"])
        self.assertFalse(list(checker.rglob("*.pyc")))

    def test_cli_migration_is_not_automatic_promotion(self):
        self.interface(lambda value: value["operations"].clear())
        seal(self.candidate, self.metadata)
        result = subprocess.run([sys.executable, "-B", str(CHECKER), "compare",
                                 str(self.current), str(self.candidate)],
                                capture_output=True, text=True, check=False)
        self.assertEqual(2, result.returncode)
        receipt = json.loads(result.stdout)
        self.assertEqual("needs_migration", receipt["status"])
        self.assertFalse(receipt["automaticPromotion"])
        self.assertFalse(receipt["eligibleForSmoke"])

    def test_unsafe_paths_versions_and_side_effects_are_rejected(self):
        for path in ("../outside", "/absolute", "./page.md", "x//page.md", "x\\page.md"):
            with self.subTest(path=path):
                write_json(self.candidate / "mc-content/index.json", {"reference": {"page": path}})
                with self.assertRaises(ReleaseError):
                    seal(self.candidate, self.metadata)
        write_json(self.candidate / "mc-content/index.json", {"reference": {"page": "page.md"}})
        for value in ("01.0.0", "1.0", "1.0.0-beta", None):
            with self.subTest(version=value):
                self.metadata["releaseVersion"] = value
                with self.assertRaises(ReleaseError):
                    seal(self.candidate, self.metadata)
        self.metadata["releaseVersion"] = "1.0.1"
        self.interface(lambda value: value["operations"]["validate"].update(sideEffects="save"))
        with self.assertRaises(ReleaseError):
            seal(self.candidate, self.metadata)

    def test_checks_do_not_mutate_either_release_and_need_no_sockets(self):
        seal(self.candidate, self.metadata)
        before = {str(p): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        code = ("import runpy, socket, sys; from unittest.mock import Mock; "
                "socket.socket=Mock(side_effect=RuntimeError('network forbidden')); "
                "sys.path.insert(0, sys.argv[1]); "
                "sys.argv=[sys.argv[1]+'/cli.py', 'compare', sys.argv[2], sys.argv[3]]; "
                "runpy.run_path(sys.argv[0], run_name='__main__')")
        result = subprocess.run([sys.executable, "-S", "-B", "-c", code, str(CHECKER.parent),
                                 str(self.current), str(self.candidate)],
                                capture_output=True, text=True, check=False)
        self.assertEqual(0, result.returncode, result.stderr)
        after = {str(p): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        self.assertEqual(before, after)

    def test_cli_seal_and_verify_use_machine_receipts(self):
        metadata = self.root / "metadata.json"
        write_json(metadata, self.metadata)
        calls = [("seal", str(self.candidate), "--metadata", str(metadata)),
                 ("verify", str(self.candidate))]
        codes = []
        for arguments in calls:
            result = subprocess.run([sys.executable, "-S", "-B", str(CHECKER), *arguments],
                                    capture_output=True, text=True, check=False, cwd=self.root)
            self.assertEqual(0, result.returncode, result.stderr)
            receipt = json.loads(result.stdout)
            codes.append(receipt["code"])
            self.assertFalse(receipt["eligibleForSmoke"])
            self.assertFalse(receipt["automaticPromotion"])
        self.assertEqual(["RELEASE_SEALED", "RELEASE_VERIFIED"], codes)

    def test_cli_rejects_broken_candidate_with_structured_error(self):
        result = subprocess.run([sys.executable, "-B", str(CHECKER), "verify", str(self.candidate)],
                                capture_output=True, text=True, check=False)
        self.assertEqual(3, result.returncode)
        self.assertEqual("error", json.loads(result.stdout)["status"])
        self.assertFalse(json.loads(result.stdout)["automaticPromotion"])
        self.assertFalse((self.candidate / MANIFEST).exists())


if __name__ == "__main__":
    unittest.main()
