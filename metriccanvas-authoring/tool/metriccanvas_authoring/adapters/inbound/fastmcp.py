from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated, Any

from fastmcp import FastMCP
from pydantic import Field, WithJsonSchema
from typing_extensions import TypedDict

from metriccanvas_authoring.application.build_page import (
    BuildPageCommand,
    BuildPageDependencies,
    create_build_page,
)
from metriccanvas_authoring.application.bundle_info import load_bundle_info
from metriccanvas_authoring.application.discover_data_context import (
    DiscoverDataContextCommand,
    DiscoverDataContextDependencies,
    create_discover_data_context,
)


BUNDLE_ROOT = Path(__file__).resolve().parents[4]
PAGE_BUILD_SPEC_SCHEMA = json.loads(
    (
        BUNDLE_ROOT
        / "contracts"
        / "authored"
        / "page-build-spec.schema.json"
    ).read_text(encoding="utf-8")
)


def _inline_local_refs(value: Any, root: dict[str, Any]) -> Any:
    if isinstance(value, list):
        return [_inline_local_refs(entry, root) for entry in value]
    if not isinstance(value, dict):
        return value
    reference = value.get("$ref")
    if isinstance(reference, str) and reference.startswith("#/$defs/"):
        name = reference.removeprefix("#/$defs/")
        target = root["$defs"][name]
        siblings = {key: entry for key, entry in value.items() if key != "$ref"}
        return _inline_local_refs({**target, **siblings}, root)
    return {
        key: _inline_local_refs(entry, root)
        for key, entry in value.items()
        if key not in {"$defs", "$schema"}
    }


RUNTIME_PAGE_BUILD_SPEC_SCHEMA = _inline_local_refs(
    PAGE_BUILD_SPEC_SCHEMA, PAGE_BUILD_SPEC_SCHEMA
)
# The Tool advertises the authored contract, while the application validator
# remains the enforcement point so failures keep stable MetricCanvas code/path.
PageBuildSpec = Annotated[
    dict[str, Any],
    WithJsonSchema(RUNTIME_PAGE_BUILD_SPEC_SCHEMA),
]


class ToolIssue(TypedDict):
    code: str
    path: str
    message: str
    stage: str


class DiscoverDataContextOutput(TypedDict):
    ok: bool
    dataContextVersion: str | None
    matches: list[dict[str, Any]]
    issues: list[ToolIssue]


class SavedRevisionOutput(TypedDict):
    pageId: str
    revisionId: str
    revisionNumber: int


class BuildPageSummary(TypedDict):
    unitCount: int


class BuildPageOutput(TypedDict):
    ok: bool
    completedStages: list[str]
    savedRevision: SavedRevisionOutput | None
    summary: BuildPageSummary
    issues: list[ToolIssue]


def create_mcp_server(dependencies: BuildPageDependencies) -> FastMCP:
    """Bind transport handlers to coarse-grained application use cases."""
    discover = create_discover_data_context(
        DiscoverDataContextDependencies(data_context=dependencies.data_context)
    )
    build = create_build_page(dependencies)
    mcp = FastMCP(
        "metriccanvas-authoring",
        instructions=(
            "Use the MetricCanvas Page Builder Skill. Discover governed names, then "
            "submit one complete Page Build Spec; generated query and page JSON are "
            "not model-authored inputs."
        ),
    )

    @mcp.resource("metriccanvas://bundle-info")
    def bundle_info() -> str:
        """Return Bundle and contract identity outside the model tool surface."""
        return json.dumps(load_bundle_info(), ensure_ascii=False)

    @mcp.tool
    async def discover_data_context(
        query: str,
        limit: Annotated[int, Field(ge=1, le=50)] = 10,
    ) -> DiscoverDataContextOutput:
        """Find governed MetricCanvas metrics and dimensions for a business term."""
        result = await discover(DiscoverDataContextCommand(query=query, limit=limit))
        return {
            "ok": result.ok,
            "dataContextVersion": result.data_context_version,
            "matches": list(result.matches),
            "issues": [
                {
                    "code": issue.code,
                    "path": issue.path,
                    "message": issue.message,
                    "stage": issue.stage,
                }
                for issue in result.issues
            ],
        }

    @mcp.tool
    async def build_page(
        page_id: str,
        idempotency_key: str,
        spec: PageBuildSpec,
        page_id_confirmed: bool = False,
    ) -> BuildPageOutput:
        """Validate, execute, assemble, and save one complete Page Build Spec."""
        result = await build(
            BuildPageCommand(
                page_id=page_id,
                idempotency_key=idempotency_key,
                spec=spec,
                page_id_confirmed=page_id_confirmed,
            )
        )
        units = spec.get("units")
        return {
            "ok": result.ok,
            "completedStages": list(result.completed_stages),
            "savedRevision": (
                None
                if result.saved_revision is None
                else {
                    "pageId": result.saved_revision.page_id,
                    "revisionId": result.saved_revision.revision_id,
                    "revisionNumber": result.saved_revision.revision_number,
                }
            ),
            "summary": {
                "unitCount": len(units) if isinstance(units, list) else 0,
            },
            "issues": [
                {
                    "code": issue.code,
                    "path": issue.path,
                    "message": issue.message,
                    "stage": issue.stage,
                }
                for issue in result.issues
            ],
        }

    return mcp
