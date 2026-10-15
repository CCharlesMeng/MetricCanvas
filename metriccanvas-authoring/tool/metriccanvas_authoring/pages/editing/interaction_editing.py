"""Atomic dimension-filter bindings and table-link navigation over trusted pages."""
from copy import deepcopy
from metriccanvas_authoring.bundle_info import load_bundle_info
from metriccanvas_authoring.pages.components.component_editing import EditFailure, component_by_id
from metriccanvas_authoring.pages.validation.page_validation import _resolved_fields

FILTER_PROPERTIES = {'dimension','label','emptyLabel','display','visible','default'}


def _filter(page,filter_id):
    existing=next((f for f in page.get('filters',[]) if f['id']==filter_id),None)
    if existing is None:raise EditFailure('FILTER_NOT_FOUND','/filterId')
    if existing['type']!='dimension':raise EditFailure('DIMENSION_FILTER_REQUIRED','/filterId')
    return existing


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
        if not any(f.get('role')=='dimension' and f.get('queryField')==binding['queryField'] for f in fields.values()):
            raise EditFailure('FILTER_QUERY_FIELD_UNVERIFIED','/bindings')
        desired[source_id]={'target':'dimension','queryField':binding['queryField']}
    # The full desired binding set is explicit; only old/new members for this filter change.
    for source_id,source in page.get('dataSources',{}).items():
        if source['source']['type']!='query':continue
        query=source['source']['query']
        if source_id in desired:
            query.setdefault('filterBindings',{})[filter_id]=desired[source_id]
        elif filter_id in query.get('filterBindings',{}):
            del query['filterBindings'][filter_id]
            if not query['filterBindings']:query.pop('filterBindings')


def add_dimension_filter(page,op):
    if any(f['id']==op['filterId'] for f in page.get('filters',[])):
        raise EditFailure('FILTER_ID_EXISTS','/filterId')
    declaration={'id':op['filterId'],'type':'dimension',**{k:deepcopy(op[k]) for k in FILTER_PROPERTIES if k in op}}
    _replace_bindings(page,op['filterId'],op['bindings'])
    page.setdefault('filters',[]).append(declaration)
    return []


def update_dimension_filter(page,op):
    declaration=_filter(page,op['filterId'])
    if 'dimension' in op['changes'] and declaration.get('hierarchy'):
        raise EditFailure('HIERARCHICAL_DIMENSION_CHANGE_UNSUPPORTED','/changes/dimension')
    declaration.update(deepcopy(op['changes']))
    _replace_bindings(page,op['filterId'],op['bindings'])
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
        field=binding if isinstance(binding,str) else binding['field']
        slot='main' if isinstance(binding,str) else binding.get('data','main')
        if field==op['fieldId'] and slot==op.get('slot','main'):matches.append(column)
    if len(matches)!=1:raise EditFailure('COLUMN_NOT_FOUND','/fieldId')
    return component,matches[0],columns


def set_table_link(page,op):
    table,column,columns=_table_column(page,op)
    if column.get('selection'):raise EditFailure('TABLE_LINK_SELECTION_CONFLICT','/fieldId')
    actions=table['props'].get('actions',[])
    navigation=[a for a in actions if 'navigate' in a]
    if len(navigation)>1:raise EditFailure('TABLE_NAVIGATION_AMBIGUOUS')
    desired=op['navigate']
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
