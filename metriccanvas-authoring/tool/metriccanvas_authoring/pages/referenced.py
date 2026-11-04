from __future__ import annotations
from metriccanvas_authoring.pages.composition.paged_join import build_paged_join, referenced_definitions
"""Page expression from verified results; this module never executes DQE."""
from copy import deepcopy
from metriccanvas_authoring.work.diagnostics import public_issue
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



def failed_block_outcome(block_id, error, section_index, block_index):
    path = error.path if error.path.startswith('/sections/') else f'/sections/{section_index}/blocks/{block_index}' + error.path
    return {'id': block_id, 'status': 'failed', 'component': {'id': 'structure-missing-' + block_id, 'type': 'text'},
            'issues': [{**error.issue(), 'path': path, 'pathScope': 'input', 'blockId': block_id}], 'adjustments': []}


def _failed_compose(code, path='', operations=None):
    return {'status': 'failed', 'document': None, 'operations': operations or [],
            'issues': [{'code': code, 'path': path}]}


def _structure_ids_valid(sections):
    ids = [b['id'] for section in sections for b in section['blocks']]
    section_ids = [section['id'] for section in sections]
    generated = {'page-header'} | {'structure-scope-' + i for i in section_ids} | {'structure-missing-' + i for i in ids}
    return (len(ids) == len(set(ids)) and len(section_ids) == len(set(section_ids))
            and 'header' not in section_ids and not set(ids) & generated and len(ids) <= 50)


def _trial_component(document, target, component, sources, combinations, validation):
    trial = deepcopy(document)
    trial['dataSources'].update({key: value for key, value in sources.items() if key not in combinations})
    for existing in [*target['components'], component]:
        root = existing.get('data', {}).get('main')
        if root in combinations:
            trial['dataSources'].update(referenced_definitions(sources, root))
    trial['sections'].append({**target, 'components': target['components'] + [component]})
    if validate_page_document(trial, **validation):
        raise StructureError('STRUCTURE_COMPONENT_INVALID')


def _compose_block(document, target, section, block, sources, combinations, records, validation, multislot):
    schema = RESULT_SECTION['properties']['blocks']['items']
    if multislot and 'tableSlots' in block:
        from metriccanvas_authoring.pages.multislot_contract import MULTISLOT_BLOCK
        schema = MULTISLOT_BLOCK
    if not Draft202012Validator(schema).is_valid(block):
        raise StructureError('STRUCTURE_BLOCK_INVALID')
    record = records.get(block.get('source'))
    component = block_component(block, sources, section['pattern'],
                                relations=record.get('relations', ()) if record else (), evidence=record, evidence_records=records)
    _trial_component(document, target, component, sources, combinations, validation)
    target['components'].append(component)
    if (block.get('component') == 'pieChart' or block.get('match')) and incomplete_initial(sources[block['source']], record):
        sources[block['source']]['source'].pop('initial', None)
    adjustments = []
    if 'tableSlots' in block:
        from metriccanvas_authoring.pages.components.multislot_table import slot_coverage
        adjustments = [{'code': 'TABLE_SLOT_ALIGNMENT_COVERAGE', 'slots': slot_coverage(block, sources, records)}]
    return {'id': block['id'], 'status': 'applied', 'component': {'id': component['id'], 'type': component['type']},
            'issues': [], 'adjustments': adjustments}


def _compose_section(document, section, si, sources, combinations, records, validation, multislot):
    target = {k: deepcopy(section[k]) for k in ('id', 'title') if k in section}
    target.update(container=section.get('container', 'panel'), components=[])
    outcomes, used = [], []
    for bi, block in enumerate(section['blocks']):
        try:
            outcomes.append(_compose_block(document, target, section, block, sources, combinations, records, validation, multislot))
            used.extend(target['components'][-1].get('data', {}).values())
        except StructureError as error:
            outcomes.append(failed_block_outcome(block['id'], error, si, bi))
            target['components'].append({'id': 'structure-missing-' + block['id'], 'type': 'text',
                'layout': {'span': 12}, 'props': {'body': f"未生成「{block.get('title', block['id'])}」：{error.code}。"}})
    for key in used:
        document['dataSources'].update(referenced_definitions(sources, key))
    pack_default_widths(target['components'], section['blocks'])
    document['sections'].append(target)
    return outcomes


def compose_candidate(page_id, schema_version, request, records, *, page_schema=None, node_resources=None,
                      compose_schema=None):
    """Explicit result evidence to candidate page; no Prepared object or execution."""
    validation = _validation_options(page_schema, node_resources)
    compose_schema = compose_schema or COMPOSE_SCHEMA
    request, adjustments = normalize_compose(request, compose_schema)
    if not Draft202012Validator(compose_envelope(compose_schema)).is_valid(request):
        return _failed_compose('COMPOSE_REQUEST_INVALID')
    if not _structure_ids_valid(request['sections']):
        return _failed_compose('STRUCTURE_ID_CONFLICT')
    combinations = request.get('pagedJoins', {})
    try:
        sources = _compose_sources(records, combinations)
    except (KeyError, TypeError):
        return _failed_compose('COMPOSE_REQUEST_INVALID', '/pagedJoins')
    document = {'id': page_id, 'schemaVersion': schema_version,
        'layout': request.get('layout', 'report'), 'dataSources': {}, 'sections': [
            {'id': 'header', 'container': 'plain', 'components': [{'id': 'page-header', 'type': 'reportHeader',
                'layout': {'span': 12}, 'props': {'title': request['title']}}]}]}
    outcomes = []
    for si, section in enumerate(request['sections']):
        outcomes.extend(_compose_section(document, section, si, sources, combinations, records, validation, compose_schema is not COMPOSE_SCHEMA))
    for op in request.get('dateFilters', []):
        candidate, issues, _ = apply_page_operation(deepcopy(document), op)
        if candidate is None or validate_page_document(candidate, **validation):
            return _failed_compose('COMPOSE_DATE_FILTER_INVALID', '/dateFilters', outcomes)
        document = candidate
    add_query_table_pagination(document)
    if not any(o['status'] == 'applied' for o in outcomes) or validate_page_document(document, **validation):
        return _failed_compose('COMPOSE_RESULT_INVALID', operations=outcomes)
    return {'status': 'partial' if any(o['status'] == 'failed' for o in outcomes) else 'changed',
            'document': document, 'operations': outcomes, 'issues': [], 'adjustments': adjustments, 'scopeAnnotations': {}}


def compose(prepared, request, records):
    return compose_candidate(prepared.binding['pageId'], load_bundle_info()['pageSchemaVersion'], request, records)


def _compatible_source(document, source_id, source, paginated):
    existing = document['dataSources'].get(source_id)
    if existing is None:
        return
    existing_contract, requested_contract = source_contract(existing), source_contract(source)
    if paginated and source['source']['type'] == 'query':
        existing_order = existing_contract['source']['query']['body']['dsl_list'][0].get('order', {})
        requested_order = requested_contract['source']['query']['body']['dsl_list'][0].get('order', {})
        for key in ('offset', 'limit'):
            if key not in requested_order:
                existing_order.pop(key, None)
    if existing_contract != requested_contract:
        raise StructureError('DATA_SOURCE_CONFLICT')


def _result_operation(document, op, record):
    if record is None:
        raise StructureError('RESULT_EVIDENCE_MISSING', '/resultRef')
    source_id = op['block']['source']
    source = deepcopy(record['source'])
    paginated = any(c.get('type') == 'table' and c.get('data', {}).get('main') == source_id
                    and c['props'].get('pagination', {}).get('mode') == 'query' for c in _components(document))
    _compatible_source(document, source_id, source, paginated)
    operation = deepcopy({k: v for k, v in op.items() if k != 'resultRef'})
    adjustments = []
    if paginated:
        base = f"{source_id[:48]}-{op['block']['id'][:48]}"
        source_id, suffix = base, 1
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
    return candidate, [], adjustments


def _edit_operation(document, op, record, summary_enabled, records=None):
    if op['type'] == 'extend_multislot_table':
        from metriccanvas_authoring.pages.components.multislot_editing import extend_multislot_table
        return extend_multislot_table(document, op, records or {})
    if op['type'] == 'add_multislot_table':
        from metriccanvas_authoring.pages.components.multislot_editing import add_multislot_table
        return add_multislot_table(document, op, records or {})
    if op['type'] != 'add_result_component' and op['type'] not in SECTION_TYPES:
        return apply_page_operation(document, op, summary_enabled=summary_enabled)
    try:
        if op['type'] == 'add_result_component':
            return _result_operation(document, op, record)
        return edit_section(document, op), [], []
    except StructureError as error:
        issue = error.issue() if op['type'] in SECTION_TYPES else public_issue(error)
        return None, [issue], []


def _untracked_scope_changed(baseline, document, scope_annotations):
    changed = data_locations(baseline) != data_locations(document) or baseline['dataSources'] != document['dataSources']
    return changed and any(c['id'].startswith(('structure-scope-', 'result-scope-', 'scope-'))
        and c['id'] not in (scope_annotations or {}) for section in baseline['sections'] for c in section['components'])


def _finish_edit(value, baseline, scope_annotations, validation):
    if value['document'] is None:
        return value
    notes, adjustments = refresh(value['document'], deepcopy(scope_annotations or {}))
    if _untracked_scope_changed(baseline, value['document'], scope_annotations):
        adjustments.append({'code': 'SCOPE_NOTE_REVIEW_REQUIRED', 'path': '/sections'})
    value.update(adjustments=adjustments, scopeAnnotations=notes)
    if validate_page_document(value['document'], **validation):
        return {'status': 'failed', 'document': None, 'operations': value['operations'],
                'issues': [{'code': 'EDIT_RESULT_INVALID', 'path': ''}]}
    return value


def edit_candidate(baseline, request, records, *, summary_enabled=False, scope_annotations=None,
                   page_schema=None, node_resources=None, operation_schema=None):
    """Apply the existing ordered batch using explicit result records only."""
    validation = _validation_options(page_schema, node_resources)
    batch = operation_batch(baseline, request, operation_schema or EDIT_RESULT_SCHEMA['properties']['operations']['items'],
                            validation=validation)
    result = None
    while True:
        try:
            document, op = batch.send(result)
        except StopIteration as completed:
            return _finish_edit(completed.value, baseline, scope_annotations, validation)
        result = _edit_operation(document, op, records.get(op.get('resultRef')), summary_enabled, records)


async def edit(baseline, request, resolve, current, summary_enabled=False, scope_annotations=None):
    """Online compatibility wrapper; current/resolve remain outside product transforms."""
    from metriccanvas_authoring.work.content_ports import ContentBaselineError
    batch = operation_batch(baseline, request, EDIT_RESULT_SCHEMA['properties']['operations']['items'])
    result = None
    while True:
        await current()
        try:
            document, op = batch.send(result)
        except StopIteration as completed:
            return _finish_edit(completed.value, baseline, scope_annotations, {})
        try:
            record = await resolve(op['resultRef']) if op['type'] == 'add_result_component' else None
            result = _edit_operation(document, op, record, summary_enabled)
        except ContentBaselineError as error:
            result = None, [public_issue(error)], []


def _validation_options(page_schema, node_resources):
    # Omit unspecified keywords for the unchanged legacy validator signature.
    options = {}
    if page_schema is not None:
        options['schema'] = page_schema
    if node_resources is not None:
        options['node_resources'] = node_resources
    return options


def _compose_sources(records, combinations):
    sources = {key: deepcopy(value['source']) for key, value in records.items() if value is not None}
    for key, spec in combinations.items():
        sources[key] = build_paged_join(sources, spec)
    return sources
