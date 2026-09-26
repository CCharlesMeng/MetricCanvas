"""Java's batch Lab metadata query, shared by semantic discovery and query context.

The provider queries the DB-first endpoint only. It neither refreshes Lab nor
forwards physical schemas to the model. Identity and dataset scope are trusted
constructor inputs, never MCP arguments.
"""
from copy import deepcopy
from dataclasses import asdict
from urllib.parse import urlsplit

import httpx

from metriccanvas_authoring.canonical import canonical_sha256
from metriccanvas_authoring.data.ports import DataContextError
from metriccanvas_authoring.data.data_context import parse_data_context
from metriccanvas_authoring.data.validation_policy import QueryValidationPolicy
from adapter_template.firstparty.data_context_http import project_lab_snapshot

DATASET_DETAIL_BASE_URL_ENV = 'METRICCANVAS_DATASET_DETAIL_BASE_URL'
DATASET_IDS_ENV = 'METRICCANVAS_DATASET_IDS'
QUERY_PATH = '/dataset-detail/query-dataset-from-lab'


def require(value, code='DATA_CONTEXT_ENVELOPE_ERROR'):
    if not value:
        raise DataContextError(code, code)


def identifier(value):
    return isinstance(value, str) and 0 < len(value) <= 64 and bool(value.strip())


class JavaDatasetMetadataProvider:
    def __init__(self, base_url, identities, *, dataset_ids=None, projection=None,
                 transport=None, timeout_seconds=20):
        parsed = urlsplit(base_url)
        require(parsed.scheme in {'http', 'https'} and parsed.netloc and not parsed.query
                and not parsed.fragment and parsed.username is None, 'DATA_CONTEXT_CONFIG_ERROR')
        require(dataset_ids is None or isinstance(dataset_ids, list) and len(dataset_ids) <= 100
                and all(identifier(value) for value in dataset_ids)
                and len(set(dataset_ids)) == len(dataset_ids), 'DATA_CONTEXT_CONFIG_ERROR')
        self.url = base_url.rstrip('/') + QUERY_PATH
        self.identities, self.dataset_ids, self.projection = identities, deepcopy(dataset_ids), projection
        self.transport, self.timeout_seconds = transport, timeout_seconds

    def identity(self, binding=None):
        require(self.identities is not None, 'DATA_CONTEXT_AUTH_REQUIRED')
        identity = self.identities.current()
        require(identifier(identity.actor_id) and identifier(identity.workspace_id)
                and bool(identity.auth_token), 'DATA_CONTEXT_AUTH_REQUIRED')
        if binding is not None:
            require((binding.get('actorId'), binding.get('workspaceId')) ==
                    (identity.actor_id, identity.workspace_id), 'DATA_CONTEXT_SCOPE_MISMATCH')
        return identity

    async def _read(self, binding=None, dataset_ids=None):
        identity = self.identity(binding)
        requested = self.dataset_ids if dataset_ids is None else dataset_ids
        body = {'workspaceId': identity.workspace_id}
        if requested is not None:
            body['datasetIds'] = list(requested)
        try:
            async with httpx.AsyncClient(transport=self.transport, timeout=self.timeout_seconds,
                                        follow_redirects=False) as client:
                response = await client.post(self.url, json=body, headers={
                    'Accept': 'application/json', 'X-Auth-Token': identity.auth_token,
                    'x-operator-id': identity.actor_id})
        except httpx.TimeoutException:
            raise DataContextError('DATA_CONTEXT_TIMEOUT', 'Java metadata query timed out') from None
        except httpx.RequestError:
            raise DataContextError('DATA_CONTEXT_TRANSPORT_ERROR', 'Java metadata query unavailable') from None
        require(self.identities.current() == identity, 'DATA_CONTEXT_SCOPE_MISMATCH')
        require(response.status_code != 401, 'DATA_CONTEXT_AUTH_REQUIRED')
        require(response.status_code != 403, 'DATA_CONTEXT_FORBIDDEN')
        require(response.status_code == 200, 'DATA_CONTEXT_TRANSPORT_ERROR')
        try:
            payload = response.json()
        except ValueError:
            raise DataContextError('DATA_CONTEXT_ENVELOPE_ERROR', 'Invalid Java metadata JSON') from None
        require(isinstance(payload, dict))
        require(payload.get('retCode') == 'CBC.0000', 'DATA_CONTEXT_QUERY_REJECTED')
        items = payload.get('dataset_details')
        require(isinstance(items, list))
        models, issues, seen = [], [], set()
        for index, item in enumerate(items):
            require(isinstance(item, dict) and identifier(item.get('dataset_id')))
            dataset_id = item['dataset_id']
            require(dataset_id not in seen)
            require(not requested or dataset_id in requested, 'DATA_CONTEXT_SCOPE_MISMATCH')
            seen.add(dataset_id)
            require(isinstance(item.get('ret_code'), str) and bool(item['ret_code']))
            if item['ret_code'] != 'CBC.0000':
                # Do not relay provider text: it can contain SQL or other private data.
                issues.append({'code': 'DATASET_METADATA_FAILED', 'datasetId': dataset_id,
                               'path': f'/dataset_details/{index}', 'retrySafe': False})
                continue
            require(item.get('id') == dataset_id)
            require(item.get('workspace_id') == identity.workspace_id, 'DATA_CONTEXT_SCOPE_MISMATCH')
            fields = item.get('logical_schema', {}).get('field_schema') if isinstance(item.get('logical_schema'), dict) else None
            require(isinstance(fields, dict) and isinstance(fields.get('metrics'), list)
                    and isinstance(fields.get('dimensions'), list))
            metric_ids = set()
            for metric in fields['metrics']:
                require(isinstance(metric, dict) and identifier(metric.get('id'))
                        and isinstance(metric.get('name'), str) and 0 < len(metric['name']) <= 256 and bool(metric['name'].strip()))
                require(metric['id'] not in metric_ids)
                metric_ids.add(metric['id'])
                require(metric.get('model_id', dataset_id) == dataset_id
                        and metric.get('workspace_id', identity.workspace_id) == identity.workspace_id,
                        'DATA_CONTEXT_SCOPE_MISMATCH')
            models.append({key: deepcopy(value) for key, value in item.items()
                           if key not in {'dataset_id', 'ret_code', 'ret_desc'}})
        for missing in sorted(set(requested or []) - seen):
            issues.append({'code': 'DATASET_METADATA_MISSING', 'datasetId': missing,
                           'path': '/dataset_details', 'retrySafe': False})
        models.sort(key=lambda model: model['id'])
        # A local snapshot identifier, not the Java/Lab version field. Includes
        # governance so discovery and executable context cannot drift silently.
        version = canonical_sha256({'workspaceId': identity.workspace_id, 'models': models,
            'issues': sorted(issues, key=lambda issue: issue['datasetId']),
            'projection': asdict(self.projection) if self.projection is not None else None})
        return {'dataContextVersion': version, 'models': models, 'issues': issues,
                'coverage': {'scope': 'authorized', 'complete': not issues, 'returnedDatasets': len(items),
                             'usableDatasets': len(models), 'failedDatasets': len(issues)}}

    async def search(self, binding, query, limit):
        # The YAML has no keyword/limit parameters. Match and bound metric cards
        # in SemanticCatalog after reading all datasets in the trusted scope.
        return await self._read(binding)

    async def detail(self, binding, source):
        require(source.get('workspaceId') == binding.get('workspaceId'), 'DATA_CONTEXT_SCOPE_MISMATCH')
        dataset_id = source.get('modelId')
        require(identifier(dataset_id) and (not self.dataset_ids or dataset_id in self.dataset_ids),
                'DATA_CONTEXT_SCOPE_MISMATCH')
        value = await self._read(binding, [dataset_id])
        require(not value['issues'], 'DATA_CONTEXT_PARTIAL')
        model = next((model for model in value['models'] if model['id'] == dataset_id), None)
        require(model is not None and canonical_sha256(model) == source.get('modelVersion'), 'METRIC_DETAIL_STALE')
        metric = next((metric for metric in model['logical_schema']['field_schema']['metrics']
                       if metric['id'] == source.get('metricId')), None)
        require(metric is not None, 'METRIC_DETAIL_IDENTITY_REQUIRED')
        detail = {'source': deepcopy(source)}
        for key in ('unit', 'frequency', 'definition'):
            field = metric.get(key)
            if isinstance(field, str) and field.strip() and len(field) <= (4096 if key == 'definition' else 256) and (key != 'definition' or field != metric['name']):
                detail[key] = field
        return detail

    async def current(self):
        return await self.current_for_query(QueryValidationPolicy(strict=True))

    async def current_for_query(self, policy):
        # Discovery does not require execution governance. Queries do, and use
        # exactly the same version as discovery when that governance is present.
        if self.projection is None:
            raise DataContextError('DATA_CONTEXT_GOVERNANCE_REQUIRED',
                'Projection is not injected by adapters.factory; load configuration and pass projection explicitly',
                diagnostics={'stage': 'projection_configuration', 'issues': [
                    {'path': '/projection', 'property': 'projection', 'reason': 'not_injected'}],
                    'issueCount': 1, 'truncated': False})
        value = await self._read()
        require(not value['issues'], 'DATA_CONTEXT_PARTIAL')
        snapshot = project_lab_snapshot(subject_id='java-dataset-metadata', details=value['models'],
                                     projection=self.projection, values_by_dataset={}, policy=policy)
        snapshot['version'] = value['dataContextVersion']
        _, issues = parse_data_context(snapshot, policy=policy)
        require(not issues, 'DATA_CONTEXT_PROJECTION_ERROR')
        return snapshot
