from __future__ import annotations

import json
import unittest
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
PRODUCTION_SERVER = BUNDLE_ROOT / "tool" / "server.py"
HARNESS_SERVER = BUNDLE_ROOT / "test-harness" / "stdio_server.py"


def fixture(name: str) -> dict[str, object]:
    return json.loads(
        (BUNDLE_ROOT / "test-harness" / "fixtures" / name).read_text(
            encoding="utf-8"
        )
    )


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

            resources = await client.list_resources()
            self.assertIn(
                "metriccanvas://bundle-info",
                {str(resource.uri) for resource in resources},
            )

            contents = await client.read_resource("metriccanvas://bundle-info")
            info = json.loads(contents[0].text)
            self.assertEqual(info["bundleVersion"], "0.2.0")
            self.assertEqual(info["transport"], "stdio")

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
                    "spec": {"question": "invalid", "units": []},
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


if __name__ == "__main__":
    unittest.main()
