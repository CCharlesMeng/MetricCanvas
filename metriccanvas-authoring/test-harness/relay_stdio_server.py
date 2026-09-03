"""Relay-target FastMCP surface with fixture outbound Adapters."""

from __future__ import annotations

import json
import sys
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))
sys.path.insert(0, str(BUNDLE_ROOT / "test-harness"))

from adapters.fakes import (  # noqa: E402
    FakeDataContextPort,
    FakeDqeExecutionPort,
    FakePageAssetPort,
)
from metriccanvas_authoring.adapters.inbound.fastmcp import (  # noqa: E402
    create_mcp_server,
)
from metriccanvas_authoring.application.build_page import (  # noqa: E402
    BuildPageDependencies,
)
from metriccanvas_authoring.application.ports import (  # noqa: E402
    DqeExecutionResult,
    SavedRevision,
)


def fixture(name: str) -> dict[str, object]:
    return json.loads(
        (BUNDLE_ROOT / "test-harness" / "fixtures" / name).read_text(
            encoding="utf-8"
        )
    )


execution = fixture("page-build-execution.json")
mcp = create_mcp_server(
    BuildPageDependencies(
        data_context=FakeDataContextPort(fixture("data-context.json")),
        dqe=FakeDqeExecutionPort(
            DqeExecutionResult(
                rows=execution["rows"],
                total_count=execution.get("totalCount"),
                captured_at=execution.get("capturedAt"),
            )
        ),
        # Required only by the compatibility surface; relay mode never calls it.
        page_assets=FakePageAssetPort(
            SavedRevision("must-not-save", "must-not-save", 1)
        ),
    ),
    tool_surface="relay",
)


if __name__ == "__main__":
    mcp.run()
