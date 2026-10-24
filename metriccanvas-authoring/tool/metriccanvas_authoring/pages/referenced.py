from __future__ import annotations
from metriccanvas_authoring.pages.composition.paged_join import build_paged_join, referenced_definitions
"""Page expression from verified results; this module never executes DQE."""
from copy import deepcopy
from metriccanvas_authoring.pages.scope_annotations import refresh, source_contract, data_locations
from jsonschema import Draft202012Validator
from metriccanvas_authoring.bundle_info import load_bundle_info
from metriccanvas_authoring.pages.composition.page_structure import SECTION, ID, NAME, TEXT, DATA_BLOCK, obj, block_component, StructureError
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document
from metriccanvas_authoring.pages.editing.page_editing import EDIT_SCHEMA, apply_page_operation
from metriccanvas_authoring.pages.editing.section_editing import SECTION_OPERATIONS, SECTION_TYPES, edit_section
from metriccanvas_authoring.pages.editing.operation_batch import operation_batch
from metriccanvas_authoring.pages.composition.section_layout import pack_section_spans
from metriccanvas_authoring.pages.composition.table_pagination import add_query_table_pagination, _components
from metriccanvas_authoring.pages.input_tolerance import normalize_compose, compose_envelope

from metriccanvas_authoring.pages.compose_contract import (
    SOURCE_REFS, RESULT_SECTION, DATE_FILTER_OPERATIONS, COMPOSE_SCHEMA,
)
RESULT_OPERATION = obj({'id': ID, 'type': {'const': 'add_result_component'}, 'sectionId': ID,
    'resultRef': NAME, 'block': DATA_BLOCK,
    'dependsOn': {'type': 'array', 'items': ID}}, ['id', 'type', 'sectionId', 'resultRef', 'block'])
EDIT_RESULT_SCHEMA = deepcopy(EDIT_SCHEMA)
EDIT_RESULT_SCHEMA['properties']['operations']['items']['oneOf'].extend([*SECTION_OPERATIONS, RESULT_OPERATION])


def incomplete_initial(source, record):
    initial = source['source'].get('initial', {})
    return record['totalCount'] is None or len(initial.get('rows', [])) != record['totalCount']


def pack_default_widths(components, blocks):
    """Fill incomplete default rows; explicitly requested widths are pinned."""
    pinned = {block['id'] for block in blocks if 'width' in block}
    row = []
    used = 0
    def flush():
        if row and not any(component['id'] in pinned for component in row):
            for component, span in zip(row, pack_section_spans([c['layout']['span'] for c in row]), strict=True):
                component['layout']['span'] = span
    for component in components:
        span = component['layout']['span']
        if used + span > 12:
            flush(); row = []; used = 0
        row.append(component); used += span
    flush()


def compose(prepared, request, records):
    request, adjustments = normalize_compose(request, COMPOSE_SCHEMA)
    require_valid = Draft202012Validator(compose_envelope(COMPOSE_SCHEMA)).is_valid(request)
    if not require_valid:
        return {'status': 'failed', 'document': None, 'operations': [], 'issues': [{'code': 'COMPOSE_REQUEST_INVALID', 'path': ''}]}
    sections = request['sections']
    ids = [b['id'] for s in sections for b in s['blocks']]
    section_ids = [s['id'] for s in sections]
    generated = {'page-header'} | {'structure-scope-' + i for i in section_ids} | {'structure-missing-' + i for i in ids}
    if len(ids) != len(set(ids)) or len(section_ids) != len(set(section_ids)) or 'header' in section_ids or set(ids) & generated or len(ids) > 50:
        return {'status': 'failed', 'document': None, 'operations': [], 'issues': [{'code': 'STRUCTURE_ID_CONFLICT', 'path': ''}]}
    sources = {key: deepcopy(value['source']) for key, value in records.items() if value is not None}
    combinations=request.get('pagedJoins',{})
    try:
        for key,spec in combinations.items():sources[key]=build_paged_join(sources,spec)
    except (KeyError,TypeError):
        return {'status':'failed','document':None,'operations':[],'issues':[{'code':'COMPOSE_REQUEST_INVALID','path':'/pagedJoins'}]}
    document = {'id': prepared.binding['pageId'], 'schemaVersion': load_bundle_info()['pageSchemaVersion'],
        'layout': request.get('layout', 'report'), 'dataSources': {}, 'sections': [
            {'id': 'header', 'container': 'plain', 'components': [{'id': 'page-header', 'type': 'reportHeader', 'layout': {'span': 12}, 'props': {'title': request['title']}}]}]}
    outcomes = []
    scope_annotations = {}
    for si, section in enumerate(sections):
        target = {k: deepcopy(section[k]) for k in ('id', 'title') if k in section}
        target.update(container=section.get('container', 'panel'), components=[])
        used = []
        for bi, block in enumerate(section['blocks']):
            try:
                if not Draft202012Validator(RESULT_SECTION['properties']['blocks']['items']).is_valid(block):
                    raise StructureError('STRUCTURE_BLOCK_INVALID', f'/sections/{si}/blocks/{bi}')
                record = records.get(block.get('source'))
                component = block_component(block, sources, section['pattern'],
                    relations=record.get('relations', ()) if record else (), evidence=record)
                trial = deepcopy(document)
                trial['dataSources'].update({key:value for key,value in sources.items() if key not in combinations})
                for existing in [*target['components'],component]:
                    root=existing.get('data',{}).get('main')
                    if root in combinations:trial['dataSources'].update(referenced_definitions(sources,root))
                trial['sections'].append({**target, 'components': target['components'] + [component]})
                if validate_page_document(trial): raise StructureError('STRUCTURE_COMPONENT_INVALID')
                target['components'].append(component)
                if (block.get('component') == 'pieChart' or block.get('match')) and incomplete_initial(sources[block['source']], record):
                    # Query again on render; an embedded sample is not a whole.
                    sources[block['source']]['source'].pop('initial', None)
                if block.get('source') in sources:
                    used.append(block['source'])
                outcomes.append({'id': block['id'], 'status': 'applied', 'issues': [], 'adjustments': []})
            except StructureError as error:
                outcomes.append({'id': block['id'], 'status': 'failed', 'issues': [error.issue()], 'adjustments': []})
                target['components'].append({'id': 'structure-missing-' + block['id'], 'type': 'text', 'layout': {'span': 12}, 'props': {'body': f"未生成「{block.get('title', block['id'])}」：{error.code}。"}})
        if used:
            for key in used:document['dataSources'].update(referenced_definitions(sources,key))
        pack_default_widths(target['components'], section['blocks'])
        document['sections'].append(target)
    for op in request.get('dateFilters', []):
        candidate, issues, _ = apply_page_operation(deepcopy(document), op)
        if candidate is None or validate_page_document(candidate):
            return {'status': 'failed', 'document': None, 'operations': outcomes, 'issues': [{'code': 'COMPOSE_DATE_FILTER_INVALID', 'path': '/dateFilters'}]}
        document = candidate
    add_query_table_pagination(document)
    applied = any(o['status'] == 'applied' for o in outcomes)
    if not applied or validate_page_document(document):
        return {'status': 'failed', 'document': None, 'operations': outcomes, 'issues': [{'code': 'COMPOSE_RESULT_INVALID', 'path': ''}]}
    return {'status': 'partial' if any(o['status'] == 'failed' for o in outcomes) else 'changed', 'document': document, 'operations': outcomes, 'issues': [], 'adjustments': adjustments, 'scopeAnnotations': scope_annotations}


async def edit(baseline, request, resolve, current, summary_enabled=False, scope_annotations=None):
    notes = deepcopy(scope_annotations or {})
    batch = operation_batch(baseline, request, EDIT_RESULT_SCHEMA['properties']['operations']['items'])
    result = None
    while True:
        await current()
        try: document, op = batch.send(result)
        except StopIteration as completed:
            value = completed.value
            if value['document'] is not None:
                notes, adjustments = refresh(value['document'], notes)
                if (data_locations(baseline) != data_locations(value['document']) or baseline['dataSources'] != value['document']['dataSources']) and any(
                        c['id'].startswith(('structure-scope-', 'result-scope-', 'scope-')) and c['id'] not in (scope_annotations or {})
                        for section in baseline['sections'] for c in section['components']):
                    adjustments.append({'code': 'SCOPE_NOTE_REVIEW_REQUIRED', 'path': '/sections'})
                value['adjustments'] = adjustments
                value['scopeAnnotations'] = notes
                if validate_page_document(value['document']):
                    return {'status': 'failed', 'document': None, 'operations': value['operations'],
                            'issues': [{'code': 'EDIT_RESULT_INVALID', 'path': ''}]}
            return value
        if op['type'] == 'add_result_component':
            from metriccanvas_authoring.work.content_ports import ContentBaselineError
            try:
                record = await resolve(op['resultRef'])
                source_id = op['block']['source']
                source = deepcopy(record['source'])
                existing = document['dataSources'].get(source_id)
                paginated = any(c.get('type') == 'table' and c.get('data', {}).get('main') == source_id
                                and c['props'].get('pagination', {}).get('mode') == 'query'
                                for c in _components(document))
                if existing is not None:
                    existing_contract, requested_contract = source_contract(existing), source_contract(source)
                    if paginated and source['source']['type'] == 'query':
                        # Only the table's first-window offset/limit may differ.
                        # Fields, filters, sorting and the remaining query stay exact.
                        existing_order = existing_contract['source']['query']['body']['dsl_list'][0].get('order', {})
                        requested_order = requested_contract['source']['query']['body']['dsl_list'][0].get('order', {})
                        for key in ('offset', 'limit'):
                            if key not in requested_order:
                                existing_order.pop(key, None)
                    if existing_contract != requested_contract:
                        raise StructureError('DATA_SOURCE_CONFLICT')
                operation = deepcopy({k: v for k, v in op.items() if k != 'resultRef'})
                adjustments = []
                if paginated:
                    base = f"{source_id[:48]}-{op['block']['id'][:48]}"
                    source_id = base
                    suffix = 1
                    while source_id in document['dataSources']:
                        source_id = f'{base}-{suffix}'
                        suffix += 1
                    operation['block']['source'] = source_id
                    adjustments.append({'code': 'SOURCE_ISOLATED_FOR_QUERY_PAGINATION', 'path': '/dataSources/' + source_id})
                if source_id not in document['dataSources']:
                    document['dataSources'][source_id] = source
                operation['type'] = 'add_source_component'
                candidate = edit_section(document, operation, relations=record.get('relations', ()), evidence=record)
                if (op['block'].get('component') == 'pieChart' or op['block'].get('match')) and incomplete_initial(source, record):
                    candidate['dataSources'][source_id]['source'].pop('initial', None)
                result = candidate, [], adjustments
            except (StructureError, ContentBaselineError) as error:
                result = None, [{'code': error.code, 'path': ''}], []
        elif op['type'] in SECTION_TYPES:
            try: result = edit_section(document, op), [], []
            except StructureError as error: result = None, [error.issue()], []
        else:
            result = apply_page_operation(document, op, summary_enabled=summary_enabled)
