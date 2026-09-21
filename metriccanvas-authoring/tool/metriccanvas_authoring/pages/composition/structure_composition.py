"""Create explicit business sections using governed query and candidate services."""
from copy import deepcopy
import json

from metriccanvas_authoring.application.bundle_info import load_bundle_info
from metriccanvas_authoring.data.query import create_query_data
from metriccanvas_authoring.pages.composition.page_building import build_query_source
from metriccanvas_authoring.pages.composition.page_structure import validate_plan, block_component, scope_note, StructureError
from metriccanvas_authoring.domain.page_validation import validate_page_document


async def compose_structure(page_id, title, layout, plan, dependencies, *, current):
    def failure(issue):
        return {'status': 'failed', 'document': None, 'operations': [], 'issues': [issue], 'sourceDescriptions': []}
    try:
        validate_plan(plan)
    except StructureError as error:
        return failure(error.issue())
    document = {'schemaVersion': load_bundle_info()['pageSchemaVersion'], 'id': page_id, 'layout': layout,
                'dataSources': {}, 'sections': [{'id': 'header', 'container': 'plain', 'components': [
                    {'id': 'page-header', 'type': 'reportHeader', 'layout': {'span': 12}, 'props': {'title': title}}]}]}
    # Cache only within this trusted call; identity, snapshot and constraints are shared.
    cache, sources, evidence, results, failed_sources = {}, {}, [], [], set()
    requests = {r['dataSourceId']: r for r in plan['dataRequests']}
    for source_id, request in requests.items():
        await current()
        signature = json.dumps({k: v for k, v in request.items() if k != 'dataSourceId'}, sort_keys=True, ensure_ascii=False)
        if signature not in cache:
            spec = {'question': plan['question'], 'dataContextVersion': plan['dataContextVersion'],
                    'units': [{**request, 'intent': 'detail', 'pinnedComponent': 'table'}]}
            # Fetch verified data independently of the presentation policy.
            built = await create_query_data(dependencies)(spec)
            await current()
            cache[signature] = built
        built = cache[signature]
        if not built.ok:
            failed_sources.add(source_id)
            results.append({'id': source_id, 'status': 'failed', 'issues': [
                {'code': i.code, 'path': i.path} for i in built.issues], 'adjustments': []})
            continue
        source = build_query_source(built.units[0], built.executions[0])
        sources[source_id] = deepcopy(source)
        for description in built.source_descriptions:
            if description not in evidence:
                evidence.append(deepcopy(description))
    applied = 0
    for section in plan['sections']:
        target = {'id': section['id'], 'title': section['title'], 'container': section.get('container', 'panel'), 'components': []}
        for block in section['blocks']:
            await current()
            try:
                if block.get('source') in failed_sources:
                    raise StructureError('STRUCTURE_SOURCE_FAILED')
                component = block_component(block, sources, section['pattern'])
                trial = deepcopy(document)
                trial['dataSources'].update(sources)
                trial['sections'].append({**target, 'components': target['components'] + [component]})
                if validate_page_document(trial):
                    raise StructureError('STRUCTURE_COMPONENT_INVALID')
                target['components'].append(component)
                results.append({'id': block['id'], 'status': 'applied', 'issues': [], 'adjustments': []})
                applied += 1
            except StructureError as error:
                results.append({'id': block['id'], 'status': 'failed', 'issues': [error.issue()], 'adjustments': []})
                target['components'].append({'id': 'structure-missing-' + block['id'], 'type': 'text',
                    'layout': {'span': 12}, 'props': {'body': f"未生成「{block.get('title', block['id'])}」：{error.code}。"}})
        # Keep scope on the page without using it to partition the business chapter.
        used = list(dict.fromkeys(b['source'] for b in section['blocks'] if b.get('source') in sources))
        if used:
            target['components'].append({'id': 'structure-scope-' + section['id'], 'type': 'text', 'layout': {'span': 12},
                                         'props': {'body': '数据口径：\n' + '\n'.join(scope_note(requests[k]) for k in used)}})
        document['sections'].append(target)
    bound = {c['data']['main'] for s in document['sections'] for c in s['components'] if 'data' in c}
    document['dataSources'] = {k: v for k, v in sources.items() if k in bound}
    if not applied:
        return {'status': 'failed', 'document': None, 'operations': results, 'issues': [], 'sourceDescriptions': []}
    if validate_page_document(document):
        return failure({'code': 'STRUCTURE_RESULT_INVALID', 'path': ''})
    await current()
    return {'status': 'partial' if any(r['status'] == 'failed' for r in results) else 'changed',
            'document': document, 'operations': results, 'issues': [], 'sourceDescriptions': evidence}
