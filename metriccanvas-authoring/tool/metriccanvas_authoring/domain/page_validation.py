from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from datetime import date
from typing import Any, Mapping

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
    issues: list[PageContractIssue] = []
    for error in validator.iter_errors(value):
        for path in _error_paths(error):
            issues.append(PageContractIssue("SCHEMA_ERROR", path, error.message))
    if issues:
        return sorted(issues, key=lambda issue: (issue.path, issue.message))
    row_issues = _query_initial_row_issues(value)
    if row_issues:
        return row_issues
    return _invariant_issues(value)


def _invariant_issues(value: Mapping[str, Any]) -> list[PageContractIssue]:
    issues: list[PageContractIssue] = []
    filters = value.get("filters", [])
    filters_by_id = {
        entry["id"]: entry
        for entry in filters
        if isinstance(entry, Mapping) and isinstance(entry.get("id"), str)
    }
    data_sources = value.get("dataSources", {})
    if isinstance(data_sources, Mapping):
        for source_id, raw_source in data_sources.items():
            if isinstance(raw_source, Mapping):
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
            issues.extend(_component_issues(component, path, data_sources))
    return issues


def _query_mapping_issues(
    source_id: object,
    data_source: Mapping[str, Any],
    filters_by_id: Mapping[str, Mapping[str, Any]],
) -> list[PageContractIssue]:
    source = data_source.get("source")
    fields = data_source.get("fields")
    if (
        not isinstance(source, Mapping)
        or source.get("type") != "query"
        or not isinstance(fields, Mapping)
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
    mapped: dict[str, str] = {}
    issues: list[PageContractIssue] = []
    source_path = f"/dataSources/{_escape_pointer(source_id)}"
    for field_id, raw_field in fields.items():
        if not isinstance(raw_field, Mapping):
            continue
        query_field = raw_field.get("queryField")
        if not isinstance(query_field, str):
            continue
        path = f"{source_path}/fields/{_escape_pointer(field_id)}/queryField"
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
        elif query_field in dimensions and raw_field.get("role") != "dimension":
            issues.append(
                PageContractIssue(
                    "QUERY_MAPPING_ERROR",
                    f"{source_path}/fields/{_escape_pointer(field_id)}/role",
                    f"DQE dimension {query_field} must have dimension role",
                )
            )
        elif query_field in metrics and raw_field.get("role") != "measure":
            issues.append(
                PageContractIssue(
                    "QUERY_MAPPING_ERROR",
                    f"{source_path}/fields/{_escape_pointer(field_id)}/role",
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
    data_sources: Any,
) -> list[PageContractIssue]:
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
    checks: list[tuple[Any, str, str | None]] = []
    if component_type == "metricCard":
        for row_index, row in enumerate(props.get("rows", [])):
            if isinstance(row, Mapping):
                checks.append(
                    (
                        row.get("valueField"),
                        f"{path}/props/rows/{row_index}/valueField",
                        "measure",
                    )
                )
    elif component_type == "barChart":
        checks.append(
            (
                props.get("categoryField"),
                f"{path}/props/categoryField",
                "dimension",
            )
        )
        checks.extend(
            (series.get("field"), f"{path}/props/series/{index}/field", "measure")
            for index, series in enumerate(props.get("series", []))
            if isinstance(series, Mapping)
        )
    elif component_type == "lineChart":
        checks.append(
            (props.get("xField"), f"{path}/props/xField", "dimension")
        )
        checks.extend(
            (series.get("field"), f"{path}/props/series/{index}/field", "measure")
            for index, series in enumerate(props.get("series", []))
            if isinstance(series, Mapping)
        )
    elif component_type == "pieChart":
        checks.extend(
            [
                (
                    props.get("categoryField"),
                    f"{path}/props/categoryField",
                    "dimension",
                ),
                (
                    props.get("valueField"),
                    f"{path}/props/valueField",
                    "measure",
                ),
            ]
        )
    elif component_type == "table":
        checks.extend(
            _table_field_checks(
                props.get("columns", []), f"{path}/props/columns"
            )
        )
    elif component_type in {"rankingCard", "rankingDetailCard"}:
        checks.extend(
            [
                (props.get("nameField"), f"{path}/props/nameField", "dimension"),
                (props.get("valueField"), f"{path}/props/valueField", "measure"),
            ]
        )
        if props.get("changeField") is not None:
            checks.append(
                (
                    props.get("changeField"),
                    f"{path}/props/changeField",
                    "measure",
                )
            )
    for binding, binding_path, expected_role in checks:
        issues.extend(
            _binding_issues(
                binding,
                binding_path,
                expected_role,
                slots,
                data_sources,
            )
        )
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


def _binding_issues(
    binding: Any,
    path: str,
    expected_role: str | None,
    slots: Mapping[Any, Any],
    data_sources: Mapping[Any, Any],
) -> list[PageContractIssue]:
    if isinstance(binding, str):
        slot = "main"
        field_id = binding
    elif isinstance(binding, Mapping):
        slot = binding.get("data")
        field_id = binding.get("field")
    else:
        return []
    source_id = slots.get(slot)
    source = data_sources.get(source_id)
    fields = source.get("fields") if isinstance(source, Mapping) else None
    if not isinstance(fields, Mapping) or field_id not in fields:
        return [
            PageContractIssue(
                "SCHEMA_ERROR",
                path,
                f"field {field_id} is not in data slot {slot} source {source_id}",
            )
        ]
    field = fields[field_id]
    if (
        expected_role is not None
        and isinstance(field, Mapping)
        and field.get("role") != expected_role
    ):
        return [
            PageContractIssue(
                "SCHEMA_ERROR",
                path,
                f"field {field_id} must have {expected_role} role",
            )
        ]
    return []


def _query_initial_row_issues(value: Any) -> list[PageContractIssue]:
    issues: list[PageContractIssue] = []
    data_sources = value.get("dataSources", {})
    if not isinstance(data_sources, Mapping):
        return issues
    for source_id, raw_data_source in data_sources.items():
        if not isinstance(raw_data_source, Mapping):
            continue
        source = raw_data_source.get("source")
        fields = raw_data_source.get("fields")
        if (
            not isinstance(source, Mapping)
            or source.get("type") != "query"
            or not isinstance(fields, Mapping)
        ):
            continue
        initial = source.get("initial")
        if not isinstance(initial, Mapping):
            continue
        rows = initial.get("rows")
        if not isinstance(rows, list):
            continue
        rows_path = (
            f"/dataSources/{_escape_pointer(source_id)}/source/initial/rows"
        )
        for row_index, row in enumerate(rows):
            if not isinstance(row, Mapping):
                continue
            for field_id, raw_field in fields.items():
                if not isinstance(raw_field, Mapping):
                    continue
                query_field = raw_field.get("queryField")
                if not isinstance(query_field, str):
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
                violation = _scalar_violation(row[query_field], raw_field)
                if violation == "null":
                    issues.append(
                        PageContractIssue(
                            "SCHEMA_ERROR",
                            path,
                            (
                                f"DQE field {query_field} is null while page field "
                                f"{field_id} declares nullable=false"
                            ),
                        )
                    )
                elif violation == "type":
                    issues.append(
                        PageContractIssue(
                            "SCHEMA_ERROR",
                            path,
                            (
                                f"DQE field {query_field} does not match page field "
                                f"{field_id} type {raw_field.get('type')}"
                            ),
                        )
                    )
    return issues


def _scalar_violation(
    value: Any,
    field: Mapping[str, Any],
) -> str | None:
    if value is None:
        return "null" if field.get("nullable") is False else None
    field_type = field.get("type")
    if field_type == "string":
        return None if isinstance(value, str) else "type"
    if field_type in {"number", "money"}:
        return (
            None
            if isinstance(value, (int, float)) and not isinstance(value, bool)
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
    return None


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
    return [base]


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
