"""Optional multislot operations; the original thirteen operation descriptors stay frozen."""
from copy import deepcopy
from dataclasses import replace
from metriccanvas_authoring.bundle_info import load_bundle_info
from metriccanvas_authoring.pages.product_operations import _COMPOSE, _EDIT, _OUTPUT, _input_issues, _diagnostics, ERROR_CODES
from metriccanvas_authoring.pages.referenced import compose_candidate, edit_candidate
from metriccanvas_authoring.pages.multislot_contract import MULTISLOT_COMPOSE, MULTISLOT_EDIT

RESOURCES = ['page-validation']
SCHEMA_BINDINGS = {'evaluation': 'authoring.evaluation'}
_CODES = ['INPUT_INVALID', 'TABLE_SLOT_CONFIGURATION_INVALID', 'TABLE_SLOT_KEY_INVALID', 'TABLE_SLOT_KEY_DUPLICATE',
    'TABLE_SLOT_EVIDENCE_REQUIRED', 'TABLE_SLOT_PERIOD_MISMATCH', 'TABLE_SLOT_INCOMPLETE',
    'TABLE_SLOT_PAGINATION_UNVERIFIED', 'COMPOSE_RESULT_INVALID', 'STRUCTURE_BLOCK_INVALID',
    'EDIT_RESULT_INVALID', 'TABLE_SLOT_ALIGNMENT_COVERAGE', 'PRESENTATION_DOUBLE_SCALE',
    'PRESENTATION_TOKENS_SCALE_CONFLICT', 'PRESENTATION_SCALE_UNVERIFIED', 'PRESENTATION_PERCENT_UNIT_CONFLICT',
    'PRESENTATION_INPUT_INVALID', 'EVALUATION_CONTEXT_REQUIRED', 'INVALID_EVALUATION_CONTEXT']

_CODES = sorted(set(_CODES) | set(ERROR_CODES))


def _descriptor(schema):
    return {'inputSchema': deepcopy(schema), 'outputSchema': deepcopy(_OUTPUT), 'errorCodes': _CODES,
            'sideEffects': 'none'}


_COMPOSE_V2 = deepcopy(_COMPOSE)
_COMPOSE_V2['properties']['request'] = deepcopy(MULTISLOT_COMPOSE)
_EDIT_V2 = deepcopy(_EDIT)
_EDIT_V2['properties']['request'] = deepcopy(MULTISLOT_EDIT)
_EDIT_V2['properties']['presentationIntent'] = {'type': 'object', 'properties': {
    'rawValuePaths': {'type': 'array', 'items': {'type': 'string'}, 'uniqueItems': True}}, 'additionalProperties': False}
OPERATIONS = {'page.compose.v2': _descriptor(_COMPOSE_V2), 'page.edit.v2': _descriptor(_EDIT_V2)}
POSTPROCESS = {'page.compose.v2': {'operation': 'page.presentation', 'baseline': False},
               'page.edit.v2': {'operation': 'page.presentation', 'baseline': True}}


def invoke(operation, value, *, page_schema=None, node_resources=None):
    if operation not in OPERATIONS:
        return {'status': 'error', 'data': {}, 'diagnostics': [{'code': 'OPERATION_UNSUPPORTED', 'path': ''}]}
    # Batch/block diagnostics retain their own order and independent partial application.
    envelope = deepcopy(_COMPOSE if operation == 'page.compose.v2' else _EDIT)
    if operation == 'page.edit.v2':
        envelope['properties']['presentationIntent'] = _EDIT_V2['properties']['presentationIntent']
    issues = _input_issues(envelope, value)
    if issues:
        return {'status': 'error', 'data': {}, 'diagnostics': issues}
    if node_resources is not None and 'evaluation' in value:
        node_resources = replace(node_resources, evaluation=deepcopy(value['evaluation']))
    if operation == 'page.compose.v2':
        result = compose_candidate(value['pageId'], value.get('schemaVersion', load_bundle_info()['pageSchemaVersion']),
            value['request'], value['resultRecords'], page_schema=page_schema, node_resources=node_resources,
            compose_schema=MULTISLOT_COMPOSE)
    else:
        result = edit_candidate(value['baseline'], value['request'], value['resultRecords'],
            page_schema=page_schema, node_resources=node_resources,
            summary_enabled=value.get('summaryEnabled', False), scope_annotations=value.get('scopeAnnotations'),
            operation_schema=MULTISLOT_EDIT['properties']['operations']['items'])
    status = 'partial' if result['status'] == 'partial' else 'ok' if result['status'] in {'changed', 'unchanged'} else 'error'
    return {'status': status, 'data': {**result, 'execution': 'not-run', 'saveStatus': 'not_requested'},
            'diagnostics': _diagnostics(result)}


from metriccanvas_authoring.pages.multislot_vectors import SELF_TESTS


def apply_postprocess(operation, value, result, audit_result):
    """Merge the same Node product audit after composition; never save or mutate inputs."""
    merged = deepcopy(result)
    if operation not in POSTPROCESS or merged['data'].get('document') is None:
        return merged
    merged['data']['presentation'] = deepcopy(audit_result['data'])
    merged['diagnostics'].extend(deepcopy(audit_result['diagnostics']))
    if audit_result['status'] == 'error':
        merged['status'] = 'error'
        merged['data'].update(status='failed', document=None)
        merged['data']['issues'].extend(deepcopy(audit_result['diagnostics']))
    elif audit_result['status'] == 'partial':
        merged['status'] = 'partial'
    return merged


POSTPROCESS_SELF_TESTS = [
    {'operation': 'page.compose.v2', 'input': {},
     'result': {'status': 'ok', 'data': {'document': {'id': 'synthetic-only'}, 'status': 'changed', 'issues': []}, 'diagnostics': []},
     'auditResult': {'status': 'partial', 'data': {'scope': 'data-only', 'findings': []}, 'diagnostics': [{'code': 'PRESENTATION_PERCENT_UNIT_CONFLICT'}]},
     'expectedStatus': 'partial', 'expectedDocument': {'id': 'synthetic-only'}},
    {'operation': 'page.edit.v2', 'input': {},
     'result': {'status': 'ok', 'data': {'document': {'id': 'synthetic-only'}, 'status': 'changed', 'issues': []}, 'diagnostics': []},
     'auditResult': {'status': 'error', 'data': {}, 'diagnostics': [{'code': 'INVALID_EVALUATION_CONTEXT'}]},
     'expectedStatus': 'error', 'expectedDocument': None}
]
