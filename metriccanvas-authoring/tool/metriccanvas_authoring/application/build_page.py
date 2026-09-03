from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Mapping

from metriccanvas_authoring.application.compose_page import (
    ComposePageCommand,
    ComposePageDependencies,
    create_compose_page,
)
from metriccanvas_authoring.application.ports import (
    DataContextPort,
    DqeExecutionPort,
    PageAssetPort,
    SavedRevision,
)
from metriccanvas_authoring.domain.execution import FailureStage
from metriccanvas_authoring.domain.idempotency import derive_idempotency_key


@dataclass(frozen=True, slots=True)
class BuildPageCommand:
    """Transitional saved-page command retained while callers migrate to compose."""

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
    """Wrap the save-free composer for compatibility with the current MCP tool."""

    compose_page = create_compose_page(
        ComposePageDependencies(
            data_context=dependencies.data_context,
            dqe=dependencies.dqe,
        )
    )

    async def build_page(command: BuildPageCommand) -> BuildPageResult:
        composed = await compose_page(
            ComposePageCommand(page_id=command.page_id, spec=command.spec)
        )
        if not composed.ok:
            return BuildPageResult(
                ok=False,
                issues=tuple(
                    BuildPageIssue(
                        code=issue.code,
                        path=issue.path,
                        message=issue.message,
                        stage=issue.stage,
                    )
                    for issue in composed.issues
                ),
                completed_stages=composed.completed_stages,
            )
        assert composed.artifact is not None

        base_revision = command.spec.get("baseRevision")
        base_revision_id = (
            None
            if not isinstance(base_revision, Mapping)
            else _optional_string(base_revision.get("revisionId"))
        )
        source: dict[str, Any] = {
            "type": "relay",
            "skillVersion": composed.artifact.bundle_version,
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
                    "document": composed.artifact.document,
                    "idempotencyKey": derive_idempotency_key(
                        command.page_id, base_revision_id, command.spec
                    ),
                    "pageIdConfirmed": command.page_id_confirmed,
                    "source": source,
                    "dataContextVersion": composed.artifact.data_context_version,
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
                completed_stages=composed.completed_stages,
            )

        return BuildPageResult(
            ok=True,
            saved_revision=saved,
            completed_stages=(*composed.completed_stages, "save"),
        )

    return build_page


def _optional_string(value: object) -> str | None:
    return value if isinstance(value, str) else None
