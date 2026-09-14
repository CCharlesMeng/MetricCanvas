"""Construct complete restricted container subtrees and explicit runtime summaries."""
from copy import deepcopy
from metriccanvas_authoring.domain.component_editing import EditFailure, walk_components
from metriccanvas_authoring.domain.text_map_building import _target_section, _component, _source, remove_component
from metriccanvas_authoring.domain.page_building import ExecutableUnit, UnitScope, PageBuildingIssue, _component_for
from metriccanvas_authoring.domain.execution import DqeExecutionResult

COMPOSITE_TYPES = {'metricCard', 'pieChart', 'gauge', 'keyValuePanel', 'categoryBreakdown'}


def _children(page, recipes, allowed):
    existing = {component['id'] for component in walk_components(page)}
    result = []
    for recipe in recipes:
        if recipe['componentType'] not in allowed:
            raise EditFailure('CONTAINER_CHILD_TYPE_UNSUPPORTED', '/children')
        if recipe['componentId'] in existing:
            raise EditFailure('COMPONENT_ID_EXISTS', '/children')
        existing.add(recipe['componentId'])
        fields, rows, total = _source(page, recipe['dataSourceId'])
        unit = ExecutableUnit(recipe['dataSourceId'], None, fields, {}, 'detail', recipe['componentType'], UnitScope('', (), '', '', ()), ())
        try:
            component = _component_for(unit, DqeExecutionResult(rows=rows,total_count=total), 0)
        except PageBuildingIssue:
            raise EditFailure('CONTAINER_CHILD_SHAPE_MISMATCH', '/children') from None
        component['id'] = recipe['componentId']
        component['layout'] = {'span':recipe.get('span',12)}
        if 'title' in recipe: component['props']['title'] = recipe['title']
        result.append(component)
    return result


def add_composite_card(page, op):
    section = _target_section(page, op)
    children = _children(page,op['children'],COMPOSITE_TYPES)
    props = {'components':children}
    for key in ('variant','titleIcon','dividers'):
        if key in op: props[key]=op[key]
    section['components'].append(_component(op,'compositeCard',props))
    return []


def add_tab_container(page, op):
    section = _target_section(page, op)
    tabs=[]
    for tab in op['tabs']:
        tabs.append({'id':tab['id'],'label':tab['label'],'components':_children(page,tab['children'],{'table'})})
    props={'tabs':tabs}
    for key in ('variant','defaultTab'):
        if key in op: props[key]=op[key]
    section['components'].append(_component(op,'tabContainer',props))
    return []


def add_ai_summary(page, op, *, summary_enabled=False):
    section = _target_section(page,op)
    if op.get('generation') != 'runtime_sse':
        raise EditFailure('EXPLICIT_RUNTIME_STREAMING_REQUIRED','/generation')
    if not summary_enabled:
        raise EditFailure('RUNTIME_SUMMARY_CONFIG_REQUIRED')
    props={'promptTemplate':op['promptTemplate'],'relatedData':deepcopy(op['relatedData'])}
    if 'variant' in op: props['variant']=op['variant']
    section['components'].append(_component(op,'aiSummary',props))
    return []


def remove_content_component(page,op):
    return remove_component(page,op,allowed_types={'text','fieldText','mapChart','tabContainer','compositeCard','aiSummary'})


CONTAINER_HANDLERS={'add_composite_card':add_composite_card,'add_tab_container':add_tab_container,'remove_component':remove_content_component}
