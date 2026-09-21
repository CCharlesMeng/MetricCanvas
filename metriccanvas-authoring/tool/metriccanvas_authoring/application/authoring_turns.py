"""Trusted per-invocation authority, deliberately separate from model arguments.

A deployment adapter must derive scope and prepared state from authenticated program
context. Neither a file token nor a model-supplied binding implements this port.
"""
from copy import deepcopy
from dataclasses import dataclass
import hashlib
import json
import math
from typing import Any, Mapping, Protocol
from jsonschema import Draft202012Validator
from metriccanvas_authoring.runtime_assets import bundle_root

from metriccanvas_authoring.application.content_ports import ContentBaseline, ContentBaselineError
from metriccanvas_authoring.application.edit_page import read_verified_baseline
from metriccanvas_authoring.domain.canonical import canonical_json

SCOPE_KEYS = ('actorId', 'workspaceId', 'requestId', 'runId', 'turnId', 'pageId', 'capabilityVersion')
TURN_VALIDATOR = Draft202012Validator(json.loads((bundle_root() / 'contracts/authored/authoring-turn.schema.json').read_text()))


@dataclass(frozen=True)
class PreparedAuthoringTurn:
    binding: Mapping[str, Any]
    baseline: ContentBaseline | None
    document_json: str | None = None


class CurrentAuthoringTurnPort(Protocol):
    async def current_scope(self) -> Mapping[str, str]: ...
    async def current_turn(self) -> PreparedAuthoringTurn: ...


class UnavailableAuthoringTurns:
    async def current_scope(self):
        raise ContentBaselineError('CURRENT_TURN_UNAVAILABLE')

    async def current_turn(self):
        raise ContentBaselineError('CURRENT_TURN_UNAVAILABLE')


class TurnBaselines:
    def __init__(self, prepared):
        self.prepared = prepared

    async def read(self, token):
        if token != self.prepared.binding['contextRef'] or self.prepared.baseline is None:
            raise ContentBaselineError('CURRENT_TURN_BASELINE_REQUIRED')
        return self.prepared.baseline


class AuthoringTurnGate:
    def __init__(self, port: CurrentAuthoringTurnPort | None):
        self.port = port or UnavailableAuthoringTurns()

    async def require(self, context_ref, *, write=False, mode=None):
        scope = dict(await self.port.current_scope())
        prepared = deepcopy(await self.port.current_turn())
        b = prepared.binding
        if not TURN_VALIDATOR.is_valid(b) or b.get('capabilityVersion') != '1.0':
            raise ContentBaselineError('CURRENT_TURN_INVALID')
        if any(scope.get(k) != b[k] for k in SCOPE_KEYS):
            raise ContentBaselineError('CURRENT_TURN_SCOPE_MISMATCH')
        if context_ref != b['contextRef'] or b['status'] != 'active':
            raise ContentBaselineError('CURRENT_TURN_STALE')
        if write and b['access'] != 'write':
            raise ContentBaselineError('CURRENT_TURN_READ_ONLY')
        if mode and b['mode'] != mode:
            raise ContentBaselineError('CURRENT_TURN_MODE_MISMATCH')
        if b['mode'] == 'new':
            if prepared.baseline is not None or prepared.document_json is not None or any(b[k] is not None for k in ('baseRef', 'documentSha256', 'selectedComponentId')):
                raise ContentBaselineError('CURRENT_TURN_NEW_BASELINE_INVALID')
        else:
            if prepared.baseline is None:
                raise ContentBaselineError('CURRENT_TURN_BASELINE_REQUIRED')
            if not isinstance(prepared.document_json, str) or len(prepared.document_json) > 20 * 1024 * 1024 or len(prepared.document_json.encode('utf-8')) > 20 * 1024 * 1024:
                raise ContentBaselineError('CURRENT_TURN_DOCUMENT_SIZE_LIMIT')
            baseline = await read_verified_baseline(TurnBaselines(prepared), context_ref)
            def unique_object(pairs):
                value = {}
                for key, item in pairs:
                    if key in value: raise ValueError('duplicate key')
                    value[key] = item
                return value
            def finite_float(value):
                result = float(value)
                if not math.isfinite(result): raise ValueError('non-finite')
                return result
            try:
                if not isinstance(prepared.document_json, str): raise ValueError('missing document bytes')
                parsed = json.loads(prepared.document_json, object_pairs_hook=unique_object, parse_float=finite_float,
                                    parse_constant=lambda _: (_ for _ in ()).throw(ValueError('non-finite')))
                if canonical_json(parsed) != canonical_json(baseline.document) or hashlib.sha256(prepared.document_json.encode('utf-8')).hexdigest() != b['documentSha256']:
                    raise ValueError('mismatch')
            except (ValueError, TypeError, UnicodeError):
                raise ContentBaselineError('CURRENT_TURN_DOCUMENT_MISMATCH')
            if baseline.ref != b['baseRef'] or baseline.ref['pageId'] != b['pageId']:
                raise ContentBaselineError('CURRENT_TURN_BASELINE_MISMATCH')
            prepared = PreparedAuthoringTurn(b, ContentBaseline(baseline.ref, parsed, baseline.document_sha256), prepared.document_json)
        # Detect a scope switch during an asynchronous baseline read.
        if dict(await self.port.current_scope()) != scope:
            raise ContentBaselineError('CURRENT_TURN_STALE')
        return prepared

    async def unchanged(self, prepared, *, write=False):
        current = await self.require(prepared.binding['contextRef'], write=write)
        if current != prepared:
            raise ContentBaselineError('CURRENT_TURN_STALE')


# Configuration projection uses named scalar fields only, never arbitrary props.
_MAX_COMPONENTS = 2000
_PROP_FIELDS = ('title', 'subtitle', 'description', 'variant', 'size', 'align', 'color',
                'showLegend', 'showLabel', 'stacked', 'smooth', 'orientation', 'height',
                'pageSize', 'showHeader', 'striped', 'bordered', 'emptyText', 'rounded')
_LAYOUT_FIELDS = ('span', 'rowSpan', 'height', 'minHeight', 'maxHeight')
_KNOWN_TYPES = {item['type'] for item in json.loads((bundle_root() / 'contract-snapshot/page/component-catalog.json').read_text())}
_BINDING_FIELDS = ('xField', 'yField', 'categoryField', 'valueField', 'nameField', 'colorField', 'sizeField', 'longitudeField', 'latitudeField', 'changeField', 'targetField', 'progressField')
_COLUMN_FIELDS = ('id', 'title', 'label', 'width', 'align', 'sortable', 'filterable', 'format')


def read_page_projection(prepared, *, target_component_id=None, use_selection=False, offset=0, limit=20, cursor=None):
    b = prepared.binding
    document = prepared.baseline.document if prepared.baseline else {'sections': []}
    sections = document.get('sections', [])
    if (not isinstance(sections, list) or any(not isinstance(section, dict)
            or not isinstance(section.get('id'), str)
            or not isinstance(section.get('components', []), list)
            or any(not isinstance(component, dict)
                   or not isinstance(component.get('id'), str)
                   or not isinstance(component.get('type'), str)
                   or not isinstance(component.get('props', {}), dict)
                   or not isinstance(component.get('layout', {}), dict)
                   for component in section.get('components', [])) for section in sections)):
        raise ContentBaselineError('PAGE_CONTEXT_INVALID')
    if len(sections) > 200 or sum(len(s.get('components', [])) for s in sections) > _MAX_COMPONENTS:
        raise ContentBaselineError('PAGE_CONTEXT_SIZE_LIMIT')
    components = [(s.get('id'), index, c) for s in sections for index, c in enumerate(s.get('components', []))]
    target = target_component_id if target_component_id is not None else b['selectedComponentId'] if use_selection else None
    if use_selection and target is None:
        raise ContentBaselineError('COMPONENT_TARGET_REQUIRED')
    entries = []
    omitted = 0
    target_location = None
    section_info = {section.get('id'): section for section in sections}
    def scalar(value):
        return value is None or type(value) in (bool, int, float) or isinstance(value, str) and len(value) <= 256
    def fields(value, allowed, path, handled=()):
        nonlocal omitted
        if not isinstance(value, dict): return
        omitted += len(value.keys() - set(allowed) - set(handled))
        for key in allowed:
            if key not in value: continue
            if scalar(value[key]): entries.append({'path': path + '/' + key, 'value': value[key]})
            else: omitted += 1
    if target is not None:
        matches = [c for _, _, c in components if c.get('id') == target]
        if len(matches) != 1:
            raise ContentBaselineError('COMPONENT_TARGET_AMBIGUOUS' if matches else 'COMPONENT_TARGET_NOT_FOUND')
        component = matches[0]
        section_id, position, _ = next(item for item in components if item[2] is component)
        target_location = {'sectionId': section_id, 'position': position}
        fields(component, ('id', 'type'), '')
        fields(component.get('layout'), _LAYOUT_FIELDS, '/layout')
        known = component.get('type') in _KNOWN_TYPES
        fields(component.get('props'), _PROP_FIELDS if known else ('title',), '/props',
               _BINDING_FIELDS + ('series', 'columns') + (('rows',) if component.get('type') == 'metricCard' else ()) if known else ())
        if known:
            props = component.get('props', {})
            def binding(value, path):
                nonlocal omitted
                if isinstance(value, str) and len(value) <= 256:
                    entries.append({'path': path, 'value': value})
                elif isinstance(value, dict):
                    fields(value, ('data', 'field', 'format'), path)
                else:
                    omitted += 1
            slots = component.get('data', {})
            if isinstance(slots, dict):
                if len(slots) > 100: raise ContentBaselineError('PAGE_CONTEXT_SIZE_LIMIT')
                for slot, source in slots.items():
                    if isinstance(slot, str) and len(slot) <= 128 and isinstance(source, str) and len(source) <= 128:
                        entries.append({'path': '/data/' + slot.replace('~', '~0').replace('/', '~1'), 'value': source})
                    else: omitted += 1
            for key in _BINDING_FIELDS:
                if key in props: binding(props[key], '/props/' + key)
            # rows here are metric-card configuration recipes, never data-source rows.
            lists = [('series', ('label', 'color', 'type', 'stack', 'format'), ('field',)),
                     ('columns', _COLUMN_FIELDS, ('field',))]
            if component.get('type') == 'metricCard':
                lists.append(('rows', ('label', 'context', 'format'), _BINDING_FIELDS))
            for name, labels, bindings in lists:
                values = props.get(name, [])
                if not isinstance(values, list):
                    omitted += 1; continue
                if len(values) > 100: raise ContentBaselineError('PAGE_CONTEXT_SIZE_LIMIT')
                for index, value in enumerate(values):
                    if not isinstance(value, dict):
                        omitted += 1; continue
                    path = '/props/' + name + '/' + str(index)
                    fields(value, labels, path, bindings)
                    for key in bindings:
                        if key in value: binding(value[key], path + '/' + key)

    else:
        for section, index, component in components:
            item = {'sectionId': section, 'position': index, 'componentId': component.get('id'), 'type': component.get('type')}
            section_value = section_info.get(section, {})
            for key in ('title', 'container'):
                value = section_value.get(key)
                if isinstance(value, str) and len(value) <= 256:
                    item['section' + key.capitalize()] = value
            title = component.get('props', {}).get('title')
            if isinstance(title, str) and len(title) <= 256: item['title'] = title
            item['layout'] = {key: value for key, value in component.get('layout', {}).items() if key in _LAYOUT_FIELDS and scalar(value)}
            entries.append(item)
    fingerprint = hashlib.sha256(json.dumps([dict(b), target], sort_keys=True).encode()).hexdigest()
    if cursor is not None:
        try:
            prefix, position = cursor.split(':')
            if prefix != fingerprint or int(position) != offset: raise ValueError()
        except (ValueError, AttributeError):
            raise ContentBaselineError('PAGE_CONTEXT_CURSOR_STALE')
    elif offset:
        raise ContentBaselineError('PAGE_CONTEXT_CURSOR_REQUIRED')
    if offset > len(entries): raise ContentBaselineError('PAGE_CONTEXT_RANGE_INVALID')
    end = min(offset + limit, len(entries))
    return {'ok': True, 'contextRef': b['contextRef'], 'pageId': b['pageId'], 'baseRef': b['baseRef'],
            'documentSha256': b['documentSha256'], 'targetComponentId': target, 'targetLocation': target_location,
            'page': {'layout': document.get('layout'), 'sectionCount': len(sections), 'componentCount': len(components)},
            'entries': entries[offset:end], 'range': {'offset': offset, 'end': end, 'total': len(entries)},
            'omitted': {'entryCount': len(entries) - (end-offset), 'unsupportedFieldCount': omitted,
                        'categories': ['fullDocument', 'dataSources', 'businessDataRows', 'query', 'credentials', 'prompt', 'unsupportedConfiguration']},
            'nextCursor': f'{fingerprint}:{end}' if end < len(entries) else None}
