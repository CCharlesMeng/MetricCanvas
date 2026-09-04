from __future__ import annotations

import json
import math
import re
from dataclasses import asdict, dataclass
from datetime import date, datetime
from typing import Any, Callable, Mapping

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

from metriccanvas_authoring.runtime_assets import bundle_root


BUNDLE_ROOT = bundle_root()
PRODUCT_CONTRACT_ROOT = BUNDLE_ROOT / "contract-snapshot"
DATETIME_PATTERN = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}"
    r"(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$"
)


@dataclass(frozen=True, slots=True)
class PageContractIssue:
    type: str
    path: str
    message: str

    def as_dict(self) -> dict[str, str]:
        return asdict(self)


def validate_page_document(value: Any) -> list[PageContractIssue]:
    """Validate structure plus query-result semantics used by Page parsing."""
    schema = json.loads(
        (PRODUCT_CONTRACT_ROOT / "page" / "schema.json").read_text(encoding="utf-8")
    )
    validator = Draft202012Validator(schema)
    issues = _schema_issues(validator, value)
    if issues:
        guided = _composite_structure_issues(value)
        if guided:
            issues = [
                issue
                for issue in issues
                if not any(
                    issue.path == hint.path
                    or issue.path.startswith(f"{hint.path}/")
                    for hint in guided
                )
            ]
            issues = [*guided, *issues]
        return sorted(issues, key=lambda issue: (issue.path, issue.message))
    capability_issues = _capability_floor_issues(value)
    if capability_issues:
        return capability_issues
    optional_materialized = _materialize_validation_text_values(value)
    optional_issues = _schema_issues(validator, optional_materialized)
    if optional_issues:
        optional_issues.append(
            PageContractIssue(
                "SCHEMA_ERROR",
                "/params",
                "optional page parameters cannot be used by required text properties",
            )
        )
        return optional_issues
    param_issues = _page_param_issues(value)
    if param_issues:
        return param_issues
    row_issues = [*_query_initial_row_issues(value), *_inline_row_issues(value)]
    return [*row_issues, *_invariant_issues(value)]


def _schema_issues(
    validator: Draft202012Validator, value: Any
) -> list[PageContractIssue]:
    return [
        PageContractIssue("SCHEMA_ERROR", path, error.message)
        for error in validator.iter_errors(value)
        for path in _error_paths(error)
    ]


def _composite_structure_issues(value: Any) -> list[PageContractIssue]:
    if not isinstance(value, Mapping):
        return []
    allowed = {
        "metricCard",
        "pieChart",
        "gauge",
        "keyValuePanel",
        "categoryBreakdown",
    }
    issues: list[PageContractIssue] = []
    sections = value.get("sections", [])
    if not isinstance(sections, list):
        return issues
    for section_index, section in enumerate(sections):
        if not isinstance(section, Mapping):
            continue
        components = section.get("components", [])
        if not isinstance(components, list):
            continue
        for component, path in _walk_components(
            components, f"/sections/{section_index}/components"
        ):
            if component.get("type") != "compositeCard":
                continue
            if "data" in component:
                issues.append(
                    PageContractIssue("SCHEMA_ERROR", f"{path}/data", "composite card cannot bind data")
                )
            props = component.get("props")
            if not isinstance(props, Mapping):
                continue
            if "actions" in props:
                issues.append(
                    PageContractIssue("SCHEMA_ERROR", f"{path}/props/actions", "composite card cannot define actions")
                )
            children = props.get("components")
            if not isinstance(children, list):
                continue
            if not children:
                issues.append(
                    PageContractIssue("SCHEMA_ERROR", f"{path}/props/components", "composite card needs at least one child")
                )
                continue
            for child_index, child in enumerate(children):
                child_type = child.get("type") if isinstance(child, Mapping) else None
                if isinstance(child_type, str) and child_type not in allowed:
                    issues.append(
                        PageContractIssue(
                            "SCHEMA_ERROR",
                            f"{path}/props/components/{child_index}",
                            f"component type {child_type} is not allowed in a composite card",
                        )
                    )
    return issues


_MISSING_TEXT_VALUE = object()


def _materialize_validation_text_values(value: Any) -> Any:
    if not isinstance(value, Mapping):
        return value
    declarations = value.get("params", [])
    required = {
        declaration.get("id"): declaration.get("required") is True
        for declaration in declarations
        if isinstance(declarations, list)
        and isinstance(declaration, Mapping)
        and isinstance(declaration.get("id"), str)
    }

    def visit(child: Any) -> Any:
        if isinstance(child, list):
            return [resolved for item in child if (resolved := visit(item)) is not _MISSING_TEXT_VALUE]
        if not isinstance(child, Mapping):
            return child
        param_id = child.get("param")
        if isinstance(param_id, str) and set(child).issubset({"param", "format"}):
            if param_id not in required:
                return dict(child)
            return "validation-value" if required[param_id] else _MISSING_TEXT_VALUE
        return {
            key: resolved
            for key, item in child.items()
            if (resolved := visit(item)) is not _MISSING_TEXT_VALUE
        }

    return visit(value)


def _capability_floor_issues(value: Any) -> list[PageContractIssue]:
    if not isinstance(value, Mapping):
        return []
    version = value.get("schemaVersion")
    match = re.fullmatch(r"(\d+)\.(\d+)", version) if isinstance(version, str) else None
    if match is None or int(match.group(1)) != 5:
        return []
    declared_minor = int(match.group(2))
    used: list[tuple[int, str]] = []

    def add(minor: int, path: str, condition: bool = True) -> None:
        if condition and minor > declared_minor:
            used.append((minor, path))

    params = value.get("params")
    add(1, "/params", isinstance(params, list) and bool(params))
    add(1, "/layoutForm", isinstance(value.get("layoutForm"), str))
    toolbar = value.get("dashboardToolbar")
    add(3, "/dashboardToolbar", isinstance(toolbar, str))
    add(4, "/dashboardToolbar", isinstance(toolbar, Mapping))
    for path, _reference in _text_value_references(value):
        add(1, path)

    data_sources = value.get("dataSources", {})
    if isinstance(data_sources, Mapping):
        for source_id, source in data_sources.items():
            if not isinstance(source, Mapping):
                continue
            source_path = f"/dataSources/{_escape_pointer(source_id)}"
            compute = source.get("compute")
            add(1, f"{source_path}/compute", isinstance(compute, list) and bool(compute))
            if isinstance(compute, list):
                for index, operator in enumerate(compute):
                    if isinstance(operator, Mapping):
                        add(
                            2,
                            f"{source_path}/compute/{index}/scale",
                            operator.get("op") == "ratio" and "scale" in operator,
                        )
            fields = source.get("fields")
            if isinstance(fields, Mapping):
                for field_path, field in _walk_field_definitions(
                    fields, f"{source_path}/fields"
                ):
                    add(1, f"{field_path}/collapsible", "collapsible" in field)

    filters = value.get("filters", [])
    if isinstance(filters, list):
        for index, raw_filter in enumerate(filters):
            if not isinstance(raw_filter, Mapping):
                continue
            path = f"/filters/{index}"
            filter_type = raw_filter.get("type")
            add(1, path, filter_type in {"boolean", "timePoint", "numberRange", "search"})
            add(1, f"{path}/hierarchy", isinstance(raw_filter.get("hierarchy"), list) and bool(raw_filter.get("hierarchy")))
            add(1, f"{path}/dependsOn", isinstance(raw_filter.get("dependsOn"), str))
            default = raw_filter.get("default")
            add(1, f"{path}/default", isinstance(default, Mapping) and isinstance(default.get("unit"), str))
            add(3, f"{path}/emptyLabel", isinstance(raw_filter.get("emptyLabel"), str))
            add(3, f"{path}/hierarchyPicker", isinstance(raw_filter.get("hierarchyPicker"), str))

    sections = value.get("sections", [])
    if not isinstance(sections, list):
        return []
    for section_index, section in enumerate(sections):
        if not isinstance(section, Mapping):
            continue
        add(3, f"/sections/{section_index}/columnTracks", "columnTracks" in section)
        components = section.get("components", [])
        if not isinstance(components, list):
            continue
        for component, path in _walk_components(
            components, f"/sections/{section_index}/components"
        ):
            component_type = component.get("type")
            props = component.get("props")
            props = props if isinstance(props, Mapping) else {}
            layout = component.get("layout")
            add(1, f"{path}/layout/layer", isinstance(layout, Mapping) and "layer" in layout)
            add(1, path, component_type == "keyValuePanel")
            add(1, path, component_type == "fieldText")
            add(1, path, component_type in {"tabContainer", "gauge"})
            add(2, path, component_type == "compositeCard")
            add(2, path, component_type == "categoryBreakdown")

            variant = props.get("variant")
            add(
                3,
                f"{path}/props/variant",
                (component_type == "reportHeader" and variant == "projectDetail")
                or (
                    component_type == "keyValuePanel"
                    and variant in {"detailSummary", "detailNormMatrix"}
                )
                or (component_type == "compositeCard" and variant == "projectNorms")
                or (component_type == "table" and variant == "forecastMatrix")
                or (
                    component_type == "fieldText"
                    and variant
                    in {
                        "narrativeShort",
                        "narrativeMeeting",
                        "narrativeRisk",
                        "narrativeProgress",
                    }
                ),
            )
            add(3, f"{path}/props/columns", component_type == "keyValuePanel" and props.get("columns") == 6)
            add(2, f"{path}/props/columns", component_type == "keyValuePanel" and props.get("columns") == 1)
            add(2, f"{path}/props/legend", component_type == "mapChart" and "legend" in props)
            add(2, f"{path}/props/tooltipFields", component_type == "mapChart" and "tooltipFields" in props)
            add(1, f"{path}/props/hierarchyFilter", component_type == "mapChart" and "hierarchyFilter" in props)
            add(3, f"{path}/props/variant", component_type == "compositeCard" and variant == "compact")
            add(4, f"{path}/props/variant", component_type == "compositeCard" and variant == "metricGrid")
            add(3, f"{path}/props/variant", component_type == "tabContainer" and variant == "compact")
            add(4, f"{path}/props/variant", component_type == "tabContainer" and variant == "analysisStack")
            add(3, f"{path}/props/variant", component_type == "table" and variant == "embedded")
            add(3, f"{path}/props/bottomFade", component_type == "table" and "bottomFade" in props)
            add(3, f"{path}/props/variant", component_type == "mapChart" and variant == "regionalOverview")
            add(3, f"{path}/props/pinnedSummary", component_type == "mapChart" and "pinnedSummary" in props)

            if component_type == "metricCard":
                for rows_key in ("rows", "secondaryRows"):
                    rows = props.get(rows_key, [])
                    if not isinstance(rows, list):
                        continue
                    for row_index, row in enumerate(rows):
                        if not isinstance(row, Mapping):
                            continue
                        add(3, f"{path}/props/{rows_key}/{row_index}/context", "context" in row)
                        add(4, f"{path}/props/{rows_key}/{row_index}/link", "link" in row)
            if component_type == "keyValuePanel":
                items = props.get("items", [])
                if isinstance(items, list):
                    for item_index, item in enumerate(items):
                        if not isinstance(item, Mapping):
                            continue
                        add(3, f"{path}/props/items/{item_index}/unit", "unit" in item)
                        add(3, f"{path}/props/items/{item_index}/icon", "icon" in item)
                add(3, f"{path}/props/titleIcon", "titleIcon" in props)
            if component_type == "compositeCard":
                add(3, f"{path}/props/titleIcon", "titleIcon" in props)
            if component_type == "tabContainer":
                tabs = props.get("tabs", [])
                if isinstance(tabs, list):
                    for tab_index, tab in enumerate(tabs):
                        add(
                            4,
                            f"{path}/props/tabs/{tab_index}/components",
                            isinstance(tab, Mapping) and isinstance(tab.get("components"), list),
                        )
            if component_type == "table":
                add(1, f"{path}/props/rowKindField", "rowKindField" in props)
                add(1, f"{path}/props/mergeBy", "mergeBy" in props)
                for column, column_path in _table_leaf_columns(
                    props.get("columns", []), f"{path}/props/columns"
                ):
                    add(1, f"{column_path}/link", "link" in column)
            actions = props.get("actions", [])
            if isinstance(actions, list):
                for action_index, action in enumerate(actions):
                    navigate = action.get("navigate") if isinstance(action, Mapping) else None
                    add(
                        1,
                        f"{path}/props/actions/{action_index}/navigate/setParams",
                        isinstance(navigate, Mapping) and "setParams" in navigate,
                    )

    return [
        PageContractIssue(
            "SCHEMA_ERROR",
            path,
            f"page capability requires schemaVersion 5.{minor}, declared {version}",
        )
        for minor, path in used
    ]


def _walk_field_definitions(
    fields: Mapping[Any, Any], base_path: str
) -> list[tuple[str, Mapping[str, Any]]]:
    result: list[tuple[str, Mapping[str, Any]]] = []
    for field_id, field in fields.items():
        if not isinstance(field, Mapping):
            continue
        path = f"{base_path}/{_escape_pointer(field_id)}"
        if "type" in field or "role" in field:
            result.append((path, field))
        else:
            result.extend(_walk_field_definitions(field, path))
    return result


NUMERIC_FORMATS = frozenset(
    {
        "number",
        "number-1",
        "number-2",
        "number-grouped",
        "compact-wan-0",
        "compact-wan-1",
        "compact-yi-1",
        "cny-adaptive",
        "percent-0",
        "percent-1",
        "percent-2",
        "percent-2-signed",
    }
)
DATE_FORMATS = frozenset({"date", "date-month-day"})


def _page_param_issues(value: Mapping[str, Any]) -> list[PageContractIssue]:
    declarations = value.get("params", [])
    if not isinstance(declarations, list):
        return []
    raw_filters = value.get("filters", [])
    filter_ids = {
        item.get("id")
        for item in raw_filters
        if isinstance(raw_filters, list)
        and isinstance(item, Mapping)
        and isinstance(item.get("id"), str)
    }
    issues: list[PageContractIssue] = []
    by_id: dict[str, Mapping[str, Any]] = {}
    for index, declaration in enumerate(declarations):
        if not isinstance(declaration, Mapping):
            continue
        param_id = declaration.get("id")
        if not isinstance(param_id, str):
            continue
        path = f"/params/{index}"
        if param_id in by_id:
            issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/id", "duplicate page parameter"))
        by_id[param_id] = declaration
        if param_id in filter_ids:
            issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/id", "page parameter duplicates filter id"))
        if "default" in declaration and not _matches_json_type(
            declaration.get("default"), declaration.get("type")
        ):
            issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/default", "page parameter default type mismatch"))

    consumed: set[str] = set()
    for path, reference in _text_value_references(value):
        param_id = reference["param"]
        declaration = by_id.get(param_id)
        if declaration is None:
            issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/param", "text value references unknown page parameter"))
            continue
        consumed.add(param_id)
        display_format = reference.get("format")
        param_type = declaration.get("type")
        if (
            isinstance(display_format, str)
            and (
                (display_format in NUMERIC_FORMATS and param_type != "number")
                or (display_format in DATE_FORMATS and param_type != "string")
            )
        ):
            issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/format", "text format does not suit parameter type"))

    for index, declaration in enumerate(declarations):
        if not isinstance(declaration, Mapping):
            continue
        param_id = declaration.get("id")
        if isinstance(param_id, str) and param_id not in consumed:
            issues.append(PageContractIssue("SCHEMA_ERROR", f"/params/{index}/id", "page parameter is unused"))
    return issues


def _text_value_references(
    value: Mapping[str, Any],
) -> list[tuple[str, Mapping[str, str]]]:
    references: list[tuple[str, Mapping[str, str]]] = []
    scope = {key: child for key, child in value.items() if key != "dataSources"}

    def visit(child: Any, path: str) -> None:
        if isinstance(child, list):
            for index, item in enumerate(child):
                visit(item, f"{path}/{index}")
            return
        if not isinstance(child, Mapping):
            return
        if (
            isinstance(child.get("param"), str)
            and set(child).issubset({"param", "format"})
        ):
            references.append((path, child))
            return
        for key, item in child.items():
            visit(item, _join_pointer(path, key))

    visit(scope, "")
    return references


def _matches_json_type(value: Any, expected: Any) -> bool:
    if expected == "string":
        return isinstance(value, str)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected == "boolean":
        return isinstance(value, bool)
    return False


def _invariant_issues(value: Mapping[str, Any]) -> list[PageContractIssue]:
    issues: list[PageContractIssue] = []
    filters = value.get("filters", [])
    if isinstance(filters, list):
        issues.extend(_filter_issues(filters))
    filters_by_id = {
        entry["id"]: entry
        for entry in filters
        if isinstance(entry, Mapping) and isinstance(entry.get("id"), str)
    }
    data_sources = value.get("dataSources", {})
    if isinstance(data_sources, Mapping):
        for source_id, raw_source in data_sources.items():
            if isinstance(raw_source, Mapping):
                issues.extend(_compute_issues(source_id, raw_source))
                issues.extend(
                    _query_mapping_issues(source_id, raw_source, filters_by_id)
                )

    section_ids: set[str] = set()
    component_ids: set[str] = set()
    sections = value.get("sections", [])
    if not isinstance(sections, list):
        return issues
    for section_index, section in enumerate(sections):
        if not isinstance(section, Mapping):
            continue
        section_id = section.get("id")
        if isinstance(section_id, str):
            if section_id in section_ids:
                issues.append(
                    PageContractIssue(
                        "SCHEMA_ERROR",
                        f"/sections/{section_index}/id",
                        f"duplicate section id: {section_id}",
                    )
                )
            section_ids.add(section_id)
        components = section.get("components", [])
        if not isinstance(components, list):
            continue
        issues.extend(_section_issues(section, section_index, components))
        for component, path in _walk_components(
            components, f"/sections/{section_index}/components"
        ):
            component_id = component.get("id")
            if isinstance(component_id, str):
                if component_id in component_ids:
                    issues.append(
                        PageContractIssue(
                            "SCHEMA_ERROR",
                            f"{path}/id",
                            f"duplicate component id: {component_id}",
                        )
                    )
                component_ids.add(component_id)
            issues.extend(_component_issues(component, path, value))
    if isinstance(filters, list):
        issues.extend(_hidden_hierarchy_picker_issues(filters, sections))
    issues.extend(_query_pagination_issues(value))
    return issues


def _section_issues(
    section: Mapping[str, Any], section_index: int, components: list[Any]
) -> list[PageContractIssue]:
    issues: list[PageContractIssue] = []
    base_path = f"/sections/{section_index}/components"
    for component, path in _walk_components(components, base_path):
        layout = component.get("layout")
        if not isinstance(layout, Mapping) or layout.get("layer") is None:
            continue
        if re.fullmatch(r"/sections/\d+/components/\d+", path) is None:
            issues.append(
                PageContractIssue(
                    "SCHEMA_ERROR",
                    f"{path}/layout/layer",
                    "layout.layer is only valid on top-level section components",
                )
            )

    backdrops: list[int] = []
    for index, component in enumerate(components):
        if not isinstance(component, Mapping):
            continue
        layout = component.get("layout")
        if isinstance(layout, Mapping) and layout.get("layer") == "backdrop":
            backdrops.append(index)
    if len(backdrops) > 1:
        issues.extend(
            PageContractIssue(
                "SCHEMA_ERROR",
                f"{base_path}/{index}/layout/layer",
                "a section can contain only one backdrop",
            )
            for index in backdrops
        )
    if backdrops and len(backdrops) == len(components):
        issues.append(
            PageContractIssue(
                "SCHEMA_ERROR", f"/sections/{section_index}/components", "backdrop needs siblings"
            )
        )
    if backdrops and section.get("container") != "plain":
        issues.append(
            PageContractIssue(
                "SCHEMA_ERROR", f"/sections/{section_index}/container", "backdrop needs plain container"
            )
        )

    tracks = section.get("columnTracks")
    if isinstance(tracks, list):
        for index, component in enumerate(components):
            if not isinstance(component, Mapping):
                continue
            layout = component.get("layout")
            if not isinstance(layout, Mapping) or layout.get("layer") == "backdrop":
                continue
            span = layout.get("span")
            if isinstance(span, int) and span > len(tracks):
                issues.append(
                    PageContractIssue(
                        "SCHEMA_ERROR",
                        f"{base_path}/{index}/layout/span",
                        "component span exceeds section column tracks",
                    )
                )
    return issues


def _hidden_hierarchy_picker_issues(
    filters: list[Any], sections: list[Any]
) -> list[PageContractIssue]:
    map_filters: set[str] = set()
    for section_index, section in enumerate(sections):
        if not isinstance(section, Mapping):
            continue
        components = section.get("components", [])
        if not isinstance(components, list):
            continue
        for component, _path in _walk_components(
            components, f"/sections/{section_index}/components"
        ):
            if component.get("type") != "mapChart":
                continue
            props = component.get("props")
            hierarchy_filter = props.get("hierarchyFilter") if isinstance(props, Mapping) else None
            if isinstance(hierarchy_filter, str):
                map_filters.add(hierarchy_filter)
    return [
        PageContractIssue(
            "SCHEMA_ERROR",
            f"/filters/{index}/hierarchyPicker",
            "hidden hierarchy picker needs a map",
        )
        for index, raw_filter in enumerate(filters)
        if isinstance(raw_filter, Mapping)
        and raw_filter.get("type") == "dimension"
        and raw_filter.get("hierarchyPicker") == "hidden"
        and raw_filter.get("id") not in map_filters
    ]


def _filter_issues(filters: list[Any]) -> list[PageContractIssue]:
    issues: list[PageContractIssue] = []
    seen_ids: set[str] = set()
    by_id: dict[str, Mapping[str, Any]] = {}
    for index, raw_filter in enumerate(filters):
        if not isinstance(raw_filter, Mapping):
            continue
        filter_id = raw_filter.get("id")
        if isinstance(filter_id, str):
            if filter_id in seen_ids:
                issues.append(
                    PageContractIssue(
                        "SCHEMA_ERROR",
                        f"/filters/{index}/id",
                        f"duplicate filter id: {filter_id}",
                    )
                )
            seen_ids.add(filter_id)
            by_id[filter_id] = raw_filter
        issues.extend(_filter_declaration_issues(raw_filter, index))

    for index, raw_filter in enumerate(filters):
        if not isinstance(raw_filter, Mapping) or raw_filter.get("type") != "dimension":
            continue
        filter_id = raw_filter.get("id")
        depends_on = raw_filter.get("dependsOn")
        if not isinstance(depends_on, str):
            continue
        path = f"/filters/{index}/dependsOn"
        if depends_on == filter_id:
            issues.append(PageContractIssue("SCHEMA_ERROR", path, "filter cannot depend on itself"))
            continue
        upstream = by_id.get(depends_on)
        if upstream is None:
            issues.append(PageContractIssue("SCHEMA_ERROR", path, "dependsOn is undeclared"))
            continue
        if upstream.get("type") != "dimension":
            issues.append(PageContractIssue("SCHEMA_ERROR", path, "upstream must be a dimension filter"))
            continue
        if isinstance(filter_id, str) and _has_filter_cycle(filter_id, by_id):
            issues.append(PageContractIssue("SCHEMA_ERROR", path, "filter dependency cycle"))
    return issues


def _filter_declaration_issues(
    filter_value: Mapping[str, Any], index: int
) -> list[PageContractIssue]:
    issues: list[PageContractIssue] = []
    path = f"/filters/{index}"
    filter_type = filter_value.get("type")
    default = filter_value.get("default")
    if filter_type == "timeRange" and isinstance(default, Mapping):
        if isinstance(default.get("from"), str) and isinstance(default.get("to"), str):
            precision = filter_value.get("precision", "date")
            from_value = default["from"]
            to_value = default["to"]
            from_valid = _calendar_value_valid(from_value, precision)
            to_valid = _calendar_value_valid(to_value, precision)
            if not from_valid:
                issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/default/from", "invalid time range start"))
            if not to_valid:
                issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/default/to", "invalid time range end"))
            if from_valid and to_valid and from_value > to_value:
                issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/default", "time range start is after end"))
        else:
            anchor = default.get("anchor")
            if isinstance(anchor, str) and not _is_calendar_date(anchor):
                issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/default/anchor", "invalid relative-time anchor"))
    elif filter_type == "timePoint" and isinstance(default, str):
        granularity = filter_value.get("granularity")
        valid = (
            _valid_month(default)
            if granularity == "month"
            else _is_calendar_date(default)
        )
        if not valid:
            issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/default", "invalid time point"))
    elif filter_type == "numberRange" and isinstance(default, Mapping):
        start = default.get("from")
        end = default.get("to")
        if start is None and end is None:
            issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/default", "number range needs a bound"))
        elif isinstance(start, (int, float)) and isinstance(end, (int, float)) and start > end:
            issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/default", "number range is inverted"))
    elif filter_type == "dimension":
        hierarchy = filter_value.get("hierarchy", [])
        hierarchy = hierarchy if isinstance(hierarchy, list) else []
        level_ids: set[str] = set()
        for level_index, level in enumerate(hierarchy):
            if not isinstance(level, Mapping) or not isinstance(level.get("id"), str):
                continue
            level_id = level["id"]
            if level_id in level_ids:
                issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/hierarchy/{level_index}/id", "duplicate hierarchy level"))
            level_ids.add(level_id)
        default_level = filter_value.get("defaultLevel")
        if isinstance(default_level, str):
            if not hierarchy or default_level not in level_ids:
                issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/defaultLevel", "default level is not declared"))
        if filter_value.get("hierarchyPicker") is not None and not hierarchy:
            issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/hierarchyPicker", "hierarchy picker needs hierarchy"))
    return issues


def _has_filter_cycle(
    start_id: str, by_id: Mapping[str, Mapping[str, Any]]
) -> bool:
    seen: set[str] = set()
    current: str | None = start_id
    while current is not None:
        if current in seen:
            return True
        seen.add(current)
        candidate = by_id.get(current)
        next_id = candidate.get("dependsOn") if candidate is not None else None
        current = next_id if isinstance(next_id, str) else None
    return False


def _calendar_value_valid(value: str, precision: object) -> bool:
    if precision == "datetime":
        match = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})", value)
        if match is None:
            return False
        date_part = "-".join(match.groups()[:3])
        return _is_calendar_date(date_part) and int(match[4]) <= 23 and int(match[5]) <= 59
    return _is_calendar_date(value)


def _valid_month(value: str) -> bool:
    match = re.fullmatch(r"\d{4}-(\d{2})", value)
    return match is not None and 1 <= int(match.group(1)) <= 12


def _query_mapping_issues(
    source_id: object,
    data_source: Mapping[str, Any],
    filters_by_id: Mapping[str, Mapping[str, Any]],
) -> list[PageContractIssue]:
    source = data_source.get("source")
    raw_fields = data_source.get("fields")
    if (
        not isinstance(source, Mapping)
        or source.get("type") != "query"
        or not isinstance(raw_fields, Mapping)
    ):
        return []
    query = source.get("query")
    if not isinstance(query, Mapping):
        return []
    body = query.get("body")
    dsl_list = body.get("dsl_list") if isinstance(body, Mapping) else None
    item = dsl_list[0] if isinstance(dsl_list, list) and dsl_list else {}
    item = item if isinstance(item, Mapping) else {}
    dimensions = [
        entry
        for entry in item.get("output_dims", [])
        if isinstance(entry, str)
    ]
    metrics = _metric_names(item.get("output_metrics", []))
    outputs = set([*dimensions, *metrics])
    fields, field_paths, field_issues = _resolved_fields(
        raw_fields, f"/dataSources/{_escape_pointer(source_id)}/fields"
    )
    mapped: dict[str, str] = {}
    issues: list[PageContractIssue] = []
    issues.extend(field_issues)
    source_path = f"/dataSources/{_escape_pointer(source_id)}"
    for field_id, raw_field in fields.items():
        if not isinstance(raw_field, Mapping):
            continue
        query_field = raw_field.get("queryField")
        if not isinstance(query_field, str):
            if str(field_id) not in _compute_output_fields(data_source):
                issues.append(
                    PageContractIssue(
                        "QUERY_MAPPING_ERROR",
                        field_paths[str(field_id)],
                        f"page field {field_id} has no queryField mapping and is not computed",
                    )
                )
            continue
        field_path = field_paths[field_id]
        path = f"{field_path}/queryField"
        if query_field in mapped:
            issues.append(
                PageContractIssue(
                    "QUERY_MAPPING_ERROR",
                    path,
                    f"queryField {query_field} is already mapped",
                )
            )
        else:
            mapped[query_field] = str(field_id)
        if query_field not in outputs:
            issues.append(
                PageContractIssue(
                    "QUERY_MAPPING_ERROR",
                    path,
                    f"queryField {query_field} is not a DQE output",
                )
            )
        elif raw_field.get("role") == "detail":
            if raw_field.get("type") == "recordList":
                item_fields = raw_field.get("items", {}).get("fields", {})
                if isinstance(item_fields, Mapping):
                    item_mappings: dict[str, str] = {}
                    for item_field_id, item_field in item_fields.items():
                        if not isinstance(item_field, Mapping):
                            continue
                        item_query_field = item_field.get("queryField")
                        if not isinstance(item_query_field, str):
                            continue
                        item_path = (
                            f"{field_path}/items/fields/"
                            f"{_escape_pointer(item_field_id)}/queryField"
                        )
                        if item_query_field in item_mappings:
                            issues.append(
                                PageContractIssue(
                                    "QUERY_MAPPING_ERROR",
                                    item_path,
                                    f"nested queryField {item_query_field} is already mapped",
                                )
                            )
                        else:
                            item_mappings[item_query_field] = str(item_field_id)
        elif query_field in dimensions and raw_field.get("role") != "dimension":
            issues.append(
                PageContractIssue(
                    "QUERY_MAPPING_ERROR",
                    f"{field_path}/role",
                    f"DQE dimension {query_field} must have dimension role",
                )
            )
        elif query_field in metrics and raw_field.get("role") != "measure":
            issues.append(
                PageContractIssue(
                    "QUERY_MAPPING_ERROR",
                    f"{field_path}/role",
                    f"DQE metric {query_field} must have measure role",
                )
            )
    for output in outputs:
        if output not in mapped:
            issues.append(
                PageContractIssue(
                    "QUERY_MAPPING_ERROR",
                    f"{source_path}/fields",
                    f"DQE output {output} has no queryField mapping",
                )
            )

    bindings = query.get("filterBindings", {})
    if isinstance(bindings, Mapping):
        for filter_id, raw_binding in bindings.items():
            path = (
                f"{source_path}/source/query/filterBindings/"
                f"{_escape_pointer(filter_id)}"
            )
            declared = filters_by_id.get(str(filter_id))
            if declared is None:
                issues.append(
                    PageContractIssue(
                        "FILTER_BINDING_ERROR",
                        path,
                        f"filter binding references unknown filter: {filter_id}",
                    )
                )
                continue
            if not isinstance(raw_binding, Mapping):
                continue
            target = raw_binding.get("target")
            filter_type = declared.get("type")
            if target == "time" and filter_type != "timeRange":
                issues.append(
                    PageContractIssue(
                        "FILTER_BINDING_ERROR",
                        path,
                        f"time target requires timeRange filter: {filter_id}",
                    )
                )
            elif target == "dimension" and filter_type != "dimension":
                issues.append(
                    PageContractIssue(
                        "FILTER_BINDING_ERROR",
                        path,
                        f"dimension target requires dimension filter: {filter_id}",
                    )
                )
    return issues


def _resolved_fields(
    raw_fields: Mapping[Any, Any], base_path: str
) -> tuple[
    dict[str, Mapping[str, Any]],
    dict[str, str],
    list[PageContractIssue],
]:
    """Expand the Page grouped-query shorthand into stable field definitions."""
    grouped = "dimensions" in raw_fields or "measures" in raw_fields
    if not grouped:
        return (
            {
                str(field_id): definition
                for field_id, definition in raw_fields.items()
                if isinstance(definition, Mapping)
            },
            {
                str(field_id): f"{base_path}/{_escape_pointer(field_id)}"
                for field_id, definition in raw_fields.items()
                if isinstance(definition, Mapping)
            },
            [],
        )

    fields: dict[str, Mapping[str, Any]] = {}
    paths: dict[str, str] = {}
    issues: list[PageContractIssue] = []
    for group_name, role in (("dimensions", "dimension"), ("measures", "measure")):
        group = raw_fields.get(group_name)
        if not isinstance(group, Mapping):
            continue
        for field_id, raw_definition in group.items():
            if not isinstance(raw_definition, Mapping):
                continue
            name = str(field_id)
            path = f"{base_path}/{group_name}/{_escape_pointer(field_id)}"
            if name in fields:
                issues.append(
                    PageContractIssue(
                        "SCHEMA_ERROR", path, f"duplicate grouped field: {name}"
                    )
                )
                continue
            if raw_definition.get("label") == name:
                issues.append(
                    PageContractIssue(
                        "SCHEMA_ERROR",
                        f"{path}/label",
                        f"field label equals its id and must be omitted: {name}",
                    )
                )
            definition = dict(raw_definition)
            definition["role"] = "measure" if definition.get("type") == "money" else role
            fields[name] = definition
            paths[name] = path
    return fields, paths, issues


def _metric_names(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    names: list[str] = []
    for entry in value:
        if isinstance(entry, str):
            names.append(entry)
        elif isinstance(entry, Mapping) and isinstance(entry.get("alias"), str):
            names.append(entry["alias"])
    return names


def _walk_components(
    components: list[Any], base_path: str
) -> list[tuple[Mapping[str, Any], str]]:
    result: list[tuple[Mapping[str, Any], str]] = []
    for index, raw_component in enumerate(components):
        path = f"{base_path}/{index}"
        result.extend(_walk_component(raw_component, path))
    return result


def _walk_component(
    raw_component: Any, path: str
) -> list[tuple[Mapping[str, Any], str]]:
    if not isinstance(raw_component, Mapping):
        return []
    result = [(raw_component, path)]
    props = raw_component.get("props")
    if not isinstance(props, Mapping):
        return result
    if raw_component.get("type") == "compositeCard":
        children = props.get("components")
        if isinstance(children, list):
            result.extend(_walk_components(children, f"{path}/props/components"))
    elif raw_component.get("type") == "tabContainer":
        tabs = props.get("tabs")
        if not isinstance(tabs, list):
            return result
        for tab_index, tab in enumerate(tabs):
            if not isinstance(tab, Mapping):
                continue
            component = tab.get("component")
            if isinstance(component, Mapping):
                result.extend(
                    _walk_component(
                        component,
                        f"{path}/props/tabs/{tab_index}/component",
                    )
                )
            children = tab.get("components")
            if isinstance(children, list):
                result.extend(
                    _walk_components(
                        children,
                        f"{path}/props/tabs/{tab_index}/components",
                    )
                )
    return result


def _component_issues(
    component: Mapping[str, Any],
    path: str,
    page: Mapping[str, Any],
) -> list[PageContractIssue]:
    data_sources = page.get("dataSources", {})
    if not isinstance(data_sources, Mapping):
        return []
    issues: list[PageContractIssue] = []
    slots = component.get("data", {})
    if not isinstance(slots, Mapping):
        slots = {}
    for slot, source_id in slots.items():
        if source_id not in data_sources:
            issues.append(
                PageContractIssue(
                    "SCHEMA_ERROR",
                    f"{path}/data/{_escape_pointer(slot)}",
                    f"data slot {slot} references unknown source: {source_id}",
                )
            )

    props = component.get("props")
    if not isinstance(props, Mapping):
        return issues
    component_type = component.get("type")
    filters = page.get("filters", [])
    filters = filters if isinstance(filters, list) else []
    filters_by_id = {
        item["id"]: item
        for item in filters
        if isinstance(item, Mapping) and isinstance(item.get("id"), str)
    }

    def check(
        binding: Any,
        binding_path: str,
        expected_role: str | None = None,
        allowed_detail_type: str | None = None,
    ) -> None:
        issues.extend(
            _binding_issues(
                binding,
                binding_path,
                expected_role,
                slots,
                data_sources,
                allowed_detail_type,
            )
        )

    if component_type == "metricCard":
        rows = [*props.get("rows", []), *props.get("secondaryRows", [])]
        has_navigate = any(
            isinstance(action, Mapping) and "navigate" in action
            for action in props.get("actions", [])
        )
        for row_index, row in enumerate(rows):
            if isinstance(row, Mapping):
                row_group = "rows" if row_index < len(props.get("rows", [])) else "secondaryRows"
                actual_index = row_index if row_group == "rows" else row_index - len(props.get("rows", []))
                row_path = f"{path}/props/{row_group}/{actual_index}"
                check(row.get("valueField"), f"{row_path}/valueField", "measure")
                for change_index, change in enumerate(row.get("changes", [])):
                    if isinstance(change, Mapping):
                        check(change.get("field"), f"{row_path}/changes/{change_index}/field", "measure")
                if row.get("link") is True and not has_navigate:
                    issues.append(PageContractIssue("SCHEMA_ERROR", f"{row_path}/link", "linked metric row needs navigate action"))
        progress = props.get("progress")
        if isinstance(progress, Mapping):
            check(progress.get("valueField"), f"{path}/props/progress/valueField", "measure")
    elif component_type == "barChart":
        check(props.get("categoryField"), f"{path}/props/categoryField", "dimension")
        for index, series in enumerate(props.get("series", [])):
            if isinstance(series, Mapping):
                check(series.get("field"), f"{path}/props/series/{index}/field", "measure")
        issues.extend(_bar_forecast_issues(component, path, data_sources))
    elif component_type == "lineChart":
        check(props.get("xField"), f"{path}/props/xField", "dimension")
        for index, series in enumerate(props.get("series", [])):
            if isinstance(series, Mapping):
                check(series.get("field"), f"{path}/props/series/{index}/field", "measure")
    elif component_type == "pieChart":
        check(props.get("categoryField"), f"{path}/props/categoryField", "dimension")
        check(props.get("valueField"), f"{path}/props/valueField", "measure")
    elif component_type == "table":
        issues.extend(_table_component_issues(component, path, data_sources, filters_by_id, check))
    elif component_type == "keyValuePanel":
        for index, item in enumerate(props.get("items", [])):
            if isinstance(item, Mapping):
                check(item.get("field"), f"{path}/props/items/{index}/field")
    elif component_type == "categoryBreakdown":
        check(props.get("categoryField"), f"{path}/props/categoryField", "dimension")
        for index, column in enumerate(props.get("columns", [])):
            if isinstance(column, Mapping):
                check(column.get("field"), f"{path}/props/columns/{index}/field", "measure")
        if props.get("swatches") is True and not _has_matching_pie(page, component):
            issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/props/swatches", "swatches need a matching pie chart"))
    elif component_type == "fieldText":
        check(props.get("field"), f"{path}/props/field", None, "semanticHtml")
    elif component_type == "aiSummary":
        issues.extend(_ai_summary_issues(props, path, data_sources))
    elif component_type == "mapChart":
        check(props.get("nameField"), f"{path}/props/nameField", "dimension")
        check(props.get("valueField"), f"{path}/props/valueField", "measure")
        for index, item in enumerate(props.get("tooltipFields", [])):
            if isinstance(item, Mapping):
                check(item.get("field"), f"{path}/props/tooltipFields/{index}/field")
        issues.extend(_map_component_issues(component, path, filters_by_id, check, slots, data_sources))
    elif component_type == "gauge":
        check(props.get("valueField"), f"{path}/props/valueField", "measure")
    elif component_type == "tabContainer":
        tab_ids: set[str] = set()
        for tab_index, tab in enumerate(props.get("tabs", [])):
            if not isinstance(tab, Mapping) or not isinstance(tab.get("id"), str):
                continue
            if tab["id"] in tab_ids:
                issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/props/tabs/{tab_index}/id", "duplicate tab id"))
            tab_ids.add(tab["id"])
        default_tab = props.get("defaultTab")
        if isinstance(default_tab, str) and default_tab not in tab_ids:
            issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/props/defaultTab", "default tab is unknown"))
    elif component_type in {"rankingCard", "rankingDetailCard"}:
        check(props.get("nameField"), f"{path}/props/nameField", "dimension")
        check(props.get("valueField"), f"{path}/props/valueField", "measure")
        if props.get("changeField") is not None:
            check(props.get("changeField"), f"{path}/props/changeField", "measure")
        if component_type == "rankingDetailCard":
            issues.extend(_ranking_detail_issues(props, path, slots, data_sources, check))

    issues.extend(_action_issues(component, path, data_sources, filters_by_id, check))
    return issues


def _table_field_checks(
    columns: Any, base_path: str
) -> list[tuple[Any, str, str | None]]:
    checks: list[tuple[Any, str, str | None]] = []
    if not isinstance(columns, list):
        return checks
    for index, column in enumerate(columns):
        if not isinstance(column, Mapping):
            continue
        path = f"{base_path}/{index}"
        if column.get("kind") == "group":
            checks.extend(
                _table_field_checks(column.get("children"), f"{path}/children")
            )
        else:
            checks.append((column.get("field"), f"{path}/field", None))
    return checks


BindingCheck = Callable[[Any, str, str | None, str | None], None]


def _ai_summary_issues(
    props: Mapping[str, Any], path: str, data_sources: Mapping[Any, Any]
) -> list[PageContractIssue]:
    issues: list[PageContractIssue] = []
    terms: dict[str, str] = {}
    related_data = props.get("relatedData", {})
    if not isinstance(related_data, Mapping):
        return issues
    for related_id, related in related_data.items():
        if not isinstance(related, Mapping):
            continue
        related_path = f"{path}/props/relatedData/{_escape_pointer(related_id)}"
        source_id = related.get("source")
        source = data_sources.get(source_id)
        if not isinstance(source, Mapping):
            issues.append(PageContractIssue("SCHEMA_ERROR", f"{related_path}/source", "related data source is unknown"))
            continue
        raw_fields = source.get("fields", {})
        fields, _paths, _field_issues = (
            _resolved_fields(raw_fields, "") if isinstance(raw_fields, Mapping) else ({}, {}, [])
        )
        seen: set[str] = set()
        for field_index, binding in enumerate(related.get("fields", [])):
            if not isinstance(binding, Mapping):
                continue
            field_id = binding.get("field")
            field_path = f"{related_path}/fields/{field_index}"
            field = fields.get(field_id) if isinstance(field_id, str) else None
            if field is None or field.get("role") == "detail":
                issues.append(PageContractIssue("SCHEMA_ERROR", f"{field_path}/field", "AI summary field is unavailable"))
            if isinstance(field_id, str) and field_id in seen:
                issues.append(PageContractIssue("SCHEMA_ERROR", f"{field_path}/field", "AI summary field is duplicated"))
            if isinstance(field_id, str):
                seen.add(field_id)
                term = binding.get("term")
                previous = terms.get(field_id)
                if isinstance(term, str) and previous is not None and previous != term:
                    issues.append(PageContractIssue("SCHEMA_ERROR", f"{field_path}/term", "AI summary term mapping conflicts"))
                elif isinstance(term, str):
                    terms[field_id] = term
    return issues


def _table_component_issues(
    component: Mapping[str, Any],
    path: str,
    data_sources: Mapping[Any, Any],
    filters_by_id: Mapping[str, Mapping[str, Any]],
    check: BindingCheck,
) -> list[PageContractIssue]:
    issues: list[PageContractIssue] = []
    slots = component.get("data", {})
    slots = slots if isinstance(slots, Mapping) else {}
    props = component.get("props", {})
    if not isinstance(props, Mapping):
        return issues
    row_key = props.get("rowKey")
    if len(slots) > 1:
        if not isinstance(row_key, str):
            issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/props/rowKey", "multi-slot table needs rowKey"))
        else:
            expected_type: Any = None
            for slot, source_id in slots.items():
                source = data_sources.get(source_id)
                raw_fields = source.get("fields", {}) if isinstance(source, Mapping) else {}
                fields, _paths, _field_issues = (
                    _resolved_fields(raw_fields, "") if isinstance(raw_fields, Mapping) else ({}, {}, [])
                )
                field = fields.get(row_key)
                slot_path = f"{path}/data/{_escape_pointer(slot)}"
                if field is None or field.get("role") != "dimension":
                    issues.append(PageContractIssue("SCHEMA_ERROR", slot_path, "rowKey must be a dimension in every slot"))
                    continue
                if expected_type is None:
                    expected_type = field.get("type")
                elif field.get("type") != expected_type:
                    issues.append(PageContractIssue("SCHEMA_ERROR", slot_path, "rowKey types must match"))

    main_source = data_sources.get(slots.get("main"))
    main_fields_raw = main_source.get("fields", {}) if isinstance(main_source, Mapping) else {}
    main_fields, _paths, _field_issues = (
        _resolved_fields(main_fields_raw, "") if isinstance(main_fields_raw, Mapping) else ({}, {}, [])
    )
    row_kind = props.get("rowKindField")
    if isinstance(row_kind, str):
        row_kind_path = f"{path}/props/rowKindField"
        if row_kind not in main_fields:
            issues.append(PageContractIssue("SCHEMA_ERROR", row_kind_path, "row kind field is unknown"))
        else:
            compute = main_source.get("compute", []) if isinstance(main_source, Mapping) else []
            written = any(
                isinstance(operator, Mapping)
                and operator.get("op") in {"groupSubtotal", "grandTotal"}
                and isinstance(operator.get("rowKind"), Mapping)
                and operator["rowKind"].get("field") == row_kind
                for operator in compute
            )
            if not written:
                issues.append(PageContractIssue("SCHEMA_ERROR", row_kind_path, "row kind field is not written by a folding operator"))

    seen: set[str] = set()
    leaf_fields: list[str] = []
    for column, column_path in _table_leaf_columns(props.get("columns", []), f"{path}/props/columns"):
        binding = column.get("field")
        check(binding, f"{column_path}/field", None, "semanticHtml")
        for property_name in ("secondaryField", "badgeField"):
            if column.get(property_name) is not None:
                check(column.get(property_name), f"{column_path}/{property_name}", None, None)
        selection = column.get("selection")
        writes = selection.get("writes", {}) if isinstance(selection, Mapping) else {}
        if isinstance(writes, Mapping):
            for filter_id, write in writes.items():
                write_path = f"{column_path}/selection/writes/{_escape_pointer(filter_id)}"
                target = filters_by_id.get(str(filter_id))
                if target is None or target.get("type") != "dimension":
                    issues.append(PageContractIssue("SCHEMA_ERROR", write_path, "selection target must be a declared dimension filter"))
                if isinstance(write, Mapping) and write.get("field") is not None:
                    check(write.get("field"), f"{write_path}/field", None, None)
        key = _binding_key(binding)
        if key in seen:
            issues.append(PageContractIssue("SCHEMA_ERROR", f"{column_path}/field", "duplicate table column binding"))
        seen.add(key)
        field_name = _binding_field_name(binding)
        if field_name is not None:
            leaf_fields.append(field_name)
        if column.get("filterable") is not None:
            check(binding, f"{column_path}/filterable", "dimension", None)

    merge_by = props.get("mergeBy")
    if isinstance(merge_by, str) and merge_by not in leaf_fields:
        issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/props/mergeBy", "mergeBy is not a table column"))
    return issues


def _table_leaf_columns(value: Any, base_path: str) -> list[tuple[Mapping[str, Any], str]]:
    result: list[tuple[Mapping[str, Any], str]] = []
    if not isinstance(value, list):
        return result
    for index, column in enumerate(value):
        if not isinstance(column, Mapping):
            continue
        path = f"{base_path}/{index}"
        if column.get("kind") == "group":
            result.extend(_table_leaf_columns(column.get("children"), f"{path}/children"))
        else:
            result.append((column, path))
    return result


def _ranking_detail_issues(
    props: Mapping[str, Any],
    path: str,
    slots: Mapping[Any, Any],
    data_sources: Mapping[Any, Any],
    check: BindingCheck,
) -> list[PageContractIssue]:
    issues: list[PageContractIssue] = []
    for index, binding in enumerate(props.get("badgeFields", [])):
        check(binding, f"{path}/props/badgeFields/{index}", "dimension", None)
    if props.get("descriptionField") is not None:
        check(props.get("descriptionField"), f"{path}/props/descriptionField", "dimension", None)
    semantic = props.get("semanticDescriptionField")
    if semantic is not None:
        semantic_path = f"{path}/props/semanticDescriptionField"
        check(semantic, semantic_path, "detail", None)
        slot, field_id = _binding_parts(semantic)
        field = _resolve_binding(slot, field_id, slots, data_sources)
        if field is not None and field.get("type") != "semanticHtml":
            issues.append(PageContractIssue("SCHEMA_ERROR", semantic_path, "semantic description must be semanticHtml"))
    details = props.get("details")
    if not isinstance(details, Mapping):
        return issues
    details_path = f"{path}/props/details"
    details_binding = details.get("field")
    check(details_binding, f"{details_path}/field", "detail", None)
    slot, field_id = _binding_parts(details_binding)
    field = _resolve_binding(slot, field_id, slots, data_sources)
    if field is None:
        return issues
    if field.get("type") != "recordList":
        issues.append(PageContractIssue("SCHEMA_ERROR", f"{details_path}/field", "details must bind recordList"))
        return issues
    item_fields = field.get("items", {}).get("fields", {})
    if not isinstance(item_fields, Mapping):
        return issues
    expected = [
        (details.get("titleField"), f"{details_path}/titleField", "dimension"),
    ]
    value_field = details.get("valueField")
    if isinstance(value_field, Mapping):
        expected.append((value_field.get("field"), f"{details_path}/valueField/field", "measure"))
    if details.get("descriptionField") is not None:
        expected.append((details.get("descriptionField"), f"{details_path}/descriptionField", "dimension"))
    for item_field_id, item_path, role in expected:
        item_field = item_fields.get(item_field_id)
        if not isinstance(item_field, Mapping) or item_field.get("role") != role:
            issues.append(PageContractIssue("SCHEMA_ERROR", item_path, "detail item field is unknown or has the wrong role"))
    return issues


def _map_component_issues(
    component: Mapping[str, Any],
    path: str,
    filters_by_id: Mapping[str, Mapping[str, Any]],
    check: BindingCheck,
    slots: Mapping[Any, Any],
    data_sources: Mapping[Any, Any],
) -> list[PageContractIssue]:
    issues: list[PageContractIssue] = []
    props = component.get("props", {})
    if not isinstance(props, Mapping):
        return issues
    summary = props.get("pinnedSummary")
    if isinstance(summary, Mapping):
        summary_path = f"{path}/props/pinnedSummary"
        check(summary.get("matchField"), f"{summary_path}/matchField", "dimension", None)
        check(summary.get("titleField"), f"{summary_path}/titleField", "dimension", None)
        for index, item in enumerate(summary.get("fields", [])):
            if isinstance(item, Mapping):
                check(item.get("field"), f"{summary_path}/fields/{index}/field", None, None)
        if props.get("variant") != "regionalOverview":
            issues.append(PageContractIssue("SCHEMA_ERROR", summary_path, "pinned summary needs regionalOverview"))
        slot, field_id = _binding_parts(summary.get("matchField"))
        field = _resolve_binding(slot, field_id, slots, data_sources)
        if field is not None and _scalar_violation(summary.get("matchValue"), field) is not None:
            issues.append(PageContractIssue("SCHEMA_ERROR", f"{summary_path}/matchValue", "pinned summary match value has wrong type"))
        labels: set[str] = set()
        for index, item in enumerate(summary.get("fields", [])):
            if not isinstance(item, Mapping):
                continue
            label = str(item.get("label"))
            if label in labels:
                issues.append(PageContractIssue("SCHEMA_ERROR", f"{summary_path}/fields/{index}/label", "duplicate pinned summary label"))
            labels.add(label)
    legend = props.get("legend")
    bands = legend.get("bands") if isinstance(legend, Mapping) else None
    if isinstance(bands, list):
        previous: float | None = None
        for index, band in enumerate(bands):
            current = band.get("from") if isinstance(band, Mapping) else None
            if isinstance(current, (int, float)) and previous is not None and current <= previous:
                issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/props/legend/bands/{index}/from", "legend bands must increase"))
            if isinstance(current, (int, float)):
                previous = float(current)
    hierarchy_filter = props.get("hierarchyFilter")
    if not isinstance(hierarchy_filter, str):
        for name in ("levelField", "parentField", "levelMaps"):
            if props.get(name) is not None:
                issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/props/{name}", f"{name} needs hierarchyFilter"))
        return issues
    target = filters_by_id.get(hierarchy_filter)
    hierarchy = target.get("hierarchy") if isinstance(target, Mapping) else None
    if target is None or target.get("type") != "dimension" or not isinstance(hierarchy, list) or not hierarchy:
        issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/props/hierarchyFilter", "map hierarchy filter is undeclared or not hierarchical"))
        return issues
    for name in ("levelField", "parentField", "codeField"):
        if props.get(name) is not None:
            check(props.get(name), f"{path}/props/{name}", "dimension", None)
    level_ids = {item.get("id") for item in hierarchy if isinstance(item, Mapping)}
    level_maps = props.get("levelMaps")
    if isinstance(level_maps, Mapping):
        for level_id in level_maps:
            if level_id not in level_ids:
                issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/props/levelMaps/{_escape_pointer(level_id)}", "level map references unknown level"))
    return issues


def _action_issues(
    component: Mapping[str, Any],
    path: str,
    data_sources: Mapping[Any, Any],
    filters_by_id: Mapping[str, Mapping[str, Any]],
    check: BindingCheck,
) -> list[PageContractIssue]:
    props = component.get("props", {})
    actions = props.get("actions", []) if isinstance(props, Mapping) else []
    if not isinstance(actions, list):
        return []
    issues: list[PageContractIssue] = []
    slots = component.get("data", {})
    slots = slots if isinstance(slots, Mapping) else {}
    main_source = data_sources.get(slots.get("main"))
    live = (
        isinstance(main_source, Mapping)
        and isinstance(main_source.get("source"), Mapping)
        and main_source["source"].get("type") == "query"
    )
    if not live and any(isinstance(action, Mapping) and "navigate" not in action for action in actions):
        issues.append(PageContractIssue("SCHEMA_ERROR", f"{path}/props/actions", "writeFilter needs a live query source"))
    for index, action in enumerate(actions):
        if not isinstance(action, Mapping):
            continue
        action_path = f"{path}/props/actions/{index}"
        if "writeFilter" in action:
            filter_id = action.get("writeFilter")
            target = filters_by_id.get(str(filter_id))
            if target is None or target.get("type") != "dimension":
                issues.append(PageContractIssue("SCHEMA_ERROR", f"{action_path}/writeFilter", "writeFilter target must be a declared dimension filter"))
            check(action.get("field"), f"{action_path}/field", "dimension", None)
            continue
        navigate = action.get("navigate")
        if not isinstance(navigate, Mapping):
            continue
        for filter_index, filter_id in enumerate(navigate.get("carryFilters", [])):
            if str(filter_id) not in filters_by_id:
                issues.append(PageContractIssue("SCHEMA_ERROR", f"{action_path}/navigate/carryFilters/{filter_index}", "carryFilters references unknown filter"))
        set_filters = navigate.get("setFilters", {})
        if isinstance(set_filters, Mapping):
            for filter_id, binding in set_filters.items():
                check(binding, f"{action_path}/navigate/setFilters/{_escape_pointer(filter_id)}", "dimension", None)
        set_params = navigate.get("setParams", {})
        if isinstance(set_params, Mapping):
            for param_id, binding in set_params.items():
                check(binding, f"{action_path}/navigate/setParams/{_escape_pointer(param_id)}", None, None)
    return issues


def _has_matching_pie(page: Mapping[str, Any], component: Mapping[str, Any]) -> bool:
    own = _category_binding_key(component, component.get("props", {}).get("categoryField"))
    if own is None:
        return False
    sections = page.get("sections", [])
    if not isinstance(sections, list):
        return False
    for section_index, section in enumerate(sections):
        if not isinstance(section, Mapping):
            continue
        components = section.get("components", [])
        if not isinstance(components, list):
            continue
        for candidate, _path in _walk_components(components, f"/sections/{section_index}/components"):
            if candidate.get("type") == "pieChart" and _category_binding_key(
                candidate, candidate.get("props", {}).get("categoryField")
            ) == own:
                return True
    return False


def _category_binding_key(component: Mapping[str, Any], binding: Any) -> str | None:
    slots = component.get("data", {})
    if not isinstance(slots, Mapping):
        return None
    slot, field_id = _binding_parts(binding)
    source_id = slots.get(slot)
    return f"{source_id}.{field_id}" if isinstance(source_id, str) and isinstance(field_id, str) else None


def _bar_forecast_issues(
    component: Mapping[str, Any], path: str, data_sources: Mapping[Any, Any]
) -> list[PageContractIssue]:
    props = component.get("props", {})
    slots = component.get("data", {})
    if not isinstance(props, Mapping) or not isinstance(slots, Mapping):
        return []
    source_id = slots.get("main")
    source = data_sources.get(source_id)
    source_value = source.get("source", {}) if isinstance(source, Mapping) else {}
    initial = source_value.get("initial") if isinstance(source_value, Mapping) else None
    if not isinstance(initial, Mapping):
        return []
    captured_at = initial.get("capturedAt")
    match = re.match(r"^\d{4}-(\d{2})-", captured_at) if isinstance(captured_at, str) else None
    if match is None:
        return []
    captured_month = int(match.group(1))
    category_field = _binding_field_name(props.get("categoryField"))
    if category_field is None:
        return []
    issues: list[PageContractIssue] = []
    for row_index, row in enumerate(initial.get("rows", [])):
        if not isinstance(row, Mapping):
            continue
        month_value = row.get(category_field)
        month_match = re.fullmatch(r"\s*(\d{1,2})月\s*", month_value) if isinstance(month_value, str) else None
        if month_match is None:
            continue
        month = int(month_match.group(1))
        for series in props.get("series", []):
            if not isinstance(series, Mapping) or series.get("role") not in {"actual", "forecast"}:
                continue
            field_id = _binding_field_name(series.get("field"))
            if field_id is None or row.get(field_id) is None:
                continue
            if (series.get("role") == "forecast" and month <= captured_month) or (
                series.get("role") == "actual" and month > captured_month
            ):
                issues.append(PageContractIssue("SCHEMA_ERROR", f"/dataSources/{_escape_pointer(source_id)}/source/initial/rows/{row_index}/{_escape_pointer(field_id)}", "forecast boundary violation"))
    return issues


def _binding_parts(binding: Any) -> tuple[str | None, str | None]:
    if isinstance(binding, str):
        return "main", binding
    if isinstance(binding, Mapping):
        slot = binding.get("data")
        field_id = binding.get("field")
        return (
            slot if isinstance(slot, str) else None,
            field_id if isinstance(field_id, str) else None,
        )
    return None, None


def _binding_field_name(binding: Any) -> str | None:
    return _binding_parts(binding)[1]


def _binding_key(binding: Any) -> str:
    slot, field_id = _binding_parts(binding)
    return f"{slot}:{field_id}"


def _binding_issues(
    binding: Any,
    path: str,
    expected_role: str | None,
    slots: Mapping[Any, Any],
    data_sources: Mapping[Any, Any],
    allowed_detail_type: str | None = None,
) -> list[PageContractIssue]:
    if isinstance(binding, str):
        slot = "main"
        field_id = binding
    elif isinstance(binding, Mapping):
        slot = binding.get("data")
        field_id = binding.get("field")
    else:
        return []
    resolved = _resolve_binding(slot, field_id, slots, data_sources)
    if resolved is None:
        return [
            PageContractIssue(
                "SCHEMA_ERROR",
                path,
                f"field {field_id} is not in data slot {slot}",
            )
        ]
    field = resolved
    if (
        expected_role is not None
        and isinstance(field, Mapping)
        and field.get("role") != expected_role
    ):
        issues = [
            PageContractIssue(
                "SCHEMA_ERROR",
                path,
                f"field {field_id} must have {expected_role} role",
            )
        ]
    elif (
        expected_role is None
        and field.get("role") == "detail"
        and field.get("type") != allowed_detail_type
    ):
        issues = [
            PageContractIssue(
                "SCHEMA_ERROR", path, "detail field is not supported by this binding"
            )
        ]
    else:
        issues = []
    if isinstance(binding, Mapping) and isinstance(binding.get("match"), Mapping):
        match = binding["match"]
        match_field = match.get("field")
        matched = _resolve_binding(slot, match_field, slots, data_sources)
        match_path = f"{path}/match"
        if matched is None:
            issues.append(PageContractIssue("SCHEMA_ERROR", f"{match_path}/field", "match field is unknown"))
        else:
            if matched.get("role") != "dimension":
                issues.append(PageContractIssue("SCHEMA_ERROR", f"{match_path}/field", "match field must be a dimension"))
            if _scalar_violation(match.get("equals"), matched) is not None:
                issues.append(PageContractIssue("SCHEMA_ERROR", f"{match_path}/equals", "match value has the wrong type"))
    return issues


def _resolve_binding(
    slot: Any,
    field_id: Any,
    slots: Mapping[Any, Any],
    data_sources: Mapping[Any, Any],
) -> Mapping[str, Any] | None:
    if not isinstance(slot, str) or not isinstance(field_id, str):
        return None
    source_id = slots.get(slot)
    source = data_sources.get(source_id)
    raw_fields = source.get("fields") if isinstance(source, Mapping) else None
    if not isinstance(raw_fields, Mapping):
        return None
    fields, _paths, _issues = _resolved_fields(raw_fields, "")
    return fields.get(field_id)


def _compute_issues(
    source_id: object, data_source: Mapping[str, Any]
) -> list[PageContractIssue]:
    operators = data_source.get("compute", [])
    raw_fields = data_source.get("fields")
    if not isinstance(operators, list) or not operators or not isinstance(raw_fields, Mapping):
        return []
    source_path = f"/dataSources/{_escape_pointer(source_id)}"
    fields, _paths, _field_issues = _resolved_fields(
        raw_fields, f"{source_path}/fields"
    )
    issues: list[PageContractIssue] = []
    produced: set[str] = set()
    row_kind_fields: set[str] = set()

    def declared(
        field_id: Any, path: str, expected_role: str | None = None
    ) -> Mapping[str, Any] | None:
        field = fields.get(field_id) if isinstance(field_id, str) else None
        if field is None:
            issues.append(
                PageContractIssue("SCHEMA_ERROR", path, f"unknown compute field: {field_id}")
            )
            return None
        if expected_role is not None and field.get("role") != expected_role:
            issues.append(
                PageContractIssue(
                    "SCHEMA_ERROR", path, f"compute field {field_id} must be {expected_role}"
                )
            )
        return field

    def numeric_input(field_id: Any, path: str) -> None:
        field = declared(field_id, path, "measure")
        if field is not None and field.get("type") not in {"number", "money"}:
            issues.append(
                PageContractIssue("SCHEMA_ERROR", path, f"compute field {field_id} must be numeric")
            )

    def output(field_id: Any, path: str, expected_role: str) -> None:
        if isinstance(field_id, str):
            if field_id in produced:
                issues.append(
                    PageContractIssue("SCHEMA_ERROR", path, f"duplicate compute output: {field_id}")
                )
            produced.add(field_id)
        field = declared(field_id, path, expected_role)
        if field is not None and "queryField" in field:
            issues.append(
                PageContractIssue("SCHEMA_ERROR", path, f"computed field {field_id} cannot have queryField")
            )

    def collapsible(values: Any, path: str) -> None:
        if not isinstance(values, list):
            return
        for index, field_id in enumerate(values):
            item_path = f"{path}/{index}"
            field = declared(field_id, item_path, "measure")
            if field is not None and field.get("collapsible") is not True:
                issues.append(
                    PageContractIssue("SCHEMA_ERROR", item_path, f"field {field_id} is not collapsible")
                )

    def row_kind(mark: Any, path: str) -> None:
        if not isinstance(mark, Mapping):
            return
        field_id = mark.get("field")
        if isinstance(field_id, str):
            row_kind_fields.add(field_id)
        field = declared(field_id, f"{path}/field", "dimension")
        if field is not None and field.get("type") != "string":
            issues.append(
                PageContractIssue("SCHEMA_ERROR", f"{path}/field", "row kind field must be string")
            )
        if field is not None and field.get("nullable") is False:
            issues.append(
                PageContractIssue("SCHEMA_ERROR", f"{path}/field", "row kind field must be nullable")
            )

    for index, operator in enumerate(operators):
        if not isinstance(operator, Mapping):
            continue
        path = f"{source_path}/compute/{index}"
        op = operator.get("op")
        if op == "ratio":
            numeric_input(operator.get("numerator"), f"{path}/numerator")
            numeric_input(operator.get("denominator"), f"{path}/denominator")
            output(operator.get("output"), f"{path}/output", "measure")
        elif op == "delta":
            numeric_input(operator.get("minuend"), f"{path}/minuend")
            numeric_input(operator.get("subtrahend"), f"{path}/subtrahend")
            output(operator.get("output"), f"{path}/output", "measure")
        elif op == "groupSubtotal":
            declared(operator.get("groupBy"), f"{path}/groupBy", "dimension")
            collapsible(operator.get("measures"), f"{path}/measures")
            row_kind(operator.get("rowKind"), f"{path}/rowKind")
        elif op == "grandTotal":
            collapsible(operator.get("measures"), f"{path}/measures")
            row_kind(operator.get("rowKind"), f"{path}/rowKind")
            label = operator.get("label")
            if isinstance(label, Mapping):
                declared(label.get("field"), f"{path}/label/field", "dimension")
        elif op == "pivot":
            declared(operator.get("categoryField"), f"{path}/categoryField", "dimension")
            declared(operator.get("valueField"), f"{path}/valueField", "measure")
            for key_index, field_id in enumerate(operator.get("keyFields", [])):
                declared(field_id, f"{path}/keyFields/{key_index}", "dimension")
            categories: set[str] = set()
            columns = operator.get("columns", [])
            if not isinstance(columns, list):
                columns = []
            for column_index, column in enumerate(columns):
                if not isinstance(column, Mapping):
                    continue
                column_path = f"{path}/columns/{column_index}"
                output(column.get("output"), f"{column_path}/output", "measure")
                for category_index, category in enumerate(column.get("categories", [])):
                    if isinstance(category, str) and category in categories:
                        issues.append(
                            PageContractIssue(
                                "SCHEMA_ERROR",
                                f"{column_path}/categories/{category_index}",
                                f"duplicate pivot category: {category}",
                            )
                        )
                    if isinstance(category, str):
                        categories.add(category)

    produced.update(row_kind_fields)
    source = data_source.get("source")
    if isinstance(source, Mapping):
        if source.get("type") == "inline":
            rows = source.get("rows")
            rows_path = f"{source_path}/source/rows"
        else:
            initial = source.get("initial")
            rows = initial.get("rows") if isinstance(initial, Mapping) else None
            rows_path = f"{source_path}/source/initial/rows"
        if isinstance(rows, list):
            for row_index, row in enumerate(rows):
                if not isinstance(row, Mapping):
                    continue
                for field_id in produced:
                    field = fields.get(field_id)
                    raw_key = (
                        field.get("queryField")
                        if source.get("type") == "query"
                        and isinstance(field, Mapping)
                        and isinstance(field.get("queryField"), str)
                        else field_id
                    )
                    if raw_key in row:
                        issues.append(
                            PageContractIssue(
                                "SCHEMA_ERROR",
                                f"{rows_path}/{row_index}/{_escape_pointer(field_id)}",
                                f"computed field {field_id} cannot be present in rows",
                            )
                        )
    return issues


def _query_pagination_issues(page: Mapping[str, Any]) -> list[PageContractIssue]:
    data_sources = page.get("dataSources", {})
    if not isinstance(data_sources, Mapping):
        return []
    references: dict[str, list[str]] = {}
    query_tables: list[tuple[str, str]] = []
    issues: list[PageContractIssue] = []

    def add_reference(source_id: Any, path: str) -> None:
        if isinstance(source_id, str):
            references.setdefault(source_id, []).append(path)

    sections = page.get("sections", [])
    if not isinstance(sections, list):
        return issues
    for section_index, section in enumerate(sections):
        if not isinstance(section, Mapping):
            continue
        components = section.get("components", [])
        if not isinstance(components, list):
            continue
        for component, path in _walk_components(
            components, f"/sections/{section_index}/components"
        ):
            slots = component.get("data", {})
            if isinstance(slots, Mapping):
                for slot, source_id in slots.items():
                    add_reference(source_id, f"{path}/data/{_escape_pointer(slot)}")
            props = component.get("props", {})
            props = props if isinstance(props, Mapping) else {}
            if component.get("type") == "aiSummary":
                related_data = props.get("relatedData", {})
                if isinstance(related_data, Mapping):
                    for name, related in related_data.items():
                        if isinstance(related, Mapping):
                            add_reference(
                                related.get("source"),
                                f"{path}/props/relatedData/{_escape_pointer(name)}/source",
                            )
            if component.get("type") != "table":
                continue
            pagination = props.get("pagination")
            if not isinstance(pagination, Mapping):
                continue
            source_id = slots.get("main") if isinstance(slots, Mapping) else None
            source = data_sources.get(source_id)
            raw_source = source.get("source") if isinstance(source, Mapping) else None
            source_type = raw_source.get("type") if isinstance(raw_source, Mapping) else None
            mode = pagination.get("mode")
            if mode == "local" and source_type != "inline":
                issues.append(
                    PageContractIssue("SCHEMA_ERROR", f"{path}/props/pagination/mode", "local pagination requires inline data")
                )
            if mode != "query":
                continue
            if source_type != "query":
                issues.append(
                    PageContractIssue("SCHEMA_ERROR", f"{path}/props/pagination/mode", "query pagination requires query data")
                )
                continue
            if not isinstance(source_id, str):
                continue
            query_tables.append((source_id, path))
            query = raw_source.get("query")
            body = query.get("body") if isinstance(query, Mapping) else None
            dsl_list = body.get("dsl_list") if isinstance(body, Mapping) else None
            item = dsl_list[0] if isinstance(dsl_list, list) and dsl_list else None
            order = item.get("order") if isinstance(item, Mapping) else None
            order = order if isinstance(order, Mapping) else None
            order_path = f"/dataSources/{_escape_pointer(source_id)}/source/query/body/dsl_list/0/order"
            if order is None or order.get("offset") != 0:
                issues.append(PageContractIssue("SCHEMA_ERROR", f"{order_path}/offset", "query pagination offset must be zero"))
            limit = order.get("limit") if order is not None else None
            if not isinstance(limit, int) or isinstance(limit, bool) or limit <= 0:
                issues.append(PageContractIssue("SCHEMA_ERROR", f"{order_path}/limit", "query pagination limit must be positive"))
            initial = raw_source.get("initial")
            if isinstance(initial, Mapping):
                initial_path = f"/dataSources/{_escape_pointer(source_id)}/source/initial"
                if "totalCount" not in initial:
                    issues.append(PageContractIssue("SCHEMA_ERROR", f"{initial_path}/totalCount", "paginated initial rows need totalCount"))
                elif isinstance(limit, int) and not isinstance(limit, bool):
                    rows = initial.get("rows")
                    total_count = initial.get("totalCount")
                    if (
                        isinstance(rows, list)
                        and isinstance(total_count, int)
                        and len(rows) != min(limit, total_count)
                    ):
                        issues.append(PageContractIssue("SCHEMA_ERROR", f"{initial_path}/rows", "initial rows must contain a full first page"))
            for column, column_path in _table_leaf_columns(
                props.get("columns", []), f"{path}/props/columns"
            ):
                if column.get("sortable"):
                    issues.append(PageContractIssue("SCHEMA_ERROR", f"{column_path}/sortable", "query pagination does not support sorting"))
                if column.get("filterable"):
                    issues.append(PageContractIssue("SCHEMA_ERROR", f"{column_path}/filterable", "query pagination does not support header filters"))

    for source_id, component_path in query_tables:
        if len(references.get(source_id, [])) != 1:
            issues.append(PageContractIssue("SCHEMA_ERROR", f"{component_path}/data/main", "query pagination source must be exclusive"))
    return issues


def _query_initial_row_issues(value: Any) -> list[PageContractIssue]:
    issues: list[PageContractIssue] = []
    data_sources = value.get("dataSources", {})
    if not isinstance(data_sources, Mapping):
        return issues
    for source_id, raw_data_source in data_sources.items():
        if not isinstance(raw_data_source, Mapping):
            continue
        source = raw_data_source.get("source")
        raw_fields = raw_data_source.get("fields")
        if (
            not isinstance(source, Mapping)
            or source.get("type") != "query"
            or not isinstance(raw_fields, Mapping)
        ):
            continue
        initial = source.get("initial")
        if not isinstance(initial, Mapping):
            continue
        captured_at = initial.get("capturedAt")
        if isinstance(captured_at, str) and not _is_rfc3339_datetime(captured_at):
            issues.append(
                PageContractIssue(
                    "SCHEMA_ERROR",
                    f"/dataSources/{_escape_pointer(source_id)}/source/initial/capturedAt",
                    "capturedAt must be a valid RFC 3339 datetime",
                )
            )
        rows = initial.get("rows")
        if not isinstance(rows, list):
            continue
        fields, _field_paths, _field_issues = _resolved_fields(
            raw_fields, f"/dataSources/{_escape_pointer(source_id)}/fields"
        )
        input_fields = {
            field_id: field
            for field_id, field in fields.items()
            if field_id not in _compute_output_fields(raw_data_source)
        }
        rows_path = (
            f"/dataSources/{_escape_pointer(source_id)}/source/initial/rows"
        )
        for row_index, row in enumerate(rows):
            if not isinstance(row, Mapping):
                continue
            for field_id, raw_field in input_fields.items():
                if not isinstance(raw_field, Mapping):
                    continue
                query_field = raw_field.get("queryField")
                if not isinstance(query_field, str):
                    path = f"{rows_path}/{row_index}/{_escape_pointer(field_id)}"
                    issues.append(
                        PageContractIssue(
                            "SCHEMA_ERROR",
                            path,
                            f"row is missing field: {field_id}",
                        )
                    )
                    continue
                path = f"{rows_path}/{row_index}/{_escape_pointer(query_field)}"
                if query_field not in row:
                    issues.append(
                        PageContractIssue(
                            "SCHEMA_ERROR",
                            path,
                            f"DQE embedded row is missing mapped field: {query_field}",
                        )
                    )
                    continue
                issues.extend(
                    _field_value_issues(
                        row[query_field],
                        raw_field,
                        path,
                        query_mapping=True,
                    )
                )
            for field_id in _compute_output_fields(raw_data_source):
                raw_field = fields.get(field_id)
                query_field = (
                    raw_field.get("queryField")
                    if isinstance(raw_field, Mapping)
                    else None
                )
                if isinstance(query_field, str) and query_field in row:
                    issues.append(
                        PageContractIssue(
                            "SCHEMA_ERROR",
                            f"{rows_path}/{row_index}/{_escape_pointer(field_id)}",
                            f"row contains computed field: {field_id}",
                        )
                    )
    return issues


def _inline_row_issues(value: Any) -> list[PageContractIssue]:
    issues: list[PageContractIssue] = []
    data_sources = value.get("dataSources", {})
    if not isinstance(data_sources, Mapping):
        return issues
    for source_id, raw_data_source in data_sources.items():
        if not isinstance(raw_data_source, Mapping):
            continue
        source = raw_data_source.get("source")
        raw_fields = raw_data_source.get("fields")
        if (
            not isinstance(source, Mapping)
            or source.get("type") != "inline"
            or not isinstance(raw_fields, Mapping)
        ):
            continue
        rows = source.get("rows")
        if not isinstance(rows, list):
            continue
        fields, _paths, _field_issues = _resolved_fields(
            raw_fields, f"/dataSources/{_escape_pointer(source_id)}/fields"
        )
        input_fields = {
            field_id: field
            for field_id, field in fields.items()
            if field_id not in _compute_output_fields(raw_data_source)
        }
        rows_path = f"/dataSources/{_escape_pointer(source_id)}/source/rows"
        for row_index, row in enumerate(rows):
            if not isinstance(row, Mapping):
                continue
            for field_id in row:
                if str(field_id) not in input_fields:
                    issues.append(
                        PageContractIssue(
                            "SCHEMA_ERROR",
                            f"{rows_path}/{row_index}/{_escape_pointer(field_id)}",
                            f"row contains undeclared field: {field_id}",
                        )
                    )
            for field_id, field in input_fields.items():
                path = f"{rows_path}/{row_index}/{_escape_pointer(field_id)}"
                if field_id not in row:
                    issues.append(
                        PageContractIssue(
                            "SCHEMA_ERROR", path, f"row is missing field: {field_id}"
                        )
                    )
                    continue
                issues.extend(_field_value_issues(row[field_id], field, path))
    return issues


def _field_value_issues(
    value: Any,
    field: Mapping[str, Any],
    path: str,
    *,
    query_mapping: bool = False,
) -> list[PageContractIssue]:
    violation = _scalar_violation(value, field)
    if violation == "null":
        return [PageContractIssue("SCHEMA_ERROR", path, "field does not allow null")]
    if violation == "type":
        return [
            PageContractIssue(
                "SCHEMA_ERROR", path, f"field value does not match {field.get('type')}"
            )
        ]
    field_type = field.get("type")
    if field_type == "semanticHtml" and isinstance(value, str) and len(value) > 64_000:
        return [PageContractIssue("SCHEMA_ERROR", path, "semantic HTML is too large")]
    if field_type != "recordList" or not isinstance(value, list):
        return []
    if len(value) > 100:
        return [PageContractIssue("SCHEMA_ERROR", path, "detail list is too large")]
    item_fields = field.get("items", {}).get("fields", {})
    if not isinstance(item_fields, Mapping):
        return []
    issues: list[PageContractIssue] = []
    for item_index, item in enumerate(value):
        item_path = f"{path}/{item_index}"
        if not isinstance(item, Mapping):
            issues.append(
                PageContractIssue("SCHEMA_ERROR", item_path, "detail item must be an object")
            )
            continue
        if not query_mapping:
            for item_field_id in item:
                if str(item_field_id) not in item_fields:
                    issues.append(
                        PageContractIssue(
                            "SCHEMA_ERROR",
                            f"{item_path}/{_escape_pointer(item_field_id)}",
                            f"detail item contains undeclared field: {item_field_id}",
                        )
                    )
        for item_field_id, raw_item_field in item_fields.items():
            if not isinstance(raw_item_field, Mapping):
                continue
            source_name = (
                raw_item_field.get("queryField") if query_mapping else item_field_id
            )
            if not isinstance(source_name, str):
                continue
            child_path = f"{item_path}/{_escape_pointer(source_name)}"
            if source_name not in item:
                issues.append(
                    PageContractIssue(
                        "SCHEMA_ERROR", child_path, f"detail item is missing field: {source_name}"
                    )
                )
                continue
            child_violation = _scalar_violation(item[source_name], raw_item_field)
            if child_violation is not None:
                issues.append(
                    PageContractIssue(
                        "SCHEMA_ERROR",
                        child_path,
                        "detail item field violates its scalar contract",
                    )
                )
    return issues


def _compute_output_fields(data_source: Mapping[str, Any]) -> set[str]:
    outputs: set[str] = set()
    operators = data_source.get("compute", [])
    if not isinstance(operators, list):
        return outputs
    for operator in operators:
        if not isinstance(operator, Mapping):
            continue
        op = operator.get("op")
        if op in {"ratio", "delta"} and isinstance(operator.get("output"), str):
            outputs.add(operator["output"])
        elif op in {"groupSubtotal", "grandTotal"}:
            row_kind = operator.get("rowKind")
            if isinstance(row_kind, Mapping) and isinstance(row_kind.get("field"), str):
                outputs.add(row_kind["field"])
        elif op == "pivot":
            for column in operator.get("columns", []):
                if isinstance(column, Mapping) and isinstance(column.get("output"), str):
                    outputs.add(column["output"])
    return outputs


def _scalar_violation(
    value: Any,
    field: Mapping[str, Any],
) -> str | None:
    if value is None:
        return "null" if field.get("nullable") is False else None
    field_type = field.get("type")
    if field_type in {"string", "semanticHtml"}:
        return None if isinstance(value, str) else "type"
    if field_type in {"number", "money"}:
        return (
            None
            if isinstance(value, (int, float))
            and not isinstance(value, bool)
            and math.isfinite(value)
            else "type"
        )
    if field_type == "boolean":
        return None if isinstance(value, bool) else "type"
    if field_type == "date":
        return None if isinstance(value, str) and _is_calendar_date(value) else "type"
    if field_type == "datetime":
        return (
            None
            if isinstance(value, str) and DATETIME_PATTERN.fullmatch(value)
            else "type"
        )
    if field_type == "recordList":
        return None if isinstance(value, list) else "type"
    return None


def _is_rfc3339_datetime(value: str) -> bool:
    if DATETIME_PATTERN.fullmatch(value) is None:
        return False
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        datetime.fromisoformat(normalized)
    except ValueError:
        return False
    return True


def _is_calendar_date(value: str) -> bool:
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value) is None:
        return False
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


def _error_paths(error: ValidationError) -> list[str]:
    base = _pointer(error.absolute_path)
    if error.validator == "required" and isinstance(error.instance, dict):
        missing = [name for name in error.validator_value if name not in error.instance]
        return [_join_pointer(base, name) for name in missing]
    if error.validator == "additionalProperties" and isinstance(error.instance, dict):
        extras = re.findall(r"'([^']+)'", error.message)
        return [_join_pointer(base, name) for name in extras]
    if (
        error.validator == "pattern"
        and "propertyNames" in error.absolute_schema_path
        and isinstance(error.instance, str)
    ):
        return [_join_pointer(base, error.instance)]
    paths = [base]
    for child in error.context:
        paths.extend(_error_paths(child))
    return paths


def _join_pointer(base: str, part: object) -> str:
    encoded = _escape_pointer(part)
    return f"{base}/{encoded}" if base else f"/{encoded}"


def _escape_pointer(part: object) -> str:
    return str(part).replace("~", "~0").replace("/", "~1")


def _pointer(parts: Any) -> str:
    result = ""
    for part in parts:
        result = _join_pointer(result, part)
    return result
