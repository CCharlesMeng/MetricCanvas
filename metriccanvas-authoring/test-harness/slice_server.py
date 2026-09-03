"""Stdio MCP server for the local page-assets slice (ADR-0062 J4).

Relay and DQE are Harness stand-ins (fixture data context, fixture rows);
the page asset port is the **real** Java HTTP Adapter, so a `build_page` call
through this server ends in a row in MySQL. Configure with:

    METRICCANVAS_PAGE_ASSETS_BASE_URL=http://host:port/rest/cdi/pageassets/v1
    METRICCANVAS_OPERATOR_ID=<actor recorded as createdBy>
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))
sys.path.insert(0, str(BUNDLE_ROOT / "test-harness"))

from adapters.fakes import FakeDataContextPort, FakeDqeExecutionPort  # noqa: E402
from metriccanvas_authoring.adapters.inbound.fastmcp import create_mcp_server  # noqa: E402
from metriccanvas_authoring.adapters.outbound.env_identity import EnvIdentityPort  # noqa: E402
from metriccanvas_authoring.adapters.outbound.java_page_assets import (  # noqa: E402
    PAGE_ASSETS_BASE_URL_ENV,
    JavaPageAssetPort,
)
from metriccanvas_authoring.application.build_page import BuildPageDependencies  # noqa: E402
from metriccanvas_authoring.application.ports import DqeExecutionResult  # noqa: E402


def fixture(name: str) -> dict[str, object]:
    return json.loads(
        (BUNDLE_ROOT / "test-harness" / "fixtures" / name).read_text(encoding="utf-8")
    )


def create_slice_server(base_url: str):
    execution = fixture("page-build-execution.json")
    return create_mcp_server(
        BuildPageDependencies(
            data_context=FakeDataContextPort(fixture("data-context.json")),
            dqe=FakeDqeExecutionPort(
                DqeExecutionResult(
                    rows=execution["rows"],
                    total_count=execution.get("totalCount"),
                    captured_at=execution.get("capturedAt"),
                )
            ),
            page_assets=JavaPageAssetPort(base_url, EnvIdentityPort()),
        )
    )


if __name__ == "__main__":
    import os

    configured = (os.environ.get(PAGE_ASSETS_BASE_URL_ENV) or "").strip()
    if not configured:
        raise SystemExit(f"{PAGE_ASSETS_BASE_URL_ENV} is required for the slice server")
    create_slice_server(configured).run()
