"""Static deployment dependencies and separate current-turn verification.

This module performs no network, model, query or page write. A host may call
it before starting stdio and use the same rules for its operational checks.
"""
from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from metriccanvas_authoring.work.authoring_turns import AuthoringTurnGate, UnavailableAuthoringTurns


_OPERATIONS = {
    'new_turn_read': ('current_turns', 'store'),
    'existing_page_read': ('current_turns', 'store', 'lifecycle_service', 'lifecycle_identities'),
    'configuration_edit': ('current_turns', 'store', 'lifecycle_service', 'lifecycle_identities'),
    'data_query': ('current_turns', 'store', 'data_context', 'dqe', 'analysis_authorization'),
    'data_compose_save': ('current_turns', 'store', 'data_context', 'dqe', 'analysis_authorization',
                          'lifecycle_service', 'lifecycle_identities'),
    'artifact_handoff': ('current_turns', 'store', 'lifecycle_service', 'lifecycle_identities', 'relay_preview'),
}

_LOCATIONS = {
    'current_turns': 'host invocation adapter: authenticated scope and frozen baseline',
    'store': 'shared SQLite path or equivalent read/CAS store reachable by every oneshot call',
    'data_context': 'governed DataContextPort configuration',
    'dqe': 'authenticated DqeExecutionPort configuration',
    'analysis_authorization': 'host confirmation and evidence authorization adapter',
    'lifecycle_service': 'KnownLifecycleHttp collection URL or equivalent save/current-read adapter',
    'lifecycle_identities': 'host per-invocation authenticated identity adapter',
    'relay_preview': 'host program-channel exact-artifact handoff adapter',
}


def platform_readiness(dependencies: Any, *, current_turns: Any = None, store: Any = None,
                       analysis_authorization: Any = None, lifecycle_service: Any = None,
                       lifecycle_identities: Any = None, relay_preview: Any = None,
                       parameter_dependencies: Any = None) -> dict[str, Any]:
    """Report assembled capabilities; an actual user turn is not required here."""
    providers = {
        'current_turns': current_turns is not None and not isinstance(current_turns, UnavailableAuthoringTurns)
                         and _methods(current_turns, 'current_scope', 'current_turn'),
        'store': _methods(store, 'read', 'compare_and_swap'),
        'data_context': _methods(getattr(dependencies, 'data_context', None), 'current')
                        and getattr(dependencies.data_context, 'configured', True) is not False,
        'dqe': _methods(getattr(dependencies, 'dqe', None), 'execute')
               and getattr(dependencies.dqe, 'configured', True) is not False,
        'analysis_authorization': _methods(analysis_authorization, 'authorize'),
        'lifecycle_service': _methods(lifecycle_service, 'current_match', 'save')
                             and (not hasattr(lifecycle_service, 'collection_url') or bool(lifecycle_service.collection_url))
                             and bool(getattr(getattr(lifecycle_service, 'capabilities', None), 'single_save', False))
                             and bool(getattr(getattr(lifecycle_service, 'capabilities', None), 'current_read', False)),
        'lifecycle_identities': _methods(lifecycle_identities, 'current'),
        'relay_preview': _methods(relay_preview, 'prepare'),
    }
    operations = {name: {'available': all(providers[key] for key in required),
                         'missing': [key for key in required if not providers[key]]}
                  for name, required in _OPERATIONS.items()}
    all_required = set(_OPERATIONS['data_compose_save']) | set(_OPERATIONS['artifact_handoff'])
    missing = [{'provider': key, 'affects': [name for name, required in _OPERATIONS.items() if key in required],
                'configureAt': _LOCATIONS[key]}
               for key in _LOCATIONS if key in all_required and not providers[key]]
    return {
        'deploymentReady': not missing,
        'providersAssembled': providers,
        'operations': operations,
        'missing': missing,
        'parameterCapability': 'assembled' if parameter_dependencies is not None else 'optional_unconfigured',
        'currentTurn': {'status': 'not_checked'},
        'connectivity': 'not_checked',
        'businessAcceptance': 'not_checked',
    }


async def current_turn_readiness(report: Mapping[str, Any], current_turns: Any,
                                 context_ref: str) -> dict[str, Any]:
    """Validate one live turn without consuming a budget or doing business I/O."""
    result = dict(report)
    try:
        if not report['providersAssembled']['current_turns']:
            raise RuntimeError('CURRENT_TURN_UNAVAILABLE')
        prepared = await AuthoringTurnGate(current_turns).require(context_ref)
    except Exception as error:
        code = getattr(error, 'code', None) or 'CURRENT_TURN_CHECK_FAILED'
        result['currentTurn'] = {'status': 'invalid', 'code': code}
    else:
        result['currentTurn'] = {'status': 'valid', 'mode': prepared.binding['mode']}
    return result


def _methods(value: Any, *names: str) -> bool:
    return value is not None and all(callable(getattr(value, name, None)) for name in names)
