"""Assemble explicit composition needs from already verified ordinary source IDs.

Structural/semantic validation belongs to the bundled TS Node Bridge. This module
only projects declarations; it never invents queries or infers page-selection
capability, row-domain equality or grain from sample rows.
"""
from copy import deepcopy


def build_paged_join(sources, specification):
    source = deepcopy(specification)
    fields = {}
    for field, projection in source['projection'].items():
        member = source['members'][projection['member']]
        definition = deepcopy(sources[member['source']]['fields'][projection['field']])
        definition.pop('queryField', None)
        if projection['member'] != source['domainMember']:
            definition['nullable'] = True
        fields[field] = definition
    ordinal = source.get('ordinalField')
    if ordinal:
        fields[ordinal] = {'type': 'number', 'role': 'measure', 'nullable': False, 'label': '序号'}
    return {'fields': fields, 'source': source}


def referenced_definitions(sources, root):
    ids = {root}
    for member in sources[root].get('source', {}).get('members', {}).values():
        ids.add(member['source'])
    return {key: deepcopy(sources[key]) for key in ids}


def attach_paged_join_tables(page, specifications):
    """Optional explicit assembly input; retain ordinary definitions for other consumers."""
    from .table_pagination import _components
    for source_id, spec in specifications.items():
        page['dataSources'][source_id] = build_paged_join(page['dataSources'], spec)
    used=set()
    for component in _components(page):
        root = component.get('data', {}).get('main')
        if root in specifications and component['type'] == 'table':
            used.add(root)
            component.setdefault('props', {})['pagination'] = {'mode': 'query'}
            component['props']['rowKey'] = specifications[root]['rowKey']
    for source_id in specifications.keys()-used:
        source=page['dataSources'][source_id]
        fields=list(source['fields'])
        page['sections'].append({'id':source_id+'-section','components':[{'id':source_id+'-table','type':'table','layout':{'span':12},'data':{'main':source_id},'props':{'rowKey':source['source']['rowKey'],'pagination':{'mode':'query'},'columns':[{'field':field,'sortable':field in source['source']['ordering']['sortableFields']} for field in fields]}}]})
    return page
