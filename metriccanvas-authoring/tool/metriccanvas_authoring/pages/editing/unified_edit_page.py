"""Unified async edit scheduler; data dependencies apply as one validated group."""
from copy import deepcopy
import json

from metriccanvas_authoring.data.query import create_query_data
from metriccanvas_authoring.pages.components.component_policy import apply_component_policy
from metriccanvas_authoring.build_issues import PageBuildingIssue
from metriccanvas_authoring.data.executable_units import build_query_source
from metriccanvas_authoring.pages.composition.page_building import build_data_component
from metriccanvas_authoring.pages.editing.page_editing import EDIT_SCHEMA, apply_page_operation
from metriccanvas_authoring.domain.page_validation import validate_page_document
from metriccanvas_authoring.runtime_assets import bundle_root
from metriccanvas_authoring.pages.editing.section_editing import SECTION_OPERATIONS, SECTION_TYPES, edit_section
from metriccanvas_authoring.pages.composition.page_structure import StructureError

_ROOT = bundle_root() / 'contracts/authored'
_SPEC = json.loads((_ROOT/'page-build-spec.schema.json').read_text())
_DATA = json.loads((_ROOT/'add-data-component.schema.json').read_text())


def _inline_spec(value):
    if isinstance(value, list): return [_inline_spec(v) for v in value]
    if not isinstance(value, dict): return value
    if '$ref' in value:
        ref = value['$ref']
        if not ref.startswith('#/$defs/'): raise ValueError('Unsupported authored reference')
        return _inline_spec(_SPEC['$defs'][ref.split('/')[-1]])
    return {k:_inline_spec(v) for k,v in value.items() if k not in {'$id','$schema','$defs'}}


# Compose actual tool schema from unique authored inputs, with no unresolved refs.
_DATA = {k:v for k,v in _DATA.items() if k not in {'$id','$schema'}}
_DATA['properties']['spec'] = _inline_spec(_SPEC)
_DATA['properties']['spec']['properties']['units']['maxItems'] = 1
UNIFIED_EDIT_SCHEMA = deepcopy(EDIT_SCHEMA)
UNIFIED_EDIT_SCHEMA['properties']['operations']['items']['oneOf'].append(_DATA)
UNIFIED_EDIT_SCHEMA['properties']['operations']['items']['oneOf'].extend(SECTION_OPERATIONS)


def _issue(code, path=''):
    return {'code':code, 'path':path}


async def _add_data(document, op, dependencies, evidence):
    sections = [s for s in document['sections'] if s['id'] == op['sectionId']]
    if len(sections) != 1: return None, [_issue('SECTION_NOT_FOUND')]
    if any(c['id'] == op['componentId'] for s in document['sections'] for c in s['components']):
        return None, [_issue('COMPONENT_ID_CONFLICT')]
    position = op.get('position', len(sections[0]['components']))
    if position > len(sections[0]['components']): return None, [_issue('COMPONENT_POSITION_INVALID')]
    base = op['spec'].get('baseRevision')
    if isinstance(base, dict) and base.get('pageId') != document['id']:
        return None, [_issue('BASE_REVISION_PAGE_ID_MISMATCH', '/baseRevision/pageId')]
    built = await create_query_data(dependencies)(op['spec'])
    if not built.ok:
        return None, [_issue(i.code, i.path) for i in built.issues]
    if len(built.units) != 1: return None, [_issue('DATA_COMPONENT_COUNT_UNSUPPORTED')]
    try:
        units = await apply_component_policy(built.units, built.executions, dependencies.component_policy, dependencies.authoring_scope)
        component = build_data_component(units[0], built.executions[0], 0)
    except PageBuildingIssue as error:
        return None, [_issue(error.code, error.path)]
    sources = {units[0].data_source_id: build_query_source(units[0], built.executions[0])}
    candidate = deepcopy(document)
    for source_id, source in sources.items():
        if source_id in candidate['dataSources']:
            existing = candidate['dataSources'][source_id]
            # Reuse only a proven identical query+field contract; never replace old rows.
            same = (existing.get('fields') == source['fields'] and
                    existing.get('source', {}).get('type') == 'query' and
                    existing['source'].get('query') == source['source'].get('query'))
            if not same: return None, [_issue('DATA_SOURCE_CONFLICT')]
        else: candidate['dataSources'][source_id] = deepcopy(source)
    component = deepcopy(component); component['id'] = op['componentId']
    # A standalone addition retains the former single-unit full-row layout.
    component['layout']['span'] = 12
    target = next(s for s in candidate['sections'] if s['id'] == op['sectionId'])
    target['components'].insert(position, component)
    errors = validate_page_document(candidate)
    if errors: return None, [_issue(e.type, e.path) for e in errors]
    evidence.extend(deepcopy(built.source_descriptions))
    return candidate, []


async def edit_unified_page(baseline, request, dependencies, *, summary_enabled=False, current):
    from metriccanvas_authoring.pages.editing.operation_batch import operation_batch
    batch = operation_batch(baseline, request, UNIFIED_EDIT_SCHEMA['properties']['operations']['items'])
    result = None
    source_descriptions = []
    while True:
        await current()
        try:
            document, op = batch.send(result)
        except StopIteration as completed:
            return {**completed.value, 'sourceDescriptions': source_descriptions}
        if op['type'] == 'add_data_component':
            candidate, issues = await _add_data(document, op, dependencies, source_descriptions)
            await current()
            result = candidate, issues, []
        elif op['type'] in SECTION_TYPES:
            try:
                result = edit_section(document, op), [], []
            except StructureError as error:
                result = None, [error.issue()], []
        else:
            result = apply_page_operation(document, op, summary_enabled=summary_enabled)
