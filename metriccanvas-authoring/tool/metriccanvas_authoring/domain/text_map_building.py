"""Explicit text, field text and map recipes over trusted existing data sources."""
import json
import math
from copy import deepcopy
from typing import Any

from metriccanvas_authoring.domain.component_editing import EditFailure, walk_components
from metriccanvas_authoring.domain.page_validation import _resolved_fields
from metriccanvas_authoring.runtime_assets import bundle_root


def _target_section(page, op):
    section = next((s for s in page["sections"] if s["id"] == op["sectionId"]), None)
    if section is None:
        raise EditFailure("SECTION_NOT_FOUND", "/sectionId")
    if any(c["id"] == op["componentId"] for c in walk_components(page)):
        raise EditFailure("COMPONENT_ID_EXISTS", "/componentId")
    return section


def _component(op, kind, props, source_id=None):
    return {"id": op["componentId"], "type": kind, "layout": {"span": op.get("span", 12)},
        **({"data": {"main": source_id}} if source_id is not None else {}),
        "props": {**({"title": op["title"]} if "title" in op else {}), **props}}


def _source(page, source_id):
    source = page.get("dataSources", {}).get(source_id)
    if source is None:
        raise EditFailure("DATA_SOURCE_NOT_FOUND", "/dataSourceId")
    if source.get("compute"):
        raise EditFailure("COMPUTED_SOURCE_REQUIRES_MATERIALIZED_EVIDENCE", "/dataSourceId")
    fields, _, issues = _resolved_fields(source["fields"], "")
    if issues:
        raise EditFailure("SOURCE_FIELDS_INVALID", "/dataSourceId")
    raw = source["source"]
    evidence = raw if raw["type"] == "inline" else raw.get("initial")
    if evidence is None:
        raise EditFailure("SOURCE_ROW_EVIDENCE_REQUIRED", "/dataSourceId")
    # Match the runtime's queryField mapping without writing materialized rows back.
    rows = [{field_id: row.get(field.get("queryField", field_id)) for field_id, field in fields.items()}
            for row in evidence["rows"]] if raw["type"] == "query" else evidence["rows"]
    return fields, rows, evidence.get("totalCount", len(rows))


def add_text(page, op):
    section = _target_section(page, op)
    props = {"body": op["body"]}
    for key in ("variant", "bodyFormat"):
        if key in op: props[key] = op[key]
    section["components"].append(_component(op, "text", props))
    return []


def add_field_text(page, op):
    section = _target_section(page, op)
    fields, rows, total = _source(page, op["dataSourceId"])
    field = fields.get(op["fieldId"])
    if field is None or field["type"] not in {"string", "semanticHtml"}:
        raise EditFailure("LONG_TEXT_FIELD_REQUIRED", "/fieldId")
    if total != 1 or len(rows) != 1:
        raise EditFailure("FIELD_TEXT_REQUIRES_SINGLE_ROW", "/dataSourceId")
    if not isinstance(rows[0].get(op["fieldId"]), str) or not rows[0][op["fieldId"]].strip():
        raise EditFailure("LONG_TEXT_VALUE_REQUIRED", "/fieldId")
    props = {"field": op["fieldId"], **({"variant": op["variant"]} if "variant" in op else {})}
    section["components"].append(_component(op, "fieldText", props, op["dataSourceId"]))
    return []


def add_map_chart(page, op):
    section = _target_section(page, op)
    if section.get("container") in {"plain", "card"}:
        raise EditFailure("MAP_SECTION_REQUIRES_CHART_HEIGHT", "/sectionId")
    fields, rows, _ = _source(page, op["dataSourceId"])
    name, value = fields.get(op["nameField"]), fields.get(op["valueField"])
    if name is None or name["type"] != "string" or name["role"] != "dimension":
        raise EditFailure("GEOGRAPHIC_NAME_FIELD_REQUIRED", "/nameField")
    if value is None or value["type"] not in {"number", "money"} or value["role"] != "measure":
        raise EditFailure("MAP_MEASURE_FIELD_REQUIRED", "/valueField")
    asset = bundle_root() / "contract-snapshot/page/map-regions.json"
    if not asset.is_file():
        raise EditFailure("MAP_REGIONS_CONTRACT_UNAVAILABLE")
    regions = json.loads(asset.read_text())["maps"][op["map"]]["regions"]
    names = set(regions)
    mapping = op.get("nameMap", {})
    if not rows or any(not isinstance(row.get(op["nameField"]), str) or mapping.get(row[op["nameField"]], row[op["nameField"]]) not in names for row in rows):
        raise EditFailure("MAP_REGION_UNRESOLVED", "/nameField")
    if any(mapped not in names for mapped in mapping.values()):
        raise EditFailure("MAP_REGION_UNRESOLVED", "/nameMap")
    if any(isinstance(row.get(op["valueField"]), bool) or not isinstance(row.get(op["valueField"]), (int, float)) or not math.isfinite(row[op["valueField"]]) for row in rows):
        raise EditFailure("MAP_NUMERIC_VALUES_REQUIRED", "/valueField")
    props = {key: deepcopy(op[key]) for key in ("nameField", "valueField", "map", "nameMap") if key in op}
    section["components"].append(_component(op, "mapChart", props, op["dataSourceId"]))
    return []


def remove_component(page, op):
    # Container editing is T10. Only the three T09 leaf types are removable here.
    for section in page["sections"]:
        for index, component in enumerate(section["components"]):
            if component["id"] == op["componentId"]:
                if component["type"] not in {"text", "fieldText", "mapChart"}:
                    raise EditFailure("REMOVE_COMPONENT_TYPE_UNSUPPORTED")
                if index + 1 < len(section["components"]) and section["components"][index + 1]["layout"].get("connectPrevious"):
                    raise EditFailure("COMPONENT_REFERENCED_BY_CONNECTION", "/componentId")
                section["components"].pop(index)
                return []
    raise EditFailure("COMPONENT_NOT_FOUND", "/componentId")


TEXT_MAP_HANDLERS = {"add_text": add_text, "add_field_text": add_field_text,
    "add_map_chart": add_map_chart, "remove_component": remove_component}
