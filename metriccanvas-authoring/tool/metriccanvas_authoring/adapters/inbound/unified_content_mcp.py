"""Unified tool surface: every invocation requires a trusted active authoring turn."""
from typing import Annotated, Literal
from copy import deepcopy
from dataclasses import replace

from fastmcp import FastMCP
from fastmcp.tools import ToolResult
from pydantic import Field

from metriccanvas_authoring.adapters.inbound.content_mcp import create_content_mcp_server, PageEditRequest, RESULT_SCHEMA
from metriccanvas_authoring.adapters.inbound.fastmcp import PageBuildSpec
from metriccanvas_authoring.application.authoring_turns import AuthoringTurnGate, TurnBaselines, read_page_projection
from metriccanvas_authoring.application.content_ports import ContentBaselineError, ContentBaseline
from metriccanvas_authoring.application.authoring_candidates import AuthoringCandidates
from metriccanvas_authoring.application.summary_capability import summary_configured
from metriccanvas_authoring.domain.page_editing import edit_page_document
from metriccanvas_authoring.application.bundle_info import load_bundle_info


def create_unified_content_mcp_server(dependencies, current_turns=None, *, summary_config=None, candidate_store=None):
    gate = AuthoringTurnGate(current_turns)
    candidates = AuthoringCandidates(candidate_store)
    mcp = FastMCP('metriccanvas-platform-content', instructions=(
        'All tools require the current trusted context_ref. No file baseline tokens are accepted. '
        'read_page_context exposes bounded configuration; explicit target_component_id takes precedence over selection. '
        'No tool saves or publishes. A trusted Relay adapter MUST keep structured artifactEnvelope off the model channel '
        'and expose only modelSummary. Missing current-turn provider is unavailable, never legacy fallback.'))

    @mcp.resource('metriccanvas://bundle-info')
    def bundle_info():
        return load_bundle_info()

    def failure(error):
        summary = {'status': 'unavailable' if error.code.endswith('_UNAVAILABLE') else 'rejected',
                   'issues': [{'code': error.code, 'path': ''}]}
        return ToolResult(content=summary, structured_content={'ok': False, 'artifactEnvelope': None, 'modelSummary': summary})

    async def invoke(name, context_ref, args, *, write=False, mode=None, candidate_ref=None):
        try:
            prepared = await gate.require(context_ref, write=write, mode=mode)
            if write: candidates.ensure_available()
            parent = await candidates.require(candidate_ref, prepared) if candidate_ref is not None else None
            if parent is not None:
                edited = edit_page_document(parent['document'], args['request'], summary_enabled=summary_configured(summary_config))
                summary = {key: edited[key] for key in ('status', 'operations', 'issues')}
                document = edited['document']
                output = {'ok': edited['status'] in {'changed', 'partial', 'unchanged'}, 'artifactEnvelope': None, 'modelSummary': summary}
            else:
                output = None
            if output is None:
                if name in {'compose_page', 'create_content_page'}:
                    args['page_id'] = prepared.binding['pageId']
                if name == 'edit_page': args['baseline_token'] = context_ref
                # Existing content algorithms remain private, never registered as a bypass.
                legacy = create_content_mcp_server(dependencies, TurnBaselines(prepared), summary_config=summary_config)
                tool = await legacy.get_tool(name)
                result = await tool.run(args)
                if not write:
                    await gate.unchanged(prepared)
                    return result
                output = deepcopy(result.structured_content)
                envelope = output['artifactEnvelope']
                document = envelope['artifact']['document'] if envelope else None
            await gate.unchanged(prepared, write=write)
            record = None
            if document is not None:
                record = await candidates.put(prepared, document, args.get('request', {}).get('operations', []), candidate_ref)
            elif parent is not None and output['modelSummary'].get('status') == 'unchanged':
                record = parent
            if record is not None:
                output['modelSummary'].update(candidateRef=record['candidateRef'], candidateVersion=record['candidateVersion'], documentSha256=record['documentSha256'])
                output['artifactEnvelope'] = {'kind': 'metriccanvas.authoring-candidate', 'formatVersion': '1.0', 'artifact': record}
            await gate.unchanged(prepared, write=write)
            return ToolResult(content=output['modelSummary'], structured_content=output)
        except ContentBaselineError as error:
            return failure(error)

    @mcp.tool
    async def read_page_context(context_ref: str, target_component_id: str | None = None,
                                use_selection: bool = False,
                                offset: Annotated[int, Field(ge=0)] = 0,
                                limit: Annotated[int, Field(ge=1, le=50)] = 20,
                                cursor: str | None = None,
                                candidate_ref: str | None = None) -> ToolResult:
        """Read bounded top-level structure or target configuration at the current exact revision.

        For additional entries pass nextCursor and range.end as cursor and offset, with
        the same context and target. Explicit stable ID wins over selected component.
        Missing/deleted/ambiguous targets fail; no full document, rows or query bodies.
        """
        try:
            prepared = await gate.require(context_ref)
            record = await candidates.require(candidate_ref, prepared) if candidate_ref is not None else None
            view = prepared if record is None else replace(prepared, baseline=ContentBaseline(
                prepared.binding['baseRef'] or {}, record['document'], record['documentSha256']))
            cursor_scope = 'root|' if record is None else f"candidate:{record['candidateRef']}:{record['candidateVersion']}|"
            if cursor is not None:
                if not cursor.startswith(cursor_scope): raise ContentBaselineError('PAGE_CONTEXT_CURSOR_STALE')
                cursor = cursor[len(cursor_scope):]
            result = read_page_projection(view, target_component_id=target_component_id,
                                          use_selection=use_selection, offset=offset, limit=limit, cursor=cursor)
            result.update(view='root' if record is None else 'candidate', candidateRef=candidate_ref,
                          candidateVersion=record['candidateVersion'] if record else None)
            if record is not None: result['documentSha256'] = record['documentSha256']
            if result['nextCursor'] is not None: result['nextCursor'] = cursor_scope + result['nextCursor']
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
    async def edit_page(context_ref: str, request: PageEditRequest, candidate_ref: str | None = None) -> ToolResult:
        """Apply controlled operations to the complete trusted current baseline, without saving."""
        return await invoke('edit_page', context_ref, {'request': request}, write=True,
                            mode=None if candidate_ref is not None else 'existing', candidate_ref=candidate_ref)

    return mcp
