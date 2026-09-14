import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastmcp import Client
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / "tool"), str(ROOT / "test-harness")]
from test_page_editing import title
from metriccanvas_authoring.domain.page_validation import validate_page_document
from metriccanvas_authoring.application.edit_page import document_sha256


class ContentMcpTest(unittest.IsolatedAsyncioTestCase):
    async def test_real_stdio_creation_and_partial_edit_only_return_safe_text(self):
        async with Client(ROOT / "test-harness/content_stdio_server.py") as client:
            tools = {t.name: t for t in await client.list_tools()}
            self.assertEqual(set(tools), {"discover_data_context", "compose_page", "edit_page", "create_content_page"})
            self.assertEqual(set(tools["edit_page"].inputSchema["properties"]), {"baseline_token", "request"})
            request = {"operations": [title(), title("bad", "missing"), title("dependent", "table", dependsOn=["bad"])]}
            edited = await client.call_tool("edit_page", {"baseline_token": "trusted-baseline-token", "request": request})
            payload = edited.structured_content
            self.assertTrue(payload["ok"])
            self.assertEqual(payload["modelSummary"]["status"], "partial")
            self.assertEqual([op["status"] for op in payload["modelSummary"]["operations"]], ["applied", "failed", "skipped"])
            artifact = payload["artifactEnvelope"]["artifact"]
            self.assertEqual(validate_page_document(artifact["document"]), [])
            self.assertEqual(artifact["documentSha256"], document_sha256(artifact["document"]))
            text = " ".join(c.text for c in edited.content if c.type == "text")
            self.assertNotIn("private-region", text)
            self.assertNotIn("dataSources", text)
            self.assertNotIn("artifactEnvelope", text)

            spec = json.loads((ROOT / "test-harness/fixtures/page-build-spec.json").read_text())
            created = await client.call_tool("compose_page", {"page_id": "content-created", "spec": spec})
            self.assertTrue(created.structured_content["ok"])
            document = created.structured_content["artifactEnvelope"]["artifact"]["document"]
            self.assertEqual(validate_page_document(document), [])
            self.assertEqual(document["layout"], "report")
            self.assertNotIn("dataSources", " ".join(c.text for c in created.content if c.type == "text"))
            self.assertNotIn("savedRevision", created.structured_content)
            authored = ROOT / "contracts/authored"
            artifact_schema = json.loads((authored / "page-build-artifact.schema.json").read_text())
            envelope_schema = json.loads((authored / "relay-page-artifact-envelope.schema.json").read_text())
            registry = Registry().with_resource(artifact_schema["$id"], Resource.from_contents(artifact_schema))
            self.assertEqual(list(Draft202012Validator(envelope_schema, registry=registry).iter_errors(created.structured_content["artifactEnvelope"])), [])
            dashboard = await client.call_tool("compose_page", {"page_id": "content-created", "spec": spec, "layout": "dashboard"})
            expected_dashboard = dict(document, layout="dashboard")
            dashboard_artifact = dashboard.structured_content["artifactEnvelope"]["artifact"]
            self.assertEqual(dashboard_artifact["document"], expected_dashboard)
            self.assertEqual(dashboard_artifact["documentSha256"], document_sha256(expected_dashboard))

    async def test_stdio_noop_failure_missing_baseline_and_raw_document_injection(self):
        async with Client(ROOT / "test-harness/content_stdio_server.py") as client:
            for token, request, expected in [
                ("trusted-baseline-token", {"operations": [title(value="Original")]}, "unchanged"),
                ("trusted-baseline-token", {"operations": [title(component="absent")]}, "failed"),
                ("missing-baseline", {"operations": [title()]}, "invalid_baseline"),
                ("trusted-baseline-token", {"operations": [title()], "document": {}}, "invalid_request"),
            ]:
                response = await client.call_tool("edit_page", {"baseline_token": token, "request": request})
                self.assertEqual(response.structured_content["modelSummary"]["status"], expected)
                self.assertIsNone(response.structured_content["artifactEnvelope"])

    async def test_content_server_has_no_compatibility_initialization_or_save_port(self):
        import metriccanvas_authoring.server as compatibility
        from metriccanvas_authoring.content_server import create_production_content_server
        with patch.object(compatibility, "create_production_server", side_effect=AssertionError("must not initialize")), patch.object(compatibility, "configure_page_assets", side_effect=AssertionError("must not configure saves")), patch.dict(os.environ, {"METRICCANVAS_TOOL_SURFACE": "invalid-unused-value"}):
            server = create_production_content_server()
            async with Client(server) as client:
                self.assertEqual({t.name for t in await client.list_tools()}, {"discover_data_context", "compose_page", "edit_page", "create_content_page"})
