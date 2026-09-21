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
            '"METRICCANVAS_TOOL_SURFACE": "relay"',
            "Page Artifact Adapter",
            '"mcpServers"',
            '"command": "uvx"',
            '"--from"',
            '"metriccanvas-authoring"',
            "METRICCANVAS_DQE_BASE_URL",
            "METRICCANVAS_DATA_CONTEXT_PROJECTION_CONFIG",
            "list_tools",
        ):
            self.assertIn(registration_fact, body)
        for input_name in ('"query"', '"limit"', '"page_id"', '"spec"'):
            self.assertIn(input_name, body)
        self.assertIn("三类模型决策名称，不是 MCP 工具", body)
        self.assertIn("封装在 `compose_page` 内", body)
        self.assertIn("Relay 尚未提供固定工作流执行器", body)
        for execution_fact in (
            "contracts/authored/agent-model-decision.schema.json",
            "Relay 使用原生 Skill ReAct 调用模型",
            "最多 6 个取数单元并发调用 DQE Interface",
            "POST /rest/cdi/cdinl2databuilderservice/v1/dsl/execute",
            "确定性指标/维度/时间词解析做一次兜底拆解",
        ):
            self.assertIn(execution_fact, body)

    def test_skill_json_examples_match_registration_and_tool_contracts(self) -> None:
        registration, discovery_call, compose_call = self._json_examples()
        server = registration["mcpServers"]["metriccanvas-authoring"]
        self.assertEqual(server["command"], "uvx")
        self.assertEqual(server["args"][-1], "metriccanvas-authoring")
        self.assertEqual(
            server["env"]["METRICCANVAS_TOOL_SURFACE"], "relay"
        )
        self.assertEqual(set(discovery_call), {"query", "limit"})
        self.assertEqual(set(compose_call), {"page_id", "spec"})
        self.assertIn("dataContextVersion", compose_call["spec"])
        self.assertEqual(
            compose_call["spec"]["units"][0]["dataSourceId"],
            "result",
        )

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
        self.assertIn("DQE_TIMEOUT", body)
        self.assertIn("retrySafe: true", body)
        self.assertIn("retrySafe: false", body)
        self.assertIn("completedStages", body)

    def test_skill_documents_executable_ask_rules_and_rich_tool_contracts(self) -> None:
        body = SKILL_PATH.read_text(encoding="utf-8")
        for fact in (
            "ask/rules.py",
            "resolution.candidates[]",
            "resolution.selected[]",
            "resolution.ambiguities[]",
            "businessDomains",
            "time`、`intent`、`structureOperation",
            "dataContextVersion",
            "dataSourceId",
            "droppedAdds",
            "STRUCTURAL_INTENT_NOT_APPLIED",
            "SCOPE_SELECTION_INVALID",
            "metric_gap_recorded",
            "formulaTraces",
            "(临时指标)",
            "前 20 行样例",
            "candidates",
        ):
            self.assertIn(fact, body)

    def test_skill_keeps_persistence_outside_the_agent(self) -> None:
        body = SKILL_PATH.read_text(encoding="utf-8")
        self.assertIn("正式页面持久化", body)
        self.assertIn("用户显式发起的沉淀", body)
        self.assertIn("仅将 `modelSummary` 返回模型", body)
        self.assertIn("禁止调用 Java 页面保存 Interface", body)
        self.assertIn("如果模型直接看到 `artifactEnvelope.artifact`", body)


class UnifiedSkillContractTest(unittest.IsolatedAsyncioTestCase):
    async def test_examples_and_allowed_tools_match_actual_target_registration(self):
        from fastmcp import Client
        from metriccanvas_authoring.entrypoints.mcp.platform_mcp import create_platform_mcp_server
        from metriccanvas_authoring.pages.platform_authoring import PlatformAuthoring
        from test_unified_content_mcp import dependencies
        folder = BUNDLE_ROOT / 'skill/metriccanvas-platform-authoring'
        examples = [json.loads(value) for value in re.findall(
            r'```json\n(.*?)\n```', (folder / 'references/examples.md').read_text(), re.DOTALL)]
        async with Client(create_platform_mcp_server(PlatformAuthoring(dependencies(), None, None))) as client:
            tools = {tool.name: tool for tool in await client.list_tools()}
        frontmatter = yaml.safe_load((folder / 'SKILL.md').read_text().split('---', 2)[1])
        self.assertEqual(set(frontmatter['allowed-tools']), set(tools))
        self.assertEqual(frontmatter['metadata']['mcp_servers'], ['metriccanvas-platform-content'])
        self.assertGreaterEqual(len(examples), 4)
        for example in examples:
            self.assertEqual(list(Draft202012Validator(tools[example['tool']].inputSchema).iter_errors(example['arguments'])), [])
        old = yaml.safe_load((BUNDLE_ROOT / 'skill-compat/platform-authoring-v1/SKILL.md').read_text().split('---', 2)[1])
        self.assertEqual(set(old['allowed-tools']), {'read_page_context', 'discover_data_context', 'compose_page', 'create_content_page', 'edit_page'})


if __name__ == '__main__':
    unittest.main()
