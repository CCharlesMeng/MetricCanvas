from __future__ import annotations

import asyncio
import hashlib
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from copy import deepcopy
from typing import Any, Mapping

from metriccanvas_authoring.application.bundle_info import load_bundle_info
from metriccanvas_authoring.application.source_description_ports import SourceDescriptionPort
from metriccanvas_authoring.domain.source_mapping import map_source_description, validate_mapped_rows, SourceMappingError
from metriccanvas_authoring.application.ports import (
    DataContextError,
    DataContextPort,
    DqeExecutionPort,
)
from metriccanvas_authoring.domain.data_context import parse_data_context
from metriccanvas_authoring.domain.execution import (
    FailureStage,
    FormulaTrace,
    failure_from_execution_error,
)
from metriccanvas_authoring.domain.idempotency import canonical_json
from metriccanvas_authoring.domain.page_build_spec import validate_page_build_spec
from metriccanvas_authoring.domain.page_building import (
    PageBuildingIssue,
    PageBuildingIssues,
    assemble_page_document,
    derive_executable_units,
)
from metriccanvas_authoring.domain.page_validation import validate_page_document
from metriccanvas_authoring.application.component_policy import apply_component_policy


@dataclass(frozen=True, slots=True)
class ComposePageCommand:
    page_id: str
    spec: Mapping[str, Any]


@dataclass(frozen=True, slots=True)
class ComposePageDependencies:
    data_context: DataContextPort
    dqe: DqeExecutionPort
    source_description: SourceDescriptionPort | None = None
    authoring_scope: Mapping[str, Any] | None = None
    require_source_description: bool = False
    business_interpretation: Any = None
    component_policy: Any = None


@dataclass(frozen=True, slots=True)
class ComposePageIssue:
    code: str
    path: str
    message: str
    stage: FailureStage = "generation"
    candidates: tuple[str, ...] = ()
    retry_safe: bool = False


@dataclass(frozen=True, slots=True)
class PageBuildArtifact:
    format_version: str
    document: Mapping[str, Any]
    document_sha256: str
    data_context_version: str
    bundle_version: str
    formula_traces: tuple[FormulaTrace, ...]
    source_descriptions: tuple[Mapping[str, Any], ...] = ()

    def to_payload(self) -> dict[str, Any]:
        return {
            "formatVersion": self.format_version,
            "document": self.document,
            "documentSha256": self.document_sha256,
            "dataContextVersion": self.data_context_version,
            "bundleVersion": self.bundle_version,
            "formulaTraces": [trace.to_payload() for trace in self.formula_traces],
            **({"sourceDescriptions": deepcopy(list(self.source_descriptions))} if self.source_descriptions else {}),
        }


@dataclass(frozen=True, slots=True)
class ComposePageResult:
    ok: bool
    artifact: PageBuildArtifact | None = None
    issues: tuple[ComposePageIssue, ...] = ()
    completed_stages: tuple[FailureStage, ...] = ()


ComposePage = Callable[[ComposePageCommand], Awaitable[ComposePageResult]]


def create_compose_page(dependencies: ComposePageDependencies) -> ComposePage:
    """Create the save-free Page Build Spec composition use case."""

    async def compose_page(command: ComposePageCommand) -> ComposePageResult:
        spec_issues = validate_page_build_spec(command.spec)
        if spec_issues:
            return ComposePageResult(
                ok=False,
                issues=tuple(
                    ComposePageIssue(
                        issue.code,
                        issue.path,
                        issue.message,
                        candidates=issue.candidates,
                    )
                    for issue in spec_issues
                ),
            )

        base_revision = command.spec.get("baseRevision")
        if isinstance(base_revision, Mapping) and base_revision.get(
            "pageId"
        ) != command.page_id:
            return ComposePageResult(
                ok=False,
                issues=(
                    ComposePageIssue(
                        "BASE_REVISION_PAGE_ID_MISMATCH",
                        "/baseRevision/pageId",
                        "baseRevision.pageId must equal the page being built "
                        f"({command.page_id!r})",
                    ),
                ),
            )

        try:
            data_context_snapshot = await dependencies.data_context.current()
        except DataContextError as error:
            return ComposePageResult(
                ok=False,
                issues=(
                    ComposePageIssue(
                        error.code,
                        "",
                        str(error),
                        stage="discovery",
                    ),
                ),
            )
        data_context, data_context_issues = parse_data_context(data_context_snapshot)
        if data_context_issues:
            return ComposePageResult(
                ok=False,
                issues=tuple(
                    ComposePageIssue(
                        issue.code,
                        issue.path,
                        issue.message,
                        stage="discovery",
                    )
                    for issue in data_context_issues
                ),
            )
        assert data_context is not None

        expected_data_context_version = command.spec.get("dataContextVersion")
        if (
            isinstance(expected_data_context_version, str)
            and expected_data_context_version != data_context.version
        ):
            return ComposePageResult(
                ok=False,
                issues=(
                    ComposePageIssue(
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
            units = derive_executable_units(command.spec, data_context)
        except PageBuildingIssue as issue:
            return ComposePageResult(
                ok=False,
                issues=(
                    ComposePageIssue(
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
                return ComposePageResult(ok=False, issues=(ComposePageIssue(
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
                    return ComposePageResult(ok=False, issues=(ComposePageIssue(code, f'/units/{index}', code),),
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
                return ComposePageResult(
                    ok=False,
                    issues=(
                        ComposePageIssue(
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
                    return ComposePageResult(ok=False, issues=(ComposePageIssue(error.code, f'/units/{index}', error.code, stage='presentation'),),
                                             completed_stages=('discovery', 'generation', 'execution'))

        bundle_info = load_bundle_info()
        try:
            units = await apply_component_policy(units, executions, dependencies.component_policy, dependencies.authoring_scope)
            document = assemble_page_document(
                page_id=command.page_id,
                description=_optional_string(command.spec.get("description")),
                schema_version=str(bundle_info["pageSchemaVersion"]),
                units=units,
                executions=executions,
            )
        except PageBuildingIssues as issue_group:
            return ComposePageResult(
                ok=False,
                issues=tuple(
                    ComposePageIssue(
                        issue.code,
                        issue.path,
                        issue.message,
                        stage="presentation",
                        candidates=issue.candidates,
                    )
                    for issue in issue_group.issues
                ),
                completed_stages=("discovery", "generation", "execution"),
            )
        except PageBuildingIssue as issue:
            return ComposePageResult(
                ok=False,
                issues=(
                    ComposePageIssue(
                        issue.code,
                        issue.path,
                        issue.message,
                        stage="presentation",
                        candidates=issue.candidates,
                    ),
                ),
                completed_stages=("discovery", "generation", "execution"),
            )

        page_issues = validate_page_document(document)
        if page_issues:
            return ComposePageResult(
                ok=False,
                issues=tuple(
                    ComposePageIssue(
                        issue.type,
                        issue.path,
                        issue.message,
                        stage="presentation",
                    )
                    for issue in page_issues
                ),
                completed_stages=("discovery", "generation", "execution"),
            )

        return ComposePageResult(
            ok=True,
            artifact=PageBuildArtifact(
                format_version="1.0",
                document=document,
                document_sha256=hashlib.sha256(
                    canonical_json(document).encode("utf-8")
                ).hexdigest(),
                data_context_version=data_context.version,
                bundle_version=str(bundle_info["bundleVersion"]),
                source_descriptions=tuple(source_descriptions),
                formula_traces=tuple(
                    trace for unit in units for trace in unit.formula_traces
                ),
            ),
            completed_stages=(
                "discovery",
                "generation",
                "execution",
                "presentation",
            ),
        )

    return compose_page


def _optional_string(value: object) -> str | None:
    return value if isinstance(value, str) else None
