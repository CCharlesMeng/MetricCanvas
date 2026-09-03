from __future__ import annotations

import os
from typing import cast

from metriccanvas_authoring.adapters.inbound.fastmcp import (
    ToolSurface,
    create_mcp_server,
)
from metriccanvas_authoring.adapters.outbound.env_identity import EnvIdentityPort
from metriccanvas_authoring.adapters.outbound.java_page_assets import (
    PAGE_ASSETS_BASE_URL_ENV,
    JavaPageAssetPort,
)
from metriccanvas_authoring.application.build_page import BuildPageDependencies
from metriccanvas_authoring.application.ports import (
    DqeExecutionResult,
    JsonObject,
    PageAssetPort,
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
        raise RuntimeError(
            f"Java Page Asset adapter is not configured; set {PAGE_ASSETS_BASE_URL_ENV}"
        )


TOOL_SURFACE_ENV = "METRICCANVAS_TOOL_SURFACE"


def configure_page_assets() -> PageAssetPort:
    base_url = (os.environ.get(PAGE_ASSETS_BASE_URL_ENV) or "").strip()
    if not base_url:
        return _UnconfiguredPageAssetPort()
    return JavaPageAssetPort(base_url, EnvIdentityPort())


def configure_tool_surface() -> ToolSurface:
    value = (os.environ.get(TOOL_SURFACE_ENV) or "compatibility").strip()
    if value not in {"compatibility", "relay"}:
        raise RuntimeError(
            f"{TOOL_SURFACE_ENV} must be 'compatibility' or 'relay', got {value!r}"
        )
    return cast(ToolSurface, value)


mcp = create_mcp_server(
    BuildPageDependencies(
        data_context=_UnconfiguredDataContextPort(),
        dqe=_UnconfiguredDqeExecutionPort(),
        page_assets=configure_page_assets(),
    ),
    tool_surface=configure_tool_surface(),
)


if __name__ == "__main__":
    mcp.run()
