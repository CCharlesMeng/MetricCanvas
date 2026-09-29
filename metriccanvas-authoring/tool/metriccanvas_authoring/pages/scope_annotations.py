"""Maintain only text owned by this work state; edited or legacy text is manual.

Ownership stays in private work records, not the page protocol or model input.
"""
from copy import deepcopy
from metriccanvas_authoring.pages.components.component_editing import walk_components
from metriccanvas_authoring.canonical import canonical_sha256
from metriccanvas_authoring.pages.composition.page_structure import scope_note


def source_contract(source):
    value = deepcopy(source)
    value['source'].pop('initial', None)
    return value


def scope_body(requests):
    return '数据口径：\n' + '\n'.join(dict.fromkeys(scope_note(request) for request in requests))


def member(component_id, source_id, record):
    return {component_id: {'sourceId': source_id, 'source': source_contract(record['source']),
                           'request': deepcopy(record['request'])}}


def refresh(document, notes):
    """Reconcile owned notes against the final accepted edit batch."""
    retained, adjustments = {}, []
    components = {c['id']: (s, c) for s in document['sections'] for c in walk_components({'sections': [s]})}
    for note_id, note in notes.items():
        location = components.get(note_id)
        if location is None or location[1].get('props', {}).get('body') != note['body']:
            continue  # User changed/deleted this text: ownership ends.
        section, text = location
        if text not in section['components']:
            continue
        groups = {}
        for component_id, binding in note['members'].items():
            target = components.get(component_id)
            if target is None:
                continue
            source_id = binding['sourceId']
            current_source = document['dataSources'].get(source_id)
            if (source_id not in target[1].get('data', {}).values() or current_source is None
                    or source_contract(current_source) != binding['source']):
                adjustments.append({'code': 'SCOPE_NOTE_REVIEW_REQUIRED', 'path': '/sections',
                                    'componentId': component_id})
                continue
            groups.setdefault(target[0]['id'], {})[component_id] = binding
        position = section['components'].index(text)
        section['components'].remove(text)
        for section_id, members in groups.items():
            target = next(s for s in document['sections'] if s['id'] == section_id)
            new_id = note_id if section_id == section['id'] else 'scope-' + canonical_sha256([note_id, section_id])[:24]
            if new_id != note_id and new_id in components:
                adjustments.append({'code': 'SCOPE_NOTE_REVIEW_REQUIRED', 'path': '/sections'})
                continue
            body = scope_body([item['request'] for item in members.values()])
            merged = next((key for key, value in retained.items() if value['body'] == body
                           and any(c['id'] == key for c in target['components'])), None)
            if merged is not None:
                retained[merged]['members'].update(deepcopy(members))
                continue
            target['components'].insert(position if target is section else len(target['components']),
                {**deepcopy(text), 'id': new_id, 'props': {**text['props'], 'body': body}})
            retained[new_id] = {'body': body, 'members': deepcopy(members)}
    return retained, adjustments


def data_locations(document):
    return [(s['id'], c['id'], c['data']) for s in document['sections']
            for c in walk_components({'sections': [s]}) if c.get('data')]
