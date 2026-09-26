"""Inspect the internal governed metadata snapshot. May call metadata services.

Does not call DQE, save pages, or invoke a model. Factory implementations must
be side-effect-free. Output contains metadata locations, never the snapshot.
"""
import argparse
import asyncio
import importlib
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tool'))
from metriccanvas_authoring.bootstrap.adapter_contract import ADAPTER_INTERFACE_VERSION, AdapterContractError, AuthoringAdapters
from metriccanvas_authoring.data.ports import DataContextError
from metriccanvas_authoring.data.data_context import parse_data_context
from metriccanvas_authoring.data.validation_policy import (QueryValidationPolicy, load_query_validation_policy, current_for_query, governance_warnings)


def diagnostic_report(error):
    report = {'status': 'unavailable', 'code': error.code, 'stage': 'data_context'}
    source = error.diagnostics
    if isinstance(source, dict):
        stage = source.get('stage')
        if stage in {'projection_configuration', 'field_governance'}:
            report['stage'] = stage
        entries = source.get('issues')
        if isinstance(entries, list):
            report['issues'] = [{key: value[:256] for key, value in row.items()
                if key in {'datasetId', 'field', 'property', 'path', 'reason'} and isinstance(value, str)}
                for row in entries[:100] if isinstance(row, dict)]
            count = source.get('issueCount')
            report['issueCount'] = count if type(count) is int and count >= len(entries) else len(entries)
            report['truncated'] = bool(source.get('truncated')) or len(entries) > 100
    return report


async def inspect_provider(provider, policy=QueryValidationPolicy(strict=True)):
    try:
        snapshot = await current_for_query(provider, policy)
        context, issues = parse_data_context(snapshot, policy=policy)
        if issues or context is None:
            return {'status': 'unavailable', 'stage': 'snapshot_validation', 'code': 'DATA_CONTEXT_PROJECTION_ERROR'}
        environments = snapshot['executionEnvironments']
        schemas = [schema for environment in environments for schema in environment['schemas']]
        return {'status': 'ready', 'stage': 'snapshot_validation',
            'dataContextVersion': snapshot['version'], 'schemas': len(schemas),
            'validationMode': policy.mode, 'warnings': governance_warnings(snapshot),
            'policyAwareProvider': callable(getattr(provider, 'current_for_query', None)),
            'metrics': sum(len(schema['metrics']) for schema in schemas),
            'dqe': 'not_checked', 'save': 'not_checked', 'relayHandoff': 'not_checked'}
    except DataContextError as error:
        return diagnostic_report(error)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--strict', action='store_true', help='Inspect strict governance independently of runtime config')
    args = parser.parse_args()
    try:
        policy = QueryValidationPolicy(strict=True) if args.strict else load_query_validation_policy()
        # Preserve safe configuration diagnostics even when factory creation fails.
        factory = importlib.import_module('metriccanvas_authoring.adapters.factory')
        adapters = factory.create_adapters()
        if not isinstance(adapters, AuthoringAdapters) or adapters.interface_version != ADAPTER_INTERFACE_VERSION:
            raise AdapterContractError('ADAPTER_CONTRACT_MISMATCH')
        report = asyncio.run(inspect_provider(adapters.data_context, policy))
    except DataContextError as error:
        report = diagnostic_report(error)
    except AdapterContractError as error:
        report = {'status': 'unavailable', 'code': error.code, 'stage': 'factory'}
    except Exception:
        report = {'status': 'unavailable', 'code': 'DATA_CONTEXT_CHECK_FAILED', 'stage': 'factory_or_provider'}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report['status'] == 'ready' else 2


if __name__ == '__main__':
    raise SystemExit(main())
