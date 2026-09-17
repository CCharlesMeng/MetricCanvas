"""Trusted authoring program handoff. This module does not implement extraction or recall."""
from copy import deepcopy
import json
from typing import Protocol
from metriccanvas_authoring.domain.page_validation import validate_page_document


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
    if not context.get('baseline') or validate_page_document(document):
        raise ValueError('INVALID_VERIFIED_BASELINE')
    request = {'action': 'prepare', 'document': deepcopy(document), 'context': deepcopy(context)}
    if selected_ids is not None: request['selectedIds'] = list(selected_ids)
    if text_replacements is not None: request['textReplacements'] = deepcopy(text_replacements)
    result = await program.prepare(request)
    if not result.get('ok'): return {'ok': False, 'issues': deepcopy(result.get('issues', []))}
    if result.get('baseline') != context['baseline'] or validate_page_document(result.get('document')):
        raise ValueError('PROGRAM_RESULT_MISMATCH')
    try:
        same_source = json.loads(result['sourceKey']) == document
    except (KeyError, TypeError, ValueError):
        same_source = False
    if not same_source or (selected_ids is not None and sorted(result.get('selectedIds', [])) != sorted(selected_ids)):
        raise ValueError('PROGRAM_RESULT_MISMATCH')
    selected = set(result.get('selectedIds', []))
    for param in result['document'].get('params', []):
        if param['id'] in selected and ('value' in param or 'default' in param):
            raise ValueError('TEMPLATE_CONTAINS_INPUT')
    if selected and any('initial' in ds['source'] for ds in result['document']['dataSources'].values() if ds['source']['type'] == 'query'):
        raise ValueError('TEMPLATE_CONTAINS_INITIAL_ROWS')
    return {'ok': True, 'artifact': deepcopy(result), 'relay_summary': {
        'baseline': context['baseline'], 'parameterCount': len(result.get('candidates', [])),
        'selectedIds': sorted(selected), 'requiresHumanConfirmation': True,
        'status': 'prepared',
    }}
