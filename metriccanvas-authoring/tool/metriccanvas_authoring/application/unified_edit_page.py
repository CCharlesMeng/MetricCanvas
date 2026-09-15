"""Unified async edit scheduler; data dependencies apply as one validated group."""
from copy import deepcopy
import json
from jsonschema import Draft202012Validator

from .compose_page import ComposePageCommand, create_compose_page
from metriccanvas_authoring.domain.page_editing import EDIT_SCHEMA, edit_page_document
from metriccanvas_authoring.domain.page_validation import normalize_page_document, validate_page_document
from metriccanvas_authoring.runtime_assets import bundle_root

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
_OPERATION = Draft202012Validator(UNIFIED_EDIT_SCHEMA['properties']['operations']['items'])


def _issue(code, path=''):
    return {'code':code, 'path':path}


async def _add_data(document, op, dependencies, evidence):
    sections = [s for s in document['sections'] if s['id'] == op['sectionId']]
    if len(sections) != 1: return None, [_issue('SECTION_NOT_FOUND')]
    if any(c['id'] == op['componentId'] for s in document['sections'] for c in s['components']):
        return None, [_issue('COMPONENT_ID_CONFLICT')]
    position = op.get('position', len(sections[0]['components']))
    if position > len(sections[0]['components']): return None, [_issue('COMPONENT_POSITION_INVALID')]
    built = await create_compose_page(dependencies)(ComposePageCommand(document['id'], op['spec']))
    if not built.ok or built.artifact is None:
        return None, [_issue(i.code, i.path) for i in built.issues]
    produced = built.artifact.document
    components = [c for s in produced['sections'] for c in s['components'] if c['type'] != 'reportHeader']
    if len(components) != 1: return None, [_issue('DATA_COMPONENT_COUNT_UNSUPPORTED')]
    candidate = deepcopy(document)
    for source_id, source in produced['dataSources'].items():
        if source_id in candidate['dataSources']:
            existing = candidate['dataSources'][source_id]
            # Reuse only a proven identical query+field contract; never replace old rows.
            same = (existing.get('fields') == source['fields'] and
                    existing.get('source', {}).get('type') == 'query' and
                    existing['source'].get('query') == source['source'].get('query'))
            if not same: return None, [_issue('DATA_SOURCE_CONFLICT')]
        else: candidate['dataSources'][source_id] = deepcopy(source)
    component = deepcopy(components[0]); component['id'] = op['componentId']
    target = next(s for s in candidate['sections'] if s['id'] == op['sectionId'])
    target['components'].insert(position, component)
    errors = validate_page_document(candidate)
    if errors: return None, [_issue(e.type, e.path) for e in errors]
    evidence.extend(deepcopy(built.artifact.source_descriptions))
    return candidate, []


async def edit_unified_page(baseline, request, dependencies, *, summary_enabled=False, current):
    normalized = normalize_page_document(baseline)
    if not normalized['ok']:
        return {'status':'invalid_baseline','document':None,'operations':[], 'issues':[_issue('BASELINE_INVALID')]}
    if (not isinstance(request, dict) or set(request) != {'operations'} or
            not isinstance(request['operations'], list) or not 1 <= len(request['operations']) <= 50):
        return {'status':'invalid_request','document':None,'operations':[], 'issues':[_issue('EDIT_REQUEST_INVALID')]}
    operations = request['operations']
    ids = [op.get('id') if isinstance(op, dict) else None for op in operations]
    if any(not isinstance(i,str) or not 0 < len(i) <= 128 for i in ids) or len(set(ids)) != len(ids):
        return {'status':'invalid_request','document':None,'operations':[], 'issues':[_issue('OPERATION_IDS_INVALID')]}
    original = normalized['document']; document = deepcopy(original)
    results, states = [], {}
    source_descriptions = []
    for index, op in enumerate(operations):
        await current()
        result = {'id':op['id'], 'status':'failed', 'issues':[], 'adjustments':[]}
        if not _OPERATION.is_valid(op):
            result['issues'] = [_issue('OPERATION_INVALID', f'/operations/{index}')]
        elif any(states.get(dep) not in {'applied','unchanged'} for dep in op.get('dependsOn', [])):
            result.update(status='skipped', issues=[_issue('DEPENDENCY_NOT_SUCCEEDED', f'/operations/{index}/dependsOn')])
        elif op['type'] == 'add_data_component':
            candidate, issues = await _add_data(document, op, dependencies, source_descriptions)
            await current()
            result['issues'] = issues
            if candidate is not None:
                result['status'] = 'applied'; document = candidate
        else:
            local = {k:v for k,v in op.items() if k != 'dependsOn'}
            edited = edit_page_document(document, {'operations':[local]}, summary_enabled=summary_enabled)
            if edited['operations']: result = edited['operations'][0]
            else: result['issues'] = edited['issues']
            if edited['document'] is not None: document = edited['document']
        results.append(result); states[op['id']] = result['status']
    changed = document != original
    failed = any(r['status'] in {'failed','skipped'} for r in results)
    status = ('partial' if failed else 'changed') if changed else ('failed' if all(r['status'] in {'failed','skipped'} for r in results) else 'unchanged')
    if validate_page_document(document):
        return {'status':'failed','document':None,'operations':[], 'issues':[_issue('EDIT_RESULT_INVALID')]}
    return {'status':status, 'document':document if changed else None, 'operations':results, 'issues':[], 'sourceDescriptions':source_descriptions}
