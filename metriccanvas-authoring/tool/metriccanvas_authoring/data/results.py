"""Scoped query reuse and explicitly authorized bounded model evidence."""
from copy import deepcopy
from dataclasses import replace
import asyncio
import json
from jsonschema import Draft202012Validator
from metriccanvas_authoring.data.query import create_query_data
from metriccanvas_authoring.data.executable_units import build_query_source
from metriccanvas_authoring.data.metric_relations import load_relations, query_relations, relation_evidence
from metriccanvas_authoring.runtime_assets import bundle_root

# The authored plan owns the governed request schema; data does not import page composition.
_PLAN = json.loads((bundle_root() / 'contracts/authored/page-structure-plan.schema.json').read_text())['oneOf'][0]['properties']
DATA_REQUEST = deepcopy(_PLAN['dataRequests']['items'])
NAME = deepcopy(_PLAN['dataContextVersion'])
TEXT = deepcopy(_PLAN['question'])

def obj(properties, required):
    return {'type': 'object', 'additionalProperties': False, 'properties': properties, 'required': required}
from metriccanvas_authoring.work.state import digest, require

QUERY_SCHEMA = obj({'question': TEXT, 'dataContextVersion': NAME,
    'requests': {'type': 'array', 'minItems': 1, 'maxItems': 6, 'items': DATA_REQUEST},
    'reason': TEXT}, ['question', 'dataContextVersion', 'requests'])


class QueryResults:
    def __init__(self, dependencies, state, authorization, semantic_catalog=None):
        self.dependencies, self.state, self.authorization = dependencies, state, authorization
        self.semantic_catalog = semantic_catalog

    async def authorize(self, prepared, request, version):
        require(self.authorization is not None, 'ANALYSIS_AUTHORIZATION_UNAVAILABLE')
        grant = await self.authorization.authorize(deepcopy(dict(prepared.binding)), deepcopy(request), version)
        require(isinstance(grant, dict) and grant.get('binding') == dict(prepared.binding)
                and grant.get('dataContextVersion') == version and grant.get('requestSha256') == digest(request)
                and grant.get('planConfirmed') is True, 'ANALYSIS_PLAN_NOT_CONFIRMED')
        require(grant.get('modelEvidenceAllowed') is True, 'MODEL_EVIDENCE_UNAVAILABLE')
        return grant

    async def execute(self, prepared, request, current):
        require(Draft202012Validator(QUERY_SCHEMA).is_valid(request), 'QUERY_REQUEST_INVALID')
        requests = request['requests']
        require(len({r['dataSourceId'] for r in requests}) == len(requests), 'QUERY_ID_CONFLICT')
        version = request['dataContextVersion']
        # Authorize the entire batch before starting even one query.
        for item in requests:
            await self.authorize(prepared, item, version)
        await current()
        await self.state.consume(prepared, 'query_rounds')
        async def one(item):
            signature = digest([self.state.key(prepared), version, {k: v for k, v in item.items() if k != 'dataSourceId'}])
            ref = 'result-' + signature
            claimed = {'binding': deepcopy(dict(prepared.binding)), 'dataContextVersion': version,
                       'request': deepcopy(item), 'status': 'pending', 'resultRef': ref}
            owner = await self.state.store.compare_and_swap('query', ref, 0, claimed)
            if not owner:
                _, record = await self.state.store.read('query', ref)
                require(record['binding'] == dict(prepared.binding), 'RESULT_SCOPE_MISMATCH')
                await current()
                return self.evidence(record, item['dataSourceId'])
            deps = replace(self.dependencies, authoring_scope=dict(prepared.binding), require_source_description=True)
            try:
                await current()
                if self.semantic_catalog is not None:
                    issues = await self.semantic_catalog.query_issues(dict(prepared.binding), item)
                    if issues:
                        claimed.update(status='failed', issues=issues)
                        await self.state.store.compare_and_swap('query', ref, 1, claimed)
                        return self.evidence(claimed, item['dataSourceId'])
                spec = {'question': request['question'], 'dataContextVersion': version,
                        'units': [{**item, 'intent': 'detail', 'pinnedComponent': 'table'}]}
                async with asyncio.timeout(await self.state.remaining(prepared)):
                    result = await create_query_data(deps)(spec)
                await current()
                if result.ok:
                    execution = result.executions[0]
                    require(len(json.dumps(list(execution.rows), ensure_ascii=False, allow_nan=False).encode()) <= 2 * 1024 * 1024, 'QUERY_RESULT_SIZE_LIMIT')
                    claimed.update(status='empty' if not execution.rows else 'ready',
                        source=build_query_source(result.units[0], execution), rows=[dict(row) for row in execution.rows],
                        returnedCount=len(execution.rows), totalCount=execution.total_count,
                        capturedAt=execution.captured_at, sourceDescriptions=list(result.source_descriptions))
                    async with asyncio.timeout(await self.state.remaining(prepared)):
                        relations, status = await load_relations(self.dependencies.metric_relations,
                            dict(prepared.binding), version, item['businessDomain'])
                    await current()
                    claimed.update(relations=query_relations(relations, item, claimed['source']), relationStatus=status)
                else:
                    claimed.update(status='failed', issues=[{'code': i.code, 'path': i.path} for i in result.issues])
                await self.state.store.compare_and_swap('query', ref, 1, claimed)
                return self.evidence(claimed, item['dataSourceId'])
            except BaseException:
                claimed.update(status='failed', issues=[{'code': 'QUERY_INTERRUPTED', 'path': ''}])
                await asyncio.shield(self.state.store.compare_and_swap('query', ref, 1, claimed))
                raise
        results = await asyncio.gather(*(one(item) for item in requests))
        await current()
        payload = {'status': 'ready' if all(r['status'] in {'ready', 'empty'} for r in results) else 'partial' if any(r['status'] in {'ready', 'empty'} for r in results) else 'failed',
                   'dataContextVersion': version, 'results': results}
        self.bound(payload)
        await self.state.consume(prepared, 'total_evidence_bytes', len(json.dumps(payload, ensure_ascii=False).encode()))
        return payload

    def bound(self, payload):
        def size(): return len(json.dumps(payload, ensure_ascii=False, allow_nan=False).encode())
        while size() > self.state.limits.evidence_bytes:
            rows = [r for r in payload['results'] if r.get('rows')]
            if not rows:
                related = [r for r in payload['results'] if r.get('relations')]
                require(bool(related), 'MODEL_EVIDENCE_LIMIT')
                item = max(related, key=lambda r: len(r['relations']))
                item['relations'].pop()
                item['relationCoverage'].update(shownCount=len(item['relations']), truncated=True)
                continue
            item = max(rows, key=lambda r: len(r['rows']))
            item['rows'].pop()
            item['coverage']['shownCount'] = len(item['rows'])
            item['coverage']['truncated'] = True
            item['coverage']['complete'] = False

    def evidence(self, record, source_id=None):
        result = {'resultRef': record['resultRef'], 'dataSourceId': source_id or record['request']['dataSourceId'],
                  'status': record['status'], 'scope': deepcopy(record['request'])}
        result['scope']['dataSourceId'] = result['dataSourceId']
        if record['status'] not in {'ready', 'empty'}:
            result['issues'] = deepcopy(record.get('issues', []))
            return result
        fields = record['source']['fields']
        # Detail/HTML/recordList values stay in the program channel.
        allowed = {key: field for key, field in fields.items() if field.get('role') in {'dimension', 'measure'} and field.get('type') not in {'recordList', 'semanticHtml'}}
        result['fields'] = {key: {k: deepcopy(v) for k, v in field.items() if k in {'label', 'role', 'type', 'unit', 'defaultFormat'}} for key, field in allowed.items()}
        result['rows'] = [{key: row.get(field.get('queryField', key)) for key, field in allowed.items()} for row in record['rows'][:self.state.limits.evidence_rows]]
        shown, returned, total = len(result['rows']), record['returnedCount'], record['totalCount']
        result['coverage'] = {'shownCount': shown, 'returnedCount': returned, 'totalCount': total,
                              'truncated': shown < returned or total is not None and returned < total,
                              'complete': total is not None and shown == returned == total,
                              'basis': 'returned rows; no ranking or aggregation inferred'}
        entries = relation_evidence(record.get('relations', []), allowed)
        result['relations'] = entries[:20]
        result['relationCoverage'] = {'status': record.get('relationStatus', 'unknown'),
            'shownCount': len(result['relations']), 'totalCount': len(entries), 'truncated': len(entries) > 20}
        result['capturedAt'] = record['capturedAt']
        return result

    async def require(self, prepared, ref, current, *, usable=True):
        _, record = await self.state.store.read('query', ref)
        require(record is not None and record['binding'] == dict(prepared.binding), 'RESULT_SCOPE_MISMATCH')
        snapshot = await self.dependencies.data_context.current()
        from metriccanvas_authoring.data.data_context import parse_data_context
        context, issues = parse_data_context(snapshot)
        require(not issues and context.version == record['dataContextVersion'], 'RESULT_VERSION_STALE')
        await self.authorize(prepared, record['request'], record['dataContextVersion'])
        await current()
        if usable:
            require(record['status'] in {'ready', 'empty'}, 'RESULT_NOT_READY')
        return deepcopy(record)

    async def read(self, prepared, ref, current):
        record = await self.require(prepared, ref, current, usable=False)
        payload = {'status': record['status'], 'results': [self.evidence(record)]}
        self.bound(payload)
        await self.state.consume(prepared, 'total_evidence_bytes', len(json.dumps(payload, ensure_ascii=False).encode()))
        return payload
