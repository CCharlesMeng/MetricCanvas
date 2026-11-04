"""Explicit page candidate operations, shared with the controlled online path."""
from copy import deepcopy
from dataclasses import replace
import json

from metriccanvas_authoring.bundle_info import load_bundle_info
from metriccanvas_authoring.runtime_assets import bundle_root
from metriccanvas_authoring.pages.referenced import compose_candidate, edit_candidate
from metriccanvas_authoring.work.diagnostics import issue_details
from jsonschema import Draft202012Validator


def _object(properties, required):
    return {'type': 'object', 'additionalProperties': False, 'properties': properties, 'required': required}


_PAGE = json.loads((bundle_root() / 'contract-snapshot/page/schema.json').read_text(encoding="utf-8"))
_SOURCE = deepcopy(_PAGE['definitions']['queryDataSource'])
_RECORD = {'type': 'object', 'properties': {'source': _SOURCE,
    'rows': {'type': 'array', 'items': {'type': 'object'}},
    'totalCount': {'type': ['integer', 'null'], 'minimum': 0}, 'relations': {'type': 'array', 'items': {'type': 'object'}}},
    'required': ['source', 'rows', 'totalCount']}
_RECORDS = {'type': 'object', 'additionalProperties': {'anyOf': [_RECORD, {'type': 'null'}]}}
_COMPOSE = _object({'pageId': {'type': 'string', 'minLength': 1, 'maxLength': 128},
    'schemaVersion': deepcopy(_PAGE['properties']['schemaVersion']), 'request': {'type': 'object'},
    'resultRecords': _RECORDS}, ['pageId', 'request', 'resultRecords'])
_EDIT = _object({'baseline': {'type': 'object'}, 'request': {'type': 'object'},
    'resultRecords': _RECORDS, 'summaryEnabled': {'type': 'boolean'},
    'scopeAnnotations': {'type': 'object'}}, ['baseline', 'request', 'resultRecords'])
_COMPOSE['definitions'] = deepcopy(_PAGE['definitions'])
_EDIT['definitions'] = deepcopy(_PAGE['definitions'])
# Build reference: C inlines A's describe.evaluationSchema before publishing.
# Runtime time semantics belong to the supplied Node product resources.
SCHEMA_BINDINGS = {'evaluation': 'authoring.evaluation'}
_COMPOSE['properties']['evaluation'] = {}
_EDIT['properties']['evaluation'] = {}

_OUTPUT = {'type': 'object', 'properties': {'document': {'type': ['object', 'null']},
    'execution': {'const': 'not-run'}, 'saveStatus': {'const': 'not_requested'}},
    'required': ['status', 'document', 'operations', 'issues', 'execution', 'saveStatus']}


# Diagnostic vocabulary of the shared deterministic rules (including adjustments).
ERROR_CODES = ('BASELINE_INVALID',
 'BASE_REVISION_PAGE_ID_MISMATCH',
 'COLUMN_NOT_FOUND',
 'COMPONENT_ASSEMBLY_UNSUPPORTED',
 'COMPONENT_FALLBACK_TABLE',
 'COMPONENT_GATE_REJECTED',
 'COMPONENT_ID_CONFLICT',
 'COMPONENT_ID_EXISTS',
 'COMPONENT_NOT_FOUND',
 'COMPONENT_POLICY_REJECTED',
 'COMPONENT_POLICY_SCOPE_UNAVAILABLE',
 'COMPONENT_POLICY_UNAVAILABLE',
 'COMPONENT_REFERENCED_BY_CONNECTION',
 'COMPONENT_SHAPE_MISMATCH',
 'COMPOSE_DATE_FILTER_INVALID',
 'COMPOSE_REQUEST_INVALID',
 'COMPOSE_RESULT_INVALID',
 'COMPUTED_SOURCE_REQUIRES_MATERIALIZED_EVIDENCE',
 'CONTAINER_CHILD_SHAPE_MISMATCH',
 'CONTAINER_CHILD_TYPE_UNSUPPORTED',
 'CURRENT_TURN_BASELINE_REQUIRED',
 'DATA_SOURCE_CONFLICT',
 'DATA_SOURCE_NOT_FOUND',
 'DATE_BINDING_INVALID',
 'DATE_FILTER_REQUIRED',
 'DATE_RANGE_WINDOW_CONFLICT',
 'DATE_WINDOW_REQUIRED',
 'DEPENDENCY_NOT_SUCCEEDED',
 'DIMENSION_FILTER_REQUIRED',
 'DUPLICATE_FILTER_BINDING',
 'EDIT_REQUEST_INVALID',
 'EDIT_RESULT_INVALID',
 'EXPLICIT_RUNTIME_STREAMING_REQUIRED',
 'FIELD_TEXT_REQUIRES_SINGLE_ROW',
 'FILTER_BINDING_ERROR',
 'FILTER_DECLARATION_DUPLICATE',
 'FILTER_ID_EXISTS',
 'FILTER_NOT_FOUND',
 'FILTER_QUERY_FIELD_UNVERIFIED',
 'FILTER_QUERY_LANGUAGE_UNSUPPORTED',
 'FILTER_QUERY_SOURCE_REQUIRED',
 'GEOGRAPHIC_NAME_FIELD_REQUIRED',
 'HIERARCHICAL_DIMENSION_CHANGE_UNSUPPORTED',
 'INPUT_INVALID',
 'INVALID_MATERIALIZATION',
 'INVALID_PAGE',
 'INVALID_TIME_RULE',
 'INVALID_VALUE',
 'INVALID_VERIFIED_BASELINE',
 'LONG_TEXT_FIELD_REQUIRED',
 'LONG_TEXT_VALUE_REQUIRED',
 'MAP_MEASURE_FIELD_REQUIRED',
 'MAP_NUMERIC_VALUES_REQUIRED',
 'MAP_REGIONS_CONTRACT_UNAVAILABLE',
 'MAP_REGION_UNRESOLVED',
 'MAP_SECTION_REQUIRES_CHART_HEIGHT',
 'MISSING_INPUT',
 'MOVE_TARGET_INVALID',
 'MOVE_TARGET_NOT_FOUND',
 'NUMBER_RANGE_FILTER_REQUIRED',
 'OPERATION_IDS_INVALID',
 'OPERATION_INVALID',
 'OPERATION_NOT_SUPPORTED',
 'OPTIONAL_NULL_OMITTED',
 'PARAMETER_CAPABILITY_UNAVAILABLE',
 'PARAMETER_CONFIGURATION_INVALID',
 'PARAMETER_INVALID',
 'PARAMETER_PROGRAM_MISMATCH',
 'PARAMETER_PROGRAM_UNAVAILABLE',
 'PARAMETER_REFERENCE_INVALID',
 'PARAMETER_SELECTION_INVALID',
 'PARAMETER_SIZE_LIMIT',
 'PARAMETER_SOURCE_CHANGED',
 'PARAMETER_STORE_UNAVAILABLE',
 'PARAMETER_TEXT_CHOICE_INVALID',
 'PARAMETER_VERIFICATION_UNAVAILABLE',
 'PINNED_COMPONENT_REJECTED',
 'PRESENTATION_DEFAULTED',
 'PRESENTATION_EDIT_INVALID',
 'PRODUCT_BRIDGE_UNAVAILABLE',
 'PROGRAM_RESULT_MISMATCH',
 'PROPERTY_NOT_ALLOWED',
 'QUERY_MAPPING_ERROR',
 'REMOVE_COMPONENT_TYPE_UNSUPPORTED',
 'REPORT_HEADER_REQUIRED',
 'RESULT_EVIDENCE_MISSING',
 'ROW_NOT_FOUND',
 'RUNTIME_SUMMARY_CONFIG_REQUIRED',
 'SCHEMA_ERROR',
 'SCOPE_NOTE_REVIEW_REQUIRED',
 'SECTION_COMPONENTS_CHANGED',
 'SECTION_HEADER_PROTECTED',
 'SECTION_ID_CONFLICT',
 'SECTION_NOT_FOUND',
 'SERIES_NOT_FOUND',
 'SOURCE_FIELDS_INVALID',
 'SOURCE_ISOLATED_FOR_QUERY_PAGINATION',
 'SOURCE_ROW_EVIDENCE_REQUIRED',
 'STRUCTURE_BLOCK_BUDGET',
 'STRUCTURE_BLOCK_INVALID',
 'STRUCTURE_CHANGE_FIELD_INVALID',
 'STRUCTURE_CHANGE_RELATION_UNVERIFIED',
 'STRUCTURE_CHANGE_UNIT_INVALID',
 'STRUCTURE_COLUMN_REFERENCE_INVALID',
 'STRUCTURE_COMPONENT_INVALID',
 'STRUCTURE_DUPLICATE_FIELD',
 'STRUCTURE_FIELD_AMBIGUOUS',
 'STRUCTURE_FIELD_NOT_FOUND',
 'STRUCTURE_ID_CONFLICT',
 'STRUCTURE_INCOMPLETE_PROPORTION',
 'STRUCTURE_MATCH_UNSUPPORTED',
 'STRUCTURE_MIXED_MEASURE_UNITS',
 'STRUCTURE_PLAN_INVALID',
 'STRUCTURE_PRESENTATION_FIELDS_UNUSED',
 'STRUCTURE_PRESENTATION_UNSUPPORTED',
 'STRUCTURE_PRIMARY_FIELD_INVALID',
 'STRUCTURE_RESERVED_ID',
 'STRUCTURE_ROW_SELECTION_AMBIGUOUS',
 'STRUCTURE_ROW_SELECTION_UNVERIFIED',
 'STRUCTURE_SOURCE_NOT_FOUND',
 'STRUCTURE_UNUSED_DATA_REQUEST',
 'TABLE_LINK_SELECTION_CONFLICT',
 'TABLE_NAVIGATION_AMBIGUOUS',
 'TABLE_NAVIGATION_SHARED',
 'TABLE_REQUIRED',
 'TEMPLATE_CONTAINS_INITIAL_ROWS',
 'TEMPLATE_CONTAINS_INPUT',
 'TYPE_CHANGE_COMPUTED_SOURCE_UNSUPPORTED',
 'TYPE_CHANGE_REQUIRES_ROW_EVIDENCE',
 'TYPE_CHANGE_UNSUPPORTED',
 'UNKNOWN_INPUT',
 'WORK_BUSY',
 'WORK_STORE_UNAVAILABLE',
 'WORK_VERSION_CONFLICT')

def _descriptor(schema):
    return {'inputSchema': schema, 'outputSchema': deepcopy(_OUTPUT),
            'errorCodes': [*ERROR_CODES, 'EVALUATION_CONTEXT_REQUIRED', 'INVALID_EVALUATION_CONTEXT'], 'sideEffects': 'none'}


RESOURCES = ['page-validation']

OPERATIONS = {'page.compose': _descriptor(_COMPOSE), 'page.edit': _descriptor(_EDIT)}


def _diagnostics(result):
    issues = deepcopy(result.get('issues', []))
    for operation in result.get('operations', []):
        issues.extend(deepcopy(operation.get('issues', [])))
    return issues


def _input_issues(schema, value):
    return [{**issue_details('INPUT_INVALID', '/' + '/'.join(str(p).replace('~', '~0').replace('/', '~1')
            for p in error.absolute_path) if error.absolute_path else ''), 'constraint': error.validator}
            for error in Draft202012Validator(schema).iter_errors(value)]


def invoke(operation, value, *, page_schema=None, node_resources=None):
    if operation not in OPERATIONS:
        return {'status': 'error', 'data': {}, 'diagnostics': [{'code': 'OPERATION_UNSUPPORTED', 'path': ''}]}
    issues = _input_issues(OPERATIONS[operation]['inputSchema'], value)
    if issues:
        return {'status': 'error', 'data': {}, 'diagnostics': issues}
    if node_resources is not None and 'evaluation' in value:
        node_resources = replace(node_resources, evaluation=deepcopy(value['evaluation']))
    if operation == 'page.compose':
        result = compose_candidate(value['pageId'], value.get('schemaVersion', load_bundle_info()['pageSchemaVersion']),
            value['request'], value['resultRecords'], page_schema=page_schema, node_resources=node_resources)
    else:
        result = edit_candidate(value['baseline'], value['request'], value['resultRecords'],
            summary_enabled=value.get('summaryEnabled', False), scope_annotations=value.get('scopeAnnotations'),
            page_schema=page_schema, node_resources=node_resources)
    status = 'partial' if result['status'] == 'partial' else 'ok' if result['status'] in {'changed', 'unchanged'} else 'error'
    return {'status': status, 'data': {**result, 'execution': 'not-run', 'saveStatus': 'not_requested'},
            'diagnostics': _diagnostics(result)}


SELF_TESTS = [{'operation': 'page.compose', 'input': {'pageId': 'offline-example', 'resultRecords': {},
    'request': {'title': '离线候选', 'sources': {}, 'sections': [{'id': 'main', 'pattern': 'custom',
        'blocks': [{'id': 'note', 'type': 'text', 'body': '明确输入生成候选'}]}]}}, 'expectedStatus': 'ok'},
    {'operation': 'page.edit', 'input': {'baseline': {}, 'request': {'operations': []}, 'resultRecords': {}},
     'expectedStatus': 'error', 'expectedDiagnostic': 'BASELINE_INVALID'}]

SELF_TESTS.append({'operation': 'page.edit', 'input': {'baseline': {
    'schemaVersion': '6.5', 'id': 'offline-edit', 'layout': 'dashboard', 'dataSources': {},
    'sections': [{'id': 'main', 'container': 'plain', 'components': [{'id': 'note', 'type': 'text',
        'layout': {'span': 12}, 'props': {'body': '原文'}}]}]}, 'resultRecords': {},
    'request': {'operations': [{'id': 'width', 'type': 'set_component_layout', 'componentId': 'note',
        'changes': {'span': 6}}]}}, 'expectedStatus': 'ok'})
