from __future__ import annotations

import os
from typing import cast

from metriccanvas_authoring.adapters.inbound.fastmcp import (
    ToolSurface,
    create_mcp_server,
)
from metriccanvas_authoring.adapters.outbound.data_context_http import (
    APP_CODE_ENV,
    DATASETS_URL_TEMPLATE_ENV,
    DETAIL_URL_TEMPLATE_ENV,
    PROJECTION_CONFIG_ENV,
    SUBJECT_ID_ENV,
    WORKSPACE_ID_ENV,
    LabDataContextHttpPort,
    load_projection_config,
)
from metriccanvas_authoring.adapters.outbound.dqe_http import (
    DQE_BASE_URL_ENV,
    DQE_FORBIDDEN_HINT_ENV,
    DQE_WORKSPACE_ID_ENV,
    DqeHttpExecutionPort,
)
from metriccanvas_authoring.adapters.outbound.env_identity import EnvIdentityPort
from metriccanvas_authoring.adapters.outbound.java_page_assets import (
    PAGE_ASSETS_BASE_URL_ENV,
    JavaPageAssetPort,
)
from metriccanvas_authoring.application.build_page import BuildPageDependencies
from metriccanvas_authoring.application.ports import (
    DataContextError,
    DataContextPort,
    DqeExecutionResult,
    DqeExecutionPort,
    JsonObject,
    PageAssetPort,
    SavedRevision,
)
from metriccanvas_authoring.domain.execution import DqeExecutionError


class _UnconfiguredDataContextPort:
    def __init__(self, message: str) -> None:
        self._message = message

    async def current(self) -> JsonObject:
        raise DataContextError("DATA_CONTEXT_CONFIG_ERROR", self._message)


class _UnconfiguredDqeExecutionPort:
    def __init__(self, message: str) -> None:
        self._message = message

    async def execute(self, effective_query: JsonObject) -> DqeExecutionResult:
        raise DqeExecutionError("DQE_CONFIG_ERROR", self._message)


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


def configure_data_context() -> DataContextPort:
    values = {
        DATASETS_URL_TEMPLATE_ENV: (
            os.environ.get(DATASETS_URL_TEMPLATE_ENV) or ""
        ).strip(),
        DETAIL_URL_TEMPLATE_ENV: (
            os.environ.get(DETAIL_URL_TEMPLATE_ENV) or ""
        ).strip(),
        SUBJECT_ID_ENV: (os.environ.get(SUBJECT_ID_ENV) or "").strip(),
        WORKSPACE_ID_ENV: (os.environ.get(WORKSPACE_ID_ENV) or "").strip(),
        APP_CODE_ENV: (os.environ.get(APP_CODE_ENV) or "").strip(),
        PROJECTION_CONFIG_ENV: (
            os.environ.get(PROJECTION_CONFIG_ENV) or ""
        ).strip(),
    }
    missing = [name for name, value in values.items() if not value]
    if missing:
        return _UnconfiguredDataContextPort(
            "Data Context adapter is not configured; set " + ", ".join(missing)
        )
    try:
        return LabDataContextHttpPort(
            datasets_url_template=values[DATASETS_URL_TEMPLATE_ENV],
            detail_url_template=values[DETAIL_URL_TEMPLATE_ENV],
            subject_id=values[SUBJECT_ID_ENV],
            workspace_id=values[WORKSPACE_ID_ENV],
            app_code=values[APP_CODE_ENV],
            identity=EnvIdentityPort(),
            projection=load_projection_config(values[PROJECTION_CONFIG_ENV]),
        )
    except (DataContextError, ValueError) as error:
        return _UnconfiguredDataContextPort(str(error))


def configure_dqe() -> DqeExecutionPort:
    base_url = (os.environ.get(DQE_BASE_URL_ENV) or "").strip()
    workspace_id = (os.environ.get(DQE_WORKSPACE_ID_ENV) or "").strip()
    if not base_url or not workspace_id:
        missing = [
            name
            for name, value in (
                (DQE_BASE_URL_ENV, base_url),
                (DQE_WORKSPACE_ID_ENV, workspace_id),
            )
            if not value
        ]
        return _UnconfiguredDqeExecutionPort(
            "DQE adapter is not configured; set " + ", ".join(missing)
        )
    return DqeHttpExecutionPort(
        base_url,
        workspace_id,
        EnvIdentityPort(),
        forbidden_hint=os.environ.get(DQE_FORBIDDEN_HINT_ENV),
    )


def configure_tool_surface() -> ToolSurface:
    value = (os.environ.get(TOOL_SURFACE_ENV) or "compatibility").strip()
    if value not in {"compatibility", "relay"}:
        raise RuntimeError(
            f"{TOOL_SURFACE_ENV} must be 'compatibility' or 'relay', got {value!r}"
        )
    return cast(ToolSurface, value)


def create_production_server():
    return create_mcp_server(
        BuildPageDependencies(
            data_context=configure_data_context(),
            dqe=configure_dqe(),
            page_assets=configure_page_assets(),
        ),
        tool_surface=configure_tool_surface(),
    )


mcp = create_production_server()


def main() -> None:
    mcp.run()
