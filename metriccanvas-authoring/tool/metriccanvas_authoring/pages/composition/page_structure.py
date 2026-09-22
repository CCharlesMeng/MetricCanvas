"""Versioned authoring structure, expanded into the ordinary page protocol."""
from copy import deepcopy
import json
from jsonschema import Draft202012Validator

from metriccanvas_authoring.runtime_assets import bundle_root
from metriccanvas_authoring.build_issues import PageBuildingIssue
from metriccanvas_authoring.data.executable_units import ExecutableUnit, UnitScope
from metriccanvas_authoring.pages.components.capabilities import ASSEMBLED_COMPONENT_TYPES
from metriccanvas_authoring.pages.composition.page_building import (
    build_data_component as _component_for,
)
from metriccanvas_authoring.data.execution import DqeExecutionResult

ROOT = bundle_root()
PATTERNS = json.loads((ROOT / 'contracts/authored/section-patterns.json').read_text())
PLAN_SCHEMA = json.loads((ROOT / 'contracts/authored/page-structure-plan.schema.json').read_text())
V1_PLAN_SCHEMA, V2_PLAN_SCHEMA, V3_PLAN_SCHEMA = PLAN_SCHEMA['oneOf']
for version_schema in PLAN_SCHEMA['oneOf']:
    version_schema['properties']['scene']['enum'] = list(PATTERNS['scenes'])
    section_schema = version_schema['properties']['sections']['items']
    section_schema['properties']['pattern']['enum'] = list(PATTERNS['patterns'])
V2_PLAN_SCHEMA['properties']['sections']['items']['properties']['blocks']['items']['oneOf'][1]['properties']['presentation']['properties']['kind']['enum'] = list(PATTERNS['presentations'])
SECTION = V1_PLAN_SCHEMA['properties']['sections']['items']
BLOCK = SECTION['properties']['blocks']['items']
TEXT_BLOCK, DATA_BLOCK = BLOCK['oneOf']
V2_DATA_BLOCK = V2_PLAN_SCHEMA['properties']['sections']['items']['properties']['blocks']['items']['oneOf'][1]
ID = DATA_BLOCK['properties']['id']
TEXT = TEXT_BLOCK['properties']['body']
NAME = V1_PLAN_SCHEMA['properties']['dataContextVersion']


def obj(properties, required):
    return {'type': 'object', 'additionalProperties': False, 'properties': properties, 'required': required}


class StructureError(Exception):
    def __init__(self, code, path='', message=None):
        super().__init__(message or code)
        self.code, self.path = code, path

    def issue(self):
        return {'code': self.code, 'path': self.path}


def validate_plan(plan):
    errors = list(Draft202012Validator(PLAN_SCHEMA).iter_errors(plan))
    if errors:
        error = errors[0]
        raise StructureError('STRUCTURE_PLAN_INVALID', '/' + '/'.join(map(str, error.absolute_path)), error.message)
    sources = [r['dataSourceId'] for r in plan['dataRequests']]
    sections = [s['id'] for s in plan['sections']]
    blocks = [b for s in plan['sections'] for b in s['blocks']]
    ids = [b['id'] for b in blocks]
    if len(sources) != len(set(sources)) or len(sections) != len(set(sections)) or len(ids) != len(set(ids)):
        raise StructureError('STRUCTURE_ID_CONFLICT')
    generated_ids = {'page-header'} | {'structure-missing-' + i for i in ids} | {'structure-scope-' + i for i in sections}
    if 'header' in sections or set(ids) & generated_ids:
        raise StructureError('STRUCTURE_RESERVED_ID')
    if len(blocks) > 50:
        raise StructureError('STRUCTURE_BLOCK_BUDGET')
    used = {b['source'] for b in blocks if b['type'] == 'data'}
    if not used <= set(sources):
        raise StructureError('STRUCTURE_SOURCE_NOT_FOUND')
    if used != set(sources):
        raise StructureError('STRUCTURE_UNUSED_DATA_REQUEST')
    for section_index, section in enumerate(plan['sections']):
        for block_index, block in enumerate(section['blocks']):
            presentation = block.get('presentation')
            if presentation and (block.get('component') != 'metricCard' or block.get('type') != 'data'):
                raise StructureError('STRUCTURE_PRESENTATION_UNSUPPORTED', f'/sections/{section_index}/blocks/{block_index}/presentation')


def field_id(fields, reference):
    found = [key for key, field in fields.items()
             if reference in (key, field.get('queryField'), field.get('label'))]
    if len(found) != 1:
        raise StructureError('STRUCTURE_FIELD_AMBIGUOUS' if found else 'STRUCTURE_FIELD_NOT_FOUND', message=reference)
    return found[0]


def block_component(block, sources, pattern='custom', *, relations=()):
    """Reuse executed sources, never execute queries or aggregate result rows."""
    if block['type'] == 'text':
        props = {'body': block['body']}
        if 'title' in block:
            props['title'] = block['title']
        return {'id': block['id'], 'type': 'text', 'layout': {'span': 12}, 'props': props}
    source = sources.get(block['source'])
    if source is None:
        raise StructureError('STRUCTURE_SOURCE_NOT_FOUND')
    keys = [field_id(source['fields'], name) for name in block['fields']]
    if len(keys) != len(set(keys)):
        raise StructureError('STRUCTURE_DUPLICATE_FIELD')
    fields = {key: deepcopy(source['fields'][key]) for key in keys}
    initial = source['source'].get('initial', {})
    rows = initial.get('rows', [])
    count = initial.get('totalCount', len(rows))
    component_type = block['component']
    match = block.get('match')
    if match:
        if component_type != 'metricCard':
            raise StructureError('STRUCTURE_MATCH_UNSUPPORTED')
        match_id = field_id(source['fields'], match['field'])
        match_field = source['fields'][match_id]
        if match_field['role'] != 'dimension' or count != len(rows):
            raise StructureError('STRUCTURE_ROW_SELECTION_UNVERIFIED')
        selected = [r for r in rows if r.get(match_field.get('queryField', match_id)) == match['equals']]
        if len(selected) != 1:
            raise StructureError('STRUCTURE_ROW_SELECTION_AMBIGUOUS')
        count = 1
    if component_type in {'barChart', 'lineChart'}:
        measures = [f for f in fields.values() if f['role'] == 'measure']
        units = {(f.get('unit'), f.get('currency'), f.get('scale')) for f in measures}
        if len(units) > 1:
            raise StructureError('STRUCTURE_MIXED_MEASURE_UNITS')
    if component_type == 'pieChart' and count != len(rows):
        raise StructureError('STRUCTURE_INCOMPLETE_PROPORTION')
    from metriccanvas_authoring.pages.components.structure_presentation import purpose_intent
    unit = ExecutableUnit(block['source'], block['title'], fields, {}, block.get('intent', purpose_intent(block.get('purpose'))),
                          component_type, UnitScope('', (), '', '', ()), ())
    try:
        component = _component_for(unit, DqeExecutionResult(rows=rows, total_count=count), 0)
    except PageBuildingIssue as error:
        raise StructureError(error.code, error.path, error.message) from error
    component['id'] = block['id']
    if block.get('presentation', {}).get('kind') == 'metric-summary':
        from metriccanvas_authoring.pages.components.section_presentation import present_metric_summary
        component = present_metric_summary(block, source, component, relations)
    elif match:
        for row in component['props']['rows']:
            row['valueField'] = {'data': 'main', 'field': row['valueField'],
                                 'match': {'field': match_id, 'equals': match['equals']}}
    from metriccanvas_authoring.pages.components.structure_presentation import apply_presentation
    component = apply_presentation(block, source, component)
    recipe = PATTERNS['patterns'][pattern]
    default = (PATTERNS['presentations']['metric-summary']['metricSpan'] if block.get('presentation', {}).get('kind') == 'metric-summary'
               else recipe['metricSpan'] if component_type == 'metricCard' else recipe['defaultSpan'])
    if component_type in {'table', 'lineChart'}:
        default = 12
    component['layout']['span'] = {'full': 12, 'half': 6, 'third': 4, 'two-thirds': 8}.get(block.get('width'), default)
    return component


def scope_note(request):
    time = request.get('time') or {}
    group = '、'.join(request['groupBy']) or '总量'
    period = f"{time.get('start', '未指定')} 至 {time.get('end', '未指定')}"
    filters = '；'.join(f"{f['dimension']}={','.join(f['values'])}" for f in request['filters'])
    return f"{request['businessDomain']}；{period}；{time.get('granularity', '未指定粒度')}；按{group}" + (f"；{filters}" if filters else '')


def scope_notes(requests):
    """Deduplicate program-generated notes by scope facts, never human text."""
    seen, notes = set(), []
    for request in requests:
        time = request.get('time') or {}
        signature = (request['businessDomain'], tuple(sorted(request['groupBy'])),
                     tuple(sorted((f['dimension'], tuple(sorted(f['values']))) for f in request['filters'])),
                     time.get('start'), time.get('end'), time.get('granularity'))
        if signature not in seen:
            seen.add(signature)
            notes.append(scope_note(request))
    return notes
