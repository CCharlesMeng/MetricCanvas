"""Trusted, batch-scoped semantic validation; never a model-controlled argument."""
from copy import deepcopy
from dataclasses import dataclass
import json
import os
from pathlib import Path

from metriccanvas_authoring.data.ports import DataContextError

POLICY_VERSION = 'query-validation/1'
OPTIONAL_GOVERNANCE = frozenset({'additivity', 'timeAggregation', 'isRatio'})
SUPPORTED_PERIODS = ('year', 'month', 'day')


@dataclass(frozen=True, slots=True)
class QueryValidationPolicy:
    strict: bool = False

    @property
    def mode(self):
        return 'strict' if self.strict else 'relaxed'

    @property
    def identity(self):
        return {'version': POLICY_VERSION, 'strict': self.strict}


def load_query_validation_policy():
    """Read once per batch. A configured file is re-read for hot switching."""
    path = os.environ.get('METRICCANVAS_QUERY_VALIDATION_CONFIG')
    try:
        if path:
            content = Path(path).read_bytes()
            if len(content) > 16384:
                raise ValueError('config too large')
            value = json.loads(content)
            if not isinstance(value, dict) or set(value) != {'queryValidation'}:
                raise ValueError('invalid configuration')
            config = value['queryValidation']
            if not isinstance(config, dict) or set(config) != {'strict'}:
                raise ValueError('invalid configuration')
            strict = config['strict']
            if type(strict) is not bool:
                raise ValueError('strict must be boolean')
        else:
            raw = os.environ.get('METRICCANVAS_QUERY_VALIDATION_STRICT', 'false')
            if raw not in {'true', 'false'}:
                raise ValueError('strict must be true or false')
            strict = raw == 'true'
    except (OSError, ValueError, TypeError):
        raise DataContextError('QUERY_VALIDATION_CONFIG_ERROR', 'Invalid trusted query validation configuration') from None
    return QueryValidationPolicy(strict)


def normalize_request(request):
    """Only established equivalent input spellings; preserve all business scope."""
    value = deepcopy(request)
    changes = []
    for index, item in enumerate(value.get('requests', value.get('units', []))):
        time = item.get('time')
        if isinstance(time, dict) and time.get('granularity') == 'M':
            time['granularity'] = 'month'
            changes.append({'path': f'/{"requests" if "requests" in value else "units"}/{index}/time/granularity',
                            'from': 'M', 'to': 'month'})
    return value, changes


async def current_for_query(provider, policy):
    """Additive adapter capability. Old current() remains a supported strict provider."""
    method = getattr(provider, 'current_for_query', None)
    return await method(policy) if callable(method) else await provider.current()


def query_snapshot_schema(schema, policy):
    """Private execution view: unknown optional governance is absent, never fabricated.

    The neutral published Schema 1.1 is unchanged. Only this query reader accepts
    omitted optional business properties; security, types, booleans and all
    other structure still validate against the original schema.
    """
    result = deepcopy(schema)
    result['properties']['queryValidationView'] = {'const': '1'}
    def visit(node):
        if isinstance(node, dict):
            props = node.get('properties', {})
            role_items = props.get('roleHints', {}).get('items', {})
            if role_items.get('enum') == ['dimension', 'time']:
                role_items['enum'] = ['dimension', 'time', 'measure']
            if all(key in props for key in OPTIONAL_GOVERNANCE) and not policy.strict:
                node['required'] = [key for key in node.get('required', []) if key not in OPTIONAL_GOVERNANCE]
            for child in node.values():
                visit(child)
        elif isinstance(node, list):
            for child in node:
                visit(child)
    visit(result)
    return result


def governance_warnings(snapshot):
    warnings = []
    for environment in snapshot['executionEnvironments']:
        for schema in environment['schemas']:
            for metric in schema['metrics']:
                for key in sorted(OPTIONAL_GOVERNANCE):
                    if key not in metric and len(warnings) < 50:
                        warnings.append({'code': 'DATA_CONTEXT_GOVERNANCE_UNKNOWN',
                            'businessDomain': schema['name'], 'name': metric['name'], 'property': key})
    return warnings


class FixedQueryContext:
    """One immutable metadata read per authorized batch, shared by concurrent units."""
    def __init__(self, snapshot):
        self.snapshot = deepcopy(snapshot)

    async def current(self):
        return deepcopy(self.snapshot)


def normalize_semantic_names(request, snapshot, context):
    """Resolve only unique known identities. No fuzzy choice or scope widening."""
    value = deepcopy(request)
    changes = []
    schemas = [s for e in snapshot['executionEnvironments'] for s in e['schemas']]
    for index, item in enumerate(value['requests']):
        domain = item['businessDomain']
        if context.surface(domain) is None:
            exact = [s['name'] for s in schemas if s['id'] == domain]
            if len(exact) == 1:
                item['businessDomain'] = exact[0]
                changes.append({'path': f'/requests/{index}/businessDomain', 'from': domain, 'to': exact[0]})
        surface = context.surface(item['businessDomain'])
        if surface is None:
            continue
        def assign(container, key, declaration, path):
            if declaration is not None and container[key] != declaration.name:
                changes.append({'path': path, 'from': container[key], 'to': declaration.name})
                container[key] = declaration.name
        for mi, metric in enumerate(item['metrics']):
            if metric['kind'] == 'metric':
                assign(metric, 'name', surface.metric(metric['name']), f'/requests/{index}/metrics/{mi}/name')
        for di, name in enumerate(item['groupBy']):
            assign(item['groupBy'], di, surface.dimension(name), f'/requests/{index}/groupBy/{di}')
        for fi, entry in enumerate(item['filters']):
            assign(entry, 'dimension', surface.dimension(entry['dimension']), f'/requests/{index}/filters/{fi}/dimension')
    return value, changes
