from __future__ import annotations

from metriccanvas_authoring.adapters.inbound.fastmcp import create_mcp_server
from metriccanvas_authoring.application.build_page import BuildPageDependencies
from metriccanvas_authoring.application.ports import (
    DqeExecutionResult,
    JsonObject,
    SavedRevision,
)


class _UnconfiguredDataContextPort:
    async def current(self) -> JsonObject:
        raise RuntimeError("Data Context adapter is not configured")


class _UnconfiguredDqeExecutionPort:
    async def execute(self, effective_query: JsonObject) -> DqeExecutionResult:
        raise RuntimeError("DQE adapter is not configured")


class _UnconfiguredPageAssetPort:
    async def save_revision(self, command: JsonObject) -> SavedRevision:
        raise RuntimeError("Java Page Asset adapter is not configured")


mcp = create_mcp_server(
    BuildPageDependencies(
        data_context=_UnconfiguredDataContextPort(),
        dqe=_UnconfiguredDqeExecutionPort(),
        page_assets=_UnconfiguredPageAssetPort(),
    )
)


if __name__ == "__main__":
    mcp.run()
