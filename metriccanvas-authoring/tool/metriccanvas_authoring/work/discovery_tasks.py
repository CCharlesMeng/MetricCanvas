"""Durable discovery continuations. One CAS record includes the event receipt."""
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo
import time
from uuid import uuid4
from metriccanvas_authoring.work.state import digest, require
from metriccanvas_authoring.data.discovery.contracts import validate


@dataclass
class DiscoveryClaim:
    key: str
    version: int
    record: dict
    token: str
    event: str
    cached: dict | None = None


class DiscoveryTasks:
    namespace = 'discovery_task'

    def __init__(self, store, limits, clock=time.time):
        self.store, self.limits, self.clock = store, limits, clock

    def identity(self, binding, invocation):
        validate('invocation', invocation)
        require(all(invocation[k] == binding.get(k) for k in ('actorId', 'workspaceId')),
                'DISCOVERY_SCOPE_MISMATCH')
        try:
            now = datetime.fromisoformat(invocation['receivedAt'].replace('Z', '+00:00'))
            require(now.tzinfo is not None, 'DISCOVERY_TIME_INVALID')
            ZoneInfo(invocation['timezone'])
        except (ValueError, KeyError):
            require(False, 'DISCOVERY_TIME_INVALID')
        return {k: invocation[k] for k in ('actorId', 'workspaceId', 'sessionRef')}

    def key(self, binding, invocation):
        owner = self.identity(binding, invocation)
        if invocation['invocationKind'] == 'new':
            require('taskRef' not in invocation and 'answer' not in invocation,
                    'DISCOVERY_NEW_CONTEXT_INVALID')
            return 'discovery-' + digest([owner, invocation['requestEventId']])
        require(bool(invocation.get('taskRef')), 'DISCOVERY_CONTINUATION_REQUIRED')
        return invocation['taskRef']

    async def begin(self, binding, invocation):
        owner = self.identity(binding, invocation)
        key = self.key(binding, invocation)
        version, record = await self.store.read(self.namespace, key)
        now = self.clock()
        event = invocation['requestEventId']
        payload_hash = digest(invocation)
        if record is None:
            require(invocation['invocationKind'] == 'new', 'DISCOVERY_TASK_NOT_FOUND')
            received = datetime.fromisoformat(invocation['receivedAt'].replace('Z', '+00:00')).timestamp()
            require(-300 <= now - received < self.limits.ttl_seconds, 'DISCOVERY_EVENT_EXPIRED')
            record = {'recordFormatVersion': '1.0', 'taskRef': key, 'revision': 0,
                      'owner': owner, 'pageId': binding.get('pageId'),
                      'originalRequest': deepcopy(invocation), 'requestRevisions': [],
                      'requirements': [], 'relationships': [], 'constraints': {},
                      'candidateEvidence': [], 'processedEvents': {}, 'pendingInteraction': None,
                      'analysisBudget': {'modelCalls': 0, 'expansions': 0}, 'clarifications': 0,
                      'createdAt': now, 'expiresAt': now + self.limits.ttl_seconds, 'status': 'collecting'}
        require(record.get('recordFormatVersion') == '1.0', 'DISCOVERY_RECORD_VERSION')
        require(record['owner'] == owner and record['pageId'] == binding.get('pageId'), 'DISCOVERY_SCOPE_MISMATCH')
        require(record['expiresAt'] > now, 'DISCOVERY_TASK_EXPIRED')
        prior = record['processedEvents'].get(event)
        if prior:
            require(prior['payloadHash'] == payload_hash and prior['bindingHash'] == digest(binding),
                    'DISCOVERY_EVENT_MISMATCH')
            # An old receipt must not restore a newer revision's old choices.
            require(prior['revision'] == record['revision'], 'DISCOVERY_REVISION_CONFLICT')
            return DiscoveryClaim(key, version, record, '', event, deepcopy(prior['response']))
        require(record['status'] not in {'cancelled', 'completed'}, 'DISCOVERY_TASK_CLOSED')
        require(len(record['processedEvents']) < self.limits.events, 'DISCOVERY_EVENT_LIMIT')
        active = record.get('active')
        require(not active or active['expiresAt'] <= now, 'DISCOVERY_BUSY')
        if invocation['invocationKind'] != 'new':
            require(invocation.get('expectedRevision') == record['revision'], 'DISCOVERY_REVISION_CONFLICT')
        if invocation['invocationKind'] == 'resume':
            pending = record.get('pendingInteraction')
            if 'answer' in invocation:
                require(pending is not None and invocation.get('interactionId') == pending['interactionId'],
                        'DISCOVERY_INTERACTION_STALE')
            else:
                require(pending is None, 'DISCOVERY_ANSWER_REQUIRED')
        if invocation['invocationKind'] == 'modify':
            require(len(record['requestRevisions']) < self.limits.events, 'DISCOVERY_EVENT_LIMIT')
            record['requestRevisions'].append(deepcopy(invocation))
            record.update(requirements=[], relationships=[], constraints={}, pendingInteraction=None,
                          analysisBudget={'modelCalls': 0, 'expansions': 0}, clarifications=0)
        token = uuid4().hex
        record['active'] = {'token': token, 'event': event, 'expiresAt': now + self.limits.lease_seconds,
                            'payloadHash': payload_hash, 'bindingHash': digest(binding)}
        require(await self.store.compare_and_swap(self.namespace, key, version, record), 'DISCOVERY_REVISION_CONFLICT')
        return DiscoveryClaim(key, version + 1, record, token, event)

    async def checkpoint(self, claim):
        # Reserve costs before network calls, so interruption cannot reset the budget.
        require(await self.store.compare_and_swap(self.namespace, claim.key, claim.version, claim.record),
                'DISCOVERY_REVISION_CONFLICT')
        claim.version += 1

    async def finish(self, claim, response):
        record = deepcopy(claim.record)
        require(record['active']['token'] == claim.token, 'DISCOVERY_REVISION_CONFLICT')
        active = record.pop('active')
        record['revision'] += 1
        response = deepcopy(response)
        response['discovery']['revision'] = record['revision']
        if response.get('interactionEnvelope'):
            response['interactionEnvelope']['revision'] = record['revision']
        record['processedEvents'][claim.event] = {
            'payloadHash': active['payloadHash'], 'bindingHash': active['bindingHash'],
            'revision': record['revision'], 'response': response}
        require(await self.store.compare_and_swap(self.namespace, claim.key, claim.version, record),
                'DISCOVERY_REVISION_CONFLICT')
        return response

    async def abort(self, claim):
        # Clear only our own persisted lease; preserve checkpoints, not speculative local changes.
        version, record = await self.store.read(self.namespace, claim.key)
        if record and record.get('active', {}).get('token') == claim.token:
            record.pop('active')
            await self.store.compare_and_swap(self.namespace, claim.key, version, record)

    async def require_query(self, binding, invocation, request, data_version):
        owner = self.identity(binding, invocation)
        _, record = await self.store.read(self.namespace, self.key(binding, invocation))
        require(record is not None and record['owner'] == owner and record['pageId'] == binding.get('pageId'),
                'DISCOVERY_TASK_NOT_FOUND')
        require(record['expiresAt'] > self.clock() and not record.get('active')
                and record['status'] not in {'cancelled', 'expired'}, 'DISCOVERY_TASK_CLOSED')
        require(record.get('lastBindingHash') == digest(binding), 'DISCOVERY_REVALIDATION_REQUIRED')
        require(record.get('dataContextVersion') == data_version, 'DATA_CONTEXT_VERSION_CHANGED')
        constraints = record.get('constraints', {})
        expected_time = constraints.get('time')
        if expected_time is not None:
            actual = request.get('time') or {}
            require(all(actual.get(k) == expected_time[k] for k in ('granularity', 'start', 'end')),
                    'DISCOVERY_REQUEST_SCOPE_CHANGED')
        require(set(constraints.get('groupBy', [])) <= set(request.get('groupBy', [])),
                'DISCOVERY_REQUEST_SCOPE_CHANGED')
        selected = {r['selectedRef'] for r in record['requirements'] if r['status'] == 'resolved'}
        allowed = {(c['businessDomain'], c['name']) for c in record['candidateEvidence'] if c['metricRef'] in selected}
        require(all((request['businessDomain'], m['name']) in allowed for m in request['metrics']),
                'DISCOVERY_SELECTION_REQUIRED')
        # A partially resolved calculation/comparison cannot be executed as if complete.
        by_id = {r['id']: r for r in record['requirements']}
        requested = {m['name'] for m in request['metrics']}
        for relation in record['relationships']:
            if relation['kind'] == 'independent': continue
            group = [by_id[i] for i in relation['requirementIds']]
            group_refs = {c['metricRef'] for r in group for c in r['candidates']}
            names = {c['name'] for c in record['candidateEvidence'] if c['metricRef'] in group_refs}
            if requested & names:
                require(all(r['status'] == 'resolved' for r in group), 'DISCOVERY_DEPENDENCY_UNRESOLVED')
