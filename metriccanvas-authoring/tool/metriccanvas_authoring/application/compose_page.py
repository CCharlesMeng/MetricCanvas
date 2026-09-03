from __future__ import annotations

import asyncio
import hashlib
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Mapping

from metriccanvas_authoring.application.bundle_info import load_bundle_info
from metriccanvas_authoring.application.ports import DataContextPort, DqeExecutionPort
from metriccanvas_authoring.domain.data_context import parse_data_context
from metriccanvas_authoring.domain.execution import (
    FailureStage,
    failure_from_execution_error,
)
from metriccanvas_authoring.domain.idempotency import canonical_json
from metriccanvas_authoring.domain.page_build_spec import validate_page_build_spec
from metriccanvas_authoring.domain.page_building import (
    PageBuildingIssue,
    assemble_page_document,
    derive_executable_units,
)
from metriccanvas_authoring.domain.page_validation import validate_page_document


@dataclass(frozen=True, slots=True)
class ComposePageCommand:
    page_id: str
    spec: Mapping[str, Any]


@dataclass(frozen=True, slots=True)
class ComposePageDependencies:
    data_context: DataContextPort
    dqe: DqeExecutionPort


@dataclass(frozen=True, slots=True)
class ComposePageIssue:
    code: str
    path: str
    message: str
    stage: FailureStage = "generation"


@dataclass(frozen=True, slots=True)
class PageBuildArtifact:
    format_version: str
    document: Mapping[str, Any]
    document_sha256: str
    data_context_version: str
    bundle_version: str

    def to_payload(self) -> dict[str, Any]:
        return {
            "formatVersion": self.format_version,
            "document": self.document,
            "documentSha256": self.document_sha256,
            "dataContextVersion": self.data_context_version,
            "bundleVersion": self.bundle_version,
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
                    ComposePageIssue(issue.code, issue.path, issue.message)
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

        data_context_snapshot = await dependencies.data_context.current()
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

        try:
            units = derive_executable_units(command.spec, data_context)
        except PageBuildingIssue as issue:
            return ComposePageResult(
                ok=False,
                issues=(ComposePageIssue(issue.code, issue.path, issue.message),),
                completed_stages=("discovery",),
            )

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
                        ),
                    ),
                    completed_stages=("discovery", "generation"),
                )
        executions = [
            result for result in execution_results if not isinstance(result, Exception)
        ]

        bundle_info = load_bundle_info()
        try:
            document = assemble_page_document(
                page_id=command.page_id,
                description=_optional_string(command.spec.get("description")),
                schema_version=str(bundle_info["pageSchemaVersion"]),
                units=units,
                executions=executions,
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
