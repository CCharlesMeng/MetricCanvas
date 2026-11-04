"""Execute governed requests without selecting components or constructing a page.

Results are program-channel values; callers must explicitly project model evidence.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, replace
from copy import deepcopy
from typing import Any, Mapping

from metriccanvas_authoring.data.source_description_ports import SourceDescriptionPort
from metriccanvas_authoring.data.field_presentation import apply_field_presentation
from metriccanvas_authoring.data.source_mapping import map_source_description, derive_source_fields, validate_mapped_rows, SourceMappingError
from metriccanvas_authoring.data.validation_policy import (QueryValidationPolicy, current_for_query, normalize_request, governance_warnings)
from metriccanvas_authoring.data.ports import DataContextError, DataContextPort, DqeExecutionPort
from metriccanvas_authoring.data.data_context import parse_data_context
from metriccanvas_authoring.data.execution import (
    FailureStage,
    DqeExecutionResult,
    failure_from_execution_error,
)
from metriccanvas_authoring.data.page_build_spec import validate_page_build_spec
from metriccanvas_authoring.build_issues import PageBuildingIssue
from metriccanvas_authoring.data.executable_units import (
    ExecutableUnit,
    derive_executable_units,
)


@dataclass(frozen=True, slots=True)
class QueryDataDependencies:
    data_context: DataContextPort
    dqe: DqeExecutionPort
    source_description: SourceDescriptionPort | None = None
    authoring_scope: Mapping[str, Any] | None = None
    require_source_description: bool = False
    stable_field_ids: bool = False
    validation_policy: QueryValidationPolicy = QueryValidationPolicy()


@dataclass(frozen=True, slots=True)
class QueryDataIssue:
    code: str
    path: str
    message: str
    stage: FailureStage = "generation"
    candidates: tuple[str, ...] = ()
    retry_safe: bool = False


@dataclass(frozen=True, slots=True)
class QueryDataResult:
    ok: bool
    units: tuple[ExecutableUnit, ...] = ()
    executions: tuple[DqeExecutionResult, ...] = ()
    data_context_version: str | None = None
    source_descriptions: tuple[Mapping[str, Any], ...] = ()
    issues: tuple[QueryDataIssue, ...] = ()
    completed_stages: tuple[FailureStage, ...] = ()
    warnings: tuple[Mapping[str, Any], ...] = ()


def _issue_result(issues, *, stage="generation", completed=()):
    return QueryDataResult(ok=False, issues=tuple(
        QueryDataIssue(i.code, i.path, i.message, stage=stage,
                       candidates=getattr(i, "candidates", ())) for i in issues),
        completed_stages=completed)


def validate_query_spec(spec):
    """Validate the same normalized request before discovery or offline derivation."""
    normalized, _ = normalize_request(spec)
    issues = validate_page_build_spec(normalized)
    return normalized, _issue_result(issues) if issues else None


def prepare_query_data(spec, snapshot, *, policy=QueryValidationPolicy()):
    """Derive query candidates from complete explicit metadata; execute nothing."""
    spec, invalid = validate_query_spec(spec)
    if invalid is not None:
        return invalid
    context, issues = parse_data_context(snapshot, policy=policy)
    if issues:
        return _issue_result(issues, stage="discovery")
    if context is None:
        return QueryDataResult(ok=False, issues=(QueryDataIssue(
            "DATA_CONTEXT_UNPARSEABLE", "", "parsed data context is empty", stage="discovery"),))
    expected = spec.get("dataContextVersion")
    if isinstance(expected, str) and expected != context.version:
        return QueryDataResult(ok=False, issues=(QueryDataIssue(
            "DATA_CONTEXT_VERSION_CHANGED", "/dataContextVersion",
            f"discovery data context version {expected!r} does not match current version {context.version!r}",
            stage="discovery"),))
    warnings = governance_warnings(snapshot)
    try:
        units = derive_executable_units(spec, context, policy, warnings)
    except PageBuildingIssue as issue:
        return _issue_result((issue,), completed=("discovery",))
    return QueryDataResult(ok=True, units=tuple(units), data_context_version=context.version,
                           completed_stages=("discovery", "generation"), warnings=tuple(warnings))


def map_query_fields(queried, descriptions=(), *, required=False, stable_field_ids=False):
    """Apply explicitly supplied source contracts without calling a provider."""
    if not queried.ok:
        return queried
    if required and not descriptions:
        return QueryDataResult(ok=False, issues=(QueryDataIssue(
            "SOURCE_DESCRIPTION_UNAVAILABLE", "", "SOURCE_DESCRIPTION_UNAVAILABLE"),),
            completed_stages=("discovery", "generation"))
    if descriptions and len(descriptions) != len(queried.units):
        return QueryDataResult(ok=False, issues=(QueryDataIssue(
            "SOURCE_DESCRIPTION_UNAVAILABLE", "", "SOURCE_DESCRIPTION_UNAVAILABLE"),),
            completed_stages=("discovery", "generation"))
    units = []
    for index, unit in enumerate(queried.units):
        try:
            if descriptions:
                unit = map_source_description(unit, descriptions[index], queried.data_context_version)
            elif stable_field_ids:
                unit = derive_source_fields(unit)
            units.append(unit)
        except SourceMappingError as error:
            path = f"/units/{index}" if descriptions else ""
            return QueryDataResult(ok=False, issues=(QueryDataIssue(error.code, path, error.code),),
                                   completed_stages=("discovery", "generation"))
    return replace(queried, units=tuple(units), source_descriptions=tuple(deepcopy(descriptions)))


def finalize_query_data(queried, executions, *, validate_rows=False, presentation_profile="legacy"):
    """Process supplied execution facts; never claim to have executed a query."""
    if not queried.ok:
        return queried
    if len(executions) != len(queried.units):
        return QueryDataResult(ok=False, issues=(QueryDataIssue(
            "RESULT_EVIDENCE_MISSING", "/executions", "one execution is required for each unit",
            stage="presentation"),), completed_stages=queried.completed_stages)
    warnings = list(deepcopy(queried.warnings))
    units = []
    for index, (unit, execution) in enumerate(zip(queried.units, executions, strict=True)):
        if validate_rows:
            try:
                validate_mapped_rows(unit.fields, execution.rows)
            except SourceMappingError as error:
                return QueryDataResult(ok=False, issues=(QueryDataIssue(error.code, f"/units/{index}",
                    error.code, stage="presentation"),), completed_stages=("discovery", "generation", "execution"))
        description = queried.source_descriptions[index] if queried.source_descriptions else None
        units.append(apply_field_presentation(unit, execution, description, warnings=warnings, profile=presentation_profile))
    return replace(queried, units=tuple(units), executions=tuple(deepcopy(executions)),
                   warnings=tuple(warnings), completed_stages=("discovery", "generation", "execution"))


async def _describe_query_fields(queried, dependencies):
    if not (dependencies.require_source_description or dependencies.source_description is not None):
        return map_query_fields(queried, stable_field_ids=dependencies.stable_field_ids)
    if dependencies.source_description is None or dependencies.authoring_scope is None:
        return map_query_fields(queried, required=True)
    descriptions = []
    for index, unit in enumerate(queried.units):
        try:
            description = await dependencies.source_description.describe(
                deepcopy(dict(dependencies.authoring_scope)), queried.data_context_version,
                deepcopy(unit.effective_query()))
            # Validate before requesting the next description, preserving failure order.
            map_source_description(unit, description, queried.data_context_version)
            descriptions.append(description)
        except Exception as error:
            code = error.code if isinstance(error, SourceMappingError) else "SOURCE_DESCRIPTION_UNAVAILABLE"
            return QueryDataResult(ok=False, issues=(QueryDataIssue(code, f"/units/{index}", code),),
                                   completed_stages=("discovery", "generation"))
    return map_query_fields(queried, descriptions)


def create_query_data(dependencies: QueryDataDependencies):
    async def query_data(spec: Mapping[str, Any]) -> QueryDataResult:
        spec, invalid = validate_query_spec(spec)
        if invalid is not None:
            return invalid
        try:
            snapshot = await current_for_query(dependencies.data_context, dependencies.validation_policy)
        except DataContextError as error:
            return QueryDataResult(ok=False, issues=(QueryDataIssue(
                error.code, "", str(error), stage="discovery"),))
        queried = prepare_query_data(spec, snapshot, policy=dependencies.validation_policy)
        if not queried.ok:
            return queried
        queried = await _describe_query_fields(queried, dependencies)
        if not queried.ok:
            return queried
        executions = await asyncio.gather(*(dependencies.dqe.execute(unit.effective_query())
                                           for unit in queried.units), return_exceptions=True)
        for index, execution in enumerate(executions):
            if isinstance(execution, Exception):
                failure = failure_from_execution_error(execution)
                return QueryDataResult(ok=False, issues=(QueryDataIssue(
                    failure.code, f"/units/{index}", failure.message, stage=failure.stage,
                    retry_safe=failure.retry_safe),), completed_stages=("discovery", "generation"))
        validate_rows = dependencies.stable_field_ids or dependencies.require_source_description or dependencies.source_description is not None
        return finalize_query_data(queried, executions, validate_rows=validate_rows)
    return query_data
