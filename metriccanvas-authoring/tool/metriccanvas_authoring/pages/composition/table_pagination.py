"""Materialize existing query-pagination declarations from verified first windows."""
from collections import Counter
from copy import deepcopy


def _components(page):
    def walk(component):
        yield component
        props = component.get('props', {})
        if component.get('type') == 'compositeCard':
            for child in props.get('components', []):
                yield from walk(child)
        elif component.get('type') == 'tabContainer':
            for tab in props.get('tabs', []):
                if 'component' in tab:
                    yield from walk(tab['component'])
                for child in tab.get('components', []):
                    yield from walk(child)
    for section in page.get('sections', []):
        for component in section.get('components', []):
            yield from walk(component)
    for detail in page.get('detailViews', []):
        if detail.get('mode') == 'snapshot':
            for component in detail.get('components', []):
                yield from walk(component)


def add_query_table_pagination(page, component_ids=None):
    """Preserve explicit settings and sources shared with other consumers."""
    components = list(_components(page))
    references = Counter(source for component in components for source in component.get('data', {}).values())
    for component in components:
        if component.get('type') == 'aiSummary':
            references.update(value['source'] for value in component['props'].get('relatedData', {}).values())
    for source in page.get('dataSources', {}).values():
        references.update(op['source'] for op in source.get('compute', []) if op.get('op') == 'joinAggregate')
        references.update(binding['source'] for binding in source.get('source', {}).get('query', {}).get('resultBindings', []))
    for component in _components({'sections': page.get('sections', [])}):
        if component.get('type') != 'table' or 'pagination' in component.get('props', {}):
            continue
        if component_ids is not None and component['id'] not in component_ids:
            continue
        source_id = component['data']['main']
        data_source = page['dataSources'][source_id]
        source = data_source['source']
        if source['type']=='pagedJoin':
            component['props']['pagination']={'mode':'query'}
            component['props']['rowKey']=source['rowKey']
            continue
        if references[source_id] != 1 or source['type'] != 'query' or data_source.get('compute') or source.get('resultScope') == 'complete':
            continue
        initial = source.get('initial', {})
        rows, total = initial.get('rows', []), initial.get('totalCount')
        if not rows or type(total) is not int or total <= len(rows):
            continue
        order = source['query']['body']['dsl_list'][0].get('order', {})
        if not isinstance(order, dict) or order.get('offset', 0) != 0:
            continue
        limit = order.get('limit', len(rows))
        if type(limit) is not int or limit <= 0 or limit != len(rows):
            continue
        source['query'] = deepcopy(source['query'])
        source['query']['body']['dsl_list'][0]['order'] = {**order, 'offset': 0, 'limit': limit}
        component['props']['pagination'] = {'mode': 'query'}
    return page
