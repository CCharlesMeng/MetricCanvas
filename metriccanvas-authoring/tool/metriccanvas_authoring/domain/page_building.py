from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from metriccanvas_authoring.domain.component_selection import (
    component_default_span,
    recommend_components,
)
from metriccanvas_authoring.domain.data_context import DataContext, SemanticSurface
from metriccanvas_authoring.domain.execution import DqeExecutionResult
from metriccanvas_authoring.domain.section_layout import pack_section_spans


@dataclass(frozen=True, slots=True)
class PageBuildingIssue(Exception):
    code: str
    path: str
    message: str


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
    for index, raw_unit in enumerate(_sequence(spec["units"])):
        unit = _mapping(raw_unit)
        business_domain = str(unit["businessDomain"])
        surface = data_context.surface(business_domain)
        if surface is None:
            raise PageBuildingIssue(
                code="DATA_CONTEXT_NAME_NOT_FOUND",
                path=f"/units/{index}/businessDomain",
                message=f"business domain is not in data context: {business_domain}",
            )
        fields = _field_contracts(unit, surface, index)
        query_body = _query_body(unit, surface, index)
        units.append(
            ExecutableUnit(
                data_source_id=f"unit-{index + 1}",
                title=_optional_string(unit.get("title")),
                fields=fields,
                query_body=query_body,
                intent=str(unit["intent"]),
                pinned_component=_optional_string(unit.get("pinnedComponent")),
                scope=_scope_of(unit, surface),
            )
        )
    return units


def assemble_page_document(
    *,
    page_id: str,
    description: str | None,
    schema_version: str,
    units: Sequence[ExecutableUnit],
    executions: Sequence[DqeExecutionResult],
) -> dict[str, Any]:
    """Assemble executed units into a current-version Page Metadata document."""
    data_sources: dict[str, Any] = {}
    components: list[dict[str, Any]] = []
    for unit_index, (unit, execution) in enumerate(
        zip(units, executions, strict=True)
    ):
        source: dict[str, Any] = {
            "type": "query",
            "query": {"language": "dqe", "body": unit.query_body},
        }
        if execution.captured_at is not None:
            source["initial"] = {
                "capturedAt": execution.captured_at,
                "rows": [dict(row) for row in execution.rows],
                **(
                    {}
                    if execution.total_count is None
                    else {"totalCount": execution.total_count}
                ),
            }
        data_sources[unit.data_source_id] = {
            "fields": unit.fields,
            "source": source,
        }
        components.append(_component_for(unit, execution, unit_index))

    return {
        "schemaVersion": schema_version,
        "id": page_id,
        **({} if description is None else {"meta": {"description": description}}),
        "dataSources": data_sources,
        "sections": _sections_of(units, components),
    }


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
                code="DATA_CONTEXT_NAME_NOT_FOUND",
                path=f"/units/{unit_index}/groupBy/{dimension_index}",
                message=f"dimension is not in data context: {name}",
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
                code="DATA_CONTEXT_NAME_NOT_FOUND",
                path=f"/units/{unit_index}/metrics/{metric_index}/name",
                message=f"metric is not in data context: {name}",
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
        allowed_granularities = {
            granularity
            for dimension in surface.dimensions_by_name.values()
            if dimension.is_time
            for granularity in dimension.granularities
        }
        if granularity not in allowed_granularities:
            raise PageBuildingIssue(
                code="TIME_GRANULARITY_NOT_IN_DATA_CONTEXT",
                path=f"/units/{unit_index}/time/granularity",
                message=(
                    f"time granularity is not in data context: {granularity}"
                ),
            )
    dimension_filters: list[dict[str, Any]] = []
    for filter_index, raw_filter in enumerate(_sequence(unit["filters"])):
        dimension_filter = _mapping(raw_filter)
        name = str(dimension_filter["dimension"])
        declaration = surface.dimension(name)
        if declaration is None:
            raise PageBuildingIssue(
                code="DATA_CONTEXT_NAME_NOT_FOUND",
                path=f"/units/{unit_index}/filters/{filter_index}/dimension",
                message=f"filter dimension is not in data context: {name}",
            )
        if declaration.is_time:
            raise PageBuildingIssue(
                code="DATA_CONTEXT_NAME_NOT_FOUND",
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


def _component_for(
    unit: ExecutableUnit,
    execution: DqeExecutionResult,
    unit_index: int,
) -> dict[str, Any]:
    row_count = (
        execution.total_count
        if execution.total_count is not None
        else len(execution.rows)
    )
    candidates = recommend_components(
        unit.fields,
        row_count=row_count,
        intent=unit.intent,
        pinned=unit.pinned_component,
    )
    if unit.pinned_component is not None:
        selected = next(
            (candidate for candidate in candidates if candidate.pinned), None
        )
        if selected is None or not selected.ok:
            reasons = () if selected is None else selected.reasons
            raise PageBuildingIssue(
                code="PINNED_COMPONENT_REJECTED",
                path=f"/units/{unit_index}/pinnedComponent",
                message=(
                    f"pinned component {unit.pinned_component} failed the capability gate: "
                    + "; ".join(reasons)
                ),
            )
    else:
        selected = next(
            (candidate for candidate in candidates if candidate.recommended), None
        )
        if selected is None:
            raise PageBuildingIssue(
                code="COMPONENT_GATE_REJECTED",
                path=f"/units/{unit_index}",
                message="no component passed the capability gate",
            )
    if selected.component_type not in {
        "metricCard",
        "barChart",
        "lineChart",
        "pieChart",
        "table",
        "rankingCard",
        "rankingDetailCard",
    }:
        raise PageBuildingIssue(
            code="COMPONENT_ASSEMBLY_UNSUPPORTED",
            path=f"/units/{unit_index}/pinnedComponent",
            message=f"component assembly is not migrated: {selected.component_type}",
        )
    scalars = [
        (field_id, field)
        for field_id, field in unit.fields.items()
        if field["role"] != "detail"
    ]
    dimensions = [field for field in scalars if field[1]["role"] == "dimension"]
    measures = [
        field for field in scalars if field[1]["role"] == "measure"
    ]
    series = [
        {"field": field_id, "label": field.get("label", field_id)}
        for field_id, field in measures
    ]
    if selected.component_type == "metricCard":
        props = {
            **({} if unit.title is None else {"title": unit.title}),
            "rows": [
                {"label": field.get("label", field_id), "valueField": field_id}
                for field_id, field in measures
            ],
        }
    elif selected.component_type == "barChart":
        props = {
            **({} if unit.title is None else {"title": unit.title}),
            "categoryField": dimensions[0][0],
            "series": series,
        }
    elif selected.component_type == "lineChart":
        time_dimension = next(
            (
                field
                for field in dimensions
                if field[1]["type"] in {"date", "datetime"}
            ),
            dimensions[0],
        )
        props = {
            **({} if unit.title is None else {"title": unit.title}),
            "xField": time_dimension[0],
            "series": series,
        }
    elif selected.component_type == "table":
        props = {
            **({} if unit.title is None else {"title": unit.title}),
            "columns": [
                {"field": field_id, "title": field.get("label", field_id)}
                for field_id, field in scalars
            ],
        }
    elif selected.component_type == "pieChart":
        props = {
            **({} if unit.title is None else {"title": unit.title}),
            "categoryField": dimensions[0][0],
            "valueField": measures[0][0],
        }
    else:
        props = {
            **({} if unit.title is None else {"title": unit.title}),
            "nameField": dimensions[0][0],
            "valueField": measures[0][0],
        }
    return {
        "id": f"{unit.data_source_id}-{_kebab_case(selected.component_type)}",
        "type": selected.component_type,
        "layout": {"span": selected.default_span},
        "data": {"main": unit.data_source_id},
        "props": props,
    }


def _kebab_case(value: str) -> str:
    result = ""
    for character in value:
        result += f"-{character.lower()}" if character.isupper() else character
    return result


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


def _sections_of(
    units: Sequence[ExecutableUnit], components: Sequence[dict[str, Any]]
) -> list[dict[str, Any]]:
    header = {
        "id": "header",
        "container": "plain",
        "components": [
            {
                "id": "page-header",
                "type": "reportHeader",
                "layout": {"span": component_default_span("reportHeader")},
                "props": _header_props(units),
            }
        ],
    }
    groups = _scope_groups(units)
    if len(groups) == 1:
        return [
            header,
            {
                "id": "main",
                "components": _laid_out(list(components)),
            },
        ]
    titles = _scope_group_titles([group[0] for group in groups])
    content_sections = [
        {
            "id": f"scope-{index + 1}",
            "title": titles[index],
            "components": _laid_out(
                [
                    component
                    for component in components
                    if component["data"]["main"] in data_source_ids
                ]
            ),
        }
        for index, (_, data_source_ids) in enumerate(groups)
    ]
    return [header, *content_sections]


def _header_props(units: Sequence[ExecutableUnit]) -> dict[str, Any]:
    title = "、".join(dict.fromkeys(unit.scope.business_domain for unit in units))
    windows = list(dict.fromkeys(_time_label(unit.scope) for unit in units))
    return {
        "title": title,
        **(
            {"asOf": {"label": "数据窗口", "value": windows[0]}}
            if len(windows) == 1
            else {}
        ),
    }


def _scope_groups(
    units: Sequence[ExecutableUnit],
) -> list[tuple[UnitScope, list[str]]]:
    groups: list[tuple[UnitScope, list[str]]] = []
    keys: list[tuple[object, ...]] = []
    for unit in units:
        key = _scope_key(unit.scope)
        if key in keys:
            groups[keys.index(key)][1].append(unit.data_source_id)
        else:
            keys.append(key)
            groups.append((unit.scope, [unit.data_source_id]))
    return groups


def _scope_key(scope: UnitScope) -> tuple[object, ...]:
    return (
        scope.business_domain,
        tuple(sorted(scope.group_by)),
        scope.time_range,
        scope.granularity,
        tuple(
            sorted(
                (entry.dimension, tuple(sorted(entry.values)))
                for entry in scope.filters
            )
        ),
    )


def _scope_group_titles(scopes: Sequence[UnitScope]) -> list[str]:
    show_domain = len({scope.business_domain for scope in scopes}) > 1
    show_time = len(
        {(scope.time_range, scope.granularity) for scope in scopes}
    ) > 1
    show_filters = len({_filters_label(scope) for scope in scopes}) > 1
    titles: list[str] = []
    for scope in scopes:
        parts = [
            *([scope.business_domain] if show_domain else []),
            _dimensions_label(scope),
            *([_time_label(scope)] if show_time else []),
            *(
                [_filters_label(scope) or "不限筛选"]
                if show_filters
                else []
            ),
        ]
        titles.append(" · ".join(parts))
    return titles


def _laid_out(components: list[dict[str, Any]]) -> list[dict[str, Any]]:
    spans = pack_section_spans(
        [int(component["layout"]["span"]) for component in components]
    )
    return [
        {**component, "layout": {"span": spans[index]}}
        for index, component in enumerate(components)
    ]


def _dimensions_label(scope: UnitScope) -> str:
    return "总量" if not scope.group_by else f'按{"、".join(scope.group_by)}'


def _time_label(scope: UnitScope) -> str:
    labels = {
        "day": "日",
        "week": "周",
        "month": "月",
        "quarter": "季",
        "year": "年",
    }
    label = labels.get(scope.granularity)
    return scope.time_range if label is None else f"{scope.time_range}({label})"


def _filters_label(scope: UnitScope) -> str:
    return "、".join(
        f'{entry.dimension}={"、".join(entry.values)}' for entry in scope.filters
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
