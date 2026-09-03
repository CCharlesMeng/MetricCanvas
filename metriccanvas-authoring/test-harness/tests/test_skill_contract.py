from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
SKILL_PATH = (
    BUNDLE_ROOT / "skill" / "metriccanvas-page-builder" / "SKILL.md"
)


class RelaySkillContractTest(unittest.TestCase):
    def _json_examples(self) -> list[dict[str, object]]:
        body = SKILL_PATH.read_text(encoding="utf-8")
        return [
            json.loads(example)
            for example in re.findall(
                r"```json\n(.*?)\n```", body, re.DOTALL
            )
        ]

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
        self.assertIn("如果发现 `build_page`", body)
        self.assertNotIn("savedRevision", body)

    def test_skill_documents_registration_and_exact_tool_calls(self) -> None:
        body = SKILL_PATH.read_text(encoding="utf-8")
        for registration_fact in (
            ".skills/metriccanvas-page-builder/SKILL.md",
            ".relay/mcp_configs/",
            "METRICCANVAS_TOOL_SURFACE=relay",
            "Page Artifact Adapter",
            '"mcpServers"',
            '"command": "python"',
            '"args": ["tool/server.py"]',
            '"cwd": "<bundle-absolute-path>"',
            "list_tools",
        ):
            self.assertIn(registration_fact, body)
        for input_name in ('"query"', '"limit"', '"page_id"', '"spec"'):
            self.assertIn(input_name, body)
        self.assertIn("三类模型决策名称，不是 MCP 工具", body)
        self.assertIn("封装在 `compose_page` 内", body)
        self.assertIn("Relay 尚未提供固定工作流执行器", body)

    def test_skill_json_examples_match_registration_and_tool_contracts(self) -> None:
        registration, discovery_call, compose_call = self._json_examples()
        server = registration["mcpServers"]["metriccanvas-authoring"]
        self.assertEqual(server["command"], "python")
        self.assertEqual(server["args"], ["tool/server.py"])
        self.assertEqual(
            server["env"]["METRICCANVAS_TOOL_SURFACE"], "relay"
        )
        self.assertEqual(set(discovery_call), {"query", "limit"})
        self.assertEqual(set(compose_call), {"page_id", "spec"})

        page_build_spec_schema = json.loads(
            (
                BUNDLE_ROOT
                / "contracts"
                / "authored"
                / "page-build-spec.schema.json"
            ).read_text(encoding="utf-8")
        )
        self.assertEqual(
            list(
                Draft202012Validator(page_build_spec_schema).iter_errors(
                    compose_call["spec"]
                )
            ),
            [],
        )

    def test_skill_exposes_the_full_runtime_state_machine(self) -> None:
        body = SKILL_PATH.read_text(encoding="utf-8")
        for state in (
            "received",
            "routing",
            "discovering",
            "awaiting_user",
            "planning",
            "composing",
            "page_composed",
            "failed",
            "cancelled",
        ):
            self.assertIn(f"`{state}`", body)
        self.assertIn("DQE_TRANSPORT_ERROR", body)
        self.assertIn("completedStages", body)

    def test_skill_keeps_persistence_outside_the_agent(self) -> None:
        body = SKILL_PATH.read_text(encoding="utf-8")
        self.assertIn("正式页面持久化", body)
        self.assertIn("用户显式发起的沉淀", body)
        self.assertIn("仅将 `modelSummary` 返回模型", body)
        self.assertIn("禁止调用 Java 页面保存 Interface", body)
        self.assertIn("如果模型直接看到 `artifactEnvelope.artifact`", body)


if __name__ == "__main__":
    unittest.main()
