"""One-call structure orchestration with deterministic partial results and trusted evidence."""
from copy import deepcopy
from dataclasses import replace
from metriccanvas_authoring.application.bundle_info import load_bundle_info
from metriccanvas_authoring.application.compose_page import create_compose_page, ComposePageCommand
from metriccanvas_authoring.application.metric_relations import load_relations
from metriccanvas_authoring.application.structure_query_cache import StructureQueryCache
from metriccanvas_authoring.domain.page_structure import block_component, scope_notes, StructureError, validate_plan
from metriccanvas_authoring.domain.structure_preflight import inspect_plan, query_signature
from metriccanvas_authoring.domain.page_validation import validate_page_document
from metriccanvas_authoring.domain.section_presentation import pack_section


async def compose_structure(page_id, title, layout, plan, dependencies, *, current, cached=None):
    check = inspect_plan(plan)
    base = {'operations': [], 'issues': check['issues'], 'overlapFindings': check['overlapFindings'],
            'appliedAdjustments': [], 'truncation': check['truncation'], 'sourceDescriptions': []}
    def failure(code):
        return {**base, 'status': 'failed', 'document': None, 'issues': [{'code': code, 'path': ''}]}
    if check['fatal'] or (plan.get('version') == '1' and check['issues']):
        return {**base, 'status': 'failed', 'document': None}
    if plan['version'] == '1':
        try: validate_plan(plan)
        except StructureError as error: return failure(error.code)
    try:
        snapshot = await dependencies.data_context.current()
    except Exception:
        return failure('DATA_CONTEXT_UNAVAILABLE')
    queries = StructureQueryCache(dependencies.dqe, dependencies.authoring_scope, snapshot, cached)
    deps = replace(dependencies, component_policy=None, dqe=queries)
    sources, evidence, relations_by_source, results, failed_sources = {}, [], {}, [], set()
    bad_blocks = {id for i in check['issues'] if '/blocks/' in i['path'] for id in i['objectIds'][:1]}
    used = {b['source'] for s in plan['sections'] for b in s['blocks'] if b['type'] == 'data' and b['id'] not in bad_blocks}
    requests = {r['dataSourceId']: r for r in plan['dataRequests']}
    cache = {}
    for source_id, request in requests.items():
        if source_id not in used: continue
        await current()
        signature = query_signature(request, plan['dataContextVersion'])
        if signature not in cache:
            spec = {'question': plan['question'], 'dataContextVersion': plan['dataContextVersion'],
                    'units': [{**request, 'intent': 'detail', 'pinnedComponent': 'table'}]}
            cache[signature] = await create_compose_page(deps)(ComposePageCommand(page_id, spec))
            await current()
        built = cache[signature]
        if not built.ok or built.artifact is None:
            failed_sources.add(source_id)
            results.append({'id': source_id, 'status': 'failed', 'issues': [
                {'code': i.code, 'path': i.path} for i in built.issues], 'adjustments': []})
            continue
        sources[source_id] = deepcopy(next(iter(built.artifact.document['dataSources'].values())))
        execution = queries.for_source(sources[source_id])
        if execution is not None and 'initial' in sources[source_id]['source']:
            sources[source_id]['source']['initial']['rows'] = deepcopy(list(execution.rows))
        for description in built.artifact.source_descriptions:
            if description not in evidence: evidence.append(deepcopy(description))
        relations, _ = await load_relations(dependencies.metric_relations, dependencies.authoring_scope,
                                            plan['dataContextVersion'], request['businessDomain'])
        period = {k: v for k, v in (request.get('time') or {}).items() if k != 'providedBy'}
        relations_by_source[source_id] = [r for r in relations if r['time'] == period]
    document = {'schemaVersion': load_bundle_info()['pageSchemaVersion'], 'id': page_id, 'layout': layout,
                'dataSources': {}, 'sections': [{'id': 'header', 'container': 'plain', 'components': [
                    {'id': 'page-header', 'type': 'reportHeader', 'layout': {'span': 12}, 'props': {'title': title}}]}]}
    applied, adjustments = 0, []
    for si, section in enumerate(plan['sections']):
        target = {'id': section['id'], 'container': section.get('container', 'panel'), 'components': []}
        if 'title' in section: target['title'] = section['title']
        if plan['version']=='3' and 'container' not in section:
            adjustments.append({'rule':'default-section-container','objectId':section['id'],'container':'panel'})
        applied_sources = []
        for bi, block in enumerate(section['blocks']):
            await current()
            try:
                if block['id'] in bad_blocks: raise StructureError('STRUCTURE_PREFLIGHT_BLOCKED')
                if block.get('source') in failed_sources: raise StructureError('STRUCTURE_SOURCE_FAILED')
                component = block_component(block, sources, section['pattern'], relations=relations_by_source.get(block.get('source'), []))
                trial = deepcopy(document)
                trial['dataSources'].update(sources)
                trial['sections'].append({**target, 'components': target['components'] + [component]})
                if validate_page_document(trial): raise StructureError('STRUCTURE_COMPONENT_INVALID')
                target['components'].append(component)
                changes = []
                if plan['version']=='3' and 'width' not in block:
                    changes.append({'rule':'default-component-width','objectId':block['id'],'span':component['layout']['span']})
                if block.get('presentation'):
                    changes.append({'rule': 'registered-'+block['presentation']['kind'], 'objectId': block['id'],
                                'variant': component['props'].get('variant', component['type'])})
                adjustments.extend(changes)
                results.append({'id': block['id'], 'status': 'applied', 'issues': [], 'adjustments': changes})
                applied += 1
                if block.get('source'): applied_sources.append(block['source'])
            except StructureError as error:
                results.append({'id': block['id'], 'status': 'failed', 'issues': [{**error.issue(),
                                'path': f'/sections/{si}/blocks/{bi}', 'objectIds': [block['id']], 'blocking': True}], 'adjustments': []})
                target['components'].append({'id': 'structure-missing-' + block['id'], 'type': 'text',
                    'layout': {'span': 12}, 'props': {'body': f'未生成「{block.get("title", block["id"])}」：{error.code}。'}})
        if plan['version'] in {'2','3'}:
            adjustments.extend(pack_section(target['components'], section['blocks']))
        notes = scope_notes(requests[k] for k in applied_sources)
        if notes and plan['version'] != '3':
            target['components'].append({'id': 'structure-scope-' + section['id'], 'type': 'text', 'layout': {'span': 12},
                                         'props': {'body': '数据口径：\n' + '\n'.join(notes)}})
        document['sections'].append(target)
    bound = {c['data']['main'] for s in document['sections'] for c in s['components'] if 'data' in c}
    document['dataSources'] = {k: v for k, v in sources.items() if k in bound}
    from metriccanvas_authoring.domain.structure_scope import refresh_scope
    refresh_scope(document, plan)
    if not applied: return {**base, 'status': 'failed', 'document': None, 'operations': results}
    if validate_page_document(document): return failure('STRUCTURE_RESULT_INVALID')
    await current()
    return {**base, 'status': 'partial' if check['issues'] or any(r['status'] == 'failed' for r in results) else 'changed',
            'document': document, 'operations': results, 'sourceDescriptions': evidence, 'appliedAdjustments': adjustments,
            'queryCounts': {'executed': queries.executions, 'reused': queries.hits},
            'structureState': {'plan': deepcopy(plan), 'queries': queries.entries, 'relations': relations_by_source}}
