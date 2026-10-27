"""One batch policy shared by synchronous and asynchronous edit use cases.

The generator yields isolated operation inputs and receives (document, issues,
adjustments). It owns identity, dependency ordering, rollback, validation and
partial/unchanged aggregation; operation handlers do not schedule batches.
"""
from copy import deepcopy
from metriccanvas_authoring.work.diagnostics import schema_issues, issue_details
from jsonschema import Draft202012Validator
from metriccanvas_authoring.pages.validation.page_validation import normalize_page_document, validate_page_document
from metriccanvas_authoring.pages.composition.table_pagination import add_query_table_pagination, _components


def operation_batch(baseline, request, operation_schema):
    normalized = normalize_page_document(baseline)
    if not normalized['ok']:
        return {'status': 'invalid_baseline', 'document': None, 'operations': [],
                'issues': [{'code': 'BASELINE_INVALID', 'path': e['path']} for e in normalized['errors']]}
    invalid = _batch_request_issue(request)
    if invalid is not None:
        return invalid
    operations = request['operations']
    original = normalized['document']
    document = deepcopy(original)
    results, states = [], {}
    validator = Draft202012Validator(operation_schema)
    for index, op in enumerate(operations):
        document, result = yield from _apply_operation(document, op, index, validator, states)
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


def _apply_operation(document, op, index, validator, states):
    result = {'id': op['id'], 'status': 'failed', 'issues': [], 'adjustments': []}
    invalid = schema_issues(validator.schema, op, 'OPERATION_INVALID')
    if invalid:
        result['issues'] = invalid
    elif any(states.get(dep) not in {'applied', 'unchanged'} for dep in op.get('dependsOn', [])):
        result.update(status='skipped', issues=[{'code': 'DEPENDENCY_NOT_SUCCEEDED', 'path': '/dependsOn'}])
    else:
        candidate, issues, adjustments = yield deepcopy(document), deepcopy(op)
        result['issues'] = issues
        if candidate is not None and not issues:
            prior_types = {component['id']: component['type'] for component in _components(document)}
            new_tables = {component['id'] for component in _components(candidate)
                          if component['type'] == 'table' and prior_types.get(component['id']) != 'table'}
            add_query_table_pagination(candidate, new_tables)
            errors = validate_page_document(candidate)
            if errors:
                result['issues'] = [{**issue_details(e.type, e.path), 'pathScope': 'document'} for e in errors]
            else:
                result['status'] = 'unchanged' if candidate == document else 'applied'
                result['adjustments'] = adjustments if result['status'] == 'applied' else []
                document = candidate
    _locate_issues(result, op['id'], index)
    _component_state(result, document, op)
    return document, result



def _component_state(result, document, operation):
    target = operation.get('componentId') or operation.get('block', {}).get('id')
    if target:
        found = next((c for c in _components(document) if c['id'] == target), None)
        result['component'] = {'id': target, 'exists': found is not None,
                               'type': found['type'] if found is not None else None}


def _locate_issues(result, operation_id, index):
    for issue in result['issues']:
        issue['operationId'] = operation_id
        if issue.get('pathScope') != 'document':
            issue.update(path=f'/operations/{index}' + issue.get('path', ''), pathScope='input')


def _batch_request_issue(request):
    if (not isinstance(request, dict) or set(request) != {'operations'}
            or not isinstance(request['operations'], list) or not 1 <= len(request['operations']) <= 50):
        return {'status': 'invalid_request', 'document': None, 'operations': [],
                'issues': [{'code': 'EDIT_REQUEST_INVALID', 'path': ''}]}
    operations = request['operations']
    ids = [op.get('id') if isinstance(op, dict) else None for op in operations]
    if any(not isinstance(i, str) or not 0 < len(i) <= 128 for i in ids) or len(set(ids)) != len(ids):
        return {'status': 'invalid_request', 'document': None, 'operations': [],
                'issues': [{'code': 'OPERATION_IDS_INVALID', 'path': '/operations'}]}
    return None
