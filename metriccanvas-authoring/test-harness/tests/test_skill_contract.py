from __future__ import annotations

import re
import unittest
from pathlib import Path

import yaml


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
SKILL_PATH = (
    BUNDLE_ROOT / "skill" / "metriccanvas-page-builder" / "SKILL.md"
)


class RelaySkillContractTest(unittest.TestCase):
    def test_skill_uses_only_the_relay_target_tool_surface(self) -> None:
        content = SKILL_PATH.read_text(encoding="utf-8")
        match = re.fullmatch(r"---\n(.*?)\n---\n(.*)", content, re.DOTALL)
        self.assertIsNotNone(match)
        assert match is not None
        frontmatter = yaml.safe_load(match.group(1))
        body = match.group(2)

        self.assertEqual(
            frontmatter["allowed-tools"],
            ["discover_data_context", "compose_page"],
        )
        self.assertEqual(
            frontmatter["metadata"]["mcp_servers"],
            ["metriccanvas-authoring"],
        )
        for decision in (
            "route_business_domains",
            "submit_data_request_units",
            "submit_analysis_intent",
        ):
            self.assertIn(decision, body)
        self.assertIn("status: page_composed", body)
        self.assertNotIn("`build_page`", body)
        self.assertNotIn("savedRevision", body)

    def test_skill_keeps_persistence_outside_the_agent(self) -> None:
        body = SKILL_PATH.read_text(encoding="utf-8")
        self.assertIn("formal page persistence", body)
        self.assertIn("explicit user action", body)
        self.assertIn("returns only its `modelSummary`", body)
        self.assertIn("Never call Java page-save Interfaces", body)


if __name__ == "__main__":
    unittest.main()
