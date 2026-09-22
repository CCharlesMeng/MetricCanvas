from __future__ import annotations

import copy
import sys
import tempfile
import unittest
from pathlib import Path

BUNDLE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BUNDLE_ROOT / "scripts"))
from check_bundle import validate_skills  # noqa: E402


class BundleSkillsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.entries = []
        for name in ("metriccanvas-page-builder", "metriccanvas-platform-authoring"):
            entry = f"skill/{name}/SKILL.md"
            self.entries.append({"id": name, "entrypoint": entry})
            folder = self.root / "skill" / name
            (folder / "references").mkdir(parents=True)
            (folder / "SKILL.md").write_text("[rules](references/rules.md#rules)\n", encoding="utf-8")
            (folder / "references/rules.md").write_text('<a id="rules"></a>\nRules\n', encoding="utf-8")
        workflows = self.root / "skill/metriccanvas-platform-authoring/workflows"
        workflows.mkdir()
        for name in ("create", "edit"):
            (workflows / f"{name}.md").write_text("# Workflow\n")
        self.bundle = {"skill": {"entrypoint": self.entries[0]["entrypoint"]}, "skills": self.entries}
        self.entries[1]["mcpServer"] = "metriccanvas-platform-content"
        self.bundle["toolServices"] = {"metriccanvas-platform-content": {"command": "metriccanvas-platform-content", "module": "metriccanvas_authoring.platform_server", "contextContract": "authoring-turn/1.0", "platformProtocolVersion": "2.0"}}
        (self.root / "tool").mkdir()
        (self.root / "tool/pyproject.toml").write_text('[project.scripts]\nmetriccanvas-platform-content = "metriccanvas_authoring.platform_server:main"\n')


    def check(self, bundle=None, locked=None):
        if locked is None:
            locked = {p.relative_to(self.root).as_posix() for p in self.root.rglob("*") if p.is_file()}
        return validate_skills(self.root, self.bundle if bundle is None else bundle, locked)

    def test_legacy_entrypoint_and_unified_independent_skill(self) -> None:
        self.assertEqual(self.check(), [])
        legacy = {"skill": self.bundle["skill"]}
        self.assertEqual(self.check(legacy), [])

    def test_invalid_registry_and_legacy_alias_are_rejected(self) -> None:
        cases = []
        value = copy.deepcopy(self.bundle)
        value["skills"].append(value["skills"][0])
        cases.append(value)
        for entrypoint in ("../outside/SKILL.md", "/outside/SKILL.md", "skill/other/SKILL.md"):
            value = copy.deepcopy(self.bundle)
            value["skills"][1]["entrypoint"] = entrypoint
            cases.append(value)
        value = copy.deepcopy(self.bundle)
        value["skill"]["entrypoint"] = self.entries[1]["entrypoint"]
        cases.append(value)
        value = copy.deepcopy(self.bundle)
        value["skills"] = []
        cases.append(value)
        for bundle in cases:
            with self.subTest(bundle=bundle):
                self.assertTrue(self.check(bundle))

    def test_missing_entry_reference_anchor_and_cross_skill_link_are_rejected(self) -> None:
        entry = self.root / self.entries[1]["entrypoint"]
        original = entry.read_text()
        entry.unlink()
        self.assertTrue(self.check())
        for text in ("[missing](references/missing.md)", "[missing](references/rules.md#missing)",
                     "[outside](../metriccanvas-page-builder/SKILL.md)"):
            with self.subTest(text=text):
                entry.write_text(text)
                self.assertTrue(self.check())
        entry.write_text(original)
        self.assertEqual(self.check(), [])

    def test_all_distributed_files_must_be_locked_and_symlinks_cannot_escape(self) -> None:
        self.assertTrue(self.check(locked=set()))
        external = self.root / "outside.md"
        external.write_text("outside")
        link = self.root / "skill/metriccanvas-platform-authoring/references/escape.md"
        link.symlink_to(external)
        self.assertTrue(self.check())

    def test_budget_and_retired_entry_are_rejected(self) -> None:
        workflow = self.root / "skill/metriccanvas-platform-authoring/workflows/create.md"
        workflow.write_text("line\n" * 251)
        self.assertTrue(any("budget" in error for error in self.check()))
        workflow.write_text("# Workflow\n")
        value = copy.deepcopy(self.bundle)
        value["skills"].append({"id": "metriccanvas-platform-create", "entrypoint": "skill/metriccanvas-platform-create/SKILL.md"})
        self.assertTrue(any("unified" in error for error in self.check(value)))

    def test_registry_rejects_unknown_projection(self) -> None:
        value = copy.deepcopy(self.bundle)
        value["skills"][1]["referenceProjection"] = "all-contracts"
        self.assertTrue(any("projection" in error for error in self.check(value)))

    def test_unified_deployment_cannot_route_to_legacy_service(self) -> None:
        value = copy.deepcopy(self.bundle)
        value["toolServices"]["metriccanvas-platform-content"]["module"] = "metriccanvas_authoring.content_server"
        self.assertTrue(any("gated" in error for error in self.check(value)))
        (self.root / "tool/pyproject.toml").write_text('[project.scripts]\nmetriccanvas-platform-content = "metriccanvas_authoring.content_server:main"\n')
        self.assertTrue(any("CLI" in error for error in self.check()))


if __name__ == "__main__":
    unittest.main()
