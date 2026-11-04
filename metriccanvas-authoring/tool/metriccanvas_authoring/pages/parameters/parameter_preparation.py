"""Trusted authoring program handoff. This module does not implement extraction or recall."""
from metriccanvas_authoring.pages.validation.grouped_params import declarations as _param_declarations
from copy import deepcopy
import json
from typing import Protocol
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document


class ParameterProgram(Protocol):
    async def prepare(self, request: dict) -> dict:
        """Call the deployed TS parameter program using a full-document program channel."""
        ...


async def prepare_page_parameters(document: dict, context: dict, program: ParameterProgram,
                                  selected_ids: list[str] | None = None,
                                  text_replacements: dict | None = None) -> dict:
    """Caller supplies a trusted final verified baseline, not model-transcribed page JSON.

    Returns the complete artifact to the application only; relay_summary is the
    sole model-facing projection. No save/confirmation/Java operation is invoked.
    """
    request = prepare_parameter_request(document, context, selected_ids, text_replacements)
    result = await program.prepare(request)
    return accept_parameter_result(document, context, result, selected_ids)


def prepare_parameter_request(document: dict, context: dict,
                              selected_ids: list[str] | None = None,
                              text_replacements: dict | None = None, *, schema=None, node_resources=None) -> dict:
    """Deterministic program request preparation; authenticity belongs to the caller."""
    if not context.get('baseline') or validate_page_document(document, schema=schema, node_resources=node_resources):
        raise ValueError('INVALID_VERIFIED_BASELINE')
    request = {'action': 'prepare', 'document': deepcopy(document), 'context': deepcopy(context)}
    if node_resources is not None and node_resources.evaluation is not None:
        request['evaluation'] = deepcopy(node_resources.evaluation)
    if selected_ids is not None: request['selectedIds'] = list(selected_ids)
    if text_replacements is not None: request['textReplacements'] = deepcopy(text_replacements)
    return request


def _check_parameter_source(document, result, selected_ids):
    try:
        same_source = json.loads(result['sourceKey']) == document
    except (KeyError, TypeError, ValueError):
        same_source = False
    if not same_source or (selected_ids is not None and sorted(result.get('selectedIds', [])) != sorted(selected_ids)):
        raise ValueError('PROGRAM_RESULT_MISMATCH')


def _check_parameter_template(document, selected):
    for param in _param_declarations(document):
        if param['id'] in selected and ('value' in param or 'default' in param):
            raise ValueError('TEMPLATE_CONTAINS_INPUT')
    if selected and any('initial' in ds['source'] for ds in document['dataSources'].values() if ds['source']['type'] == 'query'):
        raise ValueError('TEMPLATE_CONTAINS_INITIAL_ROWS')


def accept_parameter_result(document: dict, context: dict, result: dict,
                             selected_ids: list[str] | None = None, *, schema=None, node_resources=None) -> dict:
    """Check a supplied program result without executing, saving or fetching anything."""
    if not result.get('ok'): return {'ok': False, 'issues': deepcopy(result.get('issues', []))}
    if result.get('baseline') != context['baseline'] or validate_page_document(result.get('document'), schema=schema, node_resources=node_resources):
        raise ValueError('PROGRAM_RESULT_MISMATCH')
    _check_parameter_source(document, result, selected_ids)
    selected = set(result.get('selectedIds', []))
    _check_parameter_template(result['document'], selected)
    return {'ok': True, 'artifact': deepcopy(result), 'relay_summary': {
        'baseline': context['baseline'], 'parameterCount': len(result.get('candidates', [])),
        'selectedIds': sorted(selected), 'requiresHumanConfirmation': True,
        'status': 'prepared',
    }}
