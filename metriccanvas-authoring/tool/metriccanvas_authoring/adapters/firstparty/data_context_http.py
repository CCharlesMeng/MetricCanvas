from __future__ import annotations

import asyncio
import json
import socket
import urllib.error
import urllib.parse
from collections.abc import Callable
from typing import Any, Mapping, Sequence

import httpx

from metriccanvas_authoring.data.ports import DataContextError, DimensionValuePort, JsonObject
from metriccanvas_authoring.data.service_identity import IdentityPort
from metriccanvas_authoring.data.data_context import parse_data_context
from metriccanvas_authoring.data.validation_policy import QueryValidationPolicy


DATASETS_URL_TEMPLATE_ENV = "METRICCANVAS_DATA_CONTEXT_DATASETS_URL_TEMPLATE"
DETAIL_URL_TEMPLATE_ENV = "METRICCANVAS_DATA_CONTEXT_DETAIL_URL_TEMPLATE"
SUBJECT_ID_ENV = "METRICCANVAS_DATA_CONTEXT_SUBJECT_ID"
WORKSPACE_ID_ENV = "METRICCANVAS_DATA_CONTEXT_WORKSPACE_ID"
APP_CODE_ENV = "METRICCANVAS_DATA_CONTEXT_APP_CODE"
PROJECTION_CONFIG_ENV = "METRICCANVAS_DATA_CONTEXT_PROJECTION_CONFIG"
DEFAULT_TIMEOUT_SECONDS = 20.0

HttpResponse = tuple[int, bytes]
HttpTransport = Callable[[str, str, dict[str, str], bytes | None], HttpResponse]


from metriccanvas_authoring.data.lab_projection import (
    DataContextProjection, load_projection_config, project_lab_snapshot,
    _required_string, _required_mapping, _required_sequence, _nonempty_string,
    _deepcopy_json, _dimension_names,
)


class LabDataContextHttpPort:
    """Project Lab dataset list/detail responses into neutral Schema 1.1."""

    def __init__(
        self,
        *,
        datasets_url_template: str,
        detail_url_template: str,
        subject_id: str,
        workspace_id: str,
        app_code: str,
        identity: IdentityPort,
        projection: DataContextProjection,
        dimension_values: DimensionValuePort | None = None,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        transport: HttpTransport | None = None,
        async_transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        required = {
            "datasets_url_template": datasets_url_template,
            "detail_url_template": detail_url_template,
            "subject_id": subject_id,
            "workspace_id": workspace_id,
            "app_code": app_code,
        }
        missing = [name for name, value in required.items() if not value.strip()]
        if missing:
            raise ValueError("missing Data Context settings: " + ", ".join(missing))
        if "{subjectId}" not in datasets_url_template:
            raise ValueError("datasets_url_template must contain {subjectId}")
        if "{datasetId}" not in detail_url_template:
            raise ValueError("detail_url_template must contain {datasetId}")
        if transport is not None and async_transport is not None:
            raise ValueError("transport and async_transport are mutually exclusive")
        self._datasets_url_template = datasets_url_template
        self._detail_url_template = detail_url_template
        self._subject_id = subject_id.strip()
        self._workspace_id = workspace_id.strip()
        self._app_code = app_code.strip()
        self._identity = identity
        self._projection = projection
        self._dimension_values = dimension_values
        self._timeout_seconds = timeout_seconds
        self._transport = transport
        self._async_transport = async_transport
        self._snapshots: dict[bool, dict[str, Any]] = {}

    async def current(self) -> JsonObject:
        return await self.current_for_query(QueryValidationPolicy(strict=True))

    async def current_for_query(self, policy) -> JsonObject:
        if policy.strict in self._snapshots:
            return _deepcopy_json(self._snapshots[policy.strict])
        headers = self._headers()
        list_url = self._datasets_url_template.replace(
            "{subjectId}", urllib.parse.quote(self._subject_id, safe="")
        )
        dataset_list = await self._get_json(list_url, headers)
        raw_datasets = dataset_list.get("datasets")
        if not isinstance(raw_datasets, list):
            raise DataContextError(
                "DATA_CONTEXT_ENVELOPE_ERROR",
                "Lab dataset list response has no datasets array",
            )
        dataset_ids: list[str] = []
        for index, raw_dataset in enumerate(raw_datasets):
            if not isinstance(raw_dataset, Mapping):
                raise DataContextError(
                    "DATA_CONTEXT_ENVELOPE_ERROR",
                    f"Lab dataset list item {index} is not an object",
                )
            dataset_id = _nonempty_string(raw_dataset.get("id"))
            if dataset_id is None:
                raise DataContextError(
                    "DATA_CONTEXT_ENVELOPE_ERROR",
                    f"Lab dataset list item {index} has no id",
                )
            dataset_ids.append(dataset_id)
        if len(set(dataset_ids)) != len(dataset_ids):
            raise DataContextError(
                "DATA_CONTEXT_ENVELOPE_ERROR",
                "Lab dataset list contains duplicate ids",
            )
        details = await asyncio.gather(
            *(self._load_detail(dataset_id, headers) for dataset_id in dataset_ids)
        )
        values_by_dataset: dict[str, Mapping[str, Sequence[str]]] = {}
        if self._dimension_values is not None:
            values = await asyncio.gather(
                *(
                    self._dimension_values.values_for(
                        _required_string(detail, "id"), _dimension_names(detail)
                    )
                    for detail in details
                )
            )
            if not all(isinstance(entries, Mapping) for entries in values):
                raise DataContextError(
                    "DATA_CONTEXT_DIMENSION_VALUES_ERROR",
                    "DimensionValuePort must return a mapping for every dataset",
                )
            values_by_dataset = {
                _required_string(detail, "id"): entries
                for detail, entries in zip(details, values, strict=True)
            }
        snapshot = project_lab_snapshot(
            subject_id=self._subject_id,
            details=details,
            projection=self._projection,
            values_by_dataset=values_by_dataset,
            policy=policy,
        )
        _, issues = parse_data_context(snapshot, policy=policy)
        if issues:
            first = issues[0]
            raise DataContextError(
                "DATA_CONTEXT_PROJECTION_ERROR",
                f"projected Schema 1.1 is invalid at {first.path}: {first.message}",
            )
        self._snapshots[policy.strict] = snapshot
        return _deepcopy_json(snapshot)

    def _headers(self) -> dict[str, str]:
        try:
            identity = self._identity.current()
        except RuntimeError as error:
            raise DataContextError("DATA_CONTEXT_CONFIG_ERROR", str(error)) from error
        if not identity.auth_token:
            raise DataContextError(
                "DATA_CONTEXT_CONFIG_ERROR",
                "METRICCANVAS_AUTH_TOKEN is required by Lab metadata",
            )
        return {
            "Accept": "application/json",
            "X-Auth-Token": identity.auth_token,
            "X-Workspace-Id": self._workspace_id,
            "apiGw-app-code": self._app_code,
        }

    async def _load_detail(
        self, dataset_id: str, headers: dict[str, str]
    ) -> Mapping[str, Any]:
        url = self._detail_url_template.replace(
            "{datasetId}", urllib.parse.quote(dataset_id, safe="")
        )
        detail = await self._get_json(url, headers)
        returned_id = _nonempty_string(detail.get("id"))
        if returned_id != dataset_id:
            raise DataContextError(
                "DATA_CONTEXT_ENVELOPE_ERROR",
                f"Lab detail id {returned_id!r} does not match requested {dataset_id!r}",
            )
        return detail

    async def _get_json(
        self, url: str, headers: dict[str, str]
    ) -> Mapping[str, Any]:
        try:
            status, raw = await self._request("GET", url, headers, None)
        except DataContextError:
            raise
        except (TimeoutError, socket.timeout, httpx.TimeoutException) as error:
            raise DataContextError(
                "DATA_CONTEXT_TIMEOUT",
                f"Lab metadata timed out after {self._timeout_seconds:g}s",
            ) from error
        except httpx.RequestError as error:
            raise DataContextError(
                "DATA_CONTEXT_TRANSPORT_ERROR",
                f"Lab metadata is unreachable: {error}",
            ) from error
        except urllib.error.URLError as error:
            if isinstance(error.reason, (TimeoutError, socket.timeout)):
                raise DataContextError(
                    "DATA_CONTEXT_TIMEOUT",
                    f"Lab metadata timed out after {self._timeout_seconds:g}s",
                ) from error
            raise DataContextError(
                "DATA_CONTEXT_TRANSPORT_ERROR",
                f"Lab metadata is unreachable: {error}",
            ) from error
        except OSError as error:
            raise DataContextError(
                "DATA_CONTEXT_TRANSPORT_ERROR",
                f"Lab metadata is unreachable: {error}",
            ) from error
        if status == 401:
            raise DataContextError(
                "DATA_CONTEXT_AUTH_REQUIRED", "Lab metadata rejected authentication"
            )
        if status == 403:
            raise DataContextError(
                "DATA_CONTEXT_FORBIDDEN", "Lab metadata denied discovery"
            )
        if status < 200 or status >= 300:
            raise DataContextError(
                "DATA_CONTEXT_TRANSPORT_ERROR",
                f"Lab metadata returned HTTP {status}",
            )
        try:
            decoded = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise DataContextError(
                "DATA_CONTEXT_ENVELOPE_ERROR", "Lab metadata returned malformed JSON"
            ) from error
        if not isinstance(decoded, Mapping):
            raise DataContextError(
                "DATA_CONTEXT_ENVELOPE_ERROR",
                "Lab metadata response must be an object",
            )
        return decoded

    async def _request(
        self,
        method: str,
        url: str,
        headers: dict[str, str],
        payload: bytes | None,
    ) -> HttpResponse:
        if self._transport is not None:
            return await asyncio.to_thread(
                self._transport, method, url, headers, payload
            )
        async with httpx.AsyncClient(
            timeout=self._timeout_seconds,
            transport=self._async_transport,
            follow_redirects=True,
        ) as client:
            response = await client.request(
                method,
                url,
                headers=headers,
                content=payload,
            )
            return response.status_code, response.content
