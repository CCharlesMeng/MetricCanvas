"""Unified tool surface: every invocation requires a trusted active authoring turn."""
from typing import Annotated, Literal

from fastmcp import FastMCP
from fastmcp.tools import ToolResult
from pydantic import Field

from metriccanvas_authoring.adapters.inbound.content_mcp import create_content_mcp_server, PageEditRequest, RESULT_SCHEMA
from metriccanvas_authoring.adapters.inbound.fastmcp import PageBuildSpec
from metriccanvas_authoring.application.authoring_turns import AuthoringTurnGate, TurnBaselines, read_page_projection
from metriccanvas_authoring.application.content_ports import ContentBaselineError
from metriccanvas_authoring.application.bundle_info import load_bundle_info


def create_unified_content_mcp_server(dependencies, current_turns=None, *, summary_config=None):
    gate = AuthoringTurnGate(current_turns)
    mcp = FastMCP('metriccanvas-platform-content', instructions=(
        'All tools require the current trusted context_ref. No file baseline tokens are accepted. '
        'read_page_context exposes bounded configuration; explicit target_component_id takes precedence over selection. '
        'No tool saves or publishes. A trusted Relay adapter MUST keep structured artifactEnvelope off the model channel '
        'and expose only modelSummary. Missing current-turn provider is unavailable, never legacy fallback.'))

    @mcp.resource('metriccanvas://bundle-info')
    def bundle_info():
        return load_bundle_info()

    def failure(error):
        summary = {'status': 'unavailable' if error.code == 'CURRENT_TURN_UNAVAILABLE' else 'rejected',
                   'issues': [{'code': error.code, 'path': ''}]}
        return ToolResult(content=summary, structured_content={'ok': False, 'artifactEnvelope': None, 'modelSummary': summary})

    async def invoke(name, context_ref, args, *, write=False, mode=None):
        try:
            prepared = await gate.require(context_ref, write=write, mode=mode)
            if name in {'compose_page', 'create_content_page'}:
                args['page_id'] = prepared.binding['pageId']
            if name == 'edit_page': args['baseline_token'] = context_ref
            # Reuse the existing content adapter privately. It is never mounted or registered.
            legacy = create_content_mcp_server(dependencies, TurnBaselines(prepared), summary_config=summary_config)
            tool = await legacy.get_tool(name)
            result = await tool.run(args)
            await gate.unchanged(prepared, write=write)
            return result
        except ContentBaselineError as error:
            return failure(error)

    @mcp.tool
    async def read_page_context(context_ref: str, target_component_id: str | None = None,
                                use_selection: bool = False,
                                offset: Annotated[int, Field(ge=0)] = 0,
                                limit: Annotated[int, Field(ge=1, le=50)] = 20,
                                cursor: str | None = None) -> ToolResult:
        """Read bounded top-level structure or target configuration at the current exact revision.

        For additional entries pass nextCursor and range.end as cursor and offset, with
        the same context and target. Explicit stable ID wins over selected component.
        Missing/deleted/ambiguous targets fail; no full document, rows or query bodies.
        """
        try:
            prepared = await gate.require(context_ref)
            result = read_page_projection(prepared, target_component_id=target_component_id,
                                          use_selection=use_selection, offset=offset, limit=limit, cursor=cursor)
            await gate.unchanged(prepared)
            return ToolResult(content=result, structured_content=result)
        except ContentBaselineError as error:
            return failure(error)

    @mcp.tool
    async def discover_data_context(context_ref: str, query: str, limit: Annotated[int, Field(ge=1, le=50)] = 10) -> ToolResult:
        """Discover governed business data in the current trusted turn."""
        return await invoke('discover_data_context', context_ref, {'query': query, 'limit': limit})

    @mcp.tool(output_schema=RESULT_SCHEMA)
    async def compose_page(context_ref: str, spec: PageBuildSpec, layout: Literal['report', 'dashboard'] = 'report') -> ToolResult:
        """Compose a new page for the trusted new-page identity; never replace an existing baseline."""
        return await invoke('compose_page', context_ref, {'spec': spec, 'layout': layout}, write=True, mode='new')

    @mcp.tool(output_schema=RESULT_SCHEMA)
    async def create_content_page(context_ref: str, title: str, request: PageEditRequest,
                                  layout: Literal['report', 'dashboard'] = 'report') -> ToolResult:
        """Create explicit content on a trusted empty new-page baseline; no model-supplied source tokens."""
        return await invoke('create_content_page', context_ref, {'title': title, 'request': request, 'layout': layout}, write=True, mode='new')

    @mcp.tool(output_schema=RESULT_SCHEMA)
    async def edit_page(context_ref: str, request: PageEditRequest) -> ToolResult:
        """Apply controlled operations to the complete trusted current baseline, without saving."""
        return await invoke('edit_page', context_ref, {'request': request}, write=True, mode='existing')

    return mcp
