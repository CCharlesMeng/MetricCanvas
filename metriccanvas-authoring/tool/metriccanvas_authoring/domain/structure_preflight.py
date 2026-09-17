"""Pure bounded structural checks. Data overlap is a fact, never a deletion policy."""
import json
from collections import Counter
from jsonschema import Draft202012Validator
from metriccanvas_authoring.domain.page_structure import V1_PLAN_SCHEMA, V2_PLAN_SCHEMA, V3_PLAN_SCHEMA
from metriccanvas_authoring.domain.structure_diagnostics import schema_issues
from metriccanvas_authoring.domain.structure_presentation import PRESENTATION_COMPONENTS


def query_signature(request, version):
    value = {k: v for k, v in request.items() if k != 'dataSourceId'}
    value['metrics'] = sorted(value.get('metrics', []), key=lambda m: json.dumps(m, sort_keys=True))
    value['groupBy'] = sorted(value.get('groupBy', []))
    value['filters'] = sorted([{'dimension': f['dimension'], 'values': sorted(f['values'])}
                               for f in value.get('filters', [])], key=lambda f: json.dumps(f, sort_keys=True))
    if value.get('time'):
        value['time'] = {k: v for k, v in value['time'].items() if k != 'providedBy'}
    return json.dumps({'snapshot': version, 'request': value}, ensure_ascii=False, sort_keys=True)


def inspect_plan(plan):
    issues, overlaps = [], []
    def issue(code, path='', ids=(), blocking=True):
        issues.append({'code': code, 'path': path, 'objectIds': list(ids), 'blocking': blocking,
                       'options': ['revise-reference', 'remove-block'] if blocking else ['keep-for-purpose', 'revise-content']})
    version = plan.get('version') if isinstance(plan, dict) else None
    schema = {'1': V1_PLAN_SCHEMA, '2': V2_PLAN_SCHEMA, '3': V3_PLAN_SCHEMA}.get(version)
    if schema is None:
        issue('STRUCTURE_PLAN_INVALID', '/version')
    else:
        issues.extend(schema_issues(schema, plan))
    if issues:
        return {'issues': issues[:50], 'fatal': True, 'overlapFindings': [],
                'truncation': {'issues': max(0, len(issues)-50), 'overlapFindings': 0}}
    sources = {r['dataSourceId']: r for r in plan['dataRequests']}
    sections = plan['sections']
    blocks = [(si, bi, b) for si, s in enumerate(sections) for bi, b in enumerate(s['blocks'])]
    for values in ([r['dataSourceId'] for r in plan['dataRequests']], [s['id'] for s in sections], [b['id'] for _, _, b in blocks]):
        for key, count in Counter(values).items():
            if count > 1: issue('STRUCTURE_ID_CONFLICT', ids=[key])
    reserved = {'page-header', 'structure-scope-page'} | {'structure-missing-' + b['id'] for _, _, b in blocks} | {'structure-scope-' + s['id'] for s in sections}
    if any(s['id'] == 'header' for s in sections) or any(b['id'] in reserved for _, _, b in blocks):
        issue('STRUCTURE_RESERVED_ID')
    if len(blocks) > 50: issue('STRUCTURE_BLOCK_BUDGET')
    fatal = bool(issues)
    seen = {}
    used = set()
    for si, bi, b in blocks:
        path = f'/sections/{si}/blocks/{bi}'
        if b['type'] == 'text': continue
        source = b['source']; used.add(source)
        if source not in sources:
            issue('STRUCTURE_SOURCE_NOT_FOUND', path + '/source', [b['id'], source])
            continue
        request = sources[source]
        # References may be governed labels or stable field IDs; exact resolution happens after mapping.
        if b.get('presentation') and PRESENTATION_COMPONENTS.get(b['presentation']['kind']) != b['component']:
            issue('STRUCTURE_PRESENTATION_UNSUPPORTED', path + '/presentation', [b['id']])
            if version == '3': fatal = True
        if b.get('match') and b['component'] != 'metricCard':
            issue('STRUCTURE_MATCH_UNSUPPORTED', path + '/match', [b['id']])
        sig = query_signature(request, plan['dataContextVersion'])
        key = (sig, json.dumps(b.get('match'), sort_keys=True), tuple(sorted(b['fields'])))
        if key in seen:
            overlaps.append({'code': 'STRUCTURE_REFERENCE_OVERLAP', 'blockIds': [seen[key], b['id']],
                             'blocking': False, 'fact': 'same-request-fields-selection',
                             'purposes': [next(x.get('purpose') for _, _, x in blocks if x['id'] == seen[key]), b.get('purpose')]})
        else: seen[key] = b['id']
    for key in sources.keys() - used:
        issue('STRUCTURE_UNUSED_DATA_REQUEST', '/dataRequests', [key])
    return {'issues': issues[:50], 'fatal': fatal, 'overlapFindings': overlaps[:50],
            'truncation': {'issues': max(0, len(issues)-50), 'overlapFindings': max(0, len(overlaps)-50)}}


def preflight(plan):
    return inspect_plan(plan)['issues']
