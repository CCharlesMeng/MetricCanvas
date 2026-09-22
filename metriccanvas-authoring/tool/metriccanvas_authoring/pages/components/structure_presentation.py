"""Shared, bounded presentation compilation for both creation and revision."""
from copy import deepcopy

PRESENTATION_COMPONENTS = {'metric-summary': 'metricCard', 'bar-comparison': 'barChart', 'record-list': 'table'}


def purpose_intent(purpose):
    return {'primary-value':'single_value', 'change':'single_value', 'trend':'trend',
            'comparison':'comparison', 'distribution':'composition', 'ranking':'ranking',
            'reconciliation':'detail'}.get(purpose, 'detail')


def capabilities():
    # Derived from the actual input contract and explicit implemented families.
    from metriccanvas_authoring.pages.composition.page_structure import PLAN_SCHEMA, V3_PLAN_SCHEMA
    block = V3_PLAN_SCHEMA['properties']['sections']['items']['properties']['blocks']['items']['oneOf'][1]
    return {'versions':[s['properties']['version']['const'] for s in PLAN_SCHEMA['oneOf']],
            'preferredVersion':'3', 'presentations':[
                {'kind':s['properties']['kind'].get('const', s['properties']['kind'].get('enum', [None])[0]),
                 'component':PRESENTATION_COMPONENTS[s['properties']['kind'].get('const', s['properties']['kind'].get('enum', [None])[0])],
                 'options':{k:deepcopy(v.get('enum',v.get('type'))) for k,v in s['properties'].items() if k!='kind'}
                } for s in block['properties']['presentation']['oneOf']],
            'purposes':block['properties']['purpose']['enum'],
            'widths':block['properties']['width']['enum']}


def apply_presentation(block, source, component):
    from metriccanvas_authoring.pages.composition.page_structure import field_id, StructureError
    p=block.get('presentation')
    if not p: return component
    if PRESENTATION_COMPONENTS.get(p['kind']) != component['type']:
        raise StructureError('STRUCTURE_PRESENTATION_UNSUPPORTED', '/presentation')
    props=component['props']
    if p['kind']=='bar-comparison':
        props.update({k:p[k] for k in ('horizontal','stacked') if k in p})
    elif p['kind']=='record-list':
        if p.get('density')=='compact': props['variant']='reportCompact'
        if 'subtitle' in p: props['subtitle']=p['subtitle']
        overrides={}
        displayed={c['field'] for c in props['columns']}
        for column in p.get('columns',[]):
            key=field_id(source['fields'],column['field'])
            if key not in displayed or key in overrides:
                raise StructureError('STRUCTURE_COLUMN_REFERENCE_INVALID','/presentation/columns')
            overrides[key]={k:v for k,v in column.items() if k!='field'}
        for column in props['columns']:
            field=source['fields'][column['field']]
            if field['role']=='measure': column['align']='right'
            column.update(overrides.get(column['field'],{}))
    return component


def preserve_unedited(actual, old, new):
    """Three-way merge: only explicit plan changes replace manual presentation."""
    if old == new: return deepcopy(actual)
    if isinstance(actual,dict) and isinstance(old,dict) and isinstance(new,dict):
        result={k:deepcopy(v) for k,v in actual.items() if k not in old}
        for key,value in new.items():
            result[key]=preserve_unedited(actual[key],old[key],value) if key in actual and key in old else deepcopy(value)
        return result
    if all(isinstance(x,list) for x in (actual,old,new)) and len(actual)==len(old)==len(new):
        # Only align arrays whose identity/order is unchanged (e.g. table columns).
        def identity(item):
            return item.get('field',item.get('valueField')) if isinstance(item,dict) else item
        if [identity(x) for x in actual]==[identity(x) for x in old]==[identity(x) for x in new]:
            return [preserve_unedited(a,o,n) for a,o,n in zip(actual,old,new)]
    return deepcopy(new)
