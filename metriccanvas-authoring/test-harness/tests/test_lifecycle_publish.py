import asyncio
import json
import sys
import unittest
from copy import deepcopy
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'tool'), str(ROOT / 'test-harness')]
from publish_stdio_server import PublicationProvider, HumanEvents, candidate, signed, context, prepare_request, SOURCE
from lifecycle_stdio_server import Identities, Programs, ProposedService
from metriccanvas_authoring.application.lifecycle_publish import Publication, validate_candidate_parameters
from metriccanvas_authoring.application.publish_ports import PublicationDependencies
from metriccanvas_authoring.application.lifecycle_ports import LifecycleIdentity, LifecycleError


class PublicationTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.programs, self.identities, self.humans = Programs(), Identities(), HumanEvents()
        self.provider = PublicationProvider(self.humans)
        self.app = Publication(PublicationDependencies(self.provider, self.humans), self.programs, self.identities)
        self.programs.inputs['prepare-token'] = prepare_request()
    async def call(self, operation='prepare', token='prepare-token'):
        return await self.app.call(operation, token)
    async def ready(self):
        result = await self.call()
        self.assertEqual(result['status'], 'completed', result)
        self.programs.inputs['read-token'] = {'kind': 'read', 'ref': result['ref']}
        return deepcopy(self.provider.candidates['v1'])
    def publish_request(self, value, operation='publish-1', human=True):
        token = self.humans.simulate_human_action(value) if human else 'unrecorded-human-token'
        self.programs.inputs['publish-token'] = {'kind': 'publish', 'context': context(operation),
            'ref': deepcopy(value['ref']), 'confirmationToken': token}
        return token
    async def test_prepare_read_publish_replay_and_raw_program_only(self):
        first = await self.ready()
        result = await self.call('read', 'read-token')
        self.assertEqual(result['status'], 'read')
        self.assertEqual(self.programs.outputs[result['programToken']]['candidate'], first)
        self.publish_request(first)
        result = await self.call('publish', 'publish-token')
        self.assertEqual(result['status'], 'completed', result)
        again = await self.call('publish', 'publish-token')
        queried = await self.call('lookup', 'publish-token')
        self.assertEqual(result['template'], again['template']); self.assertEqual(result['template'], queried['template'])
        self.assertEqual(self.provider.writes['publish'], 1)
        self.assertNotIn('private', json.dumps(result)); self.assertNotIn('proof', json.dumps(result))
    async def test_correct_retention_and_selection_then_require_new_human_event(self):
        first = await self.ready(); old_token = self.publish_request(first)
        self.programs.inputs['revise-token'] = {'kind': 'revise', 'context': context('revise-1'), 'ref': first['ref'],
            'corrections': {'retainDimensionValues': False, 'parameterSelections': [{'parameterId': 'segment', 'selected': False}]}}
        revised = await self.call('revise', 'revise-token')
        self.assertEqual(revised['status'], 'completed', revised)
        value = self.provider.candidates['v2']
        self.assertFalse(value['retainDimensionValues']); self.assertNotIn('default', value['document']['params'][0])
        self.assertEqual(value['parameterSummary'][1]['valueState'], 'not-selected')
        self.programs.inputs['publish-token']['ref'] = revised['ref']
        stale = await self.call('publish', 'publish-token')
        self.assertEqual(stale['code'], 'CANDIDATE_CHANGED'); self.assertFalse(self.provider.templates)
        self.publish_request(value, 'publish-v2')
        self.assertEqual((await self.call('publish', 'publish-token'))['status'], 'completed')
    async def test_no_human_record_or_forged_proof_cannot_publish(self):
        first = await self.ready(); self.publish_request(first, human=False)
        self.assertEqual((await self.call('publish', 'publish-token'))['code'], 'CONFIRMATION_REQUIRED')
        self.assertEqual(self.provider.writes['publish'], 0)
        token = self.publish_request(first)
        self.humans.events[token]['proof'] = 'model-invented-proof'
        self.assertEqual((await self.call('publish', 'publish-token'))['code'], 'CONFIRMATION_REQUIRED')
        self.assertFalse(self.provider.templates)
    async def test_human_scope_review_retention_and_lease_mismatch_zero_submit(self):
        first = await self.ready()
        for key, value in [('actorId', 'other'), ('workspaceId', 'other'), ('reviewHash', '0'*64),
                           ('contentHash', '0'*64), ('retainDimensionValues', False), ('leaseId', 'other'),
                           ('reviewCanonicalization', 'weak-algorithm')]:
            token = self.publish_request(first)
            self.humans.events[token][key] = value
            result = await self.call('publish', 'publish-token')
            self.assertEqual(result['status'], 'rejected', (key, result))
        self.assertEqual(self.provider.writes['publish'], 0)
    async def test_same_document_changed_review_and_algorithm_downgrade_rejected(self):
        first = await self.ready()
        self.provider.candidates['v1']['diff'][0]['summary'] = 'changed human-visible review'
        self.assertEqual((await self.call('read', 'read-token'))['code'], 'RESPONSE_MISMATCH')
        self.provider.candidates['v1'] = deepcopy(first)
        self.provider.candidates['v1']['reviewCanonicalization'] = 'weak-algorithm'
        self.assertEqual((await self.call('read', 'read-token'))['code'], 'RESPONSE_MISMATCH')
    async def test_authoritative_expiry_revocation_head_and_lease_rejections(self):
        first = await self.ready(); self.publish_request(first)
        for code in ['CANDIDATE_EXPIRED', 'CONFIRMATION_EXPIRED', 'CONFIRMATION_REQUIRED', 'LEASE_EXPIRED', 'FORBIDDEN']:
            self.provider.rejection = code
            result = await self.call('publish', 'publish-token')
            self.assertEqual(result['code'], code)
            self.assertFalse(self.provider.templates)
        self.provider.rejection = None; self.provider.head = {**SOURCE, 'revisionId': 'draft-r2'}
        self.assertEqual((await self.call('publish', 'publish-token'))['code'], 'REVISION_CONFLICT')
        self.provider.head = deepcopy(SOURCE); self.provider.current_version = 'v3'
        self.assertEqual((await self.call('publish', 'publish-token'))['code'], 'CANDIDATE_CHANGED')
        self.assertFalse(self.provider.templates)
    async def test_completed_replay_after_expiry_head_change_but_current_permission_required(self):
        first = await self.ready(); self.publish_request(first)
        original = await self.call('publish', 'publish-token'); reads = self.humans.reads
        self.provider.rejection = 'CONFIRMATION_EXPIRED'; self.provider.head = {**SOURCE, 'revisionId': 'draft-r3'}
        self.provider.current_version = 'v3'; self.humans.events.clear()
        for method in ['lookup', 'publish']:
            replay = await self.call(method, 'publish-token')
            self.assertEqual(replay['template'], original['template'])
        self.assertEqual(self.humans.reads, reads); self.assertEqual(self.provider.writes['publish'], 1)
        self.assertEqual(self.provider.templates['template-r1']['document'], first['document'])
        self.provider.denied = True
        self.assertEqual((await self.call('lookup', 'publish-token'))['code'], 'FORBIDDEN')
    async def test_all_writes_lost_ack_query_original_result_without_repeating(self):
        self.provider.lose_ack = 'prepare'
        self.assertEqual((await self.call())['status'], 'unknown')
        prepared = await self.call('lookup')
        self.assertEqual(prepared['status'], 'completed'); self.assertEqual(self.provider.writes['prepare'], 1)
        first = self.provider.candidates['v1']
        self.programs.inputs['revise-token'] = {'kind': 'revise', 'context': context('revise-1'), 'ref': first['ref'], 'corrections': {'retainDimensionValues': False}}
        self.provider.lose_ack = 'revise'
        self.assertEqual((await self.call('revise', 'revise-token'))['status'], 'unknown')
        self.assertEqual((await self.call('lookup', 'revise-token'))['status'], 'completed')
        self.assertEqual(self.provider.writes['revise'], 1)
        self.publish_request(self.provider.candidates['v2']); self.provider.lose_ack = 'publish'
        self.assertEqual((await self.call('publish', 'publish-token'))['status'], 'unknown')
        self.assertEqual((await self.call('lookup', 'publish-token'))['status'], 'completed')
        self.assertEqual(self.provider.writes['publish'], 1)
    async def test_program_delivery_failure_and_malformed_completion_remain_unknown(self):
        original = self.programs.store
        async def failure(value, identity): raise OSError('private-path')
        self.programs.store = failure
        result = await self.call(); self.assertEqual(result['status'], 'unknown'); self.assertEqual(result['operationId'], 'prepare-1')
        self.programs.store = original
        self.assertEqual((await self.call('lookup'))['status'], 'completed'); self.assertEqual(self.provider.writes['prepare'], 1)
        value = self.provider.candidates['v1']; self.publish_request(value)
        self.provider.malformed_result = lambda result: {**result, 'operationId': 'wrong'}
        self.assertEqual((await self.call('publish', 'publish-token'))['status'], 'unknown')
        self.assertEqual((await self.call('lookup', 'publish-token'))['status'], 'completed')
        self.assertEqual(self.provider.writes['publish'], 1)
    async def test_pending_unknown_unsafe_not_applied_never_write(self):
        for state in [{'status': 'pending'}, {'status': 'unknown'}, {'status': 'not-applied', 'retrySafe': False}]:
            self.provider.lookup_state = state
            self.assertEqual((await self.call())['status'], state['status'] if state['status'] != 'not-applied' else 'unknown')
            self.assertEqual((await self.call('lookup'))['status'], state['status'])
        self.assertEqual(sum(self.provider.writes.values()), 0)
    async def test_changed_same_operation_payload_and_confirmation_token_conflict(self):
        first = await self.ready()
        self.programs.inputs['prepare-token']['retainDimensionValues'] = False
        self.assertEqual((await self.call())['code'], 'IDEMPOTENCY_CONFLICT')
        self.publish_request(first); self.assertEqual((await self.call('publish', 'publish-token'))['status'], 'completed')
        self.programs.inputs['publish-token']['confirmationToken'] = 'different-token'
        self.assertEqual((await self.call('lookup', 'publish-token'))['code'], 'IDEMPOTENCY_CONFLICT')
        self.assertEqual(self.provider.writes['publish'], 1)
    async def test_request_rejects_arbitrary_patch_duplicate_unknown_selection(self):
        first = await self.ready()
        for corrections in [{'document': {}}, {'parameterSelections': [{'parameterId': 'regions', 'selected': True}]*2},
                            {'parameterSelections': [{'parameterId': 'unknown', 'selected': True}]}]:
            self.programs.inputs['revise-token'] = {'kind': 'revise', 'context': context('revise-1'), 'ref': first['ref'], 'corrections': corrections}
            self.assertEqual((await self.call('revise', 'revise-token'))['code'], 'INVALID_REQUEST')
        self.assertEqual(self.provider.writes['revise'], 0)
    async def test_signed_but_wrong_targets_values_or_unsupported_extraction_rejected(self):
        first = await self.ready()
        variants = []
        for mutate in [lambda c: c['parameterSummary'][0]['targets'].pop(),
                       lambda c: c['parameterSummary'][0].update(required=False),
                       lambda c: c['parameterSummary'][0].update(defaultValue=['EU']),
                       lambda c: c['parameterSummary'][0].update(extractionKind='time-range'),
                       lambda c: c['parameterSummary'][0].update(sharing='different-values')]:
            value = deepcopy(first); mutate(value); variants.append(signed(value))
        for value in variants:
            self.provider.candidates['v1'] = value
            self.assertEqual((await self.call('read', 'read-token'))['status'], 'rejected')
        self.assertFalse(self.provider.templates)
    async def test_blocking_validation_is_readable_but_cannot_publish(self):
        first = await self.ready()
        first['validation'] = {'valid': False, 'issues': [{'severity': 'blocking', 'code': 'UNSUPPORTED_EXTRACTION', 'message': 'private-validation'}]}
        signed(first); self.provider.candidates['v1'] = first
        self.assertFalse((await self.call('read', 'read-token'))['publishable'])
        self.publish_request(first)
        self.assertEqual((await self.call('publish', 'publish-token'))['code'], 'CANDIDATE_INVALID')
        self.assertEqual(self.provider.writes['publish'], 0)
    async def test_cancel_or_identity_switch_retains_original_query(self):
        first = await self.ready(); self.publish_request(first)
        original = self.provider.publish; committed = asyncio.Event(); wait = asyncio.Event()
        async def delay(*args):
            result = await original(*args); committed.set(); await wait.wait(); return result
        self.provider.publish = delay
        task = asyncio.create_task(self.call('publish', 'publish-token'))
        try:
            await asyncio.wait_for(committed.wait(), 2)
        finally:
            task.cancel()
        with self.assertRaises(asyncio.CancelledError): await task
        self.identities.value = LifecycleIdentity('actor-b', 'workspace-a', 'secret-token')
        self.assertEqual((await self.call('lookup', 'publish-token'))['code'], 'FORBIDDEN')
        self.identities.value = Identities.value
        self.assertEqual((await self.call('lookup', 'publish-token'))['status'], 'completed')
        self.assertEqual(self.provider.writes['publish'], 1)
    async def test_existing_parameter_requires_exact_verified_source(self):
        first = await self.ready()
        first['parameterSummary'][0]['extractionKind'] = None
        signed(first)
        self.provider.candidates['v1'] = first
        self.assertEqual((await self.call('read', 'read-token'))['code'], 'CAPABILITY_UNAVAILABLE')
        source = {'ref': deepcopy(SOURCE), 'document': deepcopy(first['document']),
                  'contentHash': first['contentHash'], 'canonicalization': first['canonicalization']}
        provider = ProposedService()
        async def exact(identity, ref): return deepcopy(source)
        provider.read = exact
        provider.verify_document = self.provider.verify_document
        self.app.sources = provider
        self.assertEqual((await self.call('read', 'read-token'))['status'], 'read')
        source['contentHash'] = 'tampered'
        self.assertEqual((await self.call('read', 'read-token'))['code'], 'RESPONSE_MISMATCH')
        source['contentHash'] = first['contentHash']
        source['ref']['revisionId'] = 'wrong-revision'
        self.assertEqual((await self.call('read', 'read-token'))['code'], 'RESPONSE_MISMATCH')
        source['ref'] = deepcopy(SOURCE)
        source['document']['params'][0]['default'] = ['EU']
        source['contentHash'] = signed(deepcopy(first) | {'document': source['document']})['contentHash']
        self.assertEqual((await self.call('read', 'read-token'))['code'], 'RESPONSE_MISMATCH')

    async def test_default_unavailable_registers_no_fake_service(self):
        app = Publication(None, self.programs, self.identities)
        for operation in ['prepare', 'read', 'revise', 'publish', 'lookup']:
            self.assertEqual((await app.call(operation, 'irrelevant-token'))['code'], 'CAPABILITY_UNAVAILABLE')
        self.assertEqual(sum(self.provider.writes.values()), 0)


class SharedPublicationConformanceTest(unittest.TestCase):
    def test_shared_structure_and_application_relations(self):
        from jsonschema import Draft202012Validator
        from metriccanvas_authoring.application.lifecycle_publish import (
            validate_confirmation_relations, validate_corrections_relations, validate_result_relations)
        schema = json.loads((ROOT / 'contract-snapshot/authoring/publication.schema.json').read_text())
        vectors = json.loads((ROOT / 'contract-snapshot/authoring/publication-conformance.json').read_text())
        Draft202012Validator.check_schema(schema)
        for case in vectors['cases']:
            with self.subTest(vector=case['id']):
                validator = Draft202012Validator({**schema, '$ref': '#/$defs/' + case['definition']})
                self.assertEqual(validator.is_valid(case['input']), case['expected']['structure'])
                if 'relations' not in case['expected']:
                    continue
                value, ctx = case['input'], case.get('context', {})
                try:
                    if case['definition'] == 'Candidate':
                        validate_candidate_parameters(value, ctx.get('source'))
                    elif case['definition'] == 'Confirmation':
                        validate_confirmation_relations(value, ctx['candidate'], ctx['identity'])
                    elif case['definition'] == 'Corrections':
                        validate_corrections_relations(value, ctx['candidate'])
                    else:
                        validate_result_relations(ctx['request'], value)
                    accepted = True
                except LifecycleError:
                    accepted = False
                self.assertEqual(accepted, case['expected']['relations'])
