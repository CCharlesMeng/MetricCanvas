"""Explicit authoring profile; legacy normalization remains byte-compatible."""
from copy import deepcopy
from metriccanvas_authoring.data.product_operations import _NORMALIZE_INPUT, _OUTPUT, ERROR_CODES, _prepare, _query_result
from metriccanvas_authoring.data.execution import DqeExecutionResult
from metriccanvas_authoring.data.query import finalize_query_data
from metriccanvas_authoring.pages.product_operations import _input_issues

OPERATIONS = {'results.normalize.v2': {'inputSchema': deepcopy(_NORMALIZE_INPUT), 'outputSchema': deepcopy(_OUTPUT),
    'errorCodes': list(ERROR_CODES), 'sideEffects': 'none'}}


def invoke(operation, value):
    if operation not in OPERATIONS:
        return {'status': 'error', 'data': {}, 'diagnostics': [{'code': 'OPERATION_UNSUPPORTED', 'path': ''}]}
    issues = _input_issues(OPERATIONS[operation]['inputSchema'], value)
    if issues:
        return {'status': 'error', 'data': {}, 'diagnostics': issues}
    executions = [DqeExecutionResult(deepcopy(item['rows']), item.get('totalCount'), item.get('capturedAt'))
                  for item in value['executions']]
    queried = finalize_query_data(_prepare(value), executions, validate_rows=True, presentation_profile='authoring')
    return _query_result(queried, normalized=True)


from metriccanvas_authoring.data.product_vectors import SELF_TESTS as _BASE_VECTORS
SELF_TESTS = [{**deepcopy(item), 'operation': 'results.normalize.v2'} for item in _BASE_VECTORS
              if item['operation'] == 'results.normalize']
