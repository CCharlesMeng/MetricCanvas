"""Atomic range declarations and explicit metric bindings; product bridge owns rules."""
from copy import deepcopy
from metriccanvas_authoring.bundle_info import load_bundle_info
from metriccanvas_authoring.pages.components.component_editing import EditFailure


def _bindings(page, filter_id, bindings):
    desired = {}
    for binding in bindings:
        source_id = binding['dataSourceId']
        source = page.get('dataSources', {}).get(source_id)
        if source_id in desired: raise EditFailure('DUPLICATE_FILTER_BINDING', '/bindings')
        if source is None or source['source']['type'] != 'query': raise EditFailure('FILTER_QUERY_SOURCE_REQUIRED', '/bindings')
        desired[source_id] = {'target': 'numberRange', **{key: deepcopy(value) for key, value in binding.items() if key != 'dataSourceId'}}
    for source_id, source in page.get('dataSources', {}).items():
        if source['source']['type'] != 'query': continue
        query = source['source']['query']
        if source_id in desired: query.setdefault('filterBindings', {})[filter_id] = desired[source_id]
        elif filter_id in query.get('filterBindings', {}): del query['filterBindings'][filter_id]
        else: continue
        source['source'].pop('initial', None)
        if not query.get('filterBindings'): query.pop('filterBindings', None)


def add_number_range_filter(page, op):
    if any(item['id'] == op['filterId'] for item in page.get('filters', [])): raise EditFailure('FILTER_ID_EXISTS', '/filterId')
    declaration = {'id': op['filterId'], **deepcopy(op['declaration'])}
    page.setdefault('filters', []).append(declaration)
    _bindings(page, op['filterId'], op['bindings'])
    page['schemaVersion'] = load_bundle_info()['pageSchemaVersion']
    return []


def update_number_range_filter(page, op):
    declaration = next((item for item in page.get('filters', []) if item['id'] == op['filterId']), None)
    if declaration is None or declaration['type'] != 'numberRange': raise EditFailure('NUMBER_RANGE_FILTER_REQUIRED', '/filterId')
    declaration.clear(); declaration.update({'id': op['filterId'], **deepcopy(op['declaration'])})
    _bindings(page, op['filterId'], op['bindings'])
    page['schemaVersion'] = load_bundle_info()['pageSchemaVersion']
    return []
