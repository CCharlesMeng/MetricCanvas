"""Date presentation references and explicit query window ownership (Schema 6.13)."""
def report_date_issues(page):
    issues = []
    def error(path, message): issues.append(('SCHEMA_ERROR', path, message))
    filters = {f['id']: f for f in page.get('filters', [])}
    placed = set()
    for si, section in enumerate(page.get('sections', [])):
        for ci, component in enumerate(section['components']):
            if component['type'] != 'reportHeader' or 'filterIds' not in component['props']: continue
            path = f'/sections/{si}/components/{ci}/props/filterIds'
            if page.get('layout', 'report') == 'dashboard': error(path, 'date toolbar requires report layout')
            for index, filter_id in enumerate(component['props']['filterIds']):
                ref = f'{path}/{index}'
                f = filters.get(filter_id)
                if not f or f['type'] not in ('timePoint', 'timeRange'): error(ref, 'header reference requires date filter')
                elif f.get('visible') is False: error(ref, 'header date filter cannot be hidden')
                if filter_id in placed: error(ref, 'date filter may appear in one header only')
                placed.add(filter_id)
    for index, f in enumerate(page.get('filters', [])):
        if f['type'] not in ('timePoint', 'timeRange'): continue
        if f.get('required') and 'default' not in f and not f.get('initialParam'): error(f'/filters/{index}', 'required date filter needs initial value')
        if f['type'] == 'timeRange' and f.get('precision') == 'month' and 'default' in f and (not isinstance(f['default'], dict) or 'from' not in f['default']): error(f'/filters/{index}/default', 'month range requires explicit calendar bounds')
    for source_id, source in page.get('dataSources', {}).items():
        if source['source']['type'] != 'query': continue
        query = source['source']['query']
        bindings = [(k, b) for k, b in query.get('filterBindings', {}).items() if b['target'] == 'time']
        if len(bindings) > 1: error(f'/dataSources/{source_id}/source/query/filterBindings', 'time query target requires one filter owner')
        config = query['body']['dsl_list'][0].get('filter', {}).get('time', {})
        for filter_id, binding in bindings:
            f = filters.get(filter_id, {})
            path = f'/dataSources/{source_id}/source/query/filterBindings/{filter_id}'
            window = binding.get('window')
            if window and f.get('type') == 'timePoint':
                granularity = f['granularity']
                if (window['kind'] == 'lastN' and window['unit'] != ('month' if granularity == 'month' else 'day')) or (window['kind'] == 'period' and granularity == 'month' and window['unit'] == 'day'): error(path, 'incompatible date window precision')
                if config.get('period') != ('month' if granularity == 'month' else 'day'): error(path, 'date window requires matching query period')
                if any(k in config for k in ('start', 'end', 'param')): error(path, 'date window cannot have a fixed time source')
            elif f.get('type') == 'timeRange' and f.get('precision') == 'month' and config.get('period') != 'month': error(path, 'month range requires period=month')
    return issues


def date_capability_paths(page):
    paths = []
    def visit(component, path):
        props = component.get('props', {})
        if component['type'] == 'reportHeader' and 'filterIds' in props: paths.append(path)
        if component['type'] == 'tabContainer':
            for index, tab in enumerate(props['tabs']):
                if 'component' in tab: visit(tab['component'], f'{path}/props/tabs/{index}/component')
                else:
                    for ci, child in enumerate(tab['components']): visit(child, f'{path}/props/tabs/{index}/components/{ci}')
        if component['type'] == 'compositeCard':
            for index, child in enumerate(props['components']): visit(child, f'{path}/props/components/{index}')
    for si, section in enumerate(page.get('sections', [])):
        for ci, component in enumerate(section['components']): visit(component, f'/sections/{si}/components/{ci}')
    paths += [f'/filters/{i}' for i, f in enumerate(page.get('filters', [])) if f.get('precision') == 'month' or (f['type'] == 'timeRange' and 'initialParam' in f) or 'required' in f]
    paths += [f'/dataSources/{i}' for i, source in page.get('dataSources', {}).items() if any(b['target'] == 'time' and 'window' in b for b in source['source'].get('query', {}).get('filterBindings', {}).values())]
    return paths
