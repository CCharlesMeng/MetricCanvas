"""Controlled table-slot assembly; no joined-row cache, query or source mutation."""
from copy import deepcopy
import math
from metriccanvas_authoring.pages.composition.page_structure import StructureError, field_id, component_span


def table_sources(block):
    return {'main': block['source'], **{slot: value['source'] for slot, value in block['tableSlots'].items()}}


def _slot_fields(block, slot):
    return block['fields'] if slot == 'main' else block['tableSlots'][slot]['fields']


def _key_contract(source, key, expected_type):
    field = source['fields'].get(key)
    if not field or field.get('role') != 'dimension' or field.get('type') not in {'string', 'number'}:
        raise StructureError('TABLE_SLOT_KEY_INVALID', '/rowKey')
    if expected_type is not None and field['type'] != expected_type:
        raise StructureError('TABLE_SLOT_KEY_INVALID', '/rowKey')
    return field


def _keys(source, record, key):
    field = source['fields'][key]
    query_key = field.get('queryField', key)
    keys = []
    for row in record['rows']:
        value = row.get(query_key)
        valid = isinstance(value, str) and bool(value.strip()) if field['type'] == 'string' else (
            isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value))
        if not valid:
            raise StructureError('TABLE_SLOT_KEY_INVALID', '/rowKey')
        keys.append(value)
    if len(keys) != len(set(keys)):
        raise StructureError('TABLE_SLOT_KEY_DUPLICATE', '/rowKey')
    return set(keys)


def _slot_record(source_id, sources, records):
    if source_id not in sources:
        raise StructureError('STRUCTURE_SOURCE_NOT_FOUND', '/tableSlots')
    record = records.get(source_id)
    if record is None or record.get('status', 'ready') not in {'ready', 'empty'}:
        raise StructureError('TABLE_SLOT_EVIDENCE_REQUIRED', '/tableSlots')
    return record


def _period_issues(block, records):
    # Period differences are explicit input facts, not an inferred comparison.
    if set(block['periods']) != set(table_sources(block)):
        raise StructureError('TABLE_SLOT_PERIOD_MISMATCH', '/periods')
    for slot, source_id in table_sources(block).items():
        declared = block['periods'][slot]
        actual = records[source_id].get('request', {}).get('time')
        if actual is None or any(actual.get(key) != declared.get(key) for key in ('start', 'end', 'granularity')):
            raise StructureError('TABLE_SLOT_PERIOD_MISMATCH', '/periods/' + slot)


def _validated_slots(block, sources, records):
    slots, keys, expected = table_sources(block), {}, None
    for slot, source_id in slots.items():
        record = _slot_record(source_id, sources, records)
        source = sources[source_id]
        field = _key_contract(source, block['rowKey'], expected)
        expected = field['type']
        keys[slot] = _keys(source, record, block['rowKey'])
        complete = record['totalCount'] is not None and len(record['rows']) == record['totalCount']
        if slot != 'main' and (not complete or source['source'].get('resultScope') != 'complete'):
            raise StructureError('TABLE_SLOT_INCOMPLETE', '/tableSlots/' + slot)
    _period_issues(block, records)
    _pagination_evidence(block, sources, records)
    return slots, keys


def build_multislot_table(block, sources, records, pattern="custom"):
    if block['component'] != 'table' or not block['tableSlots'] or 'main' in block['tableSlots']:
        raise StructureError('TABLE_SLOT_CONFIGURATION_INVALID', '/tableSlots')
    if block.get('match'):
        raise StructureError('STRUCTURE_MATCH_UNSUPPORTED', '/match')
    slots, keys = _validated_slots(block, sources, records)
    columns = []
    for slot, source_id in slots.items():
        fields = sources[source_id]['fields']
        for reference in _slot_fields(block, slot):
            key = field_id(fields, reference)
            columns.append({'field': {'data': slot, 'field': key}, 'title': fields[key].get('label', key)})
    props = {'title': block['title'], 'rowKey': block['rowKey'], 'columns': columns}
    if 'pagination' in block:
        props['pagination'] = deepcopy(block['pagination'])
    component = {'id': block['id'], 'type': 'table', 'layout': {'span': component_span(block, pattern, 'table')}, 'data': slots, 'props': props}
    return _presentation(block, sources, component)


def slot_coverage(block, sources, records):
    slots, keys = _validated_slots(block, sources, records)
    main = keys['main']
    return [{'slot': slot, 'source': source_id, 'returnedCount': len(records[source_id]['rows']),
        'totalCount': records[source_id]['totalCount'], 'missingKeys': len(main - keys[slot]),
        'extraKeys': len(keys[slot] - main), 'keyScope': 'returned-main-keys',
        'complete': records[source_id]['totalCount'] is not None and len(records[source_id]['rows']) == records[source_id]['totalCount']} for slot, source_id in slots.items()]


def _pagination_evidence(block, sources, records):
    record = records[block['source']]
    complete = record['totalCount'] is not None and record['totalCount'] == len(record['rows'])
    mode = block.get('pagination', {}).get('mode')
    if mode == 'local' and not complete:
        raise StructureError('TABLE_SLOT_INCOMPLETE', '/pagination')
    if not complete and mode != 'query':
        raise StructureError('TABLE_SLOT_PAGINATION_UNVERIFIED', '/pagination')
    if mode == 'query':
        _query_window(block, sources, record, complete)


def _query_window(block, sources, record, complete):
    source = sources[block['source']]
    raw = source['source']
    if raw['type'] != 'query' or raw.get('resultScope') == 'complete':
        raise StructureError('TABLE_SLOT_PAGINATION_UNVERIFIED', '/pagination')
    item = raw['query']['body']['dsl_list'][0]
    query_key = source['fields'][block['rowKey']].get('queryField', block['rowKey'])
    if item.get('output_dims') != [query_key]:
        raise StructureError('TABLE_SLOT_PAGINATION_UNVERIFIED', '/rowKey')
    order = item.get('order', {})
    limit = order.get('limit')
    if type(limit) is not int or limit <= 0 or order.get('offset', 0) != 0:
        raise StructureError('TABLE_SLOT_PAGINATION_UNVERIFIED', '/pagination')
    if len(record['rows']) > limit or not complete and len(record['rows']) != limit:
        raise StructureError('TABLE_SLOT_PAGINATION_UNVERIFIED', '/pagination')


def _presentation(block, sources, component):
    from metriccanvas_authoring.pages.components.structure_presentation import apply_presentation
    component = apply_presentation(block, sources[block['source']], component)
    if not block.get('presentation'):
        return component
    for column in component['props']['columns']:
        binding = column['field']
        if binding['data'] != 'main':
            field = sources[component['data'][binding['data']]]['fields'][binding['field']]
            column['align'] = 'right' if field['role'] == 'measure' else 'left'
    return component
