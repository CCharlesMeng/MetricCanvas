"""Receipt matching over supplied facts. No lookup, save or verification callback."""
from copy import deepcopy
from metriccanvas_authoring.assets.lifecycle_ports import LifecycleError
from metriccanvas_authoring.canonical import canonical_json
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document

REF_KEYS = {'pageId', 'revisionId', 'resourceId'}
SAFE_CODES = {'INVALID_PAGE', 'INVALID_REQUEST', 'UNAUTHENTICATED', 'FORBIDDEN',
    'REVISION_NOT_FOUND', 'REVISION_CONFLICT', 'IDEMPOTENCY_CONFLICT',
    'CAPABILITY_UNAVAILABLE', 'RESPONSE_MISMATCH', 'PROGRAM_UNAVAILABLE',
    'PROGRAM_TOKEN_INVALID', 'PROGRAM_NOT_FOUND'}


def valid_ref(ref):
    return isinstance(ref, dict) and set(ref) == REF_KEYS and all(
        isinstance(v, str) and 0 < len(v) <= 256 for v in ref.values())


def require(condition, code='RESPONSE_MISMATCH'):
    if not condition:
        raise LifecycleError(code)


def check_receipt_status(response, command):
    require(isinstance(response, dict))
    require(response.get('operationId') == command['context']['operationId'])
    status = response.get('status')
    require(status in {'saved', 'pending', 'unknown', 'rejected', 'not-applied'})
    if status != 'saved':
        require('ref' not in response)
        result = {'status': status, 'operationId': response['operationId']}
        if status == 'not-applied':
            require(isinstance(response.get('retrySafe'), bool))
            result['retrySafe'] = response['retrySafe']
        if status == 'rejected':
            result['code'] = response.get('code') if response.get('code') in SAFE_CODES else 'SERVICE_REJECTED'
            result['retryable'] = False
            result['message'] = result['code']
        return result
    return None


def check_provider_receipt(response, command, *, page_schema=None, node_resources=None):
    result = check_receipt_status(response, command)
    if result is not None:
        return result
    validation = {}
    if page_schema is not None:
        validation['schema'] = page_schema
    if node_resources is not None:
        validation['node_resources'] = node_resources
    require(valid_ref(response.get('ref')) and response['ref']['pageId'] == command['pageId'])
    require(response.get('base') == command['base'] and response.get('assurance') == 'provider-response')
    require(type(response.get('revisionNumber')) is int and response['revisionNumber'] > 0)
    require(response.get('isDraft') is True)
    require(command['base'] is None or response['ref']['resourceId'] == command['base']['resourceId'] and response['ref']['revisionId'] != command['base']['revisionId'])
    require(isinstance(response.get('document'),dict) and not validate_page_document(response['document'], **validation))
    require(canonical_json(response['document']) == canonical_json(command['document']))
    return {k:deepcopy(response[k]) for k in ('status','operationId','ref','base','revisionNumber','isDraft','document','assurance')}
