"""取数单元：从业务语义派生 DQE 请求与结果字段契约，并把执行结果投影为查询源。

查询定义与结果字段契约是取数单元经真实执行后的派生物（见 CONTEXT.md「取数单元」），
因此归 `data`。本模块不选组件、不排布局、不装配页面。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from metriccanvas_authoring.build_issues import PageBuildingIssue
from metriccanvas_authoring.data.data_context import DataContext, SemanticSurface
from metriccanvas_authoring.data.execution import DqeExecutionResult, FormulaTrace


@dataclass(frozen=True, slots=True)
class ScopeFilter:
    dimension: str
    values: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class UnitScope:
    business_domain: str
    group_by: tuple[str, ...]
    time_range: str
    granularity: str
    filters: tuple[ScopeFilter, ...]


@dataclass(frozen=True, slots=True)
class ExecutableUnit:
    data_source_id: str
    title: str | None
    fields: dict[str, dict[str, Any]]
    query_body: dict[str, Any]
    intent: str
    pinned_component: str | None
    scope: UnitScope
    formula_traces: tuple[FormulaTrace, ...]

    def effective_query(self) -> dict[str, Any]:
        return {
            "language": "dqe",
            "body": self.query_body,
            "fieldMappings": self.fields,
            "filterValues": [],
        }


def derive_executable_units(
    spec: Mapping[str, Any],
    data_context: DataContext,
) -> list[ExecutableUnit]:
    """Derive DQE requests and field contracts from business-semantic units."""
    units: list[ExecutableUnit] = []
    question = str(spec["question"]).strip()
    seen_data_source_ids: set[str] = set()
    for index, raw_unit in enumerate(_sequence(spec["units"])):
        unit = _mapping(raw_unit)
        data_source_id = _optional_string(unit.get("dataSourceId")) or f"unit-{index + 1}"
        if data_source_id in seen_data_source_ids:
            raise PageBuildingIssue(
                code="PAGE_BUILD_SPEC_DUPLICATE_UNIT_ID",
                path=f"/units/{index}/dataSourceId",
                message=f"duplicate data request unit id: {data_source_id}",
            )
        seen_data_source_ids.add(data_source_id)
        business_domain = str(unit["businessDomain"])
        surface = data_context.surface(business_domain)
        if surface is None:
            raise PageBuildingIssue(
                code="DATA_CONTEXT_NAME_NOT_FOUND",
                path=f"/units/{index}/businessDomain",
                message=f"business domain is not in data context: {business_domain}",
                candidates=_candidate_names(
                    business_domain,
                    tuple(data_context.surfaces_by_domain),
                ),
            )
        formula_traces = _formula_traces(unit, data_context, question, index)
        fields = _field_contracts(unit, surface, index)
        query_body = _query_body(unit, surface, index)
        units.append(
            ExecutableUnit(
                data_source_id=data_source_id,
                title=_component_title(unit, question, bool(formula_traces)),
                fields=fields,
                query_body=query_body,
                intent=str(unit["intent"]),
                pinned_component=_optional_string(unit.get("pinnedComponent")),
                scope=_scope_of(unit, surface),
                formula_traces=formula_traces,
            )
        )
    return units


def _formula_traces(
    unit: Mapping[str, Any],
    data_context: DataContext,
    question: str,
    unit_index: int,
) -> tuple[FormulaTrace, ...]:
    formulas = [
        _mapping(raw_metric)
        for raw_metric in _sequence(unit["metrics"])
        if _mapping(raw_metric)["kind"] == "formula"
    ]
    if formulas and not question:
        raise PageBuildingIssue(
            code="FORMULA_QUESTION_MISSING",
            path=f"/units/{unit_index}/metrics",
            message="formula must retain the originating question",
        )
    metric_names = tuple(
        dict.fromkeys(entry.name for entry in data_context.metric_entries)
    )
    return tuple(
        FormulaTrace(
            question=question,
            expression=str(metric["expression"]),
            referenced_metrics=tuple(
                name for name in metric_names if name in str(metric["expression"])
            ),
        )
        for metric in formulas
    )


def _component_title(
    unit: Mapping[str, Any], question: str, has_formula: bool
) -> str | None:
    title = _optional_string(unit.get("title"))
    if not has_formula:
        return title
    visible_title = title or question
    marker = "(临时指标)"
    return visible_title if marker in visible_title else f"{visible_title}{marker}"


def build_query_source(unit: ExecutableUnit, execution: DqeExecutionResult) -> dict[str, Any]:
    """Project an executed unit to a source, retaining preview rows when available."""
    source: dict[str, Any] = {
        "type": "query",
        "query": {"language": "dqe", "body": unit.query_body},
    }
    if execution.captured_at is not None:
        source["initial"] = {
            "capturedAt": execution.captured_at,
            "rows": [dict(row) for row in execution.sample_rows],
            "totalCount": execution.effective_total_count,
        }
    return {"fields": unit.fields, "source": source}


def _field_contracts(
    unit: Mapping[str, Any],
    surface: SemanticSurface,
    unit_index: int,
) -> dict[str, dict[str, Any]]:
    fields: dict[str, dict[str, Any]] = {}
    field_number = 0
    for dimension_index, raw_name in enumerate(_sequence(unit["groupBy"])):
        name = str(raw_name)
        declaration = surface.dimension(name)
        if declaration is None:
            raise PageBuildingIssue(
                code="DIMENSION_NOT_IN_DATA_CONTEXT",
                path=f"/units/{unit_index}/groupBy/{dimension_index}",
                message=f"dimension is not in data context: {name}",
                candidates=_candidate_names(
                    name, _canonical_dimension_names(surface)
                ),
            )
        canonical_name = declaration.name
        time = unit.get("time")
        granularity = (
            None if time is None else str(_mapping(time)["granularity"])
        )
        field_number += 1
        fields[f"field-{field_number}"] = {
            "queryField": canonical_name,
            "type": (
                "date"
                if declaration.is_time and granularity == "day"
                else "string"
                if declaration.is_time
                else declaration.field_type
            ),
            "role": "dimension",
            "label": canonical_name,
            "nullable": declaration.nullable,
        }

    for metric_index, raw_metric in enumerate(_sequence(unit["metrics"])):
        metric = _mapping(raw_metric)
        if metric["kind"] == "formula":
            label = str(metric["label"])
            field_number += 1
            fields[f"field-{field_number}"] = {
                "queryField": label,
                "type": "number",
                "role": "measure",
                "label": label,
                **(
                    {}
                    if metric.get("unit") is None
                    else {"unit": metric["unit"]}
                ),
                "nullable": False,
            }
            continue
        name = str(metric["name"])
        declaration = surface.metric(name)
        if declaration is None:
            raise PageBuildingIssue(
                code="METRIC_NOT_IN_DATA_CONTEXT",
                path=f"/units/{unit_index}/metrics/{metric_index}/name",
                message=f"metric is not in data context: {name}",
                candidates=_candidate_names(
                    name,
                    tuple(
                        dict.fromkeys(
                            metric.name
                            for metric in surface.metrics_by_name.values()
                        )
                    ),
                ),
            )
        canonical_name = declaration.name
        field_number += 1
        fields[f"field-{field_number}"] = {
            "queryField": canonical_name,
            "type": declaration.field_type,
            "role": "measure",
            "label": canonical_name,
            **(
                {}
                if declaration.unit is None
                else {"unit": declaration.unit}
            ),
            "nullable": declaration.nullable,
        }
    return fields


def _query_body(
    unit: Mapping[str, Any],
    surface: SemanticSurface,
    unit_index: int,
) -> dict[str, Any]:
    time = unit.get("time")
    if time is not None:
        granularity = str(_mapping(time)["granularity"])
        allowed_granularities = _allowed_granularities(surface)
        if granularity not in allowed_granularities:
            raise PageBuildingIssue(
                code="TIME_GRANULARITY_NOT_IN_DATA_CONTEXT",
                path=f"/units/{unit_index}/time/granularity",
                message=(
                    f"time granularity is not in data context: {granularity}"
                ),
                candidates=allowed_granularities,
            )
    dimension_filters: list[dict[str, Any]] = []
    for filter_index, raw_filter in enumerate(_sequence(unit["filters"])):
        dimension_filter = _mapping(raw_filter)
        name = str(dimension_filter["dimension"])
        declaration = surface.dimension(name)
        if declaration is None:
            raise PageBuildingIssue(
                code="DIMENSION_NOT_IN_DATA_CONTEXT",
                path=f"/units/{unit_index}/filters/{filter_index}/dimension",
                message=f"filter dimension is not in data context: {name}",
                candidates=_candidate_names(
                    name, _filter_dimension_names(surface)
                ),
            )
        if declaration.is_time:
            raise PageBuildingIssue(
                code="DIMENSION_NOT_IN_DATA_CONTEXT",
                path=f"/units/{unit_index}/filters/{filter_index}/dimension",
                message=f"time dimension must be expressed by unit time: {name}",
            )
        values = list(_sequence(dimension_filter["values"]))
        if declaration.values is not None:
            for value_index, value in enumerate(values):
                if str(value) not in declaration.values:
                    raise PageBuildingIssue(
                        code="DIMENSION_VALUE_NOT_IN_DATA_CONTEXT",
                        path=(
                            f"/units/{unit_index}/filters/{filter_index}"
                            f"/values/{value_index}"
                        ),
                        message=(
                            f"dimension value is not in data context: "
                            f"{declaration.name}={value}"
                        ),
                        candidates=declaration.values,
                    )
        dimension_filters.append(
            {
                "dim_name": declaration.name,
                "dim_value_list": values,
            }
        )
    return {
        "dsl_list": [
            {
                "output_dims": [
                    _required_dimension(surface, str(name)).name
                    for name in _sequence(unit["groupBy"])
                ],
                "output_metrics": [
                    _output_metric(_mapping(metric), surface)
                    for metric in _sequence(unit["metrics"])
                ],
                "filter": {
                    **(
                        {}
                        if time is None
                        else {
                            "time": {
                                "period": _mapping(time)["granularity"],
                                "start": _mapping(time)["start"],
                                "end": _mapping(time)["end"],
                            }
                        }
                    ),
                    "dims": dimension_filters,
                    "metrics": [],
                },
                "order": {},
            }
        ]
    }


def _output_metric(
    metric: Mapping[str, Any],
    surface: SemanticSurface,
) -> str | dict[str, str]:
    if metric["kind"] == "metric":
        declaration = surface.metric(str(metric["name"]))
        if declaration is None:
            raise AssertionError("metric names are checked before query derivation")
        return declaration.name
    return {"formula": str(metric["expression"]), "alias": str(metric["label"])}


def _scope_of(unit: Mapping[str, Any], surface: SemanticSurface) -> UnitScope:
    time = unit.get("time")
    if time is None:
        time_range = "不限定时间范围"
        granularity = "未指定"
    else:
        time_mapping = _mapping(time)
        time_range = f'{time_mapping["start"]} ~ {time_mapping["end"]}'
        granularity = str(time_mapping["granularity"])
    return UnitScope(
        business_domain=surface.business_domain,
        group_by=tuple(
            _required_dimension(surface, str(name)).name
            for name in _sequence(unit["groupBy"])
        ),
        time_range=time_range,
        granularity=granularity,
        filters=tuple(
            ScopeFilter(
                dimension=_required_dimension(
                    surface, str(_mapping(raw_filter)["dimension"])
                ).name,
                values=tuple(
                    str(value)
                    for value in _sequence(_mapping(raw_filter)["values"])
                ),
            )
            for raw_filter in _sequence(unit["filters"])
        ),
    )


def _required_dimension(surface: SemanticSurface, name: str):
    declaration = surface.dimension(name)
    if declaration is None:
        raise AssertionError("dimension names are checked before query derivation")
    return declaration


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


def _candidate_names(
    unknown: str, names: tuple[str, ...], limit: int = 5
) -> tuple[str, ...]:
    partial = tuple(
        name for name in names if name in unknown or unknown in name
    )
    return (partial or names)[:limit]


def _canonical_dimension_names(surface: SemanticSurface) -> tuple[str, ...]:
    return tuple(
        dict.fromkeys(
            dimension.name for dimension in surface.dimensions_by_name.values()
        )
    )


def _filter_dimension_names(surface: SemanticSurface) -> tuple[str, ...]:
    return tuple(
        name
        for name in _canonical_dimension_names(surface)
        if not _required_dimension(surface, name).is_time
    )


def _allowed_granularities(surface: SemanticSurface) -> tuple[str, ...]:
    return tuple(
        dict.fromkeys(
            granularity
            for dimension in surface.dimensions_by_name.values()
            if dimension.is_time
            for granularity in dimension.granularities
        )
    )
