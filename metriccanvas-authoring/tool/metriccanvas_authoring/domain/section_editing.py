"""Bounded structural edits on the complete candidate; never re-run queries."""
from copy import deepcopy
from metriccanvas_authoring.domain.page_structure import obj, ID, TEXT, DATA_BLOCK, BLOCK, StructureError, block_component

COMMON = {'id': ID, 'sectionId': ID, 'dependsOn': {'type': 'array', 'items': ID}}
CONTAINER = {'enum': ['plain', 'panel', 'card']}
SECTION_OPERATIONS = [
    obj({**COMMON, 'type': {'const': 'add_section'}, 'title': TEXT, 'container': CONTAINER, 'beforeId': ID,
         'blocks': {'type': 'array', 'minItems': 1, 'maxItems': 24, 'items': BLOCK}}, ['id', 'type', 'sectionId', 'title', 'blocks']),
    obj({**COMMON, 'type': {'const': 'set_section'}, 'changes': {**obj({'title': TEXT, 'container': CONTAINER}, []), 'minProperties': 1}}, ['id', 'type', 'sectionId', 'changes']),
    obj({**COMMON, 'type': {'const': 'move_section'}, 'beforeId': ID}, ['id', 'type', 'sectionId']),
    obj({**COMMON, 'type': {'const': 'remove_section'},
         'componentIds': {'type': 'array', 'uniqueItems': True, 'items': ID}}, ['id', 'type', 'sectionId', 'componentIds']),
    obj({**COMMON, 'type': {'const': 'add_source_component'}, 'block': DATA_BLOCK}, ['id', 'type', 'sectionId', 'block']),
]
SECTION_TYPES = {s['properties']['type']['const'] for s in SECTION_OPERATIONS}


def edit_section(document, op):
    candidate = deepcopy(document)
    sections = candidate['sections']
    target = next((s for s in sections if s['id'] == op['sectionId']), None)
    kind = op['type']
    if kind == 'add_section':
        if target is not None:
            raise StructureError('SECTION_ID_CONFLICT')
        target = {'id': op['sectionId'], 'title': op['title'], 'container': op.get('container', 'panel'), 'components': []}
        occupied = {c['id'] for s in sections for c in s['components']}
        for block in op['blocks']:
            if block['id'] in occupied:
                raise StructureError('COMPONENT_ID_CONFLICT')
            occupied.add(block['id'])
            target['components'].append(block_component(block, candidate['dataSources']))
    elif target is None:
        raise StructureError('SECTION_NOT_FOUND')
    if any(c['type'] == 'reportHeader' for c in target['components']) and kind in {'move_section', 'remove_section'}:
        raise StructureError('SECTION_HEADER_PROTECTED')
    if kind in {'add_section', 'move_section'}:
        before = op.get('beforeId')
        if before == target['id']:
            return candidate
        if before is not None and not any(s['id'] == before for s in sections):
            raise StructureError('SECTION_NOT_FOUND', '/beforeId')
        if kind == 'move_section':
            sections.remove(target)
        position = next((i for i, s in enumerate(sections) if s['id'] == before), len(sections))
        if before is not None and any(c['type'] == 'reportHeader' for c in sections[position]['components']):
            raise StructureError('SECTION_HEADER_PROTECTED')
        sections.insert(position, target)
    elif kind == 'set_section':
        target.update(deepcopy(op['changes']))
    elif kind == 'remove_section':
        # Require the complete observed component set for atomic section deletion.
        if set(op['componentIds']) != {c['id'] for c in target['components']}:
            raise StructureError('SECTION_COMPONENTS_CHANGED')
        sections.remove(target)
    else:
        block = op['block']
        if any(c['id'] == block['id'] for s in sections for c in s['components']):
            raise StructureError('COMPONENT_ID_CONFLICT')
        target['components'].append(block_component(block, candidate['dataSources']))
    return candidate
