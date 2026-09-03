from __future__ import annotations

import json
import re
from copy import deepcopy
from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import ValidationError

from metriccanvas_authoring.runtime_assets import bundle_root


BUNDLE_ROOT = bundle_root()
DATA_CONTEXT_SCHEMA = BUNDLE_ROOT / "contract-snapshot" / "data-context" / "schema.json"
VALUE_DOMAIN_PATTERN = re.compile(r"取值域[:：]([^。]+)")


@dataclass(frozen=True, slots=True)
class DataContextIssue:
    code: str
    path: str
    message: str


@dataclass(frozen=True, slots=True)
class SemanticMetric:
    name: str
    field_type: str
    unit: str | None
    nullable: bool
    sensitive: bool


@dataclass(frozen=True, slots=True)
class SemanticDimension:
    name: str
    field_type: str
    nullable: bool
    sensitive: bool
    values: tuple[str, ...] | None
    granularities: tuple[str, ...]
    is_time: bool


@dataclass(frozen=True, slots=True)
class MetricEntry:
    business_domain: str
    name: str
    definition: str
    aliases: tuple[str, ...]
    unit: str | None


@dataclass(frozen=True, slots=True)
class DimensionEntry:
    business_domain: str
    name: str
    definition: str
    aliases: tuple[str, ...]
    values: tuple[str, ...] | None
    granularities: tuple[str, ...]
    is_time: bool


@dataclass(frozen=True, slots=True)
class SemanticSurface:
    business_domain: str
    metrics_by_name: Mapping[str, SemanticMetric]
    dimensions_by_name: Mapping[str, SemanticDimension]

    def metric(self, name: str) -> SemanticMetric | None:
        return self.metrics_by_name.get(name)

    def dimension(self, name: str) -> SemanticDimension | None:
        return self.dimensions_by_name.get(name)


@dataclass(frozen=True, slots=True)
class SearchCandidate:
    match: Mapping[str, Any]
    text: str


@dataclass(frozen=True, slots=True)
class DataContext:
    version: str
    surfaces_by_domain: Mapping[str, SemanticSurface]
    metric_entries: tuple[MetricEntry, ...]
    dimension_entries: tuple[DimensionEntry, ...]
    search_candidates: tuple[SearchCandidate, ...]

    def surface(self, business_domain: str) -> SemanticSurface | None:
        return self.surfaces_by_domain.get(business_domain)

    def search(self, query: str, limit: int = 10) -> tuple[Mapping[str, Any], ...]:
        needle = query.strip().casefold()
        if not needle or limit <= 0:
            return ()
        ranked = [
            (score, index, candidate)
            for index, candidate in enumerate(self.search_candidates)
            if (score := _match_score(needle, candidate.text)) is not None
        ]
        ranked.sort(key=lambda item: (item[0], item[1]))
        return tuple(
            deepcopy(candidate.match) for _, _, candidate in ranked[:limit]
        )


def parse_data_context(
    value: Any,
) -> tuple[DataContext | None, tuple[DataContextIssue, ...]]:
    """Validate the neutral snapshot and project its authoring semantic surface."""
    schema = json.loads(DATA_CONTEXT_SCHEMA.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    issues = [
        DataContextIssue("DATA_CONTEXT_SCHEMA_ERROR", path, error.message)
        for error in validator.iter_errors(value)
        for path in _error_paths(error)
    ]
    if issues:
        return None, tuple(sorted(issues, key=lambda issue: (issue.path, issue.message)))

    snapshot = _mapping(value)
    surfaces: dict[str, SemanticSurface] = {}
    metric_entries: list[MetricEntry] = []
    dimension_entries: list[DimensionEntry] = []
    search_candidates: list[SearchCandidate] = []
    for raw_environment in _sequence(snapshot["executionEnvironments"]):
        environment = _mapping(raw_environment)
        environment_id = str(environment["id"])
        search_candidates.append(
            SearchCandidate(
                match={
                    "kind": "environment",
                    "environmentId": environment_id,
                    "name": environment["name"],
                    **(
                        {}
                        if environment.get("description") is None
                        else {"description": environment["description"]}
                    ),
                },
                text=_join_text(
                    environment["id"],
                    environment["name"],
                    environment.get("description"),
                ),
            )
        )
        for raw_schema in _sequence(environment["schemas"]):
            data_schema = _mapping(raw_schema)
            surface = _project_surface(data_schema)
            surfaces.setdefault(surface.business_domain, surface)
            metric_entries.extend(_metric_entries_for_schema(data_schema))
            dimension_entries.extend(_dimension_entries_for_schema(data_schema))
            search_candidates.extend(
                _search_candidates_for_schema(environment_id, data_schema)
            )
    return (
        DataContext(
            version=str(snapshot["version"]),
            surfaces_by_domain=surfaces,
            metric_entries=tuple(metric_entries),
            dimension_entries=tuple(dimension_entries),
            search_candidates=tuple(search_candidates),
        ),
        (),
    )


def _metric_entries_for_schema(schema: Mapping[str, Any]) -> list[MetricEntry]:
    business_domain = str(schema["name"])
    return [
        MetricEntry(
            business_domain=business_domain,
            name=str(metric["name"]),
            definition=str(metric["description"]),
            aliases=tuple(str(alias) for alias in _sequence(metric.get("aliases", []))),
            unit=_optional_string(metric.get("unit")),
        )
        for raw_metric in _sequence(schema["metrics"])
        for metric in [_mapping(raw_metric)]
    ]


def _dimension_entries_for_schema(
    schema: Mapping[str, Any],
) -> list[DimensionEntry]:
    business_domain = str(schema["name"])
    entries: list[DimensionEntry] = []
    for raw_object in _sequence(schema["objects"]):
        data_object = _mapping(raw_object)
        for raw_field in _sequence(data_object["fields"]):
            field = _mapping(raw_field)
            role_hints = {str(value) for value in _sequence(field["roleHints"])}
            is_time = "time" in role_hints
            if not is_time and "dimension" not in role_hints:
                continue
            entries.append(
                DimensionEntry(
                    business_domain=business_domain,
                    name=str(field["name"]),
                    definition=str(field["description"]),
                    aliases=tuple(
                        str(alias) for alias in _sequence(field.get("aliases", []))
                    ),
                    values=(
                        None
                        if bool(field["sensitive"]) or is_time
                        else _parse_value_domain(str(field["description"]))
                    ),
                    granularities=(
                        tuple(
                            part.strip()
                            for part in str(field.get("granularity", "")).split(",")
                            if part.strip()
                        )
                        if is_time
                        else ()
                    ),
                    is_time=is_time,
                )
            )
    return entries


def _project_surface(schema: Mapping[str, Any]) -> SemanticSurface:
    metrics: dict[str, SemanticMetric] = {}
    for raw_metric in _sequence(schema["metrics"]):
        declaration = _mapping(raw_metric)
        metric = SemanticMetric(
            name=str(declaration["name"]),
            field_type=str(declaration["type"]),
            unit=_optional_string(declaration.get("unit")),
            nullable=bool(declaration["nullable"]),
            sensitive=bool(declaration["sensitive"]),
        )
        _index_name_and_aliases(metrics, metric, declaration)

    dimensions: dict[str, SemanticDimension] = {}
    for raw_object in _sequence(schema["objects"]):
        data_object = _mapping(raw_object)
        for raw_field in _sequence(data_object["fields"]):
            declaration = _mapping(raw_field)
            role_hints = {str(value) for value in _sequence(declaration["roleHints"])}
            is_time = "time" in role_hints
            if not is_time and "dimension" not in role_hints:
                continue
            dimension = SemanticDimension(
                name=str(declaration["name"]),
                field_type=str(declaration["type"]),
                nullable=bool(declaration["nullable"]),
                sensitive=bool(declaration["sensitive"]),
                values=(
                    None
                    if bool(declaration["sensitive"])
                    else _parse_value_domain(str(declaration["description"]))
                ),
                granularities=(
                    tuple(
                        part.strip()
                        for part in str(declaration.get("granularity", "")).split(",")
                        if part.strip()
                    )
                    if is_time
                    else ()
                ),
                is_time=is_time,
            )
            _index_name_and_aliases(dimensions, dimension, declaration)

    return SemanticSurface(
        business_domain=str(schema["name"]),
        metrics_by_name=metrics,
        dimensions_by_name=dimensions,
    )


def _index_name_and_aliases(
    index: dict[str, Any],
    item: SemanticMetric | SemanticDimension,
    declaration: Mapping[str, Any],
) -> None:
    index.setdefault(item.name, item)
    for alias in _sequence(declaration.get("aliases", [])):
        index.setdefault(str(alias), item)


def _parse_value_domain(description: str) -> tuple[str, ...] | None:
    match = VALUE_DOMAIN_PATTERN.search(description)
    if match is None:
        return None
    values = tuple(value.strip() for value in match.group(1).split("、") if value.strip())
    return values or None


def _search_candidates_for_schema(
    environment_id: str, schema: Mapping[str, Any]
) -> list[SearchCandidate]:
    schema_id = str(schema["id"])
    candidates = [
        SearchCandidate(
            match={
                "kind": "schema",
                "environmentId": environment_id,
                "schemaId": schema_id,
                "name": schema["name"],
                "description": schema["description"],
            },
            text=_join_text(schema["id"], schema["name"], schema["description"]),
        )
    ]
    for raw_metric in _sequence(schema["metrics"]):
        metric = _mapping(raw_metric)
        candidates.append(
            SearchCandidate(
                match={
                    "kind": "metric",
                    "environmentId": environment_id,
                    "schemaId": schema_id,
                    "metric": deepcopy(dict(metric)),
                },
                text=_join_text(
                    metric["name"],
                    metric["description"],
                    *_sequence(metric.get("aliases", [])),
                ),
            )
        )
    for raw_object in _sequence(schema["objects"]):
        data_object = _mapping(raw_object)
        object_id = str(data_object["id"])
        candidates.append(
            SearchCandidate(
                match={
                    "kind": "object",
                    "environmentId": environment_id,
                    "schemaId": schema_id,
                    "objectId": object_id,
                    "name": data_object["name"],
                    "description": data_object["description"],
                },
                text=_join_text(
                    data_object["id"],
                    data_object["name"],
                    data_object["description"],
                ),
            )
        )
        for raw_field in _sequence(data_object["fields"]):
            field = _redacted_field(_mapping(raw_field))
            candidates.append(
                SearchCandidate(
                    match={
                        "kind": "field",
                        "environmentId": environment_id,
                        "schemaId": schema_id,
                        "objectId": object_id,
                        "field": field,
                    },
                    text=_join_text(
                        field["name"],
                        field["description"],
                        *_sequence(field.get("aliases", [])),
                    ),
                )
            )
    for raw_query in _sequence(schema["verifiedQueries"]):
        query = _mapping(raw_query)
        candidates.append(
            SearchCandidate(
                match={
                    "kind": "verifiedQuery",
                    "environmentId": environment_id,
                    "schemaId": schema_id,
                    "query": deepcopy(dict(query)),
                },
                text=_join_text(
                    query["id"], query["question"], query["description"]
                ),
            )
        )
    return candidates


def _redacted_field(field: Mapping[str, Any]) -> dict[str, Any]:
    result = deepcopy(dict(field))
    if bool(result["sensitive"]):
        result["description"] = VALUE_DOMAIN_PATTERN.sub(
            "取值域:(敏感,已隐去)", str(result["description"])
        )
    return result


def _match_score(needle: str, text: str) -> int | None:
    normalized = text.casefold()
    if normalized == needle:
        return 0
    if normalized.startswith(needle):
        return 1
    if needle in normalized:
        return 2
    return None


def _join_text(*values: object) -> str:
    return " ".join("" if value is None else str(value) for value in values)


def _error_paths(error: ValidationError) -> list[str]:
    base = _pointer(error.absolute_path)
    if error.validator == "required" and isinstance(error.instance, dict):
        missing = [name for name in error.validator_value if name not in error.instance]
        return [_join_pointer(base, name) for name in missing]
    return [base]


def _join_pointer(base: str, part: object) -> str:
    encoded = str(part).replace("~", "~0").replace("/", "~1")
    return f"{base}/{encoded}" if base else f"/{encoded}"


def _pointer(parts: Any) -> str:
    result = ""
    for part in parts:
        result = _join_pointer(result, part)
    return result


def _mapping(value: object) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise TypeError("expected object")
    return value


def _sequence(value: object) -> Sequence[object]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
        raise TypeError("expected array")
    return value


def _optional_string(value: object) -> str | None:
    return value if isinstance(value, str) else None
