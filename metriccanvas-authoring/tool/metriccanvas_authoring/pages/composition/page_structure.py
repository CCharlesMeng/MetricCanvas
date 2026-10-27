"""Versioned authoring structure, expanded into the ordinary page protocol."""
from copy import deepcopy
from metriccanvas_authoring.work.diagnostics import public_issue
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

# Re-export existing names for callers; the build exporter shares this active contract.
from metriccanvas_authoring.pages.compose_contract import (
    ROOT, PATTERNS, PLAN_SCHEMA, CURRENT_PLAN_SCHEMA, SECTION, BLOCK,
    TEXT_BLOCK, DATA_BLOCK, ID, TEXT, NAME, obj,
)


class StructureError(Exception):
    def __init__(self, code, path='', message=None, *, reason=None, candidates=()):
        super().__init__(message or code)
        self.code, self.path, self.reason = code, path, reason
        self.candidates = candidates

    def issue(self):
        value = public_issue(self)
        if self.candidates:
            value['candidates'] = list(self.candidates)[:10]
        return value


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



def select_metric_row(block, fields, rows, count):
    """One completeness/uniqueness decision shared by every metric-card presentation."""
    if count is None or count != len(rows):
        raise StructureError('STRUCTURE_ROW_SELECTION_UNVERIFIED', '/match')
    match = block.get('match')
    match_id = field_id(fields, match['field']) if match else None
    if match and fields[match_id]['role'] != 'dimension':
        raise StructureError('STRUCTURE_ROW_SELECTION_UNVERIFIED', '/match/field')
    selected = [row for row in rows if row.get(fields[match_id].get('queryField', match_id)) == match['equals']] if match else rows
    if len(selected) != 1:
        raise StructureError('STRUCTURE_ROW_SELECTION_AMBIGUOUS', '/match')
    return match_id, selected



def paged_table_component(block, source, keys):
    if block['component'] != 'table':
        raise StructureError('STRUCTURE_COMPONENT_INVALID')
    props = {'rowKey': source['source']['rowKey'], 'pagination': {'mode': 'query'},
             'columns': [{'field': field, 'sortable': field in source['source']['ordering']['sortableFields']} for field in keys]}
    if 'title' in block:
        props['title'] = block['title']
    return {'id': block['id'], 'type': 'table', 'data': {'main': block['source']}, 'layout': {'span': 12}, 'props': props}


def validate_chart_evidence(component_type, fields, rows, count):
    if component_type in {'barChart', 'lineChart'}:
        measures = [f for f in fields.values() if f['role'] == 'measure']
        units = {(f.get('unit'), f.get('currency'), f.get('scale')) for f in measures}
        if len(units) > 1:
            raise StructureError('STRUCTURE_MIXED_MEASURE_UNITS')
    if component_type == 'pieChart' and count != len(rows):
        raise StructureError('STRUCTURE_INCOMPLETE_PROPORTION')


def component_span(block, pattern, component_type):
    recipe = PATTERNS['patterns'][pattern]
    default = (PATTERNS['presentations']['metric-summary']['metricSpan'] if block.get('presentation', {}).get('kind') == 'metric-summary'
               else recipe['metricSpan'] if component_type == 'metricCard' else recipe['defaultSpan'])
    if component_type in {'table', 'lineChart'}:
        default = 12
    return {'full': 12, 'half': 6, 'third': 4, 'two-thirds': 8}.get(block.get('width'), default)



def component_rows(source, evidence):
    if evidence is not None:
        return evidence['rows'], evidence['totalCount']
    raw = source['source']
    initial = raw if raw['type'] == 'inline' else raw.get('initial', {})
    rows = initial.get('rows', [])
    count = initial.get('totalCount', len(rows) if raw['type'] == 'inline' else None)
    return rows, count


def block_component(block, sources, pattern='custom', *, relations=(), evidence=None):
    """Reuse executed sources, never execute queries or aggregate result rows."""
    if block['type'] == 'text':
        props = {'body': block['body']}
        if 'title' in block:
            props['title'] = block['title']
        return {'id': block['id'], 'type': 'text', 'layout': {'span': 12}, 'props': props}
    source = sources.get(block['source'])
    if source is None:
        raise StructureError('STRUCTURE_SOURCE_NOT_FOUND', '/source', candidates=tuple(sources))
    keys = [field_id(source['fields'], name) for name in block['fields']]
    if len(keys) != len(set(keys)):
        raise StructureError('STRUCTURE_DUPLICATE_FIELD')
    fields = {key: deepcopy(source['fields'][key]) for key in keys}
    rows, count = component_rows(source, evidence)
    component_type = block['component']
    if source['source']['type'] == 'pagedJoin':
        return paged_table_component(block, source, keys)
    match = block.get('match')
    if match and component_type != 'metricCard':
        raise StructureError('STRUCTURE_MATCH_UNSUPPORTED', '/match')
    if component_type == 'metricCard':
        match_id, rows = select_metric_row(block, source['fields'], rows, count)
        count = 1
    validate_chart_evidence(component_type, fields, rows, count)
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
        component = present_metric_summary(block, source, component, relations, match_id=match_id)
    elif match:
        for row in component['props']['rows']:
            row['valueField'] = {'data': 'main', 'field': row['valueField'],
                                 'match': {'field': match_id, 'equals': match['equals']}}
    from metriccanvas_authoring.pages.components.structure_presentation import apply_presentation
    component = apply_presentation(block, source, component)
    component['layout']['span'] = component_span(block, pattern, component_type)
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
