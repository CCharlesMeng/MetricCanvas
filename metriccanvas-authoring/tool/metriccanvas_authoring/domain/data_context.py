from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence

from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import ValidationError


BUNDLE_ROOT = Path(__file__).resolve().parents[3]
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
class SemanticSurface:
    business_domain: str
    metrics_by_name: Mapping[str, SemanticMetric]
    dimensions_by_name: Mapping[str, SemanticDimension]

    def metric(self, name: str) -> SemanticMetric | None:
        return self.metrics_by_name.get(name)

    def dimension(self, name: str) -> SemanticDimension | None:
        return self.dimensions_by_name.get(name)


@dataclass(frozen=True, slots=True)
class DataContext:
    surfaces_by_domain: Mapping[str, SemanticSurface]

    def surface(self, business_domain: str) -> SemanticSurface | None:
        return self.surfaces_by_domain.get(business_domain)


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
    for raw_environment in _sequence(snapshot["executionEnvironments"]):
        environment = _mapping(raw_environment)
        for raw_schema in _sequence(environment["schemas"]):
            data_schema = _mapping(raw_schema)
            surface = _project_surface(data_schema)
            surfaces.setdefault(surface.business_domain, surface)
    return DataContext(surfaces_by_domain=surfaces), ()


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
