"""Unified tool surface: every invocation requires a trusted active authoring turn."""
from typing import Annotated, Literal, Any
from copy import deepcopy
from dataclasses import replace

from fastmcp import FastMCP
from fastmcp.tools import ToolResult
from pydantic import Field, WithJsonSchema, BaseModel, ConfigDict
from metriccanvas_authoring.application.page_parameters import PageParameters, parameter_summary

from metriccanvas_authoring.adapters.inbound.content_mcp import create_content_mcp_server, RESULT_SCHEMA
from metriccanvas_authoring.adapters.inbound.fastmcp import PageBuildSpec
from metriccanvas_authoring.application.authoring_turns import AuthoringTurnGate, TurnBaselines, read_page_projection
from metriccanvas_authoring.application.content_ports import ContentBaselineError, ContentBaseline
from metriccanvas_authoring.application.authoring_candidates import AuthoringCandidates
from metriccanvas_authoring.application.summary_capability import summary_configured
from metriccanvas_authoring.application.unified_edit_page import edit_unified_page, UNIFIED_EDIT_SCHEMA
from metriccanvas_authoring.application.bundle_info import load_bundle_info
from metriccanvas_authoring.application.discover_data_context import DiscoverDataContextDependencies, DiscoverDataContextCommand, create_discover_data_context
from metriccanvas_authoring.application.unified_composition import compose_unified_content, COMPOSITION_SCHEMA
from metriccanvas_authoring.application.metric_relations import load_relations
from metriccanvas_authoring.application.structure_revision import REVISION_SCHEMA, revise_structure


UnifiedEditRequest = Annotated[dict[str, Any], WithJsonSchema({'oneOf': [UNIFIED_EDIT_SCHEMA, REVISION_SCHEMA]})]
CompositionRequest = Annotated[dict[str, Any], WithJsonSchema(COMPOSITION_SCHEMA)]

class ParameterTextChoice(BaseModel):
    model_config = ConfigDict(extra='forbid')
    slot_id: Annotated[str, Field(min_length=1, max_length=128)]
    kind: Literal['parameter', 'literal']
    candidate_id: Annotated[str, Field(min_length=1, max_length=128)] | None = None
    text: Annotated[str, Field(max_length=4096)] | None = None


def create_unified_content_mcp_server(dependencies, current_turns=None, *, summary_config=None, candidate_store=None, parameter_dependencies=None):
    gate = AuthoringTurnGate(current_turns)
    candidates = AuthoringCandidates(candidate_store)
    parameters = PageParameters(gate, candidates, parameter_dependencies)
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
                if found.ok:
                    domains = [args['business_domain']] if args.get('business_domain') else []
                    relation_items, relation_status = [], 'unknown'
                    for domain in domains:
                        items, relation_status = await load_relations(dependencies.metric_relations, dict(prepared.binding),
                                                                     found.data_context_version, domain)
                        relation_items.extend(items)
                    payload['metricRelations'] = {'status': relation_status, 'entries': relation_items[:50],
                                                   'truncated': max(0, len(relation_items)-50)}
                    payload['coverage'] = {'businessDomain': args.get('business_domain'), 'returned': len(found.matches),
                                           'snapshot': found.data_context_version, 'bounded': True}
                    from metriccanvas_authoring.domain.structure_presentation import capabilities
                    payload['structureCapabilities'] = capabilities()
                    payload['structureVersions'] = payload['structureCapabilities']['versions']
                    await gate.unchanged(prepared)
                return ToolResult(content=payload, structured_content=payload)
            if name == 'create_content_page':
                if not isinstance(args['title'], str) or not args['title'].strip():
                    summary={'status':'rejected','operations':[], 'issues':[{'code':'CREATION_TITLE_REQUIRED','path':'/title','rule':'required'}]}
                    return ToolResult(content=summary, structured_content={'ok':False,'artifactEnvelope':None,'modelSummary':summary})
                edited = await compose_unified_content(prepared.binding['pageId'], args['title'], args['layout'], args['request'],
                    scoped_dependencies, summary_enabled=summary_configured(summary_config),
                    current=lambda: gate.unchanged(prepared, write=True))
                document = edited['document']
                source_descriptions = edited.get('sourceDescriptions', [])
                output = {'ok': document is not None, 'artifactEnvelope': None,
                          'modelSummary': {key: edited[key] for key in ('status', 'operations', 'issues')}}
                output['modelSummary'].update({key: edited[key] for key in ('appliedAdjustments', 'overlapFindings', 'truncation', 'queryCounts') if key in edited})
            elif name == 'edit_page':
                baseline = parent['document'] if parent is not None else prepared.baseline.document
                if 'structureRevision' in args['request']:
                    edited = await revise_structure(parent, args['request'], scoped_dependencies,
                        current=lambda: gate.unchanged(prepared, write=True))
                else:
                    prior = [o['state'] for o in parent['operations'] if o.get('type') == 'structure_state'] if parent else []
                    edited = await edit_unified_page(baseline, args['request'], scoped_dependencies,
                        summary_enabled=summary_configured(summary_config), current=lambda: gate.unchanged(prepared, write=True),
                        structure_state=prior[-1] if prior else None)
                    if prior: edited['structureState'] = deepcopy(prior[-1])
                summary = {key: edited[key] for key in ('status', 'operations', 'issues')}
                summary.update({key: edited[key] for key in ('appliedAdjustments', 'overlapFindings', 'queryCounts', 'truncation') if key in edited})
                document = edited['document']
                source_descriptions = edited.get('sourceDescriptions', [])
                output = {'ok': edited['status'] in {'changed', 'partial', 'unchanged'}, 'artifactEnvelope': None, 'modelSummary': summary}
            else:
                output = None
            if output is None:
                if name in {'compose_page', 'create_content_page'}:
                    args['page_id'] = prepared.binding['pageId']
                if name == 'edit_page': args['baseline_token'] = context_ref
                # Existing content algorithms remain private, never registered as a bypass.
                legacy = create_content_mcp_server(scoped_dependencies, TurnBaselines(prepared), summary_config=summary_config)
                tool = await legacy.get_tool(name)
                result = await tool.run(args)
                if not write:
                    await gate.unchanged(prepared)
                    return result
                output = deepcopy(result.structured_content)
                envelope = output['artifactEnvelope']
                document = envelope['artifact']['document'] if envelope else None
                source_descriptions = envelope['artifact'].get('sourceDescriptions', []) if envelope else []
            await gate.unchanged(prepared, write=write)
            record = None
            if document is not None:
                record_operations = deepcopy(args.get('request', {}).get('operations', []))
                if 'plan' in args.get('request', {}):
                    record_operations.append({'type': 'structure_plan', 'plan': deepcopy(args['request']['plan'])})
                if name in {'create_content_page', 'edit_page'} and edited.get('structureState'):
                    record_operations.append({'type': 'structure_state', 'state': deepcopy(edited['structureState'])})
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
            declarations = parameter_summary(view.baseline.document) if view.baseline else []
            result['parameters'] = declarations[:100]
            result['parametersOmitted'] = max(0, len(declarations) - 100)
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
    async def create_content_page(context_ref: str, request: CompositionRequest, title: str | None = None,
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

    async def parameter_call(operation):
        try:
            output = await operation
            return ToolResult(content=output['modelSummary'], structured_content=output)
        except ContentBaselineError as error:
            return failure(error)

    @mcp.tool(output_schema=RESULT_SCHEMA)
    async def extract_page_parameters(context_ref: str, candidate_ref: str | None = None) -> ToolResult:
        """Extract choices from a trusted DQE-verified page; no execution or asset save.

        Baseline and dimension identities come from the provider, not model input.
        Returned choice IDs differ from page parameter IDs. Values are omitted.
        """
        return await parameter_call(parameters.extract(context_ref, candidate_ref))

    @mcp.tool(output_schema=RESULT_SCHEMA)
    async def apply_page_parameter_selection(context_ref: str, extraction_ref: str,
            selected_ids: Annotated[list[str], Field(max_length=100)],
            text_choices: Annotated[list[ParameterTextChoice], Field(max_length=200)] = []) -> ToolResult:
        """Build an unfilled template candidate from selected choice IDs and text slots.

        A parameter choice has candidate_id only; a literal choice has text only.
        This never confirms or publishes. Source changes invalidate extraction.
        """
        choices = [c.model_dump(exclude_none=True) for c in text_choices]
        if any((c['kind'] == 'parameter' and set(c) != {'slot_id', 'kind', 'candidate_id'}) or
               (c['kind'] == 'literal' and set(c) != {'slot_id', 'kind', 'text'}) for c in choices):
            return failure(ContentBaselineError('PARAMETER_TEXT_CHOICE_INVALID'))
        return await parameter_call(parameters.apply(context_ref, extraction_ref, selected_ids, choices))

    @mcp.tool(output_schema=RESULT_SCHEMA)
    async def resolve_page_parameters(context_ref: str, values: dict[str, Any],
                                      candidate_ref: str | None = None) -> ToolResult:
        """Fill a trusted page with canonical typed inputs; return a temporary instance.

        No DQE execution or save. Missing/invalid input fails, never falls back.
        The host consumes instance_ref through the trusted program channel.
        """
        return await parameter_call(parameters.resolve(context_ref, values, candidate_ref))

    return mcp
