from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from metriccanvas_authoring.domain.execution import DqeExecutionResult


@dataclass(frozen=True, slots=True)
class PageBuildingIssue(Exception):
    code: str
    path: str
    message: str


@dataclass(frozen=True, slots=True)
class ExecutableUnit:
    data_source_id: str
    title: str | None
    fields: dict[str, dict[str, Any]]
    query_body: dict[str, Any]
    pinned_component: str | None

    def effective_query(self) -> dict[str, Any]:
        return {
            "language": "dqe",
            "body": self.query_body,
            "fieldMappings": self.fields,
            "filterValues": [],
        }


def derive_executable_units(
    spec: Mapping[str, Any],
    data_context: Mapping[str, Any],
) -> list[ExecutableUnit]:
    """Derive DQE requests and field contracts from business-semantic units."""
    units: list[ExecutableUnit] = []
    for index, raw_unit in enumerate(_sequence(spec["units"])):
        unit = _mapping(raw_unit)
        schema = _schema_for(
            data_context,
            str(unit["businessDomain"]),
            f"/units/{index}/businessDomain",
        )
        fields = _field_contracts(unit, schema, index)
        units.append(
            ExecutableUnit(
                data_source_id=f"unit-{index + 1}",
                title=_optional_string(unit.get("title")),
                fields=fields,
                query_body=_query_body(unit, schema, index),
                pinned_component=_optional_string(unit.get("pinnedComponent")),
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
    for unit, execution in zip(units, executions, strict=True):
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
        components.append(_component_for(unit))

    return {
        "schemaVersion": schema_version,
        "id": page_id,
        **({} if description is None else {"meta": {"description": description}}),
        "dataSources": data_sources,
        "sections": [{"id": "results", "components": components}],
    }


def _field_contracts(
    unit: Mapping[str, Any],
    schema: Mapping[str, Any],
    unit_index: int,
) -> dict[str, dict[str, Any]]:
    fields: dict[str, dict[str, Any]] = {}
    field_number = 0
    dimensions = _dimension_index(schema)
    metrics = _named_index(_sequence(schema["metrics"]))

    for dimension_index, raw_name in enumerate(_sequence(unit["groupBy"])):
        name = str(raw_name)
        declaration = dimensions.get(name)
        if declaration is None:
            raise PageBuildingIssue(
                code="DATA_CONTEXT_NAME_NOT_FOUND",
                path=f"/units/{unit_index}/groupBy/{dimension_index}",
                message=f"dimension is not in data context: {name}",
            )
        canonical_name = str(declaration["name"])
        field_number += 1
        fields[f"field-{field_number}"] = {
            "queryField": canonical_name,
            "type": declaration.get("type", "string"),
            "role": "dimension",
            "label": canonical_name,
            "nullable": bool(declaration.get("nullable", False)),
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
        declaration = metrics.get(name)
        if declaration is None:
            raise PageBuildingIssue(
                code="DATA_CONTEXT_NAME_NOT_FOUND",
                path=f"/units/{unit_index}/metrics/{metric_index}/name",
                message=f"metric is not in data context: {name}",
            )
        canonical_name = str(declaration["name"])
        field_number += 1
        fields[f"field-{field_number}"] = {
            "queryField": canonical_name,
            "type": declaration.get("type", "number"),
            "role": "measure",
            "label": canonical_name,
            **(
                {}
                if declaration.get("unit") is None
                else {"unit": declaration["unit"]}
            ),
            "nullable": bool(declaration.get("nullable", False)),
        }
    return fields


def _query_body(
    unit: Mapping[str, Any],
    schema: Mapping[str, Any],
    unit_index: int,
) -> dict[str, Any]:
    time = unit.get("time")
    dimensions = _dimension_index(schema)
    metrics = _named_index(_sequence(schema["metrics"]))
    dimension_filters: list[dict[str, Any]] = []
    for filter_index, raw_filter in enumerate(_sequence(unit["filters"])):
        dimension_filter = _mapping(raw_filter)
        name = str(dimension_filter["dimension"])
        declaration = dimensions.get(name)
        if declaration is None:
            raise PageBuildingIssue(
                code="DATA_CONTEXT_NAME_NOT_FOUND",
                path=f"/units/{unit_index}/filters/{filter_index}/dimension",
                message=f"filter dimension is not in data context: {name}",
            )
        dimension_filters.append(
            {
                "dim_name": declaration["name"],
                "dim_value_list": list(_sequence(dimension_filter["values"])),
            }
        )
    return {
        "dsl_list": [
            {
                "output_dims": [
                    str(dimensions[str(name)]["name"])
                    for name in _sequence(unit["groupBy"])
                ],
                "output_metrics": [
                    _output_metric(_mapping(metric), metrics)
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
    metrics: Mapping[str, Mapping[str, Any]],
) -> str | dict[str, str]:
    if metric["kind"] == "metric":
        return str(metrics[str(metric["name"])]["name"])
    return {"formula": str(metric["expression"]), "alias": str(metric["label"])}


def _component_for(unit: ExecutableUnit) -> dict[str, Any]:
    if unit.pinned_component != "barChart":
        raise ValueError("the first build slice requires pinnedComponent=barChart")
    dimensions = [
        (field_id, field)
        for field_id, field in unit.fields.items()
        if field["role"] == "dimension"
    ]
    measures = [
        (field_id, field)
        for field_id, field in unit.fields.items()
        if field["role"] == "measure"
    ]
    return {
        "id": f"{unit.data_source_id}-bar-chart",
        "type": "barChart",
        "layout": {"span": 12},
        "data": {"main": unit.data_source_id},
        "props": {
            **({} if unit.title is None else {"title": unit.title}),
            "categoryField": dimensions[0][0],
            "series": [
                {"field": field_id, "label": field.get("label", field_id)}
                for field_id, field in measures
            ],
        },
    }


def _schema_for(
    data_context: Mapping[str, Any],
    business_domain: str,
    path: str,
) -> Mapping[str, Any]:
    for raw_environment in _sequence(data_context["executionEnvironments"]):
        environment = _mapping(raw_environment)
        for raw_schema in _sequence(environment["schemas"]):
            schema = _mapping(raw_schema)
            if schema.get("name") == business_domain:
                return schema
    raise PageBuildingIssue(
        code="DATA_CONTEXT_NAME_NOT_FOUND",
        path=path,
        message=f"business domain is not in data context: {business_domain}",
    )


def _dimension_index(schema: Mapping[str, Any]) -> dict[str, Mapping[str, Any]]:
    result: dict[str, Mapping[str, Any]] = {}
    for raw_object in _sequence(schema["objects"]):
        for raw_field in _sequence(_mapping(raw_object)["fields"]):
            field = _mapping(raw_field)
            name = str(field["name"])
            result[name] = field
            for alias in _sequence(field.get("aliases", [])):
                result.setdefault(str(alias), field)
    return result


def _named_index(values: Sequence[object]) -> dict[str, Mapping[str, Any]]:
    result: dict[str, Mapping[str, Any]] = {}
    for raw_value in values:
        value = _mapping(raw_value)
        name = str(value["name"])
        result[name] = value
        for alias in _sequence(value.get("aliases", [])):
            result.setdefault(str(alias), value)
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
