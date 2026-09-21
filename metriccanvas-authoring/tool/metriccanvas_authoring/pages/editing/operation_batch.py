"""One batch policy shared by synchronous and asynchronous edit use cases.

The generator yields isolated operation inputs and receives (document, issues,
adjustments). It owns identity, dependency ordering, rollback, validation and
partial/unchanged aggregation; operation handlers do not schedule batches.
"""
from copy import deepcopy
from jsonschema import Draft202012Validator
from metriccanvas_authoring.domain.page_validation import normalize_page_document, validate_page_document


def operation_batch(baseline, request, operation_schema):
    normalized = normalize_page_document(baseline)
    if not normalized['ok']:
        return {'status': 'invalid_baseline', 'document': None, 'operations': [],
                'issues': [{'code': 'BASELINE_INVALID', 'path': e['path']} for e in normalized['errors']]}
    if (not isinstance(request, dict) or set(request) != {'operations'}
            or not isinstance(request['operations'], list) or not 1 <= len(request['operations']) <= 50):
        return {'status': 'invalid_request', 'document': None, 'operations': [],
                'issues': [{'code': 'EDIT_REQUEST_INVALID', 'path': ''}]}
    operations = request['operations']
    ids = [op.get('id') if isinstance(op, dict) else None for op in operations]
    if any(not isinstance(i, str) or not 0 < len(i) <= 128 for i in ids) or len(set(ids)) != len(ids):
        return {'status': 'invalid_request', 'document': None, 'operations': [],
                'issues': [{'code': 'OPERATION_IDS_INVALID', 'path': '/operations'}]}
    original = normalized['document']
    document = deepcopy(original)
    results, states = [], {}
    validator = Draft202012Validator(operation_schema)
    for index, op in enumerate(operations):
        result = {'id': op['id'], 'status': 'failed', 'issues': [], 'adjustments': []}
        if not validator.is_valid(op):
            result['issues'] = [{'code': 'OPERATION_INVALID', 'path': f'/operations/{index}'}]
        elif any(states.get(dep) not in {'applied', 'unchanged'} for dep in op.get('dependsOn', [])):
            result.update(status='skipped', issues=[{'code': 'DEPENDENCY_NOT_SUCCEEDED', 'path': f'/operations/{index}/dependsOn'}])
        else:
            candidate, issues, adjustments = yield deepcopy(document), deepcopy(op)
            result['issues'] = issues
            if candidate is not None and not issues:
                errors = validate_page_document(candidate)
                if errors:
                    result['issues'] = [{'code': e.type, 'path': e.path} for e in errors]
                else:
                    result['status'] = 'unchanged' if candidate == document else 'applied'
                    result['adjustments'] = adjustments if result['status'] == 'applied' else []
                    document = candidate
        results.append(result)
        states[op['id']] = result['status']
    changed = document != original
    failed = any(r['status'] in {'failed', 'skipped'} for r in results)
    status = ('partial' if failed else 'changed') if changed else (
        'failed' if all(r['status'] in {'failed', 'skipped'} for r in results) else 'unchanged')
    if validate_page_document(document):
        return {'status': 'failed', 'document': None, 'operations': [],
                'issues': [{'code': 'EDIT_RESULT_INVALID', 'path': ''}]}
    return {'status': status, 'document': document if changed else None, 'operations': results, 'issues': []}
