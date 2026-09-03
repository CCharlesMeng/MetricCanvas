from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Mapping

from metriccanvas_authoring.application.bundle_info import load_bundle_info
from metriccanvas_authoring.application.ports import (
    DataContextPort,
    DqeExecutionPort,
    PageAssetPort,
    SavedRevision,
)
from metriccanvas_authoring.domain.data_context import parse_data_context
from metriccanvas_authoring.domain.execution import (
    FailureStage,
    failure_from_execution_error,
)
from metriccanvas_authoring.domain.idempotency import derive_idempotency_key
from metriccanvas_authoring.domain.page_build_spec import validate_page_build_spec
from metriccanvas_authoring.domain.page_building import (
    PageBuildingIssue,
    assemble_page_document,
    derive_executable_units,
)
from metriccanvas_authoring.domain.page_validation import validate_page_document


@dataclass(frozen=True, slots=True)
class BuildPageCommand:
    """Application command; save controls remain outside Page Build Spec.

    There is no idempotency key here: ADR-0063 makes the Tool derive it from
    ``(pageId, baseRevisionId, canonical(spec))``. ``session_id`` / ``run_id``
    are the Relay identifiers recorded on the revision source when known.
    """

    page_id: str
    spec: Mapping[str, Any]
    page_id_confirmed: bool = False
    session_id: str | None = None
    run_id: str | None = None


@dataclass(frozen=True, slots=True)
class BuildPageDependencies:
    data_context: DataContextPort
    dqe: DqeExecutionPort
    page_assets: PageAssetPort


@dataclass(frozen=True, slots=True)
class BuildPageIssue:
    code: str
    path: str
    message: str
    stage: FailureStage = "generation"


@dataclass(frozen=True, slots=True)
class BuildPageResult:
    ok: bool
    saved_revision: SavedRevision | None = None
    issues: tuple[BuildPageIssue, ...] = ()
    completed_stages: tuple[FailureStage, ...] = ()


BuildPage = Callable[[BuildPageCommand], Awaitable[BuildPageResult]]


def create_build_page(dependencies: BuildPageDependencies) -> BuildPage:
    """Create the coarse-grained Page Build Spec submission use case."""

    async def build_page(command: BuildPageCommand) -> BuildPageResult:
        spec_issues = validate_page_build_spec(command.spec)
        if spec_issues:
            return BuildPageResult(
                ok=False,
                issues=tuple(
                    BuildPageIssue(issue.code, issue.path, issue.message)
                    for issue in spec_issues
                ),
            )
        base_revision = command.spec.get("baseRevision")
        base_revision_id = (
            None
            if not isinstance(base_revision, Mapping)
            else _optional_string(base_revision.get("revisionId"))
        )
        if isinstance(base_revision, Mapping) and base_revision.get("pageId") != command.page_id:
            return BuildPageResult(
                ok=False,
                issues=(
                    BuildPageIssue(
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
            return BuildPageResult(
                ok=False,
                issues=tuple(
                    BuildPageIssue(
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
            return BuildPageResult(
                ok=False,
                issues=(BuildPageIssue(issue.code, issue.path, issue.message),),
                completed_stages=("discovery",),
            )
        executions = []
        for unit_index, unit in enumerate(units):
            try:
                executions.append(
                    await dependencies.dqe.execute(unit.effective_query())
                )
            except Exception as cause:
                failure = failure_from_execution_error(cause)
                return BuildPageResult(
                    ok=False,
                    issues=(
                        BuildPageIssue(
                            code=failure.code,
                            path=f"/units/{unit_index}",
                            message=failure.message,
                            stage=failure.stage,
                        ),
                    ),
                    completed_stages=("discovery", "generation"),
                )
        bundle_info = load_bundle_info()
        page_schema_version = str(bundle_info["pageSchemaVersion"])
        try:
            document = assemble_page_document(
                page_id=command.page_id,
                description=_optional_string(command.spec.get("description")),
                schema_version=page_schema_version,
                units=units,
                executions=executions,
            )
        except PageBuildingIssue as issue:
            return BuildPageResult(
                ok=False,
                issues=(
                    BuildPageIssue(
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
            return BuildPageResult(
                ok=False,
                issues=tuple(
                    BuildPageIssue(
                        issue.type,
                        issue.path,
                        issue.message,
                        stage="presentation",
                    )
                    for issue in page_issues
                ),
                completed_stages=("discovery", "generation", "execution"),
            )

        source: dict[str, Any] = {
            "type": "relay",
            "skillVersion": str(bundle_info["bundleVersion"]),
        }
        if command.session_id:
            source["sessionId"] = command.session_id
        if command.run_id:
            source["runId"] = command.run_id
        try:
            saved = await dependencies.page_assets.save_revision(
                {
                    "pageId": command.page_id,
                    "baseRevisionId": base_revision_id,
                    "document": document,
                    "idempotencyKey": derive_idempotency_key(
                        command.page_id, base_revision_id, command.spec
                    ),
                    "pageIdConfirmed": command.page_id_confirmed,
                    "source": source,
                    "dataContextVersion": data_context.version,
                }
            )
        except Exception as cause:
            raw_code = getattr(cause, "code", None)
            code = raw_code if isinstance(raw_code, str) else "PAGE_SAVE_FAILED"
            return BuildPageResult(
                ok=False,
                issues=(
                    BuildPageIssue(
                        code=code,
                        path="/",
                        message=str(cause),
                        stage="save",
                    ),
                ),
                completed_stages=(
                    "discovery",
                    "generation",
                    "execution",
                    "presentation",
                ),
            )
        return BuildPageResult(
            ok=True,
            saved_revision=saved,
            completed_stages=(
                "discovery",
                "generation",
                "execution",
                "presentation",
                "save",
            ),
        )

    return build_page


def _optional_string(value: object) -> str | None:
    return value if isinstance(value, str) else None
