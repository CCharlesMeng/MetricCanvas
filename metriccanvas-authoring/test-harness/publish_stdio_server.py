"""Explicit publication provider/human-event substitutes, excluded from production packages."""
import asyncio
import json
import os
import sys
from copy import deepcopy
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [os.environ.get('S4_LIFECYCLE_INSTALLED_ROOT') or str(ROOT / 'tool'), str(ROOT / 'test-harness')]
from lifecycle_stdio_server import Identities, Programs, ProposedService, digest
from metriccanvas_authoring.application.lifecycle_ports import LifecycleError
from metriccanvas_authoring.application.publish_ports import PublicationDependencies
from metriccanvas_authoring.adapters.inbound.lifecycle_mcp import create_lifecycle_mcp_server

REVIEW_KEYS = ('ref', 'contentHash', 'canonicalization', 'diff', 'affectedDataSources',
               'parameterSummary', 'retainDimensionValues', 'validation', 'expiresAt',
               'leaseId', 'leaseExpiresAt')
SOURCE = {'pageId': 'dimension-params-page', 'revisionId': 'draft-r1', 'resourceId': 'resource-a'}


def context(operation):
    return {'actorId': 'actor-a', 'workspaceId': 'workspace-a', 'operationId': operation,
            'origin': {'kind': 'relay', 'skillVersion': 'fixture/1', 'runId': 'run-a'}}


def signed(candidate):
    candidate['contentHash'] = digest(candidate['document'])
    candidate['canonicalization'] = 'fixture-document/1'
    candidate['reviewCanonicalization'] = 'fixture-review/1'
    candidate['reviewHash'] = digest({'algorithm': 'fixture-review/1',
        'payload': {k: candidate[k] for k in REVIEW_KEYS}})
    return candidate


def candidate(version='v1', retain=True):
    document = json.loads((ROOT.parent / 'packages/page/fixtures/contract-valid/dimension-params-page.json').read_text())
    if not retain:
        document['params'][0].pop('default', None)
    return signed({'ref': {'candidateId': 'candidate-a', 'candidateVersion': version, 'source': deepcopy(SOURCE)},
        'document': document, 'expiresAt': '2026-09-14T15:15:00Z', 'leaseId': 'lease-a',
        'leaseExpiresAt': '2026-09-14T15:15:00Z',
        'diff': [{'summary': 'private-region-values', 'sourcePath': '/dataSources/sales/source/query',
                  'candidatePath': '/params/0', 'parameterId': 'regions'}],
        'affectedDataSources': ['sales', 'shared'],
        'parameterSummary': [
            {'parameterId': 'regions', 'label': 'private-region-label', 'valueType': 'string[]',
             'selected': True, 'required': True, 'valueState': 'retained' if retain else 'missing',
             **({'defaultValue': ['APAC']} if retain else {}),
             'targets': [{'dataSourceId': 'sales', 'queryField': 'region'}, {'dataSourceId': 'shared', 'queryField': 'region'}],
             'extractionKind': 'dimension-in', 'sharing': 'identical-values'},
            {'parameterId': 'segment', 'label': 'Segment', 'valueType': 'string', 'selected': True,
             'required': False, 'valueState': 'missing',
             'targets': [{'dataSourceId': 'shared', 'queryField': 'segment'}],
             'extractionKind': 'dimension-eq', 'sharing': 'none'}],
        'retainDimensionValues': retain, 'validation': {'valid': True, 'issues': []}})


def prepare_request(operation='prepare-1'):
    return {'kind': 'prepare', 'context': context(operation), 'source': deepcopy(SOURCE), 'retainDimensionValues': True}


class HumanEvents:
    """Only simulate_human_action records an event; no such method is a model tool."""
    def __init__(self):
        self.events = {}
        self.reads = 0
    def simulate_human_action(self, candidate):
        token = 'human-event-token-' + str(len(self.events) + 1)
        record = {'actorId': 'actor-a', 'workspaceId': 'workspace-a', 'candidate': deepcopy(candidate['ref']),
            'source': deepcopy(candidate['ref']['source']), 'expiresAt': '2026-09-14T15:14:00Z',
            'proof': 'authenticated-human-proof-' + token}
        for key in ('retainDimensionValues', 'contentHash', 'canonicalization', 'reviewHash', 'reviewCanonicalization', 'leaseId'):
            record[key] = deepcopy(candidate[key])
        self.events[token] = record
        return token
    async def read(self, token, identity):
        self.reads += 1
        if token not in self.events:
            raise LifecycleError('CONFIRMATION_REQUIRED')
        return deepcopy(self.events[token])


class PublicationProvider:
    available = True
    def __init__(self, humans):
        self.humans = humans
        self.operations, self.candidates, self.templates = {}, {}, {}
        self.attestations = set()
        self.writes = {'prepare': 0, 'revise': 0, 'publish': 0}
        self.head = deepcopy(SOURCE)
        self.current_version = None
        self.denied = False
        self.lease_consumed = False
        self.rejection = None
        self.lose_ack = None
        self.lookup_state = None
        self.malformed_result = None
    def authorize(self, identity):
        if self.denied or identity.actor_id != 'actor-a' or identity.workspace_id != 'workspace-a' or identity.auth_token != 'secret-token':
            raise LifecycleError('FORBIDDEN')
    def key(self, command):
        return command['kind'], command['context']['actorId'], command['context']['workspaceId'], command['context']['operationId']
    def result(self, command, status, **extra):
        return {'status': status, 'operationKind': command['kind'], 'operationId': command['context']['operationId'], **extra}
    def attest(self, command, result):
        self.attestations.add((digest(command), digest(result)))
        return deepcopy(result)
    def verify_result(self, identity, command, result):
        self.authorize(identity)
        return (digest(command), digest(result)) in self.attestations
    def verify_document(self, document, content_hash, algorithm):
        return algorithm == 'fixture-document/1' and digest(document) == content_hash
    def verify_review(self, value):
        return value['reviewCanonicalization'] == 'fixture-review/1' and value['reviewHash'] == digest({
            'algorithm': 'fixture-review/1', 'payload': {k: value[k] for k in REVIEW_KEYS}})
    async def lookup(self, identity, command):
        self.authorize(identity)
        key = self.key(command)
        if self.lookup_state:
            return self.attest(command, self.result(command, **self.lookup_state))
        if key not in self.operations:
            return self.attest(command, self.result(command, 'not-applied', retrySafe=True))
        fingerprint, result = self.operations[key]
        if fingerprint != digest(command):
            return self.attest(command, self.result(command, 'rejected', code='IDEMPOTENCY_CONFLICT', retryable=False))
        return self.attest(command, result)
    async def read(self, identity, ref):
        self.authorize(identity)
        value = self.candidates.get(ref['candidateVersion'])
        if value is None:
            raise LifecycleError('CANDIDATE_CHANGED')
        return deepcopy(value)
    async def finish(self, command, result):
        self.operations[self.key(command)] = digest(command), deepcopy(result)
        if self.lose_ack == command['kind']:
            self.lose_ack = None
            raise TimeoutError('private-provider-diagnostics')
        if self.malformed_result is not None:
            result = self.malformed_result(result)
        return self.attest(command, result)
    async def prepare(self, identity, command):
        self.authorize(identity)
        self.writes['prepare'] += 1
        value = candidate(retain=command['retainDimensionValues'])
        self.candidates['v1'] = deepcopy(value); self.current_version = 'v1'
        return await self.finish(command, self.result(command, 'completed', candidate=value))
    async def revise(self, identity, command):
        self.authorize(identity)
        self.writes['revise'] += 1
        if command['ref']['candidateVersion'] != self.current_version:
            raise LifecycleError('CANDIDATE_CHANGED')
        # One predetermined correction fixture, not a general extraction algorithm.
        if any(item['parameterId'] == 'regions' and not item['selected'] for item in command['corrections'].get('parameterSelections', [])):
            raise LifecycleError('INVALID_REQUEST')
        value = candidate('v2', command['corrections'].get('retainDimensionValues', True))
        if any(item['parameterId'] == 'segment' and not item['selected'] for item in command['corrections'].get('parameterSelections', [])):
            value['document']['params'] = [p for p in value['document']['params'] if p['id'] != 'segment']
            del value['document']['dataSources']['shared']['source']['query']['paramBindings']['segment']
            value['parameterSummary'][1]['selected'] = False
            value['parameterSummary'][1]['valueState'] = 'not-selected'
            signed(value)
        self.candidates['v2'] = deepcopy(value); self.current_version = 'v2'
        return await self.finish(command, self.result(command, 'completed', candidate=value))
    async def publish(self, identity, command, value, confirmation):
        self.authorize(identity)
        self.writes['publish'] += 1
        if self.rejection:
            raise LifecycleError(self.rejection)
        if self.lease_consumed:
            raise LifecycleError('LEASE_EXPIRED')
        if self.head != command['ref']['source']:
            raise LifecycleError('REVISION_CONFLICT')
        if self.current_version != command['ref']['candidateVersion']:
            raise LifecycleError('CANDIDATE_CHANGED')
        expected = self.humans.events.get(command['confirmationToken'])
        if expected is None or expected != confirmation:
            raise LifecycleError('CONFIRMATION_REQUIRED')
        if confirmation['proof'] != 'authenticated-human-proof-' + command['confirmationToken']:
            raise LifecycleError('CONFIRMATION_REQUIRED')
        ref = {'templateId': 'template-a', 'templateRevisionId': 'template-r1', 'source': deepcopy(command['ref']['source'])}
        self.templates['template-r1'] = {'ref': deepcopy(ref), 'document': deepcopy(value['document'])}
        self.lease_consumed = True
        return await self.finish(command, self.result(command, 'completed', template=ref))


if __name__ == '__main__':
    if installed := os.environ.get('S4_LIFECYCLE_INSTALLED_ROOT'):
        import metriccanvas_authoring
        assert Path(metriccanvas_authoring.__file__).resolve().is_relative_to(Path(installed).resolve())
    programs, humans = Programs(), HumanEvents()
    provider = PublicationProvider(humans)
    first = candidate()
    provider.candidates['v1'] = deepcopy(first); provider.current_version = 'v1'
    confirmation_token = humans.simulate_human_action(first)
    programs.inputs['prepare-request-token'] = prepare_request()
    programs.inputs['candidate-read-token'] = {'kind': 'read', 'ref': first['ref']}
    programs.inputs['publish-request-token'] = {'kind': 'publish', 'context': context('publish-1'),
                                               'ref': first['ref'], 'confirmationToken': confirmation_token}
    programs.inputs['publish-unconfirmed-token'] = {'kind': 'publish', 'context': context('unconfirmed-1'),
        'ref': first['ref'], 'confirmationToken': 'unrecorded-human-token'}
    create_lifecycle_mcp_server(ProposedService(), programs, Identities(),
        publication=PublicationDependencies(provider, humans)).run()
