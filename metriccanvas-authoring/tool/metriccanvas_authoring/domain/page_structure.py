"""Versioned authoring structure, expanded into the ordinary page protocol."""
from copy import deepcopy
import json
from jsonschema import Draft202012Validator

from metriccanvas_authoring.runtime_assets import bundle_root
from metriccanvas_authoring.domain.page_building import (
    ExecutableUnit, UnitScope, PageBuildingIssue, build_data_component, ASSEMBLED_COMPONENT_TYPES,
)
from metriccanvas_authoring.domain.execution import DqeExecutionResult

ROOT = bundle_root()
PATTERNS = json.loads((ROOT / 'contracts/authored/section-patterns.json').read_text())
SPEC = json.loads((ROOT / 'contracts/authored/page-build-spec.schema.json').read_text())
INTENTS = json.loads((ROOT / 'contracts/exported/analysis-intents.json').read_text())['intents']


def inline_schema(value):
    """Share governed query definitions without exposing refs to the model."""
    if isinstance(value, list):
        return [inline_schema(v) for v in value]
    if not isinstance(value, dict):
        return value
    if '$ref' in value:
        return inline_schema(SPEC['$defs'][value['$ref'].split('/')[-1]])
    return {k: inline_schema(v) for k, v in value.items() if k not in {'$id', '$schema', '$defs'}}


def obj(properties, required):
    return {'type': 'object', 'additionalProperties': False, 'properties': properties, 'required': required}


NAME = {'type': 'string', 'minLength': 1, 'maxLength': 128}
PAGE_SCHEMA = json.loads((ROOT / 'contract-snapshot/page/schema.json').read_text())
ID = {**NAME, 'pattern': PAGE_SCHEMA['properties']['id']['pattern']}
TEXT = {'type': 'string', 'minLength': 1, 'maxLength': 8000}
WIDTH = {'enum': ['full', 'half', 'third', 'two-thirds']}
BASE = {'id': ID, 'title': TEXT, 'width': WIDTH}
TEXT_BLOCK = obj({'id': ID, 'title': TEXT, 'type': {'const': 'text'}, 'body': TEXT}, ['id', 'type', 'body'])
DATA_BLOCK = obj({**BASE, 'type': {'const': 'data'}, 'source': ID,
                  'component': {'enum': sorted(ASSEMBLED_COMPONENT_TYPES)},
                  'intent': {'enum': INTENTS},
                  'fields': {'type': 'array', 'minItems': 1, 'maxItems': 30, 'uniqueItems': True, 'items': NAME},
                  'match': obj({'field': NAME, 'equals': {'type': ['string', 'number', 'boolean']}}, ['field', 'equals'])},
                 ['id', 'type', 'source', 'component', 'fields', 'title'])
BLOCK = {'oneOf': [TEXT_BLOCK, DATA_BLOCK]}
SECTION = obj({'id': ID, 'title': TEXT, 'pattern': {'enum': list(PATTERNS['patterns'])},
               'container': {'enum': ['plain', 'panel', 'card']},
               'blocks': {'type': 'array', 'minItems': 1, 'maxItems': 24, 'items': BLOCK}},
              ['id', 'title', 'pattern', 'blocks'])
DATA_REQUEST = inline_schema(SPEC['$defs']['unit'])
for key in ('intent', 'pinnedComponent', 'title'):
    DATA_REQUEST['properties'].pop(key, None)
DATA_REQUEST['required'] = list(dict.fromkeys([k for k in DATA_REQUEST['required'] if k != 'intent'] + ['dataSourceId']))
DATA_REQUEST['properties']['dataSourceId'] = ID
# The new structural path does not introduce an ad-hoc formula approval flow.
DATA_REQUEST['properties']['metrics']['items'] = inline_schema(SPEC['$defs']['metric']['oneOf'][0])
PLAN_SCHEMA = obj({'version': {'const': '1'}, 'scene': {'enum': PATTERNS['scenes']},
                   'question': TEXT, 'dataContextVersion': NAME,
                   'dataRequests': {'type': 'array', 'maxItems': 6, 'items': DATA_REQUEST},
                   'sections': {'type': 'array', 'minItems': 1, 'maxItems': 12, 'items': SECTION}},
                  ['version', 'scene', 'question', 'dataContextVersion', 'dataRequests', 'sections'])


class StructureError(Exception):
    def __init__(self, code, path='', message=None):
        super().__init__(message or code)
        self.code, self.path = code, path

    def issue(self):
        return {'code': self.code, 'path': self.path, 'message': str(self)}


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


def field_id(fields, reference):
    found = [key for key, field in fields.items()
             if reference in (key, field.get('queryField'), field.get('label'))]
    if len(found) != 1:
        raise StructureError('STRUCTURE_FIELD_AMBIGUOUS' if found else 'STRUCTURE_FIELD_NOT_FOUND', message=reference)
    return found[0]


def block_component(block, sources, pattern='custom'):
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
    unit = ExecutableUnit(block['source'], block['title'], fields, {}, block.get('intent', 'detail'),
                          component_type, UnitScope('', (), '', '', ()), ())
    try:
        component = build_data_component(unit, DqeExecutionResult(rows=rows, total_count=count), 0)
    except PageBuildingIssue as error:
        raise StructureError(error.code, error.path, error.message) from error
    component['id'] = block['id']
    if match:
        for row in component['props']['rows']:
            row['valueField'] = {'data': 'main', 'field': row['valueField'],
                                 'match': {'field': match_id, 'equals': match['equals']}}
    recipe = PATTERNS['patterns'][pattern]
    default = recipe['metricSpan'] if component_type == 'metricCard' else recipe['defaultSpan']
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
