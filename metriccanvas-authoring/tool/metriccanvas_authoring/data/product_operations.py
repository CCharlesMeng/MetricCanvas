"""Versioned product operation definitions; the release facade owns the envelope.

Inputs contain complete facts. These handlers neither discover/query/save nor
accept executable callbacks. Resource resolution belongs to the product runtime.
"""
from copy import deepcopy
from dataclasses import asdict
import json

from jsonschema import Draft202012Validator
from metriccanvas_authoring.runtime_assets import bundle_root
from metriccanvas_authoring.data.execution import DqeExecutionResult
from metriccanvas_authoring.data.executable_units import build_query_source
from metriccanvas_authoring.data.query import prepare_query_data, map_query_fields, finalize_query_data
from metriccanvas_authoring.data.validation_policy import QueryValidationPolicy
from metriccanvas_authoring.work.diagnostics import issue_details


def _object(properties, required):
    return {'type': 'object', 'additionalProperties': False, 'properties': properties, 'required': required}


_ROOT = bundle_root()
_SPEC = json.loads((_ROOT / 'contracts/authored/page-build-spec.schema.json').read_text(encoding="utf-8"))
_CONTEXT = {'type': 'object'}  # The existing parser validates the full governed snapshot.
_EXECUTION = _object({'rows': {'type': 'array', 'items': {'type': 'object'}},
    'totalCount': {'type': ['integer', 'null'], 'minimum': 0},
    'capturedAt': {'type': ['string', 'null']}}, ['rows'])
_QUERY_INPUT = _object({'spec': _SPEC, 'dataContext': _CONTEXT,
    'strict': {'type': 'boolean'}, 'sourceDescriptions': {'type': 'array', 'items': {'type': 'object'}},
    'requireSourceDescription': {'type': 'boolean'}, 'stableFieldIds': {'type': 'boolean'}}, ['spec', 'dataContext'])
_NORMALIZE_INPUT = deepcopy(_QUERY_INPUT)
_NORMALIZE_INPUT['properties']['executions'] = {'type': 'array', 'items': _EXECUTION}
_NORMALIZE_INPUT['required'].append('executions')
_OUTPUT = {'type': 'object', 'properties': {'execution': {'const': 'not-run'},
    'dataContextVersion': {'type': 'string'}, 'units': {'type': 'array', 'items': {'type': 'object'}},
    'sources': {'type': 'object'}, 'coverage': {'type': 'array', 'items': {'type': 'object'}},
    'evidence': {'const': 'supplied'}}, 'required': ['execution']}


# Diagnostic vocabulary of the shared deterministic rules (including adjustments).
ERROR_CODES = ('DATA_CONTEXT_DOMAIN_AMBIGUOUS',
 'DATA_CONTEXT_GOVERNANCE_UNKNOWN',
 'DATA_CONTEXT_NAME_AMBIGUOUS',
 'DATA_CONTEXT_NAME_NOT_FOUND',
 'DATA_CONTEXT_PARTIAL',
 'DATA_CONTEXT_SCHEMA_ERROR',
 'DATA_CONTEXT_UNPARSEABLE',
 'DATA_CONTEXT_VERSION_CHANGED',
 'DIMENSION_NOT_IN_DATA_CONTEXT',
 'DIMENSION_VALUE_NOT_IN_DATA_CONTEXT',
 'FORMULA_QUESTION_MISSING',
 'INPUT_INVALID',
 'METRIC_CATALOG_ENTRY_MISSING',
 'METRIC_DIMENSION_COMPATIBILITY_UNKNOWN',
 'METRIC_NOT_IN_DATA_CONTEXT',
 'PAGE_BUILD_SPEC_CLOSED_SET_ERROR',
 'PAGE_BUILD_SPEC_DUPLICATE_UNIT_ID',
 'PAGE_BUILD_SPEC_SCHEMA_ERROR',
 'PRESENTATION_FORMAT_ADJUSTED',
 'PRESENTATION_PRECISION_LIMIT',
 'QUERY_VALIDATION_CONFIG_ERROR',
 'RESULT_EVIDENCE_MISSING',
 'SOURCE_CONTEXT_MISMATCH',
 'SOURCE_DESCRIPTION_INVALID',
 'SOURCE_DESCRIPTION_UNAVAILABLE',
 'SOURCE_FIELD_CONTRACT_MISMATCH',
 'SOURCE_FIELD_IDENTITY_DUPLICATE',
 'SOURCE_FORMAT_UNSUPPORTED',
 'SOURCE_QUERY_MISMATCH',
 'SOURCE_ROWS_INVALID',
 'SOURCE_ROW_MAPPING_MISSING',
 'SOURCE_ROW_TYPE_MISMATCH',
 'SOURCE_RULES_UNSUPPORTED',
 'SOURCE_SCALE_UNSUPPORTED',
 'SOURCE_SEMANTIC_MAPPING_MISMATCH',
 'TIME_GRANULARITY_NOT_IN_DATA_CONTEXT',
 'TIME_GRANULARITY_UNSUPPORTED',
 'TIME_RANGE_REVERSED',
 'TIME_VALUE_CALENDAR_INVALID',
 'TIME_VALUE_PRECISION_INVALID')

def _descriptor(schema):
    return {'inputSchema': schema, 'outputSchema': deepcopy(_OUTPUT),
            'errorCodes': list(ERROR_CODES),
            'sideEffects': 'none'}


OPERATIONS = {'query.prepare': _descriptor(_QUERY_INPUT), 'results.normalize': _descriptor(_NORMALIZE_INPUT)}


def _prepare(value):
    queried = prepare_query_data(value['spec'], value['dataContext'],
                                policy=QueryValidationPolicy(value.get('strict', False)))
    return map_query_fields(queried, value.get('sourceDescriptions', ()),
        required=value.get('requireSourceDescription', False), stable_field_ids=value.get('stableFieldIds', False))


def _query_result(queried, *, normalized=False):
    diagnostics = [asdict(issue) for issue in queried.issues]
    diagnostics.extend(deepcopy(queried.warnings))
    if not queried.ok:
        return {'status': 'error', 'data': {'execution': 'not-run'}, 'diagnostics': diagnostics}
    data = {'execution': 'not-run', 'dataContextVersion': queried.data_context_version,
            'units': [{'dataSourceId': unit.data_source_id, 'query': deepcopy(unit.effective_query()),
                       'fields': deepcopy(unit.fields)} for unit in queried.units]}
    if normalized:
        data['sources'] = {unit.data_source_id: build_query_source(unit, execution)
            for unit, execution in zip(queried.units, queried.executions, strict=True)}
        data['coverage'] = [_coverage(execution) for execution in queried.executions]
        data['evidence'] = 'supplied'
    return {'status': 'ok', 'data': data, 'diagnostics': diagnostics}


def _coverage(execution):
    returned, total = len(execution.rows), execution.total_count
    return {'returnedCount': returned, 'totalCount': total,
            'complete': total is not None and returned == total,
            'truncated': total is not None and returned < total}


def _normalize(value):
    queried = _prepare(value)
    executions = tuple(DqeExecutionResult(rows=deepcopy(item['rows']), total_count=item.get('totalCount'),
                                         captured_at=item.get('capturedAt')) for item in value['executions'])
    # Supplied facts are never allowed to bypass the mapped row contract.
    return _query_result(finalize_query_data(queried, executions, validate_rows=True), normalized=True)


def invoke(operation, value):
    if operation not in OPERATIONS:
        return {'status': 'error', 'data': {}, 'diagnostics': [{'code': 'OPERATION_UNSUPPORTED', 'path': ''}]}
    issues = [{**issue_details('INPUT_INVALID', '/' + '/'.join(str(p).replace('~', '~0').replace('/', '~1')
        for p in error.absolute_path) if error.absolute_path else ''), 'constraint': error.validator}
        for error in Draft202012Validator(OPERATIONS[operation]['inputSchema']).iter_errors(value)]
    if issues:
        return {'status': 'error', 'data': {}, 'diagnostics': issues}
    if operation == 'query.prepare':
        return _query_result(_prepare(value))
    return _normalize(value)


from metriccanvas_authoring.data.product_vectors import SELF_TESTS
