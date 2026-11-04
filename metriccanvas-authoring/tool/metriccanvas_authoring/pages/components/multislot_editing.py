"""Atomic insertion from complete explicitly resolved slot records."""
from copy import deepcopy
from metriccanvas_authoring.pages.composition.page_structure import StructureError
from metriccanvas_authoring.pages.components.multislot_table import build_multislot_table, table_sources, slot_coverage
from metriccanvas_authoring.pages.scope_annotations import source_contract
from metriccanvas_authoring.work.diagnostics import public_issue


def add_multislot_table(document, operation, records):
    try:
        candidate = deepcopy(document)
        target = next((section for section in candidate['sections'] if section['id'] == operation['sectionId']), None)
        if target is None:
            raise StructureError('SECTION_NOT_FOUND', '/sectionId')
        if any(component['id'] == operation['block']['id'] for section in candidate['sections'] for component in section['components']):
            raise StructureError('COMPONENT_ID_CONFLICT', '/block/id')
        evidence = _merge_sources(candidate, operation, records)
        target['components'].append(build_multislot_table(operation['block'], candidate['dataSources'], evidence))
        return candidate, [], [{'code': 'TABLE_SLOT_ALIGNMENT_COVERAGE',
            'slots': slot_coverage(operation['block'], candidate['dataSources'], evidence)}]
    except StructureError as error:
        return None, [public_issue(error)], []


def _merge_sources(candidate, operation, records):
    evidence = {}
    slots = table_sources(operation['block'])
    if set(operation['resultRefs']) != set(slots):
        raise StructureError('TABLE_SLOT_CONFIGURATION_INVALID', '/resultRefs')
    for slot, source_id in slots.items():
        record = records.get(operation['resultRefs'][slot])
        if record is None:
            raise StructureError('TABLE_SLOT_EVIDENCE_REQUIRED', '/resultRefs/' + slot)
        source = record['source']
        existing = candidate['dataSources'].get(source_id)
        if existing is not None and source_contract(existing) != source_contract(source):
            raise StructureError('DATA_SOURCE_CONFLICT', '/resultRefs/' + slot)
        candidate['dataSources'].setdefault(source_id, deepcopy(source))
        evidence[source_id] = record
    return evidence


def extend_multislot_table(document, operation, records):
    from metriccanvas_authoring.pages.composition.table_pagination import _components
    try:
        candidate = deepcopy(document)
        actual = next((c for c in _components(candidate) if c['id'] == operation['componentId']), None)
        if actual is None or actual['type'] != 'table' or actual['id'] != operation['block']['id']:
            raise StructureError('TABLE_SLOT_CONFIGURATION_INVALID', '/componentId')
        _preserved_slots(actual, operation['block'])
        evidence = _merge_sources(candidate, operation, records)
        proposed = build_multislot_table(operation['block'], candidate['dataSources'], evidence)
        old_columns = _column_bindings(actual['props']['columns'])
        new_columns = _column_bindings(proposed['props']['columns'])
        if not old_columns <= new_columns:
            raise StructureError('TABLE_SLOT_CONFIGURATION_INVALID', '/block/fields')
        actual['data'] = proposed['data']
        actual['props']['rowKey'] = proposed['props']['rowKey']
        actual['props']['columns'].extend(column for column in proposed['props']['columns']
            if next(iter(_column_bindings([column]))) not in old_columns)
        return candidate, [], [{'code': 'TABLE_SLOT_ALIGNMENT_COVERAGE',
            'slots': slot_coverage(operation['block'], candidate['dataSources'], evidence)}]
    except StructureError as error:
        return None, [public_issue(error)], []


def _preserved_slots(actual, block):
    if block.get('presentation') or block.get('title') != actual['props'].get('title', actual['id']):
        raise StructureError('TABLE_SLOT_CONFIGURATION_INVALID', '/block/title')
    requested = table_sources(block)
    if any(requested.get(slot) != source for slot, source in actual['data'].items()):
        raise StructureError('TABLE_SLOT_CONFIGURATION_INVALID', '/block/tableSlots')
    if actual['props'].get('rowKey', block['rowKey']) != block['rowKey'] or actual['props'].get('pinnedTop'):
        raise StructureError('TABLE_SLOT_CONFIGURATION_INVALID', '/block/rowKey')


def _column_bindings(columns):
    from metriccanvas_authoring.pages.components.field_bindings import binding_keys
    keys = set()
    for column in columns:
        if column.get('kind') == 'group':
            keys.update(_column_bindings(column['children']))
        else:
            keys.update(binding_keys(column['field']))
    return keys
