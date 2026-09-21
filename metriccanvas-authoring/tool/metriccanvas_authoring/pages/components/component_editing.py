"""Controlled mutations; callers validate and commit a complete candidate page."""
from copy import deepcopy
from typing import Any

from metriccanvas_authoring.domain.page_building import (
    ExecutableUnit, UnitScope, PageBuildingIssue, build_data_component,
)
from metriccanvas_authoring.domain.execution import DqeExecutionResult
from metriccanvas_authoring.domain.page_validation import _resolved_fields
from metriccanvas_authoring.domain.layout_policy import layout_transition_impacts

DATA_COMPONENTS = (
    "metricCard", "barChart", "lineChart", "pieChart", "table", "gauge",
    "keyValuePanel", "categoryBreakdown", "rankingCard", "rankingDetailCard",
)
PROPERTY_WHITELIST = {
    "reportHeader": {"subtitle", "badge", "tags"},
    "metricCard": {"showTrendArrows"},
    "barChart": {"horizontal", "stacked", "rounded", "showSegmentLabels", "showStackTotalLabels"},
    "lineChart": {"smooth", "areaGradient", "showPointLabels", "hideYAxis"},
    "pieChart": {"ring", "labelLine"},
    "table": {"subtitle", "fit"},
}


class EditFailure(Exception):
    def __init__(self, code: str, path: str = "") -> None:
        self.code, self.path = code, path
        super().__init__(code)


def walk_components(page: dict[str, Any]):
    def walk(component):
        yield component
        if component["type"] == "compositeCard":
            for child in component["props"]["components"]:
                yield from walk(child)
        elif component["type"] == "tabContainer":
            for tab in component["props"]["tabs"]:
                if "component" in tab:
                    yield from walk(tab["component"])
                for child in tab.get("components", []):
                    yield from walk(child)
    for section in page["sections"]:
        for component in section["components"]:
            yield from walk(component)


def component_by_id(page, component_id):
    matches = [c for c in walk_components(page) if c["id"] == component_id]
    if len(matches) != 1:
        raise EditFailure("COMPONENT_NOT_FOUND", "/componentId")
    return matches[0]


def _patch(target, changes, allowed):
    if not changes or not set(changes) <= allowed:
        raise EditFailure("PROPERTY_NOT_ALLOWED", "/properties")
    target.update(deepcopy(changes))


def set_title(page, op):
    component_by_id(page, op["componentId"])["props"]["title"] = op["title"]
    return []


def set_component_layout(page, op):
    component_by_id(page, op["componentId"])["layout"].update(op["changes"])
    return []


def set_properties(page, op):
    component = component_by_id(page, op["componentId"])
    _patch(component["props"], op["properties"], PROPERTY_WHITELIST.get(component["type"], set()))
    return []


def set_series_label(page, op):
    component = component_by_id(page, op["componentId"])
    if component["type"] not in {"barChart", "lineChart"}:
        raise EditFailure("OPERATION_NOT_SUPPORTED")
    series = component["props"]["series"]
    if op["index"] >= len(series):
        raise EditFailure("SERIES_NOT_FOUND", "/index")
    series[op["index"]]["label"] = op["label"]
    return []


def set_metric_row(page, op):
    component = component_by_id(page, op["componentId"])
    if component["type"] != "metricCard":
        raise EditFailure("OPERATION_NOT_SUPPORTED")
    rows = component["props"].get(op.get("rows", "rows"), [])
    if op["index"] >= len(rows):
        raise EditFailure("ROW_NOT_FOUND", "/index")
    _patch(rows[op["index"]], op["properties"], {"label", "context", "unit"})
    return []


def set_table_column(page, op):
    component = component_by_id(page, op["componentId"])
    if component["type"] != "table":
        raise EditFailure("OPERATION_NOT_SUPPORTED")
    def columns(nodes):
        for node in nodes:
            if node.get("kind") == "group":
                yield from columns(node["children"])
            else:
                yield node
    matches = []
    for column in columns(component["props"]["columns"]):
        binding = column["field"]
        field = binding if isinstance(binding, str) else binding["field"]
        slot = "main" if isinstance(binding, str) else binding.get("data", "main")
        if field == op["fieldId"] and slot == op.get("slot", "main"):
            matches.append(column)
    if len(matches) != 1:
        raise EditFailure("COLUMN_NOT_FOUND", "/fieldId")
    _patch(matches[0], op["properties"], {"title", "width", "fixed", "align"})
    return []


def move_component(page, op):
    # Container subtree insertion is a separate operation introduced by T10.
    target = next((s for s in page["sections"] if s["id"] == op["sectionId"]), None)
    source = next((s for s in page["sections"] if any(c["id"] == op["componentId"] for c in s["components"])), None)
    if target is None or source is None:
        raise EditFailure("MOVE_TARGET_NOT_FOUND")
    if op.get("beforeId") == op["componentId"]:
        raise EditFailure("MOVE_TARGET_INVALID", "/beforeId")
    component = next(c for c in source["components"] if c["id"] == op["componentId"])
    source["components"].remove(component)
    before = op.get("beforeId")
    if before is None:
        target["components"].append(component)
    else:
        index = next((i for i,c in enumerate(target["components"]) if c["id"] == before), None)
        if index is None:
            raise EditFailure("MOVE_TARGET_NOT_FOUND", "/beforeId")
        target["components"].insert(index, component)
    return []


def set_page_layout(page, op):
    impacts = layout_transition_impacts(page, op["layout"])
    page["layout"] = op["layout"]
    return impacts


def change_component_type(page, op):
    component = component_by_id(page, op["componentId"])
    if component["type"] == op["componentType"]:
        return []
    if component["type"] not in DATA_COMPONENTS or set(component.get("data", {})) != {"main"}:
        raise EditFailure("TYPE_CHANGE_UNSUPPORTED")
    source_id = component["data"]["main"]
    source = page["dataSources"][source_id]
    if source.get("compute"):
        raise EditFailure("TYPE_CHANGE_COMPUTED_SOURCE_UNSUPPORTED")
    field_map, _, field_issues = _resolved_fields(source["fields"], "")
    if field_issues:
        raise EditFailure("COMPONENT_SHAPE_MISMATCH")
    raw = source["source"]
    evidence = raw if raw["type"] == "inline" else raw.get("initial")
    if evidence is None:
        raise EditFailure("TYPE_CHANGE_REQUIRES_ROW_EVIDENCE")
    execution = DqeExecutionResult(rows=evidence["rows"], total_count=evidence.get("totalCount"))
    unit = ExecutableUnit(source_id, None, field_map, {}, "detail", op["componentType"], UnitScope("", (), "", "", ()), ())
    try:
        built = build_data_component(unit, execution, 0)
    except PageBuildingIssue:
        raise EditFailure("COMPONENT_SHAPE_MISMATCH", "/componentType") from None
    # Retain all universally meaningful display values and original binding formats.
    old = component["props"]
    for name in set(built["props"]) & set(old) | {"title", "actions"} & set(old):
        built["props"][name] = deepcopy(old[name])
    dropped = sorted(set(old) - set(built["props"]))
    component["type"], component["props"] = built["type"], built["props"]
    return [f"props.{name}" for name in dropped]


OPERATION_HANDLERS = {
    "set_title": set_title,
    "set_component_layout": set_component_layout,
    "set_properties": set_properties,
    "set_series_label": set_series_label,
    "set_metric_row": set_metric_row,
    "set_table_column": set_table_column,
    "move_component": move_component,
    "set_page_layout": set_page_layout,
    "change_component_type": change_component_type,
}
