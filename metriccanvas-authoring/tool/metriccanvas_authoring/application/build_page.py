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
from metriccanvas_authoring.domain.page_build_spec import validate_page_build_spec
from metriccanvas_authoring.domain.page_building import (
    PageBuildingIssue,
    assemble_page_document,
    derive_executable_units,
)
from metriccanvas_authoring.domain.page_validation import validate_page_schema


@dataclass(frozen=True, slots=True)
class BuildPageCommand:
    """Application command; save controls remain outside Page Build Spec."""

    page_id: str
    idempotency_key: str
    spec: Mapping[str, Any]
    page_id_confirmed: bool = False


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


@dataclass(frozen=True, slots=True)
class BuildPageResult:
    ok: bool
    saved_revision: SavedRevision | None = None
    issues: tuple[BuildPageIssue, ...] = ()


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

        data_context = await dependencies.data_context.current()
        try:
            units = derive_executable_units(command.spec, data_context)
        except PageBuildingIssue as issue:
            return BuildPageResult(
                ok=False,
                issues=(BuildPageIssue(issue.code, issue.path, issue.message),),
            )
        executions = [
            await dependencies.dqe.execute(unit.effective_query()) for unit in units
        ]
        page_schema_version = str(load_bundle_info()["pageSchemaVersion"])
        document = assemble_page_document(
            page_id=command.page_id,
            description=_optional_string(command.spec.get("description")),
            schema_version=page_schema_version,
            units=units,
            executions=executions,
        )
        page_issues = validate_page_schema(document)
        if page_issues:
            return BuildPageResult(
                ok=False,
                issues=tuple(
                    BuildPageIssue(issue.type, issue.path, issue.message)
                    for issue in page_issues
                ),
            )

        base_revision = command.spec.get("baseRevision")
        base_revision_id = (
            None
            if not isinstance(base_revision, Mapping)
            else _optional_string(base_revision.get("revisionId"))
        )
        saved = await dependencies.page_assets.save_revision(
            {
                "pageId": command.page_id,
                "baseRevisionId": base_revision_id,
                "document": document,
                "idempotencyKey": command.idempotency_key,
                "pageIdConfirmed": command.page_id_confirmed,
            }
        )
        return BuildPageResult(ok=True, saved_revision=saved)

    return build_page


def _optional_string(value: object) -> str | None:
    return value if isinstance(value, str) else None
