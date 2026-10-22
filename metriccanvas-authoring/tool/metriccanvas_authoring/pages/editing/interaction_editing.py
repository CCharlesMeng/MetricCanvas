from metriccanvas_authoring.pages.components.field_bindings import binding_keys
"""Atomic dimension-filter bindings and table-link navigation over trusted pages."""
from copy import deepcopy
from metriccanvas_authoring.bundle_info import load_bundle_info
from metriccanvas_authoring.pages.components.component_editing import EditFailure, component_by_id
from metriccanvas_authoring.pages.validation.page_validation import _resolved_fields

FILTER_PROPERTIES = {'dimension','label','emptyLabel','display','visible','default','selection','options','treeSelection','hint','hierarchy','hierarchyPicker','defaultLevel','initialParam','dependsOn','candidateContext','candidateWindow','clearOnChangeOf'}


def _filter(page,filter_id):
    existing=next((f for f in page.get('filters',[]) if f['id']==filter_id),None)
    if existing is None:raise EditFailure('FILTER_NOT_FOUND','/filterId')
    if existing['type']!='dimension':raise EditFailure('DIMENSION_FILTER_REQUIRED','/filterId')
    return existing


def _dimension_binding(binding, fields):
    mapped = {f.get('queryField') for f in fields.values() if f.get('role') == 'dimension'}
    candidates = list(binding.get('levelQueryFields', {}).values()) if 'levelQueryFields' in binding else [binding['queryField']]
    if any(field not in mapped for field in candidates):
        raise EditFailure('FILTER_QUERY_FIELD_UNVERIFIED', '/bindings')
    return {'target': 'dimension', **{key: deepcopy(binding[key]) for key in ('queryField', 'levelQueryFields') if key in binding}}


def _replace_bindings(page,filter_id,bindings):
    desired={}
    for binding in bindings:
        source_id=binding['dataSourceId']
        if source_id in desired:raise EditFailure('DUPLICATE_FILTER_BINDING','/bindings')
        source=page.get('dataSources',{}).get(source_id)
        if source is None or source['source']['type']!='query':
            raise EditFailure('FILTER_QUERY_SOURCE_REQUIRED','/bindings')
        query=source['source']['query']
        if query['language']!='dqe':raise EditFailure('FILTER_QUERY_LANGUAGE_UNSUPPORTED','/bindings')
        fields,_,_= _resolved_fields(source['fields'],'')
        desired[source_id] = _dimension_binding(binding, fields)
    # The full desired binding set is explicit; only old/new members for this filter change.
    for source_id,source in page.get('dataSources',{}).items():
        if source['source']['type']!='query':continue
        query=source['source']['query']
        if 'timeModes' in query:
            for leaf in query['timeModes']['cases'].values():
                if source_id in desired:
                    leaf.setdefault('filterBindings', {})[filter_id] = deepcopy(desired[source_id])
                else:
                    leaf.get('filterBindings', {}).pop(filter_id, None)
            source['source'].pop('initial', None)
            continue
        if source_id in desired:
            query.setdefault('filterBindings',{})[filter_id]=desired[source_id]
        elif filter_id in query.get('filterBindings',{}):
            del query['filterBindings'][filter_id]
            if not query['filterBindings']:query.pop('filterBindings')


def _filter_version(page, declaration):
    if any(key in declaration for key in ('selection', 'options', 'treeSelection', 'candidateContext', 'candidateWindow', 'hint', 'clearOnChangeOf', 'hierarchy')):
        page['schemaVersion'] = load_bundle_info()['pageSchemaVersion']


def add_dimension_filter(page,op):
    if any(f['id']==op['filterId'] for f in page.get('filters',[])):
        raise EditFailure('FILTER_ID_EXISTS','/filterId')
    flat = {k: deepcopy(op[k]) for k in FILTER_PROPERTIES if k in op and k != 'dependsOn'}
    nested = op.get('declaration', {})
    if flat.keys() & nested.keys(): raise EditFailure('FILTER_DECLARATION_DUPLICATE', '/declaration')
    declaration = {'id': op['filterId'], 'type': 'dimension', **flat, **deepcopy(nested)}
    _replace_bindings(page,op['filterId'],op['bindings'])
    page.setdefault('filters',[]).append(declaration)
    _filter_version(page, declaration)
    return []


def update_dimension_filter(page,op):
    declaration=_filter(page,op['filterId'])
    if 'dimension' in op['changes'] and declaration.get('hierarchy'):
        raise EditFailure('HIERARCHICAL_DIMENSION_CHANGE_UNSUPPORTED','/changes/dimension')
    declaration.update(deepcopy(op['changes']))
    _replace_bindings(page,op['filterId'],op['bindings'])
    _filter_version(page, declaration)
    return []


def remove_dimension_filter(page,op):
    declaration=_filter(page,op['filterId'])
    _replace_bindings(page,op['filterId'],[])
    page['filters'].remove(declaration)
    if not page['filters']:page.pop('filters')
    # Surviving navigation/actions/dependencies/parameter relations must still validate.
    return []


def _columns(nodes):
    for node in nodes:
        if node.get('kind')=='group':yield from _columns(node['children'])
        else:yield node


def _table_column(page,op):
    component=component_by_id(page,op['componentId'])
    if component['type']!='table':raise EditFailure('TABLE_REQUIRED','/componentId')
    columns=list(_columns(component['props']['columns']))
    matches=[]
    for column in columns:
        binding=column['field']
        if (op.get('slot','main'),op['fieldId']) in binding_keys(binding):matches.append(column)
    if len(matches)!=1:raise EditFailure('COLUMN_NOT_FOUND','/fieldId')
    return component,matches[0],columns


def set_table_link(page,op):
    table,column,columns=_table_column(page,op)
    if column.get('selection'):raise EditFailure('TABLE_LINK_SELECTION_CONFLICT','/fieldId')
    actions=table['props'].get('actions',[])
    navigation=[a for a in actions if 'navigate' in a]
    if len(navigation)>1:raise EditFailure('TABLE_NAVIGATION_AMBIGUOUS')
    desired=op['navigate']
    if desired.get('validateTargetInputs'): page['schemaVersion'] = load_bundle_info()['pageSchemaVersion']
    others=any(c is not column and c.get('link') for c in columns)
    if others and (not navigation or navigation[0]['navigate']!=desired):
        raise EditFailure('TABLE_NAVIGATION_SHARED','/navigate')
    column['link']=True
    if navigation:navigation[0]['navigate']=deepcopy(desired)
    else:table['props']['actions']=[*actions,{'on':'click','navigate':deepcopy(desired)}]
    return []


def remove_table_link(page,op):
    table,column,columns=_table_column(page,op)
    if not column.get('link'):return []
    column.pop('link')
    if not any(c.get('link') for c in columns):
        actions=[a for a in table['props'].get('actions',[]) if 'navigate' not in a]
        if actions:table['props']['actions']=actions
        else:table['props'].pop('actions',None)
    return []


INTERACTION_HANDLERS={'add_dimension_filter':add_dimension_filter,'update_dimension_filter':update_dimension_filter,
    'remove_dimension_filter':remove_dimension_filter,'set_table_link':set_table_link,'remove_table_link':remove_table_link}


def set_report_header_filters(page, op):
    header = component_by_id(page, op['headerId'])
    if header['type'] != 'reportHeader' or page.get('layout', 'report') != 'report':
        raise EditFailure('REPORT_HEADER_REQUIRED', '/headerId')
    ids = op['filterIds']
    for section in page['sections']:
        for other in section['components']:
            if other['type'] != 'reportHeader' or other is header: continue
            remaining = [i for i in other['props'].get('filterIds', []) if i not in ids]
            if remaining: other['props']['filterIds'] = remaining
            else: other['props'].pop('filterIds', None)
    if ids: header['props']['filterIds'] = list(ids)
    else: header['props'].pop('filterIds', None)
    page['schemaVersion'] = load_bundle_info()['pageSchemaVersion']
    return []


def _date_bindings(page, filter_id, declaration, bindings):
    desired = {}
    for binding in bindings:
        source_id = binding['dataSourceId']
        source = page.get('dataSources', {}).get(source_id)
        if source_id in desired: raise EditFailure('DUPLICATE_FILTER_BINDING', '/bindings')
        if not source or source['source']['type'] != 'query': raise EditFailure('FILTER_QUERY_SOURCE_REQUIRED', '/bindings')
        target = binding['target']
        if target == 'timePoint':
            if declaration['type'] != 'timePoint' or not binding.get('queryField') or binding.get('window'):
                raise EditFailure('DATE_BINDING_INVALID', '/bindings')
            fields, _, _ = _resolved_fields(source['fields'], '')
            if not any(f.get('role') == 'dimension' and f.get('queryField') == binding['queryField'] for f in fields.values()):
                raise EditFailure('FILTER_QUERY_FIELD_UNVERIFIED', '/bindings')
        elif declaration['type'] == 'timePoint' and not binding.get('window'):
            raise EditFailure('DATE_WINDOW_REQUIRED', '/bindings')
        elif declaration['type'] == 'timeRange' and binding.get('window'):
            raise EditFailure('DATE_RANGE_WINDOW_CONFLICT', '/bindings')
        if target == 'time' and binding.get('queryField'): raise EditFailure('DATE_BINDING_INVALID', '/bindings')
        desired[source_id] = {k: deepcopy(v) for k, v in binding.items() if k != 'dataSourceId'}
    for source_id, source in page.get('dataSources', {}).items():
        if source['source']['type'] != 'query': continue
        query = source['source']['query']
        if 'timeModes' in query:
            for leaf in query['timeModes']['cases'].values():
                if source_id in desired:
                    leaf.setdefault('filterBindings', {})[filter_id] = deepcopy(desired[source_id])
                else:
                    leaf.get('filterBindings', {}).pop(filter_id, None)
            source['source'].pop('initial', None)
            continue
        if source_id in desired:
            binding = desired[source_id]
            query.setdefault('filterBindings', {})[filter_id] = binding
            raw_filter = query['body']['dsl_list'][0].get('filter', {})
            if binding['target'] == 'time' and isinstance(raw_filter.get('time'), dict):
                raw_filter['time'].pop('start', None); raw_filter['time'].pop('end', None)
            if binding['target'] == 'timePoint' and isinstance(raw_filter.get('dims'), list):
                raw_filter['dims'] = [dim for dim in raw_filter['dims'] if dim.get('dim_name') != binding['queryField']]
            source['source'].pop('initial', None)
        elif filter_id in query.get('filterBindings', {}):
            del query['filterBindings'][filter_id]
            source['source'].pop('initial', None)
        if not query.get('filterBindings'): query.pop('filterBindings', None)


def add_date_filter(page, op):
    if any(f['id'] == op['filterId'] for f in page.get('filters', [])): raise EditFailure('FILTER_ID_EXISTS', '/filterId')
    declaration = {'id': op['filterId'], **deepcopy(op['declaration'])}
    _date_bindings(page, op['filterId'], declaration, op['bindings'])
    page.setdefault('filters', []).append(declaration)
    page['schemaVersion'] = load_bundle_info()['pageSchemaVersion']
    if op.get('headerId'):
        header = component_by_id(page, op['headerId'])
        ids = header['props'].get('filterIds', [])
        set_report_header_filters(page, {'headerId': op['headerId'], 'filterIds': [*ids, op['filterId']]})
    return []


def update_date_filter(page, op):
    existing = next((f for f in page.get('filters', []) if f['id'] == op['filterId']), None)
    if not existing or existing['type'] not in ('timePoint', 'timeRange'): raise EditFailure('DATE_FILTER_REQUIRED', '/filterId')
    old_param = existing.get('initialParam')
    existing.clear(); existing.update({'id': op['filterId'], **deepcopy(op['declaration'])})
    _date_bindings(page, op['filterId'], existing, op['bindings'])
    _prune_date_param(page, old_param)
    page['schemaVersion'] = load_bundle_info()['pageSchemaVersion']
    if op.get('headerId'):
        header = component_by_id(page, op['headerId'])
        set_report_header_filters(page, {'headerId': op['headerId'], 'filterIds': list(dict.fromkeys([*header['props'].get('filterIds', []), op['filterId']]))})
    return []


def remove_date_filter(page, op):
    existing = next((f for f in page.get('filters', []) if f['id'] == op['filterId']), None)
    if not existing or existing['type'] not in ('timePoint', 'timeRange'): raise EditFailure('DATE_FILTER_REQUIRED', '/filterId')
    _date_bindings(page, op['filterId'], existing, [])
    page['filters'].remove(existing)
    for section in page['sections']:
        for component in section['components']:
            if component['type'] != 'reportHeader': continue
            ids = [i for i in component['props'].get('filterIds', []) if i != op['filterId']]
            if ids: component['props']['filterIds'] = ids
            else: component['props'].pop('filterIds', None)
    if not page['filters']: page.pop('filters')
    _prune_date_param(page, existing.get('initialParam'))
    return []


INTERACTION_HANDLERS.update(add_date_filter=add_date_filter, update_date_filter=update_date_filter,
    remove_date_filter=remove_date_filter, set_report_header_filters=set_report_header_filters)


def _prune_date_param(page, param_id):
    if not param_id: return
    def consumes(node):
        if isinstance(node, list): return any(consumes(item) for item in node)
        if not isinstance(node, dict): return False
        return node.get('param') == param_id or node.get('initialParam') == param_id or node.get('sectionGroupParam') == param_id or (node.get('source') == 'param' and node.get('id') == param_id) or param_id in node.get('paramBindings', {}) or any(consumes(value) for key, value in node.items() if key != 'params')
    if consumes(page): return
    params = page.get('params', {})
    if not isinstance(params, dict): return
    query = params.get('query', {})
    if 'times' not in query: return
    query['times'] = [item for item in query['times'] if item['id'] != param_id]
    if not query['times']: query.pop('times')
    if not query: params.pop('query', None)
    if not params: page.pop('params', None)


def set_ioc_header(page, op):
    """Replace only the root declaration; shared product validation owns conflicts."""
    if op['header'] is None:
        page.pop('iocHeader', None)
    else:
        page['iocHeader'] = deepcopy(op['header'])
    if 'dashboardToolbar' in op:
        page['dashboardToolbar'] = op['dashboardToolbar']
    page['schemaVersion'] = load_bundle_info()['pageSchemaVersion']
    return []


INTERACTION_HANDLERS['set_ioc_header'] = set_ioc_header

from metriccanvas_authoring.pages.editing.range_editing import add_number_range_filter, update_number_range_filter
INTERACTION_HANDLERS.update(add_number_range_filter=add_number_range_filter, update_number_range_filter=update_number_range_filter)


def set_time_program(page, op):
    """Replace one temporal declaration and its complete static programs atomically."""
    existing = next((f for f in page.get('filters', []) if f['id'] == op['filterId']), None)
    declaration = deepcopy(op['declaration'])
    if declaration.get('type') not in ('timePoint', 'timeRange') or 'id' in declaration:
        raise EditFailure('DATE_FILTER_REQUIRED', '/declaration')
    for source_id in op['queries']:
        source = page.get('dataSources', {}).get(source_id)
        if not source or source['source']['type'] != 'query':
            raise EditFailure('FILTER_QUERY_SOURCE_REQUIRED', '/queries')
    replacement = {'id': op['filterId'], **declaration}
    if existing is None:
        page.setdefault('filters', []).append(replacement)
    else:
        existing.clear()
        existing.update(replacement)
    for source_id, query in op['queries'].items():
        source = page['dataSources'][source_id]['source']
        source['query'] = deepcopy(query)
        source.pop('initial', None)
    page['schemaVersion'] = load_bundle_info()['pageSchemaVersion']
    return []

INTERACTION_HANDLERS['set_time_program'] = set_time_program


def set_url_input_validation(page, op):
    if op['enabled']:
        page['strictURLInputs'] = True
        page['schemaVersion'] = load_bundle_info()['pageSchemaVersion']
    else:
        page.pop('strictURLInputs', None)
    return []


INTERACTION_HANDLERS['set_url_input_validation'] = set_url_input_validation
