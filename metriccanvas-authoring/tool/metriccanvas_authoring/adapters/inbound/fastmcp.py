from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated, Any, Literal

from fastmcp import Context, FastMCP
from pydantic import Field, WithJsonSchema
from typing_extensions import TypedDict

from metriccanvas_authoring.application.build_page import (
    BuildPageCommand,
    BuildPageDependencies,
    create_build_page,
)
from metriccanvas_authoring.application.bundle_info import load_bundle_info
from metriccanvas_authoring.application.compose_page import (
    ComposePageCommand,
    ComposePageDependencies,
    create_compose_page,
)
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


class PageBuildArtifactOutput(TypedDict):
    formatVersion: str
    document: dict[str, Any]
    documentSha256: str
    dataContextVersion: str
    bundleVersion: str


class RelayModelSummary(TypedDict):
    status: Literal["page_composed"]
    pageId: str
    unitCount: int
    topLevelComponentCount: int
    dataContextVersion: str
    bundleVersion: str
    documentSha256: str


class RelayArtifactEnvelope(TypedDict):
    kind: Literal["metriccanvas.page-build-artifact"]
    formatVersion: Literal["1.0"]
    artifact: PageBuildArtifactOutput
    modelSummary: RelayModelSummary


class ComposePageOutput(TypedDict):
    ok: bool
    completedStages: list[str]
    artifactEnvelope: RelayArtifactEnvelope | None
    issues: list[ToolIssue]


ToolSurface = Literal["compatibility", "relay"]


def create_mcp_server(
    dependencies: BuildPageDependencies,
    *,
    tool_surface: ToolSurface = "compatibility",
) -> FastMCP:
    """Bind transport handlers to coarse-grained application use cases."""
    if tool_surface not in {"compatibility", "relay"}:
        raise ValueError(f"unsupported MetricCanvas tool surface: {tool_surface}")
    discover = create_discover_data_context(
        DiscoverDataContextDependencies(data_context=dependencies.data_context)
    )
    build = (
        create_build_page(dependencies) if tool_surface == "compatibility" else None
    )
    compose = create_compose_page(
        ComposePageDependencies(
            data_context=dependencies.data_context,
            dqe=dependencies.dqe,
        )
    )
    mcp = FastMCP(
        "metriccanvas-authoring",
        instructions=(
            "Use the MetricCanvas Page Builder Skill. Discover governed names, then "
            "submit one complete Page Build Spec; generated query and page JSON are "
            "not model-authored inputs. The Relay surface requires a Page Artifact "
            "Adapter that stores artifactEnvelope.artifact and returns only "
            "artifactEnvelope.modelSummary to the model."
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

    if tool_surface == "relay":

        @mcp.tool
        async def compose_page(
            page_id: str,
            spec: PageBuildSpec,
        ) -> ComposePageOutput:
            """Return a validated page artifact for Relay checkpoint handoff.

            Relay must store the full artifact envelope before exposing only its
            modelSummary. User-triggered persistence remains a platform-to-Java action.
            """
            result = await compose(ComposePageCommand(page_id=page_id, spec=spec))
            envelope: RelayArtifactEnvelope | None = None
            if result.artifact is not None:
                artifact_payload = result.artifact.to_payload()
                envelope = {
                    "kind": "metriccanvas.page-build-artifact",
                    "formatVersion": "1.0",
                    "artifact": artifact_payload,
                    "modelSummary": {
                        "status": "page_composed",
                        "pageId": page_id,
                        "unitCount": _unit_count(spec),
                        "topLevelComponentCount": _top_level_component_count(
                            artifact_payload["document"]
                        ),
                        "dataContextVersion": result.artifact.data_context_version,
                        "bundleVersion": result.artifact.bundle_version,
                        "documentSha256": result.artifact.document_sha256,
                    },
                }
            return {
                "ok": result.ok,
                "completedStages": list(result.completed_stages),
                "artifactEnvelope": envelope,
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

    else:
        assert build is not None

        @mcp.tool
        async def build_page(
            page_id: str,
            spec: PageBuildSpec,
            ctx: Context,
            page_id_confirmed: bool = False,
        ) -> BuildPageOutput:
            """Validate, execute, assemble, and save one complete Page Build Spec.

            Retrying the same page and spec is safe: the Tool derives the save
            idempotency key itself, so a repeated call returns the same revision.
            """
            result = await build(
                BuildPageCommand(
                    page_id=page_id,
                    spec=spec,
                    page_id_confirmed=page_id_confirmed,
                    session_id=_relay_session_id(ctx),
                )
            )
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
                    "unitCount": _unit_count(spec),
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


def _unit_count(spec: dict[str, Any]) -> int:
    units = spec.get("units")
    return len(units) if isinstance(units, list) else 0


def _top_level_component_count(document: dict[str, Any]) -> int:
    sections = document.get("sections")
    if not isinstance(sections, list):
        return 0
    return sum(
        len(components)
        for section in sections
        if isinstance(section, dict)
        and isinstance((components := section.get("components")), list)
    )


def _relay_session_id(ctx: Context) -> str | None:
    """MCP session id when the transport has one; recorded as `source.sessionId`."""
    try:
        session_id = ctx.session_id
    except Exception:  # noqa: BLE001 - absence of a session is not a build failure
        return None
    return session_id if isinstance(session_id, str) and session_id else None
