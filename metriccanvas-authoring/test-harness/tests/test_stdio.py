from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
PRODUCTION_SERVER = BUNDLE_ROOT / "tool" / "server.py"
HARNESS_SERVER = BUNDLE_ROOT / "test-harness" / "stdio_server.py"
RELAY_HARNESS_SERVER = BUNDLE_ROOT / "test-harness" / "relay_stdio_server.py"


def fixture(name: str) -> dict[str, object]:
    return json.loads(
        (BUNDLE_ROOT / "test-harness" / "fixtures" / name).read_text(
            encoding="utf-8"
        )
    )


def _contains_key(value: object, key: str) -> bool:
    if isinstance(value, dict):
        return key in value or any(_contains_key(entry, key) for entry in value.values())
    if isinstance(value, list):
        return any(_contains_key(entry, key) for entry in value)
    return False


class FastMcpStdioTest(unittest.IsolatedAsyncioTestCase):
    async def test_bundle_info_is_a_resource_not_a_model_visible_tool(self) -> None:
        from fastmcp import Client

        async with Client(PRODUCTION_SERVER) as client:
            tools = await client.list_tools()
            self.assertEqual(
                {tool.name for tool in tools},
                {"discover_data_context", "build_page"},
            )
            wire_tools = {
                tool.name: tool.model_dump(by_alias=True, exclude_none=True)
                for tool in tools
            }
            discover_schema = wire_tools["discover_data_context"]["inputSchema"]
            self.assertEqual(
                discover_schema["properties"]["limit"],
                {"default": 10, "minimum": 1, "maximum": 50, "type": "integer"},
            )
            discover_output_schema = wire_tools["discover_data_context"][
                "outputSchema"
            ]
            self.assertEqual(
                set(discover_output_schema["required"]),
                {
                    "ok",
                    "dataContextVersion",
                    "businessDomains",
                    "matches",
                    "resolution",
                    "time",
                    "intent",
                    "structureOperation",
                    "issues",
                },
            )
            resolution_schema = next(
                option
                for option in discover_output_schema["properties"]["resolution"][
                    "anyOf"
                ]
                if option.get("type") == "object"
            )
            self.assertEqual(
                set(resolution_schema["required"]),
                {
                    "formatVersion",
                    "question",
                    "candidates",
                    "selected",
                    "ambiguities",
                },
            )
            candidate_schema = resolution_schema["properties"]["candidates"][
                "items"
            ]
            self.assertTrue(
                {"matchedTerm", "score"}.issubset(candidate_schema["required"])
            )
            ambiguity_schema = resolution_schema["properties"]["ambiguities"][
                "items"
            ]
            self.assertEqual(
                set(ambiguity_schema["required"]),
                {"matchedTerm", "candidates"},
            )
            build_spec_schema = wire_tools["build_page"]["inputSchema"][
                "properties"
            ]["spec"]
            authored_spec = json.loads(
                (
                    BUNDLE_ROOT
                    / "contracts"
                    / "authored"
                    / "page-build-spec.schema.json"
                ).read_text(encoding="utf-8")
            )
            self.assertEqual(build_spec_schema["$id"], authored_spec["$id"])
            self.assertIn("dataContextVersion", build_spec_schema["required"])
            self.assertIn(
                "dataSourceId",
                build_spec_schema["properties"]["units"]["items"]["required"],
            )
            self.assertEqual(
                build_spec_schema["properties"]["units"]["minItems"], 1
            )
            self.assertNotIn('"$ref"', json.dumps(build_spec_schema))
            self.assertEqual(
                set(wire_tools["build_page"]["outputSchema"]["required"]),
                {
                    "ok",
                    "completedStages",
                    "savedRevision",
                    "summary",
                    "issues",
                },
            )
            for tool_name in ("discover_data_context", "build_page"):
                issue_schema = wire_tools[tool_name]["outputSchema"][
                    "properties"
                ]["issues"]["items"]
                self.assertIn("retrySafe", issue_schema["required"])

            resources = await client.list_resources()
            self.assertIn(
                "metriccanvas://bundle-info",
                {str(resource.uri) for resource in resources},
            )

            contents = await client.read_resource("metriccanvas://bundle-info")
            info = json.loads(contents[0].text)
            self.assertEqual(info["bundleVersion"], "0.2.0")
            self.assertEqual(info["transport"], "stdio")

    async def test_discovery_exposes_governed_details_and_term_resolution(
        self,
    ) -> None:
        from fastmcp import Client

        async with Client(HARNESS_SERVER) as client:
            discovered = await client.call_tool(
                "discover_data_context", {"query": "大区"}
            )
            unknown = await client.call_tool(
                "discover_data_context", {"query": "完全未知的词"}
            )

        payload = discovered.structured_content
        self.assertEqual(payload["businessDomains"], ["运营分析"])
        self.assertEqual(payload["matches"][0]["field"]["name"], "区域")
        self.assertEqual(payload["resolution"]["ambiguities"], [])
        self.assertEqual(
            {
                "matchedTerm": payload["resolution"]["selected"][0][
                    "matchedTerm"
                ],
                "score": payload["resolution"]["selected"][0]["score"],
            },
            {"matchedTerm": "大区", "score": 52},
        )
        self.assertIsNone(payload["time"])
        self.assertIsNone(payload["intent"])
        self.assertIsNone(payload["structureOperation"])

        self.assertEqual(unknown.structured_content["matches"], [])
        self.assertEqual(
            unknown.structured_content["businessDomains"], ["运营分析"]
        )
        self.assertEqual(
            unknown.structured_content["resolution"],
            {
                "formatVersion": "1.0",
                "question": "完全未知的词",
                "candidates": [],
                "selected": [],
                "ambiguities": [],
            },
        )
        self.assertIsNone(unknown.structured_content["time"])
        self.assertIsNone(unknown.structured_content["intent"])
        self.assertIsNone(unknown.structured_content["structureOperation"])

    async def test_relay_surface_exposes_only_discovery_and_compose(self) -> None:
        from fastmcp import Client

        async with Client(RELAY_HARNESS_SERVER) as client:
            tools = await client.list_tools()
            self.assertEqual(
                {tool.name for tool in tools},
                {"discover_data_context", "compose_page"},
            )
            wire_tools = {
                tool.name: tool.model_dump(by_alias=True, exclude_none=True)
                for tool in tools
            }
            compose_schema = wire_tools["compose_page"]["inputSchema"][
                "properties"
            ]["spec"]
            authored_spec = json.loads(
                (
                    BUNDLE_ROOT
                    / "contracts"
                    / "authored"
                    / "page-build-spec.schema.json"
                ).read_text(encoding="utf-8")
            )
            self.assertEqual(compose_schema["$id"], authored_spec["$id"])
            self.assertIn("dataContextVersion", compose_schema["required"])
            self.assertIn(
                "dataSourceId",
                compose_schema["properties"]["units"]["items"]["required"],
            )
            self.assertNotIn('"$ref"', json.dumps(compose_schema))
            self.assertEqual(
                set(wire_tools["compose_page"]["outputSchema"]["required"]),
                {"ok", "completedStages", "artifactEnvelope", "issues"},
            )
            compose_output_schema = wire_tools["compose_page"]["outputSchema"]
            issue_schema = compose_output_schema["properties"]["issues"]["items"]
            self.assertIn("candidates", issue_schema["properties"])
            self.assertNotIn("candidates", issue_schema["required"])
            self.assertIn("retrySafe", issue_schema["required"])

            artifact_envelope_schema = next(
                option
                for option in compose_output_schema["properties"][
                    "artifactEnvelope"
                ]["anyOf"]
                if option.get("type") == "object"
            )
            artifact_output_schema = artifact_envelope_schema["properties"][
                "artifact"
            ]
            artifact_contract = json.loads(
                (
                    BUNDLE_ROOT
                    / "contracts"
                    / "authored"
                    / "page-build-artifact.schema.json"
                ).read_text(encoding="utf-8")
            )
            self.assertEqual(
                set(artifact_output_schema["properties"]),
                set(artifact_contract["properties"]),
            )
            self.assertEqual(
                set(artifact_output_schema["required"]),
                set(artifact_contract["required"]),
            )
            self.assertEqual(
                set(
                    artifact_output_schema["properties"]["formulaTraces"][
                        "items"
                    ]["required"]
                ),
                {"question", "expression", "referencedMetrics"},
            )

    async def test_relay_compose_returns_valid_artifact_envelope_and_safe_summary(
        self,
    ) -> None:
        from fastmcp import Client

        async with Client(RELAY_HARNESS_SERVER) as client:
            composed = await client.call_tool(
                "compose_page",
                {
                    "page_id": "tokens-by-region",
                    "spec": fixture("page-build-spec.json"),
                },
            )

        self.assertFalse(composed.is_error)
        payload = composed.structured_content
        self.assertTrue(payload["ok"])
        self.assertEqual(
            payload["completedStages"],
            ["discovery", "generation", "execution", "presentation"],
        )
        self.assertNotIn("savedRevision", payload)
        envelope = payload["artifactEnvelope"]
        self.assertEqual(envelope["kind"], "metriccanvas.page-build-artifact")
        self.assertEqual(envelope["formatVersion"], "1.0")

        authored_root = BUNDLE_ROOT / "contracts" / "authored"
        artifact_schema = json.loads(
            (authored_root / "page-build-artifact.schema.json").read_text(
                encoding="utf-8"
            )
        )
        envelope_schema = json.loads(
            (authored_root / "relay-page-artifact-envelope.schema.json").read_text(
                encoding="utf-8"
            )
        )
        registry = Registry().with_resource(
            artifact_schema["$id"], Resource.from_contents(artifact_schema)
        )
        self.assertEqual(
            list(
                Draft202012Validator(
                    envelope_schema, registry=registry
                ).iter_errors(envelope)
            ),
            [],
        )

        artifact = envelope["artifact"]
        summary = envelope["modelSummary"]
        self.assertEqual(summary["status"], "page_composed")
        self.assertEqual(summary["pageId"], "tokens-by-region")
        self.assertEqual(summary["unitCount"], 1)
        self.assertGreaterEqual(summary["topLevelComponentCount"], 1)
        self.assertEqual(summary["documentSha256"], artifact["documentSha256"])
        self.assertEqual(summary["dataContextVersion"], artifact["dataContextVersion"])
        self.assertEqual(summary["bundleVersion"], artifact["bundleVersion"])
        self.assertTrue(_contains_key(artifact, "rows"))
        for forbidden in ("artifact", "document", "rows", "initial"):
            self.assertFalse(_contains_key(summary, forbidden))

    async def test_relay_compose_failure_contains_no_artifact(self) -> None:
        from fastmcp import Client

        async with Client(RELAY_HARNESS_SERVER) as client:
            composed = await client.call_tool(
                "compose_page",
                {
                    "page_id": "invalid",
                    "spec": {
                        "question": "invalid",
                        "dataContextVersion": "2026-09-02.1",
                        "units": [],
                    },
                },
            )

        self.assertFalse(composed.is_error)
        self.assertFalse(composed.structured_content["ok"])
        self.assertIsNone(composed.structured_content["artifactEnvelope"])
        self.assertEqual(composed.structured_content["completedStages"], [])
        self.assertFalse(_contains_key(composed.structured_content, "rows"))

    async def test_relay_manifest_failure_exposes_repair_candidates(self) -> None:
        from fastmcp import Client

        spec = fixture("page-build-spec.json")
        spec["units"][0]["metrics"][0]["name"] = "不存在的指标"
        async with Client(RELAY_HARNESS_SERVER) as client:
            composed = await client.call_tool(
                "compose_page",
                {"page_id": "invalid-metric", "spec": spec},
            )

        self.assertFalse(composed.is_error)
        self.assertFalse(composed.structured_content["ok"])
        self.assertIsNone(composed.structured_content["artifactEnvelope"])
        self.assertEqual(
            composed.structured_content["issues"],
            [
                {
                    "code": "METRIC_NOT_IN_DATA_CONTEXT",
                    "path": "/units/0/metrics/0/name",
                    "message": "metric is not in data context: 不存在的指标",
                    "stage": "generation",
                    "retrySafe": False,
                    "candidates": ["Tokens请求量"],
                }
            ],
        )

    async def test_relay_closed_set_failure_exposes_repair_candidates(self) -> None:
        from fastmcp import Client

        spec = fixture("page-build-spec.json")
        spec["units"][0]["intent"] = "invented"
        async with Client(RELAY_HARNESS_SERVER) as client:
            composed = await client.call_tool(
                "compose_page",
                {"page_id": "invalid-intent", "spec": spec},
            )

        issue = composed.structured_content["issues"][0]
        self.assertEqual(issue["code"], "PAGE_BUILD_SPEC_CLOSED_SET_ERROR")
        self.assertFalse(issue["retrySafe"])
        self.assertIn("comparison", issue["candidates"])

    async def test_relay_execution_failure_exposes_retry_safety(self) -> None:
        from fastmcp import Client

        sys.path.insert(0, str(BUNDLE_ROOT / "tool"))
        sys.path.insert(0, str(BUNDLE_ROOT / "test-harness"))
        from adapters.fakes import (  # noqa: PLC0415
            FakeDataContextPort,
            FakeDqeExecutionPort,
            FakePageAssetPort,
        )
        from metriccanvas_authoring.adapters.inbound.fastmcp import (  # noqa: PLC0415
            create_mcp_server,
        )
        from metriccanvas_authoring.application.build_page import (  # noqa: PLC0415
            BuildPageDependencies,
        )
        from metriccanvas_authoring.application.ports import (  # noqa: PLC0415
            SavedRevision,
        )

        class DqeFailure(Exception):
            def __init__(self, code: str) -> None:
                super().__init__(code)
                self.code = code

        for code, expected_retry_safe in (
            ("DQE_TRANSPORT_ERROR", True),
            ("DQE_FORBIDDEN", False),
        ):
            with self.subTest(code=code):
                dqe = FakeDqeExecutionPort(error=DqeFailure(code))
                server = create_mcp_server(
                    BuildPageDependencies(
                        data_context=FakeDataContextPort(
                            fixture("data-context.json")
                        ),
                        dqe=dqe,
                        page_assets=FakePageAssetPort(
                            SavedRevision("unused", "unused", 1)
                        ),
                    ),
                    tool_surface="relay",
                )
                async with Client(server) as client:
                    composed = await client.call_tool(
                        "compose_page",
                        {
                            "page_id": f"retry-{code.lower()}",
                            "spec": fixture("page-build-spec.json"),
                        },
                    )

                self.assertEqual(
                    composed.structured_content["issues"][0]["retrySafe"],
                    expected_retry_safe,
                )
                self.assertEqual(len(dqe.calls), 1)

    async def test_coarse_grained_tools_complete_the_golden_flow(self) -> None:
        from fastmcp import Client

        async with Client(HARNESS_SERVER) as client:
            discovery = await client.call_tool(
                "discover_data_context", {"query": "大区", "limit": 10}
            )
            self.assertEqual(
                discovery.structured_content,
                {
                    "ok": True,
                    "dataContextVersion": "2026-09-02.1",
                    "businessDomains": ["运营分析"],
                    "matches": [
                        {
                            "kind": "field",
                            "environmentId": "dqe-primary",
                            "schemaId": "operations-analytics",
                            "objectId": "operations-surface",
                            "field": {
                                "name": "区域",
                                "type": "string",
                                "description": "业务归属区域。取值域:华东、华南。",
                                "aliases": ["大区"],
                                "roleHints": ["dimension"],
                                "nullable": False,
                                "sensitive": False,
                            },
                        }
                    ],
                    "resolution": {
                        "formatVersion": "1.0",
                        "question": "大区",
                        "candidates": [
                            {
                                "kind": "dimension",
                                "matchedTerm": "大区",
                                "canonicalName": "区域",
                                "businessDomain": "运营分析",
                                "source": "alias",
                                "score": 52,
                                "definition": "业务归属区域。取值域:华东、华南。",
                                "start": 0,
                                "end": 2,
                            }
                        ],
                        "selected": [
                            {
                                "kind": "dimension",
                                "matchedTerm": "大区",
                                "canonicalName": "区域",
                                "businessDomain": "运营分析",
                                "source": "alias",
                                "score": 52,
                                "definition": "业务归属区域。取值域:华东、华南。",
                                "start": 0,
                                "end": 2,
                            }
                        ],
                        "ambiguities": [],
                    },
                    "time": None,
                    "intent": None,
                    "structureOperation": None,
                    "issues": [],
                },
            )

            build = await client.call_tool(
                "build_page",
                {
                    "page_id": "tokens-by-region",
                    "page_id_confirmed": True,
                    "spec": fixture("page-build-spec.json"),
                },
            )
            self.assertEqual(
                build.structured_content,
                {
                    "ok": True,
                    "completedStages": [
                        "discovery",
                        "generation",
                        "execution",
                        "presentation",
                        "save",
                    ],
                    "savedRevision": {
                        "pageId": "tokens-by-region",
                        "revisionId": "revision-1",
                        "revisionNumber": 1,
                    },
                    "summary": {"unitCount": 1},
                    "issues": [],
                },
            )

    async def test_build_failure_reports_completed_stages_without_mcp_error(self) -> None:
        from fastmcp import Client

        async with Client(HARNESS_SERVER) as client:
            build = await client.call_tool(
                "build_page",
                {
                    "page_id": "invalid",
                    "spec": {
                        "question": "invalid",
                        "dataContextVersion": "2026-09-02.1",
                        "units": [],
                    },
                },
            )

            self.assertFalse(build.is_error)
            self.assertFalse(build.structured_content["ok"])
            self.assertEqual(build.structured_content["completedStages"], [])
            self.assertIsNone(build.structured_content["savedRevision"])
            self.assertEqual(build.structured_content["summary"], {"unitCount": 0})
            self.assertEqual(
                [
                    (issue["code"], issue["stage"])
                    for issue in build.structured_content["issues"]
                ],
                [("PAGE_BUILD_SPEC_SCHEMA_ERROR", "generation")],
            )
            self.assertFalse(build.structured_content["issues"][0]["retrySafe"])


if __name__ == "__main__":
    unittest.main()
