"""Which outbound adapters a process gets, decided once from the environment.

Every entrypoint assembles from here, so the target server no longer reaches
into a compatibility server for its adapters. A capability that is not
configured resolves to a port that fails with a stated reason; it is never
silently replaced by a weaker one.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from metriccanvas_authoring.adapters.relay.content_baselines import FileContentBaselines
from metriccanvas_authoring.adapters.firstparty.data_context_http import (
    APP_CODE_ENV,
    DATASETS_URL_TEMPLATE_ENV,
    DETAIL_URL_TEMPLATE_ENV,
    PROJECTION_CONFIG_ENV,
    SUBJECT_ID_ENV,
    WORKSPACE_ID_ENV,
    LabDataContextHttpPort,
    load_projection_config,
)
from metriccanvas_authoring.adapters.firstparty.dqe_http import (
    DQE_BASE_URL_ENV,
    DQE_FORBIDDEN_HINT_ENV,
    DQE_WORKSPACE_ID_ENV,
    DqeHttpExecutionPort,
)
from metriccanvas_authoring.adapters.relay.env_identity import EnvIdentityPort
from metriccanvas_authoring.adapters.firstparty.lifecycle_http import KnownLifecycleHttp
from metriccanvas_authoring.adapters.firstparty.dataset_metadata_http import (
    JavaDatasetMetadataProvider, DATASET_DETAIL_BASE_URL_ENV, DATASET_IDS_ENV,
)
from metriccanvas_authoring.adapters.relay.lifecycle_spool import (
    FileLifecyclePrograms,
    InjectedLifecycleIdentity,
)
from metriccanvas_authoring.data.ports import (
    JsonObject,
    DataContextError,
    DataContextPort,
    DqeExecutionPort,
)
from metriccanvas_authoring.data.execution import DqeExecutionError, DqeExecutionResult

CONTENT_BASELINES_DIRECTORY_ENV = "METRICCANVAS_CONTENT_BASELINES_DIR"
CONTENT_SUMMARY_CONFIG_ENV = "METRICCANVAS_CONTENT_AI_SUMMARY_CONFIG"
LIFECYCLE_COLLECTION_URL_ENV = "METRICCANVAS_LIFECYCLE_COLLECTION_URL"
LIFECYCLE_INPUTS_DIRECTORY_ENV = "METRICCANVAS_LIFECYCLE_INPUTS_DIR"
LIFECYCLE_OUTPUTS_DIRECTORY_ENV = "METRICCANVAS_LIFECYCLE_OUTPUTS_DIR"


class _UnconfiguredDataContextPort:
    configured = False
    def __init__(self, message: str) -> None:
        self._message = message

    async def current(self) -> JsonObject:
        raise DataContextError("DATA_CONTEXT_CONFIG_ERROR", self._message)


class _UnconfiguredDqeExecutionPort:
    configured = False
    def __init__(self, message: str) -> None:
        self._message = message

    async def execute(self, effective_query: JsonObject) -> DqeExecutionResult:
        raise DqeExecutionError("DQE_CONFIG_ERROR", self._message)


def unconfigured_data_context(reason: str) -> DataContextPort:
    """A governed-metadata port that states why it is unavailable when called."""
    return _UnconfiguredDataContextPort(reason)


def unconfigured_dqe(reason: str) -> DqeExecutionPort:
    """An execution port that states why it is unavailable when called."""
    return _UnconfiguredDqeExecutionPort(reason)


def configure_data_context(*, identities=None) -> DataContextPort:
    java_base = (os.environ.get(DATASET_DETAIL_BASE_URL_ENV) or '').strip()
    if java_base:
        try:
            config = (os.environ.get(PROJECTION_CONFIG_ENV) or '').strip()
            return JavaDatasetMetadataProvider(java_base, identities or InjectedLifecycleIdentity(),
                dataset_ids=json.loads(os.environ.get(DATASET_IDS_ENV, 'null')),
                projection=load_projection_config(config) if config else None)
        except (DataContextError, ValueError) as error:
            return _UnconfiguredDataContextPort(str(error))
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


def configure_content_baselines() -> FileContentBaselines:
    return FileContentBaselines(_directory(CONTENT_BASELINES_DIRECTORY_ENV))


def configure_summary_config():
    """Optional summary configuration; unreadable JSON leaves the capability off."""
    try:
        return json.loads(os.environ.get(CONTENT_SUMMARY_CONFIG_ENV, "null"))
    except ValueError:
        return None


def configure_lifecycle_service() -> KnownLifecycleHttp:
    return KnownLifecycleHttp(os.environ.get(LIFECYCLE_COLLECTION_URL_ENV, ""))


def configure_lifecycle_programs() -> FileLifecyclePrograms:
    return FileLifecyclePrograms(
        _directory(LIFECYCLE_INPUTS_DIRECTORY_ENV),
        _directory(LIFECYCLE_OUTPUTS_DIRECTORY_ENV),
    )


def configure_lifecycle_identities() -> InjectedLifecycleIdentity:
    return InjectedLifecycleIdentity()


def _directory(name: str) -> Path | None:
    value = (os.environ.get(name) or "").strip()
    return Path(value) if value else None
