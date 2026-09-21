"""Real stdio transport with controlled external data/baseline ports."""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "tool"), str(ROOT / "test-harness"), str(ROOT / "test-harness/tests")]
from adapters.fakes import FakeDataContextPort, FakeDqeExecutionPort
from test_page_editing import page
from test_text_map_building import content_page
from test_interaction_editing import interaction_page
from metriccanvas_authoring.adapters.inbound.content_mcp import create_content_mcp_server
from metriccanvas_authoring.application.compose_page import ComposePageDependencies
from metriccanvas_authoring.application.content_ports import ContentBaseline, ContentBaselineError
from metriccanvas_authoring.application.edit_page import document_sha256
from metriccanvas_authoring.domain.execution import DqeExecutionResult


class Baselines:
    async def read(self, token):
        if token not in {"trusted-baseline-token", "trusted-content-source", "trusted-interaction-source"}:
            raise ContentBaselineError("BASELINE_NOT_FOUND")
        document = interaction_page() if token == "trusted-interaction-source" else content_page() if token == "trusted-content-source" else page()
        return ContentBaseline({"pageId": document["id"], "revisionId": "r1", "resourceId": "resource1"}, document, document_sha256(document))


def fixture(name):
    return json.loads((ROOT / "test-harness/fixtures" / name).read_text())


execution = fixture("page-build-execution.json")
server = create_content_mcp_server(ComposePageDependencies(
    FakeDataContextPort(fixture("data-context.json")),
    FakeDqeExecutionPort(DqeExecutionResult(rows=execution["rows"], total_count=execution.get("totalCount"), captured_at=execution.get("capturedAt"))),
), Baselines(), summary_config=json.loads(os.environ.get("METRICCANVAS_CONTENT_AI_SUMMARY_CONFIG", "null")))

if __name__ == "__main__":
    server.run()
