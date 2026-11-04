"""Pure precondition and receipt operations. Decisions confer no authority or CAS."""
from copy import deepcopy
from dataclasses import replace
from jsonschema import Draft202012Validator
from metriccanvas_authoring.work.content_ports import ContentBaselineError
from metriccanvas_authoring.assets.lifecycle_ports import LifecycleError
from metriccanvas_authoring.data.result_rules import check_result_record
from metriccanvas_authoring.work.rules import reserve_work
from metriccanvas_authoring.work.receipt_rules import check_provider_receipt
from metriccanvas_authoring.work.diagnostics import issue_details


def _object(properties, required):
    return {'type': 'object', 'additionalProperties': False, 'properties': properties, 'required': required}


_TEXT = {'type': 'string', 'minLength': 1}
_RECORD = {'type': ['object', 'null'], 'properties': {'binding': {'type': 'object'},
    'validationPolicy': {'type': 'object'}, 'dataContextVersion': _TEXT,
    'status': {'enum': ['pending', 'ready', 'empty', 'failed']}},
    'required': ['binding', 'dataContextVersion', 'status']}
_RESULT = _object({'record': _RECORD, 'binding': {'type': 'object'}, 'contextVersion': _TEXT,
    'policyIdentity': {'type': 'object'}, 'usable': {'type': 'boolean'}, 'allowUnready': {'type': 'boolean'}},
    ['record', 'binding', 'contextVersion', 'policyIdentity'])
_WORK_RECORD = {'type': 'object', 'properties': {'workVersion': {'type': 'integer', 'minimum': 0},
    'active': {'type': ['string', 'null']}, 'lastRequest': {'type': ['string', 'null']},
    'lastResult': {'type': ['object', 'null']}}, 'required': ['workVersion', 'active', 'lastRequest', 'lastResult']}
_WORK = _object({'work': _WORK_RECORD, 'expectedVersion': {'type': 'integer', 'minimum': 0},
                 'requestHash': _TEXT}, ['work', 'expectedVersion', 'requestHash'])
_COMMAND = {'type': 'object', 'properties': {'context': {'type': 'object',
    'properties': {'operationId': _TEXT}, 'required': ['operationId']}, 'pageId': _TEXT,
    'base': {'type': ['object', 'null']}, 'document': {'type': 'object'}},
    'required': ['context', 'pageId', 'base', 'document']}
_RECEIPT = _object({'command': _COMMAND, 'response': {'type': 'object'}}, ['command', 'response'])
# Build reference resolved by C from A's single EVALUATION_SCHEMA source.
SCHEMA_BINDINGS = {'evaluation': 'authoring.evaluation'}
_RECEIPT['properties']['evaluation'] = {}

_OUTPUT = {'type': 'object'}


def _descriptor(schema, codes):
    return {'inputSchema': schema, 'outputSchema': deepcopy(_OUTPUT),
            'errorCodes': ['INPUT_INVALID', *codes, 'EVALUATION_CONTEXT_REQUIRED', 'INVALID_EVALUATION_CONTEXT'], 'sideEffects': 'none'}


RESOURCES = ['page-validation']

OPERATIONS = {
    'results.check': _descriptor(_RESULT, ['RESULT_SCOPE_MISMATCH', 'RESULT_VALIDATION_POLICY_CHANGED',
                                         'RESULT_VERSION_STALE', 'RESULT_NOT_READY']),
    'work.check': _descriptor(_WORK, ['WORK_BUSY', 'SAVE_RECONCILIATION_REQUIRED', 'WORK_VERSION_CONFLICT']),
    'receipt.check': _descriptor(_RECEIPT, ['RESPONSE_MISMATCH'])}


def _invoke(operation, value, page_schema, node_resources):
    if operation == 'results.check':
        check_result_record(value['record'], value['binding'], value['contextVersion'], value['policyIdentity'],
                            usable=value.get('usable', True), allow_unready=value.get('allowUnready', False))
        return {'matches': True, 'authorization': 'not-checked'}
    if operation == 'work.check':
        return {**reserve_work(value['work'], value['expectedVersion'], value['requestHash']), 'cas': 'not-run'}
    return {'receipt': check_provider_receipt(value['response'], value['command'],
        page_schema=page_schema, node_resources=node_resources), 'evidence': 'supplied'}


def invoke(operation, value, *, page_schema=None, node_resources=None):
    if operation not in OPERATIONS:
        return {'status': 'error', 'data': {}, 'diagnostics': [{'code': 'OPERATION_UNSUPPORTED', 'path': ''}]}
    issues = [{**issue_details('INPUT_INVALID', '/' + '/'.join(str(p) for p in error.absolute_path)
        if error.absolute_path else ''), 'constraint': error.validator}
        for error in Draft202012Validator(OPERATIONS[operation]['inputSchema']).iter_errors(value)]
    if issues:
        return {'status': 'error', 'data': {}, 'diagnostics': issues}
    if node_resources is not None and 'evaluation' in value:
        node_resources = replace(node_resources, evaluation=deepcopy(value['evaluation']))
    try:
        return {'status': 'ok', 'data': _invoke(operation, value, page_schema, node_resources), 'diagnostics': []}
    except (ContentBaselineError, LifecycleError) as error:
        return {'status': 'error', 'data': {}, 'diagnostics': [issue_details(error.code)]}


SELF_TESTS = [
    {'operation': 'work.check', 'input': {'work': {'workVersion': 1, 'active': None, 'lastRequest': None,
        'lastResult': None}, 'expectedVersion': 1, 'requestHash': 'frozen-example'}, 'expectedStatus': 'ok'},
    {'operation': 'work.check', 'input': {'work': {'workVersion': 1, 'active': None, 'lastRequest': 'previous',
        'lastResult': {'saveStatus': 'unknown'}}, 'expectedVersion': 1, 'requestHash': 'new'},
        'expectedStatus': 'error', 'expectedDiagnostic': 'SAVE_RECONCILIATION_REQUIRED'},
    {'operation': 'receipt.check', 'input': {'command': {'context': {'operationId': 'one'}, 'pageId': 'example',
        'base': None, 'document': {}}, 'response': {'status': 'unknown', 'operationId': 'one'}}, 'expectedStatus': 'ok'},
    {'operation': 'results.check', 'input': {'record': None, 'binding': {}, 'contextVersion': 'v', 'policyIdentity': {}},
        'expectedStatus': 'error', 'expectedDiagnostic': 'RESULT_SCOPE_MISMATCH'}]
