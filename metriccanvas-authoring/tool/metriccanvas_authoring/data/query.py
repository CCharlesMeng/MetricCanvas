"""Execute governed requests without selecting components or constructing a page.

Results are program-channel values; callers must explicitly project model evidence.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from copy import deepcopy
from typing import Any, Mapping

from metriccanvas_authoring.data.source_description_ports import SourceDescriptionPort
from metriccanvas_authoring.data.source_mapping import map_source_description, validate_mapped_rows, SourceMappingError
from metriccanvas_authoring.data.ports import DataContextError, DataContextPort, DqeExecutionPort
from metriccanvas_authoring.data.data_context import parse_data_context
from metriccanvas_authoring.data.execution import (
    FailureStage,
    DqeExecutionResult,
    failure_from_execution_error,
)
from metriccanvas_authoring.data.page_build_spec import validate_page_build_spec
from metriccanvas_authoring.pages.composition.page_building import (
    PageBuildingIssue,
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


def create_query_data(dependencies: QueryDataDependencies):
    async def query_data(spec: Mapping[str, Any]) -> QueryDataResult:
        spec_issues = validate_page_build_spec(spec)
        if spec_issues:
            return QueryDataResult(
                ok=False,
                issues=tuple(
                    QueryDataIssue(
                        issue.code,
                        issue.path,
                        issue.message,
                        candidates=issue.candidates,
                    )
                    for issue in spec_issues
                ),
            )

        try:
            data_context_snapshot = await dependencies.data_context.current()
        except DataContextError as error:
            return QueryDataResult(
                ok=False,
                issues=(
                    QueryDataIssue(
                        error.code,
                        "",
                        str(error),
                        stage="discovery",
                    ),
                ),
            )
        data_context, data_context_issues = parse_data_context(data_context_snapshot)
        if data_context_issues:
            return QueryDataResult(
                ok=False,
                issues=tuple(
                    QueryDataIssue(
                        issue.code,
                        issue.path,
                        issue.message,
                        stage="discovery",
                    )
                    for issue in data_context_issues
                ),
            )
        assert data_context is not None

        expected_data_context_version = spec.get("dataContextVersion")
        if (
            isinstance(expected_data_context_version, str)
            and expected_data_context_version != data_context.version
        ):
            return QueryDataResult(
                ok=False,
                issues=(
                    QueryDataIssue(
                        "DATA_CONTEXT_VERSION_CHANGED",
                        "/dataContextVersion",
                        "discovery data context version "
                        f"{expected_data_context_version!r} does not match current "
                        f"version {data_context.version!r}",
                        stage="discovery",
                    ),
                ),
            )

        try:
            units = derive_executable_units(spec, data_context)
        except PageBuildingIssue as issue:
            return QueryDataResult(
                ok=False,
                issues=(
                    QueryDataIssue(
                        issue.code,
                        issue.path,
                        issue.message,
                        candidates=issue.candidates,
                    ),
                ),
                completed_stages=("discovery",),
            )

        source_descriptions = []
        if dependencies.require_source_description or dependencies.source_description is not None:
            if dependencies.source_description is None or dependencies.authoring_scope is None:
                return QueryDataResult(ok=False, issues=(QueryDataIssue(
                    'SOURCE_DESCRIPTION_UNAVAILABLE', '', 'SOURCE_DESCRIPTION_UNAVAILABLE'),), completed_stages=('discovery', 'generation'))
            mapped_units = []
            for index, unit in enumerate(units):
                try:
                    description = await dependencies.source_description.describe(
                        deepcopy(dict(dependencies.authoring_scope)), data_context.version, deepcopy(unit.effective_query()))
                    mapped_units.append(map_source_description(unit, description, data_context.version))
                    source_descriptions.append(deepcopy(description))
                except Exception as error:
                    code = error.code if isinstance(error, SourceMappingError) else 'SOURCE_DESCRIPTION_UNAVAILABLE'
                    return QueryDataResult(ok=False, issues=(QueryDataIssue(code, f'/units/{index}', code),),
                                             completed_stages=('discovery', 'generation'))
            units = mapped_units

        execution_results = await asyncio.gather(
            *(
                dependencies.dqe.execute(unit.effective_query())
                for unit in units
            ),
            return_exceptions=True,
        )
        for unit_index, result in enumerate(execution_results):
            if isinstance(result, Exception):
                cause = result
                failure = failure_from_execution_error(cause)
                return QueryDataResult(
                    ok=False,
                    issues=(
                        QueryDataIssue(
                            code=failure.code,
                            path=f"/units/{unit_index}",
                            message=failure.message,
                            stage=failure.stage,
                            retry_safe=failure.retry_safe,
                        ),
                    ),
                    completed_stages=("discovery", "generation"),
                )
        executions = [
            result for result in execution_results if not isinstance(result, Exception)
        ]

        if dependencies.require_source_description or dependencies.source_description is not None:
            for index, (unit, execution) in enumerate(zip(units, executions, strict=True)):
                try:
                    validate_mapped_rows(unit.fields, execution.rows)
                except SourceMappingError as error:
                    return QueryDataResult(ok=False, issues=(QueryDataIssue(error.code, f'/units/{index}', error.code, stage='presentation'),),
                                             completed_stages=('discovery', 'generation', 'execution'))

        return QueryDataResult(
            ok=True, units=tuple(units), executions=tuple(executions),
            data_context_version=data_context.version,
            source_descriptions=tuple(source_descriptions),
            completed_stages=('discovery', 'generation', 'execution'),
        )

    return query_data
