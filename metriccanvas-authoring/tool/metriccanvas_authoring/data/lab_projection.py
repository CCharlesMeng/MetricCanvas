"""Shared Lab semantic projection. HTTP, credentials and company URLs stay in adapters."""
from __future__ import annotations
import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping, Sequence
from metriccanvas_authoring.data.ports import DataContextError
from metriccanvas_authoring.data.validation_policy import QueryValidationPolicy, OPTIONAL_GOVERNANCE

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


def project_lab_snapshot(
    *,
    subject_id: str,
    details: Sequence[Mapping[str, Any]],
    projection: DataContextProjection,
    values_by_dataset: Mapping[str, Mapping[str, Sequence[str]]],
    policy: QueryValidationPolicy = QueryValidationPolicy(strict=True),
) -> dict[str, Any]:
    diagnostics = inspect_projection_governance(details, projection, policy)
    if diagnostics['issues']:
        raise DataContextError('DATA_CONTEXT_GOVERNANCE_REQUIRED',
            'Data context governance is missing or invalid; run check_data_context.py for locations',
            diagnostics=diagnostics)
    environment = projection.environment
    updates = [(_required_string(detail, "id"), _update_value(detail)) for detail in details]
    generated_at = _latest_update_timestamp(updates)
    schemas = [
        _project_schema(
            detail,
            projection,
            values_by_dataset.get(_required_string(detail, "id"), {}),
            policy,
        )
        for detail in details
    ]
    versioned_content = {
        "formatVersion": "1.1",
        **({"queryValidationView": "1"} if not policy.strict else {}),
        "id": f"lab-subject:{subject_id}",
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
    version_input = json.dumps(
        {"subjectId": subject_id, "details": list(details),
         "projection": asdict(projection), "dimensionValues": values_by_dataset},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return {
        **versioned_content,
        "version": hashlib.sha256(version_input.encode("utf-8")).hexdigest(),
    }


def _project_schema(
    detail: Mapping[str, Any],
    projection: DataContextProjection,
    dimension_values: Mapping[str, Sequence[str]],
    policy: QueryValidationPolicy,
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
        _project_metric(dataset_id, raw, projection, policy)
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
    policy: QueryValidationPolicy,
) -> dict[str, Any]:
    name = _first_string(raw, "name", "caption", "code")
    if name is None:
        raise DataContextError(
            "DATA_CONTEXT_ENVELOPE_ERROR", f"dataset {dataset_id} has a metric without name"
        )
    governance = _governance_for(projection.metric_governance, dataset_id, name)
    optional = {}
    for key, read in (
        ('additivity', lambda: _metric_additivity(raw, governance)),
        ('timeAggregation', lambda: _metric_time_aggregation(raw, governance)),
        ('isRatio', lambda: _required_bool_value(raw, governance, projection.defaults, 'isRatio', dataset_id, name)),
    ):
        try:
            optional[key] = read()
        except DataContextError as error:
            if error.code != 'DATA_CONTEXT_GOVERNANCE_REQUIRED' or policy.strict or 'is invalid' in str(error):
                raise
    nullable = _required_bool_value(
        raw, governance, projection.defaults, "nullable", dataset_id, name
    )
    sensitive = _required_bool_value(
        raw, governance, projection.defaults, "sensitive", dataset_id, name
    )
    description = (
        _first_string(raw, "definition", "calculate_logic", "calculateLogic", "description") or name
    )
    result: dict[str, Any] = {
        "name": name,
        "type": "number",
        "description": description,
        **optional,
        "dimensions": _reference_names(raw.get("dimensions"), raw.get("time_dimensions", raw.get("timeDimensions"))),
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
    is_time = is_time_dimension(raw)
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
    direct = _declared_governance(raw, governance, 'additivity', {'可加', '半可加', '不可加'})
    if direct is not None:
        return direct
    raise DataContextError(
        "DATA_CONTEXT_GOVERNANCE_REQUIRED",
        "metric additivity is absent from Lab and projection governance",
    )


def _metric_time_aggregation(
    raw: Mapping[str, Any], governance: Mapping[str, Any]
) -> str:
    direct = _declared_governance(raw, governance, 'timeAggregation', {'求和', '均值', '期末值'})
    if direct is not None:
        return direct
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
        if value is not None and not (isinstance(value, str) and not value.strip()):
            raise DataContextError('DATA_CONTEXT_GOVERNANCE_REQUIRED', f'{key} is invalid')
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
    for key in ("synonyms", "public_synonyms", "publicSynonyms"):
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


def _declared_governance(raw, governance, key, allowed):
    """Empty declarations may be supplemented; explicit invalid values fail closed."""
    for source in (raw, governance):
        value = source.get(key)
        if value is None or isinstance(value, str) and not value.strip():
            continue
        if isinstance(value, str) and value in allowed:
            return value
        raise DataContextError('DATA_CONTEXT_GOVERNANCE_REQUIRED', f'metric {key} is invalid')
    return None


def inspect_projection_governance(details, projection, policy):
    """Collect bounded metadata locations, never raw values, rows or provider errors."""
    issues = []
    total = 0
    for dataset_index, detail in enumerate(details):
        dataset_id = _required_string(detail, 'id')
        fields = _required_mapping(_required_mapping(detail, 'logical_schema'), 'field_schema')
        for group, governance_root in (('metrics', projection.metric_governance),
                                        ('dimensions', projection.field_governance)):
            for index, raw in enumerate(_required_sequence(fields, group)):
                if not isinstance(raw, Mapping):
                    raise DataContextError('DATA_CONTEXT_ENVELOPE_ERROR', 'metadata field must be an object')
                name = _first_string(raw, 'name', 'caption', 'code') or ''
                governance = _governance_for(governance_root, dataset_id, name)
                properties = ['nullable', 'sensitive']
                if group == 'metrics':
                    properties = ['additivity', 'timeAggregation', 'isRatio', *properties]
                for key in properties:
                    try:
                        if key == 'additivity':
                            _metric_additivity(raw, governance)
                        elif key == 'timeAggregation':
                            _metric_time_aggregation(raw, governance)
                        else:
                            _required_bool_value(raw, governance, projection.defaults, key, dataset_id, name)
                    except DataContextError as error:
                        if error.code != 'DATA_CONTEXT_GOVERNANCE_REQUIRED':
                            raise
                        if not policy.strict and key in OPTIONAL_GOVERNANCE and 'is invalid' not in str(error):
                            continue
                        total += 1
                        if len(issues) < 100:
                            issues.append({'datasetId': dataset_id, 'field': name, 'property': key,
                                'path': f'/models/{dataset_index}/logical_schema/field_schema/{group}/{index}/{key}',
                                'reason': 'invalid' if 'is invalid' in str(error) else 'missing_or_unusable'})
    return {'stage': 'field_governance', 'issues': issues, 'issueCount': total,
            'truncated': total > len(issues)}


def business_domain(model):
    return _first_string(model, 'caption', 'name', 'id')


def is_time_dimension(raw):
    kind = raw.get('dimension_type', raw.get('dimensionType'))
    if kind in {'StrDateTypeDimension', 'strDateTypeDimension'}:
        return True
    if kind is None or kind in {'StandardDimension', 'standardDimension', 'stringDimension'}:
        return False
    raise DataContextError('DATA_CONTEXT_DIMENSION_TYPE_UNSUPPORTED', 'Unknown source dimension type')


def time_granularities(raw):
    return _time_granularities(raw) if is_time_dimension(raw) else []


def dimension_name(raw):
    return _first_string(raw, 'name', 'caption', 'code')
