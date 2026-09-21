"""Unified tool surface: every invocation requires a trusted active authoring turn."""
from typing import Annotated, Literal, Any
from copy import deepcopy
from dataclasses import replace

from fastmcp import FastMCP
from fastmcp.tools import ToolResult
from pydantic import Field, WithJsonSchema

from metriccanvas_authoring.entrypoints.compat.content_mcp import RESULT_SCHEMA
from metriccanvas_authoring.pages.composition.compose_content import compose_content
from metriccanvas_authoring.entrypoints.compat.fastmcp import PageBuildSpec
from metriccanvas_authoring.work.authoring_turns import AuthoringTurnGate, read_page_projection
from metriccanvas_authoring.work.content_ports import ContentBaselineError, ContentBaseline
from metriccanvas_authoring.work.authoring_candidates import AuthoringCandidates
from metriccanvas_authoring.application.summary_capability import summary_configured
from metriccanvas_authoring.pages.editing.unified_edit_page import edit_unified_page, UNIFIED_EDIT_SCHEMA
from metriccanvas_authoring.application.bundle_info import load_bundle_info
from metriccanvas_authoring.application.discover_data_context import DiscoverDataContextDependencies, DiscoverDataContextCommand, create_discover_data_context
from metriccanvas_authoring.pages.composition.unified_composition import compose_unified_content, COMPOSITION_SCHEMA


UnifiedEditRequest = Annotated[dict[str, Any], WithJsonSchema(UNIFIED_EDIT_SCHEMA)]
CompositionRequest = Annotated[dict[str, Any], WithJsonSchema(COMPOSITION_SCHEMA)]

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
            scoped_dependencies = replace(dependencies, authoring_scope=dict(prepared.binding), require_source_description=True) if write else dependencies
            source_descriptions = []
            if name == 'discover_data_context':
                discover = create_discover_data_context(DiscoverDataContextDependencies(dependencies.data_context,
                    business_interpretation=dependencies.business_interpretation))
                found = await discover(DiscoverDataContextCommand(**args))
                await gate.unchanged(prepared)
                payload = {'ok': found.ok, 'dataContextVersion': found.data_context_version,
                    'businessDomains': list(found.business_domains), 'matches': list(found.matches),
                    'resolution': found.resolution, 'time': found.time, 'intent': found.intent, 'structureOperation': found.structure_operation,
                    'issues': [{'code': issue.code, 'path': issue.path, 'stage': issue.stage} for issue in found.issues]}
                if found.page_range is not None:
                    payload['range'] = found.page_range
                return ToolResult(content=payload, structured_content=payload)
            if name == 'create_content_page':
                edited = await compose_unified_content(prepared.binding['pageId'], args['title'], args['layout'], args['request'],
                    scoped_dependencies, summary_enabled=summary_configured(summary_config),
                    current=lambda: gate.unchanged(prepared, write=True))
                document = edited['document']
                source_descriptions = edited.get('sourceDescriptions', [])
                output = {'ok': document is not None, 'artifactEnvelope': None,
                          'modelSummary': {key: edited[key] for key in ('status', 'operations', 'issues')}}
            elif name == 'edit_page':
                baseline = parent['document'] if parent is not None else prepared.baseline.document
                edited = await edit_unified_page(baseline, args['request'], scoped_dependencies,
                    summary_enabled=summary_configured(summary_config), current=lambda: gate.unchanged(prepared, write=True))
                summary = {key: edited[key] for key in ('status', 'operations', 'issues')}
                document = edited['document']
                source_descriptions = edited.get('sourceDescriptions', [])
                output = {'ok': edited['status'] in {'changed', 'partial', 'unchanged'}, 'artifactEnvelope': None, 'modelSummary': summary}
            else:
                output = None
            if output is None:
                output = await compose_content(scoped_dependencies, prepared.binding['pageId'], args['spec'], args['layout'])
                envelope = output['artifactEnvelope']
                document = envelope['artifact']['document'] if envelope else None
                source_descriptions = envelope['artifact'].get('sourceDescriptions', []) if envelope else []
            await gate.unchanged(prepared, write=write)
            record = None
            if document is not None:
                record_operations = deepcopy(args.get('request', {}).get('operations', []))
                if 'plan' in args.get('request', {}):
                    record_operations.append({'type': 'structure_plan', 'plan': deepcopy(args['request']['plan'])})
                if source_descriptions:
                    record_operations.append({'type': 'source_description_evidence', 'descriptors': deepcopy(source_descriptions)})
                record = await candidates.put(prepared, document, record_operations, candidate_ref)
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
    async def discover_data_context(context_ref: str, query: str = '', limit: Annotated[int, Field(ge=1, le=50)] = 10,
                                    business_domain: str | None = None,
                                    offset: Annotated[int, Field(ge=0)] = 0,
                                    data_context_version: str | None = None) -> ToolResult:
        """Search governed data, or enumerate metrics/dimensions with exact business_domain.
        For domain pagination pass range.end as offset and the returned dataContextVersion.
        This reads business metadata, not Skill references or files.
        """
        return await invoke('discover_data_context', context_ref, {'query': query, 'limit': limit,
            'business_domain': business_domain, 'offset': offset, 'data_context_version': data_context_version})

    @mcp.tool(output_schema=RESULT_SCHEMA)
    async def compose_page(context_ref: str, spec: PageBuildSpec, layout: Literal['report', 'dashboard'] = 'report') -> ToolResult:
        """Quick query-driven assembly grouped by scope. For a business report with authored
        sections and reusable data, use create_content_page request.plan instead.
        Never replace an existing baseline.
        """
        return await invoke('compose_page', context_ref, {'spec': spec, 'layout': layout}, write=True, mode='new')

    @mcp.tool(output_schema=RESULT_SCHEMA)
    async def create_content_page(context_ref: str, title: str, request: CompositionRequest,
                                  layout: Literal['report', 'dashboard'] = 'report') -> ToolResult:
        """Create mixed governed data and static content on a new page.

        For full reports use request.plan: governed dataRequests plus explicit business
        sections/blocks. Patterns are defaults; custom allows supported combinations.
        Reuse a source across blocks without another query. Different scopes may share
        a section. Field references use discovered names, not guessed IDs. First-phase
        text is supplied explanation, not invented numerical analysis.
        Legacy request.operations runs in order with dependencies. Target section main;
        page-header is protected. Set span/order with controlled layout/move
        operations. Explicit unsupported components fail; no source tokens or raw
        rows/query/page payloads. Independent success may produce a partial candidate.
        """
        return await invoke('create_content_page', context_ref, {'title': title, 'request': request, 'layout': layout}, write=True, mode='new')

    @mcp.tool(output_schema=RESULT_SCHEMA)
    async def edit_page(context_ref: str, request: UnifiedEditRequest, candidate_ref: str | None = None) -> ToolResult:
        """Apply controlled operations to the complete trusted current baseline, without saving."""
        return await invoke('edit_page', context_ref, {'request': request}, write=True,
                            mode=None if candidate_ref is not None else 'existing', candidate_ref=candidate_ref)

    return mcp
