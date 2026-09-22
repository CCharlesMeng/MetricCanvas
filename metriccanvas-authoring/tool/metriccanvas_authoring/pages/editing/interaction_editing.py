"""Atomic dimension-filter bindings and table-link navigation over trusted pages."""
from copy import deepcopy
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
