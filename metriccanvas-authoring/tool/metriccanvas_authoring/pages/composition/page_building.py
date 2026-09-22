from __future__ import annotations

from typing import Any, Sequence

from metriccanvas_authoring.build_issues import PageBuildingIssue, PageBuildingIssues
from metriccanvas_authoring.pages.components.capabilities import (
    ASSEMBLED_COMPONENT_TYPES,
)
from metriccanvas_authoring.pages.components.component_selection import (
    component_default_span,
    recommend_components,
)
from metriccanvas_authoring.data.executable_units import (
    ExecutableUnit,
    UnitScope,
    build_query_source,
)
from metriccanvas_authoring.data.execution import DqeExecutionResult
from metriccanvas_authoring.pages.composition.section_layout import pack_section_spans


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
    issues: list[PageBuildingIssue] = []
    for unit_index, (unit, execution) in enumerate(
        zip(units, executions, strict=True)
    ):
        data_sources[unit.data_source_id] = build_query_source(unit, execution)
        try:
            components.append(build_data_component(unit, execution, unit_index))
        except PageBuildingIssue as issue:
            issues.append(issue)

    if issues:
        raise PageBuildingIssues(tuple(issues))

    return {
        "schemaVersion": schema_version,
        "layout": "report",
        "id": page_id,
        **({} if description is None else {"meta": {"description": description}}),
        "dataSources": data_sources,
        "sections": _sections_of(units, components),
    }


def build_data_component(
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
    if selected.component_type not in ASSEMBLED_COMPONENT_TYPES:
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
    elif selected.component_type == "gauge":
        props = {
            **({} if unit.title is None else {"title": unit.title}),
            "valueField": measures[0][0],
        }
    elif selected.component_type == "keyValuePanel":
        props = {
            **({} if unit.title is None else {"title": unit.title}),
            "items": [
                {"label": field.get("label", field_id), "field": field_id}
                for field_id, field in scalars
            ],
        }
    elif selected.component_type == "categoryBreakdown":
        props = {
            **({} if unit.title is None else {"title": unit.title}),
            "categoryField": dimensions[0][0],
            "columns": [
                {"label": field.get("label", field_id), "field": field_id}
                for field_id, field in measures
            ],
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
                "title": "问数结果",
                "container": "panel",
                "components": _laid_out(list(components)),
            },
        ]
    titles = _scope_group_titles([group[0] for group in groups])
    content_sections = [
        {
            "id": f"scope-{index + 1}",
            "title": titles[index],
            "container": "panel",
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
