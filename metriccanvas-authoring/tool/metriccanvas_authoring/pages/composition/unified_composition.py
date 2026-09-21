"""Create controlled mixed content on a trusted empty page, without persistence."""
from copy import deepcopy

from metriccanvas_authoring.bundle_info import load_bundle_info
from metriccanvas_authoring.pages.editing.unified_edit_page import UNIFIED_EDIT_SCHEMA, edit_unified_page
from metriccanvas_authoring.pages.composition.layout_policy import apply_creation_layout
from metriccanvas_authoring.domain.page_validation import validate_page_document
from metriccanvas_authoring.pages.composition.page_structure import PLAN_SCHEMA
from metriccanvas_authoring.pages.composition.structure_composition import compose_structure

CREATION_OPERATIONS = frozenset({'add_text', 'add_field_text', 'add_map_chart', 'add_tab_container',
    'add_composite_card', 'add_ai_summary', 'add_data_component', 'set_component_layout', 'move_component'})
COMPOSITION_SCHEMA = deepcopy(UNIFIED_EDIT_SCHEMA)
COMPOSITION_SCHEMA['properties']['operations']['items']['oneOf'] = [
    operation for operation in COMPOSITION_SCHEMA['properties']['operations']['items']['oneOf']
    if operation['properties']['type']['const'] in CREATION_OPERATIONS]
COMPOSITION_SCHEMA = {'oneOf': [COMPOSITION_SCHEMA, {
    'type': 'object', 'additionalProperties': False, 'required': ['plan'],
    'properties': {'plan': PLAN_SCHEMA}}]}


def _failure(code):
    return {'status': 'failed', 'document': None, 'operations': [], 'issues': [{'code': code, 'path': ''}], 'sourceDescriptions': []}


async def compose_unified_content(page_id, title, layout, request, dependencies, *, summary_enabled=False, current):
    if layout not in {'report', 'dashboard'}:
        return _failure('CREATION_LAYOUT_INVALID')
    if isinstance(request, dict) and set(request) == {'plan'}:
        return await compose_structure(page_id, title, layout, request['plan'], dependencies, current=current)
    baseline = {'schemaVersion': load_bundle_info()['pageSchemaVersion'], 'id': page_id, 'layout': layout,
        'dataSources': {}, 'sections': [{'id': 'main', 'container': 'panel', 'components': [{
            'id': 'page-header', 'type': 'reportHeader', 'layout': {'span': 12}, 'props': {'title': title}}]}]}
    if validate_page_document(baseline):
        return _failure('CREATION_BASELINE_INVALID')
    protected = deepcopy(request)
    rejected = {}
    # Preserve scheduler identity/dependency and partial-success semantics. Replace
    # denied operations with an invalid opcode so none can execute by accident.
    if isinstance(protected, dict) and isinstance(protected.get('operations'), list):
        for index, operation in enumerate(protected['operations']):
            if not isinstance(operation, dict): continue
            if not isinstance(operation.get('type'), str) or operation['type'] not in CREATION_OPERATIONS:
                rejected[index] = 'CREATION_OPERATION_UNSUPPORTED'
            elif operation.get('type') in {'set_component_layout', 'move_component'} and operation.get('componentId') == 'page-header':
                rejected[index] = 'CREATION_HEADER_PROTECTED'
            if index in rejected: operation['type'] = '__invalid_creation_operation__'
    result = await edit_unified_page(baseline, protected, dependencies, summary_enabled=summary_enabled, current=current)
    for index, outcome in enumerate(result['operations']):
        if index in rejected:
            outcome['issues'] = [{'code': rejected[index], 'path': f'/operations/{index}'}]
    if result['document'] is None: return result
    header = [c for section in result['document']['sections'] for c in section['components'] if c['id'] == 'page-header']
    if header != baseline['sections'][0]['components']:
        return _failure('CREATION_HEADER_PROTECTED')
    document = apply_creation_layout(result['document'], layout)
    if validate_page_document(document): return _failure('CREATION_LAYOUT_RESULT_INVALID')
    await current()
    return {**result, 'document': document}
