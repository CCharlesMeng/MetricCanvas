"""Page expression from verified results; this module never executes DQE."""
from copy import deepcopy
from jsonschema import Draft202012Validator
from metriccanvas_authoring.bundle_info import load_bundle_info
from metriccanvas_authoring.pages.composition.page_structure import SECTION, ID, NAME, TEXT, DATA_BLOCK, obj, block_component, scope_note, StructureError
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document
from metriccanvas_authoring.pages.editing.page_editing import EDIT_SCHEMA, apply_page_operation
from metriccanvas_authoring.pages.editing.section_editing import SECTION_OPERATIONS, SECTION_TYPES, edit_section
from metriccanvas_authoring.pages.editing.operation_batch import operation_batch
from metriccanvas_authoring.pages.composition.section_layout import pack_section_spans

SOURCE_REFS = {'type': 'object', 'propertyNames': ID, 'maxProperties': 6, 'additionalProperties': NAME}
# Result-reference composition does not repeat the analysis plan's narrative fields.
RESULT_SECTION = deepcopy(SECTION)
RESULT_SECTION['required'] = ['id', 'pattern', 'blocks']
for block_schema in RESULT_SECTION['properties']['blocks']['items']['oneOf']:
    block_schema['required'] = [key for key in block_schema['required'] if key != 'purpose']
COMPOSE_SCHEMA = obj({'title': TEXT, 'layout': {'enum': ['report', 'dashboard']}, 'sources': SOURCE_REFS,
                      'sections': {'type': 'array', 'minItems': 1, 'maxItems': 12, 'items': RESULT_SECTION}}, ['title', 'sources', 'sections'])
RESULT_OPERATION = obj({'id': ID, 'type': {'const': 'add_result_component'}, 'sectionId': ID,
    'resultRef': NAME, 'block': DATA_BLOCK,
    'dependsOn': {'type': 'array', 'items': ID}}, ['id', 'type', 'sectionId', 'resultRef', 'block'])
EDIT_RESULT_SCHEMA = deepcopy(EDIT_SCHEMA)
EDIT_RESULT_SCHEMA['properties']['operations']['items']['oneOf'].extend([*SECTION_OPERATIONS, RESULT_OPERATION])


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
    require_valid = Draft202012Validator(COMPOSE_SCHEMA).is_valid(request)
    if not require_valid:
        return {'status': 'failed', 'document': None, 'operations': [], 'issues': [{'code': 'COMPOSE_REQUEST_INVALID', 'path': ''}]}
    sections = request['sections']
    ids = [b['id'] for s in sections for b in s['blocks']]
    section_ids = [s['id'] for s in sections]
    generated = {'page-header'} | {'structure-scope-' + i for i in section_ids} | {'structure-missing-' + i for i in ids}
    if len(ids) != len(set(ids)) or len(section_ids) != len(set(section_ids)) or 'header' in section_ids or set(ids) & generated or len(ids) > 50:
        return {'status': 'failed', 'document': None, 'operations': [], 'issues': [{'code': 'STRUCTURE_ID_CONFLICT', 'path': ''}]}
    sources = {key: deepcopy(value['source']) for key, value in records.items() if value is not None}
    document = {'id': prepared.binding['pageId'], 'schemaVersion': load_bundle_info()['pageSchemaVersion'],
        'layout': request.get('layout', 'report'), 'dataSources': {}, 'sections': [
            {'id': 'header', 'container': 'plain', 'components': [{'id': 'page-header', 'type': 'reportHeader', 'layout': {'span': 12}, 'props': {'title': request['title']}}]}]}
    outcomes = []
    for section in sections:
        target = {k: deepcopy(section[k]) for k in ('id', 'title') if k in section}
        target.update(container=section.get('container', 'panel'), components=[])
        used = []
        for block in section['blocks']:
            try:
                component = block_component(block, sources, section['pattern'])
                trial = deepcopy(document)
                trial['dataSources'].update(sources)
                trial['sections'].append({**target, 'components': target['components'] + [component]})
                if validate_page_document(trial): raise StructureError('STRUCTURE_COMPONENT_INVALID')
                target['components'].append(component)
                if block.get('source') in sources: used.append(block['source'])
                outcomes.append({'id': block['id'], 'status': 'applied', 'issues': [], 'adjustments': []})
            except StructureError as error:
                outcomes.append({'id': block['id'], 'status': 'failed', 'issues': [error.issue()], 'adjustments': []})
                target['components'].append({'id': 'structure-missing-' + block['id'], 'type': 'text', 'layout': {'span': 12}, 'props': {'body': f"未生成「{block.get('title', block['id'])}」：{error.code}。"}})
        if used:
            target['components'].append({'id': 'structure-scope-' + section['id'], 'type': 'text', 'layout': {'span': 12},
                'props': {'body': '数据口径：\n' + '\n'.join(scope_note(records[k]['request']) for k in dict.fromkeys(used))}})
            document['dataSources'].update({k: sources[k] for k in used})
        pack_default_widths(target['components'], section['blocks'])
        document['sections'].append(target)
    applied = any(o['status'] == 'applied' for o in outcomes)
    if not applied or validate_page_document(document):
        return {'status': 'failed', 'document': None, 'operations': outcomes, 'issues': [{'code': 'COMPOSE_RESULT_INVALID', 'path': ''}]}
    return {'status': 'partial' if any(o['status'] == 'failed' for o in outcomes) else 'changed', 'document': document, 'operations': outcomes, 'issues': []}


async def edit(baseline, request, resolve, current, summary_enabled=False):
    batch = operation_batch(baseline, request, EDIT_RESULT_SCHEMA['properties']['operations']['items'])
    result = None
    while True:
        await current()
        try: document, op = batch.send(result)
        except StopIteration as completed: return completed.value
        if op['type'] == 'add_result_component':
            from metriccanvas_authoring.work.content_ports import ContentBaselineError
            try:
                record = await resolve(op['resultRef'])
                source_id = op['block']['source']
                source = deepcopy(record['source'])
                if source_id in document['dataSources'] and document['dataSources'][source_id] != source:
                    raise StructureError('DATA_SOURCE_CONFLICT')
                document['dataSources'][source_id] = source
                operation = {k: v for k, v in op.items() if k != 'resultRef'}
                operation['type'] = 'add_source_component'
                candidate = edit_section(document, operation)
                target = next(section for section in candidate['sections'] if section['id'] == op['sectionId'])
                target['components'].append({'id': 'result-scope-' + op['block']['id'], 'type': 'text', 'layout': {'span': 12},
                    'props': {'body': '数据口径：' + scope_note(record['request'])}})
                result = candidate, [], []
            except (StructureError, ContentBaselineError) as error:
                result = None, [{'code': error.code, 'path': ''}], []
        elif op['type'] in SECTION_TYPES:
            try: result = edit_section(document, op), [], []
            except StructureError as error: result = None, [error.issue()], []
        else:
            result = apply_page_operation(document, op, summary_enabled=summary_enabled)
