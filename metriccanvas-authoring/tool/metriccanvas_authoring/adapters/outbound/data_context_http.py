from __future__ import annotations

import asyncio
import hashlib
import json
import socket
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping, Sequence

from metriccanvas_authoring.application.ports import (
    DataContextError,
    DimensionValuePort,
    IdentityPort,
    JsonObject,
)
from metriccanvas_authoring.domain.data_context import parse_data_context


DATASETS_URL_TEMPLATE_ENV = "METRICCANVAS_DATA_CONTEXT_DATASETS_URL_TEMPLATE"
DETAIL_URL_TEMPLATE_ENV = "METRICCANVAS_DATA_CONTEXT_DETAIL_URL_TEMPLATE"
SUBJECT_ID_ENV = "METRICCANVAS_DATA_CONTEXT_SUBJECT_ID"
WORKSPACE_ID_ENV = "METRICCANVAS_DATA_CONTEXT_WORKSPACE_ID"
APP_CODE_ENV = "METRICCANVAS_DATA_CONTEXT_APP_CODE"
PROJECTION_CONFIG_ENV = "METRICCANVAS_DATA_CONTEXT_PROJECTION_CONFIG"
DEFAULT_TIMEOUT_SECONDS = 20.0

HttpResponse = tuple[int, bytes]
HttpTransport = Callable[[str, str, dict[str, str], bytes | None], HttpResponse]


@dataclass(frozen=True, slots=True)
class DataContextProjection:
    environment: Mapping[str, Any]
    metric_governance: Mapping[str, Any]
    field_governance: Mapping[str, Any]
    defaults: Mapping[str, Any]

    @classmethod
    def from_mapping(cls, value: Any) -> DataContextProjection:
        if not isinstance(value, Mapping):
            raise DataContextError(
                "DATA_CONTEXT_CONFIG_ERROR", "projection config must be an object"
            )
        environment = value.get("environment")
        if not isinstance(environment, Mapping):
            raise DataContextError(
                "DATA_CONTEXT_CONFIG_ERROR",
                "projection config environment must be an object",
            )
        return cls(
            environment=environment,
            metric_governance=_optional_mapping(value.get("metricGovernance")),
            field_governance=_optional_mapping(value.get("fieldGovernance")),
            defaults=_optional_mapping(value.get("defaults")),
        )


def load_projection_config(path: str) -> DataContextProjection:
    try:
        value = json.loads(Path(path).expanduser().read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise DataContextError(
            "DATA_CONTEXT_CONFIG_ERROR",
            f"cannot read Data Context projection config {path!r}: {error}",
        ) from error
    return DataContextProjection.from_mapping(value)


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
        self._datasets_url_template = datasets_url_template
        self._detail_url_template = detail_url_template
        self._subject_id = subject_id.strip()
        self._workspace_id = workspace_id.strip()
        self._app_code = app_code.strip()
        self._identity = identity
        self._projection = projection
        self._dimension_values = dimension_values
        self._timeout_seconds = timeout_seconds
        self._transport = transport or self._urllib_transport
        self._snapshot: dict[str, Any] | None = None

    async def current(self) -> JsonObject:
        if self._snapshot is not None:
            return _deepcopy_json(self._snapshot)
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
        snapshot = _project_snapshot(
            subject_id=self._subject_id,
            details=details,
            projection=self._projection,
            values_by_dataset=values_by_dataset,
        )
        _, issues = parse_data_context(snapshot)
        if issues:
            first = issues[0]
            raise DataContextError(
                "DATA_CONTEXT_PROJECTION_ERROR",
                f"projected Schema 1.1 is invalid at {first.path}: {first.message}",
            )
        self._snapshot = snapshot
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
            status, raw = await asyncio.to_thread(
                self._transport, "GET", url, headers, None
            )
        except DataContextError:
            raise
        except (TimeoutError, socket.timeout) as error:
            raise DataContextError(
                "DATA_CONTEXT_TIMEOUT",
                f"Lab metadata timed out after {self._timeout_seconds:g}s",
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

    def _urllib_transport(
        self,
        method: str,
        url: str,
        headers: dict[str, str],
        payload: bytes | None,
    ) -> HttpResponse:
        request = urllib.request.Request(url, data=payload, method=method, headers=headers)
        try:
            with urllib.request.urlopen(
                request, timeout=self._timeout_seconds
            ) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            return error.code, error.read()


def _project_snapshot(
    *,
    subject_id: str,
    details: Sequence[Mapping[str, Any]],
    projection: DataContextProjection,
    values_by_dataset: Mapping[str, Mapping[str, Sequence[str]]],
) -> dict[str, Any]:
    environment = projection.environment
    updates = [(_required_string(detail, "id"), _update_value(detail)) for detail in details]
    generated_at = _latest_update_timestamp(updates)
    version_input = json.dumps(
        sorted(updates), ensure_ascii=False, separators=(",", ":")
    )
    version = hashlib.sha256(version_input.encode("utf-8")).hexdigest()
    schemas = [
        _project_schema(
            detail,
            projection,
            values_by_dataset.get(_required_string(detail, "id"), {}),
        )
        for detail in details
    ]
    return {
        "formatVersion": "1.1",
        "id": f"lab-subject:{subject_id}",
        "version": version,
        "generatedAt": generated_at,
        "source": "lab-nl2sql2",
        "executionEnvironments": [
            {
                "id": _required_string(environment, "id"),
                "name": _required_string(environment, "name"),
                "language": "dqe",
                "endpointRef": _required_string(environment, "endpointRef"),
                **_optional_property(environment, "description"),
                "schemas": schemas,
                "constraints": _required_mapping(environment, "constraints"),
                "security": _required_mapping(environment, "security"),
            }
        ],
    }


def _project_schema(
    detail: Mapping[str, Any],
    projection: DataContextProjection,
    dimension_values: Mapping[str, Sequence[str]],
) -> dict[str, Any]:
    dataset_id = _required_string(detail, "id")
    name = _first_string(detail, "caption", "name", "id")
    if name is None:
        raise DataContextError(
            "DATA_CONTEXT_ENVELOPE_ERROR", f"dataset {dataset_id} has no caption"
        )
    description = _first_string(detail, "description") or name
    logical_schema = _required_mapping(detail, "logical_schema")
    field_schema = _required_mapping(logical_schema, "field_schema")
    dimensions = _required_sequence(field_schema, "dimensions")
    metrics = _required_sequence(field_schema, "metrics")
    fields = [
        _project_dimension(dataset_id, raw, projection, dimension_values)
        for raw in dimensions
        if isinstance(raw, Mapping)
    ]
    if len(fields) != len(dimensions):
        raise DataContextError(
            "DATA_CONTEXT_ENVELOPE_ERROR",
            f"dataset {dataset_id} dimensions must all be objects",
        )
    projected_metrics = [
        _project_metric(dataset_id, raw, projection)
        for raw in metrics
        if isinstance(raw, Mapping)
    ]
    if len(projected_metrics) != len(metrics):
        raise DataContextError(
            "DATA_CONTEXT_ENVELOPE_ERROR",
            f"dataset {dataset_id} metrics must all be objects",
        )
    return {
        "id": dataset_id,
        "name": name,
        "description": description,
        "metrics": projected_metrics,
        "objects": [
            {
                "id": dataset_id,
                "name": name,
                "kind": "dataset",
                "description": description,
                "fields": fields,
            }
        ],
        "relationships": [],
        "verifiedQueries": [],
    }


def _project_metric(
    dataset_id: str,
    raw: Mapping[str, Any],
    projection: DataContextProjection,
) -> dict[str, Any]:
    name = _first_string(raw, "name", "caption", "code")
    if name is None:
        raise DataContextError(
            "DATA_CONTEXT_ENVELOPE_ERROR", f"dataset {dataset_id} has a metric without name"
        )
    governance = _governance_for(projection.metric_governance, dataset_id, name)
    additivity = _metric_additivity(raw, governance)
    time_aggregation = _metric_time_aggregation(raw, governance)
    is_ratio = _required_bool_value(
        raw, governance, projection.defaults, "isRatio", dataset_id, name
    )
    nullable = _required_bool_value(
        raw, governance, projection.defaults, "nullable", dataset_id, name
    )
    sensitive = _required_bool_value(
        raw, governance, projection.defaults, "sensitive", dataset_id, name
    )
    description = (
        _first_string(raw, "definition", "calculateLogic", "description") or name
    )
    result: dict[str, Any] = {
        "name": name,
        "type": "number",
        "description": description,
        "additivity": additivity,
        "timeAggregation": time_aggregation,
        "isRatio": is_ratio,
        "dimensions": _reference_names(raw.get("dimensions"), raw.get("timeDimensions")),
        "nullable": nullable,
        "sensitive": sensitive,
    }
    aliases = _aliases(raw)
    if aliases:
        result["aliases"] = aliases
    unit = _first_string(raw, "unit")
    if unit is not None:
        result["unit"] = unit
    return result


def _project_dimension(
    dataset_id: str,
    raw: Mapping[str, Any],
    projection: DataContextProjection,
    dimension_values: Mapping[str, Sequence[str]],
) -> dict[str, Any]:
    name = _first_string(raw, "name", "caption", "code")
    if name is None:
        raise DataContextError(
            "DATA_CONTEXT_ENVELOPE_ERROR",
            f"dataset {dataset_id} has a dimension without name",
        )
    governance = _governance_for(projection.field_governance, dataset_id, name)
    is_time = raw.get("dimensionType") == "strDateTypeDimension"
    field_type = _field_type(raw, governance, is_time)
    nullable = _required_bool_value(
        raw, governance, projection.defaults, "nullable", dataset_id, name
    )
    sensitive = _required_bool_value(
        raw, governance, projection.defaults, "sensitive", dataset_id, name
    )
    granularities = _time_granularities(raw) if is_time else []
    description = _first_string(raw, "definition", "description") or name
    values = dimension_values.get(name, ())
    if values and not sensitive and not is_time:
        normalized_values = [
            entry.strip()
            for entry in values
            if isinstance(entry, str) and entry.strip()
        ]
        if normalized_values:
            description = (
                description.rstrip("。")
                + "。取值域:"
                + "、".join(dict.fromkeys(normalized_values))
                + "。"
            )
    result: dict[str, Any] = {
        "name": name,
        "type": field_type,
        "description": description,
        "roleHints": ["dimension", *(("time",) if is_time else ())],
        "nullable": nullable,
        "sensitive": sensitive,
    }
    aliases = _aliases(raw)
    if aliases:
        result["aliases"] = aliases
    if granularities:
        result["granularity"] = ",".join(granularities)
    return result


def _metric_additivity(
    raw: Mapping[str, Any], governance: Mapping[str, Any]
) -> str:
    direct = raw.get("additivity", governance.get("additivity"))
    if direct in {"可加", "半可加", "不可加"}:
        return str(direct)
    aggregator = str(raw.get("aggregator") or "").strip().upper()
    if aggregator in {"SUM", "COUNT"} and raw.get("isAgg") is not False:
        return "可加"
    if aggregator in {"LAST", "LAST_VALUE"}:
        return "半可加"
    if aggregator in {"AVG", "AVERAGE"} or raw.get("isAgg") is False:
        return "不可加"
    raise DataContextError(
        "DATA_CONTEXT_GOVERNANCE_REQUIRED",
        "metric additivity is absent from Lab and projection governance",
    )


def _metric_time_aggregation(
    raw: Mapping[str, Any], governance: Mapping[str, Any]
) -> str:
    direct = raw.get("timeAggregation", governance.get("timeAggregation"))
    if direct in {"求和", "均值", "期末值"}:
        return str(direct)
    aggregator = str(raw.get("aggregator") or "").strip().upper()
    mapping = {
        "SUM": "求和",
        "COUNT": "求和",
        "AVG": "均值",
        "AVERAGE": "均值",
        "LAST": "期末值",
        "LAST_VALUE": "期末值",
    }
    if aggregator in mapping:
        return mapping[aggregator]
    raise DataContextError(
        "DATA_CONTEXT_GOVERNANCE_REQUIRED",
        "metric time aggregation is absent from Lab and projection governance",
    )


def _required_bool_value(
    raw: Mapping[str, Any],
    governance: Mapping[str, Any],
    defaults: Mapping[str, Any],
    key: str,
    dataset_id: str,
    name: str,
) -> bool:
    for source in (raw, governance, defaults):
        value = source.get(key)
        if isinstance(value, bool):
            return value
    raise DataContextError(
        "DATA_CONTEXT_GOVERNANCE_REQUIRED",
        f"{dataset_id}/{name} requires explicit {key} governance",
    )


def _field_type(
    raw: Mapping[str, Any], governance: Mapping[str, Any], is_time: bool
) -> str:
    configured = governance.get("type")
    if configured in {"string", "number", "boolean", "date", "datetime"}:
        return str(configured)
    if is_time:
        return "date"
    value = str(raw.get("dataType") or raw.get("type") or "").lower()
    if any(token in value for token in ("int", "long", "float", "double", "decimal", "number")):
        return "number"
    if "bool" in value:
        return "boolean"
    if "timestamp" in value or "datetime" in value:
        return "datetime"
    if "date" in value:
        return "date"
    return "string"


def _time_granularities(raw: Mapping[str, Any]) -> list[str]:
    result: list[str] = []
    hierarchies = raw.get("hierarchies")
    if not isinstance(hierarchies, list):
        return result
    for hierarchy in hierarchies:
        if not isinstance(hierarchy, Mapping):
            continue
        levels = hierarchy.get("levels")
        if not isinstance(levels, list):
            continue
        for level in levels:
            if not isinstance(level, Mapping):
                continue
            level_type = _nonempty_string(level.get("levelType"))
            if level_type is None or not level_type.endswith("Level"):
                continue
            granularity = level_type.removesuffix("Level")
            if granularity in {"year", "month", "day"} and granularity not in result:
                result.append(granularity)
    return result


def _dimension_names(detail: Mapping[str, Any]) -> list[str]:
    logical_schema = _required_mapping(detail, "logical_schema")
    field_schema = _required_mapping(logical_schema, "field_schema")
    names: list[str] = []
    for raw in _required_sequence(field_schema, "dimensions"):
        if not isinstance(raw, Mapping):
            continue
        name = _first_string(raw, "name", "caption", "code")
        if name is not None:
            names.append(name)
    return names


def _aliases(raw: Mapping[str, Any]) -> list[str]:
    result: list[str] = []
    for key in ("synonyms", "publicSynonyms"):
        value = raw.get(key)
        entries = value if isinstance(value, list) else [value] if isinstance(value, str) else []
        for entry in entries:
            if isinstance(entry, str):
                for alias in entry.replace(",", "、").split("、"):
                    alias = alias.strip()
                    if alias and alias not in result:
                        result.append(alias)
    return result


def _reference_names(*values: Any) -> list[str]:
    result: list[str] = []
    for value in values:
        if not isinstance(value, list):
            continue
        for entry in value:
            if isinstance(entry, str):
                name = entry
            elif isinstance(entry, Mapping):
                name = _first_string(entry, "name", "caption")
            else:
                name = None
            if name and name not in result:
                result.append(name)
    return result


def _governance_for(
    root: Mapping[str, Any], dataset_id: str, name: str
) -> Mapping[str, Any]:
    dataset = root.get(dataset_id)
    if not isinstance(dataset, Mapping):
        return {}
    entry = dataset.get(name)
    return entry if isinstance(entry, Mapping) else {}


def _update_value(detail: Mapping[str, Any]) -> str:
    value = detail.get("update_date")
    if value is None:
        raise DataContextError(
            "DATA_CONTEXT_ENVELOPE_ERROR",
            f"dataset {_required_string(detail, 'id')} has no update_date",
        )
    return str(value)


def _latest_update_timestamp(updates: Sequence[tuple[str, str]]) -> str:
    parsed = [_parse_timestamp(value) for _, value in updates]
    if not parsed:
        return datetime.fromtimestamp(0, tz=timezone.utc).isoformat().replace(
            "+00:00", "Z"
        )
    return max(parsed).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _parse_timestamp(value: str) -> datetime:
    try:
        numeric = float(value)
    except ValueError:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as error:
            raise DataContextError(
                "DATA_CONTEXT_ENVELOPE_ERROR", f"invalid update_date: {value!r}"
            ) from error
        return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=timezone.utc)
    seconds = numeric / 1000 if numeric > 100_000_000_000 else numeric
    try:
        return datetime.fromtimestamp(seconds, tz=timezone.utc)
    except (OverflowError, OSError, ValueError) as error:
        raise DataContextError(
            "DATA_CONTEXT_ENVELOPE_ERROR", f"invalid update_date: {value!r}"
        ) from error


def _required_string(value: Mapping[str, Any], key: str) -> str:
    result = _nonempty_string(value.get(key))
    if result is None:
        raise DataContextError(
            "DATA_CONTEXT_CONFIG_ERROR", f"required string is missing: {key}"
        )
    return result


def _first_string(value: Mapping[str, Any], *keys: str) -> str | None:
    return next(
        (entry for key in keys if (entry := _nonempty_string(value.get(key))) is not None),
        None,
    )


def _nonempty_string(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _required_mapping(value: Mapping[str, Any], key: str) -> dict[str, Any]:
    result = value.get(key)
    if not isinstance(result, Mapping):
        raise DataContextError(
            "DATA_CONTEXT_CONFIG_ERROR", f"required object is missing: {key}"
        )
    return dict(result)


def _required_sequence(value: Mapping[str, Any], key: str) -> list[Any]:
    result = value.get(key)
    if not isinstance(result, list):
        raise DataContextError(
            "DATA_CONTEXT_ENVELOPE_ERROR", f"required array is missing: {key}"
        )
    return result


def _optional_mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _optional_property(value: Mapping[str, Any], key: str) -> dict[str, Any]:
    result = _nonempty_string(value.get(key))
    return {} if result is None else {key: result}


def _deepcopy_json(value: Mapping[str, Any]) -> dict[str, Any]:
    return json.loads(json.dumps(value, ensure_ascii=False))
