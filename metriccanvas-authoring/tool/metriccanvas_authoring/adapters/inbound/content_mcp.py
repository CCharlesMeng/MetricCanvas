"""Independent content MCP; full artifacts stay on the trusted program channel."""
from typing import Annotated, Any, Literal
from copy import deepcopy
from dataclasses import replace

from fastmcp import FastMCP
from fastmcp.tools import ToolResult
from pydantic import Field, WithJsonSchema

from metriccanvas_authoring.adapters.inbound.fastmcp import PageBuildSpec
from metriccanvas_authoring.application.compose_page import ComposePageCommand, ComposePageDependencies, create_compose_page
from metriccanvas_authoring.application.create_content_page import create_content_page as make_content_page
from metriccanvas_authoring.application.content_ports import ContentBaselinePort
from metriccanvas_authoring.application.discover_data_context import DiscoverDataContextCommand, DiscoverDataContextDependencies, create_discover_data_context
from metriccanvas_authoring.application.edit_page import create_edit_page, document_sha256
from metriccanvas_authoring.application.bundle_info import load_bundle_info
from metriccanvas_authoring.domain.page_editing import EDIT_SCHEMA
from metriccanvas_authoring.domain.page_validation import validate_page_document

PageEditRequest = Annotated[dict[str, Any], WithJsonSchema(EDIT_SCHEMA)]
RESULT_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["ok", "artifactEnvelope", "modelSummary"],
    "properties": {"ok": {"type": "boolean"},
        "artifactEnvelope": {"anyOf": [{"type": "object"}, {"type": "null"}]},
        "modelSummary": {"type": "object"}},
}


def create_content_mcp_server(dependencies: ComposePageDependencies, baselines: ContentBaselinePort, *, summary_config=None) -> FastMCP:
    compose = create_compose_page(dependencies)
    edit = create_edit_page(baselines, summary_config)
    create_content = make_content_page(baselines, summary_config)
    discover = create_discover_data_context(DiscoverDataContextDependencies(dependencies.data_context))
    mcp = FastMCP("metriccanvas-content", instructions=(
        "Create with compose_page or create_content_page; edit an existing page only with edit_page and a trusted baseline_token. "
        "Never reconstruct a missing baseline. No tool saves or publishes. "
        "Relay must retain structured artifactEnvelope for trusted program handoff and expose only "
        "modelSummary to the model; do not expose this server to a model without that adapter."
    ))

    @mcp.resource("metriccanvas://bundle-info")
    def bundle_info() -> dict[str, Any]:
        return load_bundle_info()

    @mcp.tool
    async def discover_data_context(query: str, limit: Annotated[int, Field(ge=1, le=50)] = 10) -> dict[str, Any]:
        """Reuse governed discovery before submitting a complete Page Build Spec."""
        result = await discover(DiscoverDataContextCommand(query, limit))
        return {"ok": result.ok, "dataContextVersion": result.data_context_version,
            "businessDomains": list(result.business_domains), "matches": list(result.matches),
            "resolution": result.resolution, "time": result.time, "intent": result.intent,
            "structureOperation": result.structure_operation,
            "issues": [{"code": i.code, "path": i.path, "stage": i.stage} for i in result.issues]}

    @mcp.tool(output_schema=RESULT_SCHEMA)
    async def compose_page(page_id: str, spec: PageBuildSpec, layout: Literal["report", "dashboard"] = "report") -> ToolResult:
        """Create using existing discovery/DQE/building; return a save-free artifact."""
        result = await compose(ComposePageCommand(page_id, spec))
        if result.artifact is not None and layout != result.artifact.document["layout"]:
            document = deepcopy(result.artifact.document)
            document["layout"] = layout
            errors = validate_page_document(document)
            if errors:
                summary = {"status": "failed", "issues": [{"code": e.type, "path": e.path} for e in errors]}
                return ToolResult(content=summary, structured_content={"ok": False, "artifactEnvelope": None, "modelSummary": summary})
            result = replace(result, artifact=replace(result.artifact, document=document, document_sha256=document_sha256(document)))
        summary = {"status": "created" if result.ok else "failed",
            "completedStages": list(result.completed_stages),
            "issues": [{"code": i.code, "path": i.path, "stage": i.stage} for i in result.issues]}
        envelope = None
        if result.artifact is not None:
            document = result.artifact.document
            summary = {"status": "page_composed", "pageId": page_id,
                "unitCount": len(spec["units"]),
                "topLevelComponentCount": sum(len(s["components"]) for s in document["sections"]),
                "dataContextVersion": result.artifact.data_context_version,
                "bundleVersion": result.artifact.bundle_version,
                "documentSha256": result.artifact.document_sha256}
            envelope = {"kind": "metriccanvas.page-build-artifact", "formatVersion": "1.0",
                "artifact": result.artifact.to_payload(), "modelSummary": summary}
        output = {"ok": result.ok, "artifactEnvelope": envelope, "modelSummary": summary}
        return ToolResult(content=summary, structured_content=output)

    @mcp.tool(output_schema=RESULT_SCHEMA)
    async def edit_page(baseline_token: str, request: PageEditRequest) -> ToolResult:
        """Apply controlled operations to a trusted full baseline; never save or publish.

        Dependencies name earlier operation IDs. A failed operation is rolled back,
        its dependents skipped, and independent operations continue. No artifact is
        returned for a failed or unchanged batch. Raw page JSON is not a tool input.
        """
        output = await edit(baseline_token, request)
        return ToolResult(content=output["modelSummary"], structured_content=output)

    @mcp.tool(output_schema=RESULT_SCHEMA)
    async def create_content_page(page_id: str, title: str, request: PageEditRequest,
            layout: Literal["report", "dashboard"] = "report", source_token: str | None = None) -> ToolResult:
        """Create complete content in section main using explicit add operations.

        Containers take governed child recipes. AI summaries require generation=runtime_sse,
        explicit prompt/relatedData and a deployment-owned summary configuration.

        Static text needs no source. Field text and maps require a trusted source_token
        whose complete page supplies governed data and verified row evidence. Never
        pass raw rows, queries or page JSON. Full artifacts stay in the trusted channel.
        """
        output = await create_content(page_id, title, layout, request, source_token)
        return ToolResult(content=output["modelSummary"], structured_content=output)

    return mcp
