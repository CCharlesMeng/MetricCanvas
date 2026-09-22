"""S3 port-consumer tests; memory substitutes do not establish persistence."""
import asyncio
from copy import deepcopy
from dataclasses import replace
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'tool'), str(ROOT / 'test-harness')]
from test_authoring_turns import Turns
from test_authoring_candidates import MemoryCandidates
from lifecycle_stdio_server import ProposedService, Identities, digest
from metriccanvas_authoring.work.authoring_candidates import AuthoringCandidates
from metriccanvas_authoring.work.authoring_turns import AuthoringTurnGate, SCOPE_KEYS
from metriccanvas_authoring.work.authoring_submission import AuthoringSubmissionCoordinator, semantic_equal
from metriccanvas_authoring.assets.lifecycle import Lifecycle
from metriccanvas_authoring.assets.lifecycle_ports import LifecycleError
from metriccanvas_authoring.work.content_ports import ContentBaseline, ContentBaselineError


class MemoryExecutions:
    def __init__(self):
        self.records, self.events = {}, []
        self.fail_status = None

    async def claim(self, key, record):
        self.events.append(('claim', record['operationId']))
        if key in self.records: return deepcopy(self.records[key]), False
        self.records[key] = deepcopy(record)
        return deepcopy(record), True

    async def update(self, key, record):
        self.events.append(('update', record['status']))
        if record['status'] == self.fail_status: raise OSError('private storage failure')
        for field in ('candidateRef', 'rootBinding', 'operationId', 'command'):
            if self.records[key][field] != record[field]: raise ValueError('immutable selection')
        self.records[key] = deepcopy(record)


class RoundTripPrograms:
    def __init__(self):
        self.values, self.events = {}, []
        self.fail_store = False

    async def store(self, value, identity):
        if self.fail_store: raise OSError('private program failure')
        token = f'token-{len(self.values)}'
        self.values[token] = deepcopy(value)
        self.events.append(('store', value.get('kind')))
        return token

    async def load(self, token, identity):
        return deepcopy(self.values[token])


class SubmissionFixture:
    @classmethod
    async def create(cls, mode='existing'):
        self = cls()
        self.turns, self.service, self.identities = Turns(mode), ProposedService(), Identities()
        self.turns.binding.update(actorId='actor-a', workspaceId='workspace-a')
        if self.turns.baseline:
            ref = {**self.turns.baseline.ref, 'resourceId': 'resource-opaque'}
            self.turns.baseline = ContentBaseline(ref, self.turns.baseline.document, self.turns.baseline.document_sha256)
            self.turns.binding['baseRef'] = ref
            self.service.head = deepcopy(ref)
            self.service.revisions[ref['revisionId']] = {'ref': ref, 'document': deepcopy(self.turns.baseline.document),
                'base': None, 'contentHash': digest(self.turns.baseline.document), 'canonicalization': 'test-python-sorted-json/1'}
        self.turns.scope = {key: self.turns.binding[key] for key in SCOPE_KEYS}
        self.gate = AuthoringTurnGate(self.turns)
        self.prepared = await self.gate.require('current-context', write=True)
        self.store, self.records, self.programs = MemoryCandidates(), MemoryExecutions(), RoundTripPrograms()
        self.candidates = AuthoringCandidates(self.store)
        self.lifecycle = Lifecycle(self.service, self.programs, self.identities)
        self.serial = 0
        def operation_id():
            self.serial += 1
            return f'program-operation-{self.serial}'
        self.coordinator = AuthoringSubmissionCoordinator(self.candidates, self.records, self.gate, self.lifecycle, operation_id=operation_id)
        return self

    async def candidate(self, title='changed', parent=None, unchanged=False):
        document = deepcopy(self.prepared.baseline.document if self.prepared.baseline else Turns().baseline.document)
        if not unchanged: document['sections'][0]['components'][0]['props']['title'] = title
        return await self.candidates.put(self.prepared, document, [{'id': 'title', 'status': 'applied'}], parent)

    async def finalize(self, candidate):
        return await self.coordinator.finalize('current-context', candidate['candidateRef'], description='program description', retain_dimension_values=False)


class AuthoringSubmissionTest(unittest.IsolatedAsyncioTestCase):
    async def test_parameter_templates_and_descendants_cannot_auto_save(self):
        f = await SubmissionFixture.create()
        template = await f.candidates.put(f.prepared, f.prepared.baseline.document,
            [{'type': 'parameter_selection', 'requiresHumanConfirmation': True}])
        child = await f.candidate('edited template', parent=template['candidateRef'])
        for candidate in (template, child):
            with self.assertRaisesRegex(LifecycleError, 'TEMPLATE_REQUIRES_HUMAN_PUBLICATION'):
                await f.finalize(candidate)
        self.assertEqual(f.service.save_calls, 0)
        self.assertEqual(f.records.records, {})

    async def test_saved_requires_atomic_selection_frozen_payload_and_exact_read(self):
        f = await SubmissionFixture.create()
        candidate = await f.candidate()
        original_save = f.service.save
        async def save(identity, command):
            frozen = next(iter(f.records.records.values()))
            self.assertEqual(frozen['status'], 'sending')
            self.assertEqual(frozen['command'], command)
            self.assertEqual(await f.programs.load(frozen['programToken'], identity), command)
            return await original_save(identity, command)
        f.service.save = save
        result = await f.finalize(candidate)
        self.assertEqual(result['status'], 'saved')
        self.assertEqual(f.service.save_calls, 1)
        self.assertIn(('store', 'read'), f.programs.events)
        record = next(iter(f.records.records.values()))
        self.assertEqual(record['command']['base'], f.prepared.binding['baseRef'])
        self.assertEqual(record['rootBinding'], f.prepared.binding)
        self.assertNotIn('document', result)
        self.assertNotIn('programToken', result)

    async def test_new_candidate_uses_allocated_identity_and_empty_base(self):
        f = await SubmissionFixture.create('new')
        result = await f.finalize(await f.candidate())
        self.assertEqual(result['status'], 'saved')
        self.assertEqual(result['ref']['pageId'], f.prepared.binding['pageId'])
        self.assertIsNone(next(iter(f.records.records.values()))['command']['base'])

    async def test_duplicate_final_selection_cannot_replace_original_or_send_again(self):
        f = await SubmissionFixture.create()
        first, alternate = await f.candidate('first'), await f.candidate('alternate')
        result = await f.finalize(first)
        repeated = await f.finalize(alternate)
        self.assertEqual(repeated, result)
        self.assertEqual(f.service.save_calls, 1)
        self.assertEqual(next(iter(f.records.records.values()))['candidateRef'], first['candidateRef'])

    async def test_semantic_root_no_change_freezes_selection_without_network(self):
        f = await SubmissionFixture.create()
        result = await f.finalize(await f.candidate(unchanged=True))
        self.assertEqual(result['status'], 'unchanged')
        self.assertEqual(await f.finalize(await f.candidate('late alternate')), result)
        self.assertEqual(f.service.save_calls, 0)
        self.assertEqual(f.programs.events, [])
        self.assertTrue(semantic_equal({'x': 1.0, 'y': 'z'}, {'y': 'z', 'x': 1}))
        self.assertFalse(semantic_equal({'x': True}, {'x': 1}))

    async def test_lost_ack_queries_only_original_operation_and_verifies_saved(self):
        f = await SubmissionFixture.create(); f.service.lose_ack = True
        candidate = await f.candidate()
        unknown = await f.finalize(candidate)
        self.assertEqual(unknown['status'], 'unknown')
        recovered = await f.finalize(await f.candidate('different'))
        self.assertEqual(recovered['status'], 'saved')
        self.assertEqual(recovered['operationId'], unknown['operationId'])
        self.assertEqual(recovered['candidateRef'], candidate['candidateRef'])
        self.assertEqual(f.service.save_calls, 1)

    async def test_unknown_lookup_never_sends_even_when_later_not_applied(self):
        f = await SubmissionFixture.create(); candidate = await f.candidate()
        f.service.lookup_status = {'status': 'unknown'}
        first = await f.finalize(candidate)
        f.service.lookup_status = None
        second = await f.finalize(candidate)
        self.assertEqual(first['status'], 'unknown')
        self.assertEqual(second['status'], 'not-applied')
        self.assertEqual(first['operationId'], second['operationId'])
        self.assertEqual(f.service.save_calls, 0)

    async def test_exact_read_mismatch_does_not_report_saved(self):
        f = await SubmissionFixture.create(); candidate = await f.candidate()
        original_read = f.service.read
        async def wrong(identity, ref):
            raw = await original_read(identity, ref)
            raw['document']['sections'][0]['components'][0]['props']['title'] = 'other valid content'
            raw['contentHash'] = digest(raw['document'])
            return raw
        f.service.read = wrong
        result = await f.finalize(candidate)
        self.assertEqual(result['status'], 'unknown')
        self.assertNotIn('ref', result)
        self.assertEqual(f.service.save_calls, 1)

    async def test_missing_capabilities_or_ports_fail_before_claim(self):
        for capability in ('stable_save', 'operation_lookup', 'exact_read'):
            f = await SubmissionFixture.create(); candidate = await f.candidate()
            f.service.capabilities = replace(f.service.capabilities, **{capability: False})
            with self.subTest(capability=capability), self.assertRaisesRegex(LifecycleError, 'CAPABILITY_UNAVAILABLE'):
                await f.finalize(candidate)
            self.assertEqual(f.records.events, [])
        f = await SubmissionFixture.create(); candidate = await f.candidate(); f.coordinator.records = None
        with self.assertRaisesRegex(LifecycleError, 'CAPABILITY_UNAVAILABLE'): await f.finalize(candidate)

    async def test_root_scope_and_read_only_are_checked_before_claim(self):
        for key, value in [('status', 'cancelled'), ('access', 'read'), ('runId', 'old-run')]:
            f = await SubmissionFixture.create(); candidate = await f.candidate()
            f.turns.binding[key] = value
            with self.subTest(key=key), self.assertRaises(ContentBaselineError): await f.finalize(candidate)
            self.assertEqual(f.records.events, [])

    async def test_cancelled_turn_during_lifecycle_lookup_cannot_reach_save(self):
        f = await SubmissionFixture.create(); candidate = await f.candidate()
        original_lookup = f.service.lookup
        async def lookup(identity, command):
            result = await original_lookup(identity, command)
            f.turns.binding['status'] = 'cancelled'
            return result
        f.service.lookup = lookup
        result = await f.finalize(candidate)
        self.assertEqual(result['status'], 'unknown')
        self.assertEqual(f.service.save_calls, 0)
        self.assertEqual(next(iter(f.records.records.values()))['status'], 'unknown')

    async def test_task_cancellation_after_send_retains_original_operation(self):
        f = await SubmissionFixture.create(); candidate = await f.candidate()
        entered = asyncio.Event()
        async def save(identity, command):
            entered.set()
            await asyncio.Event().wait()
        f.service.save = save
        task = asyncio.create_task(f.finalize(candidate))
        await entered.wait(); task.cancel()
        with self.assertRaises(asyncio.CancelledError): await task
        record = next(iter(f.records.records.values()))
        self.assertEqual(record['status'], 'unknown')
        self.assertEqual(record['operationId'], 'program-operation-1')
        self.assertIsNotNone(record['programToken'])

    async def test_program_or_record_failure_before_send_never_saves(self):
        for failure in ('program', 'record'):
            f = await SubmissionFixture.create(); candidate = await f.candidate()
            if failure == 'program': f.programs.fail_store = True
            else: f.records.fail_status = 'sending'
            result = await f.finalize(candidate)
            self.assertEqual(result['status'], 'unknown')
            self.assertEqual(f.service.save_calls, 0)
            repeated = await f.finalize(candidate)
            self.assertIn(repeated['status'], ('unknown', 'not-applied'))
            self.assertEqual(f.service.save_calls, 0)

    async def test_program_store_token_must_load_exact_original_payload(self):
        f = await SubmissionFixture.create(); candidate = await f.candidate()
        original_store = f.programs.store
        async def tampered(value, identity):
            if value.get('kind') == 'save': value['description'] = 'changed program payload'
            return await original_store(value, identity)
        f.programs.store = tampered
        self.assertEqual((await f.finalize(candidate))['status'], 'unknown')
        self.assertEqual(f.service.save_calls, 0)


    async def test_duplicate_while_sending_returns_pending_without_second_save(self):
        f = await SubmissionFixture.create(); first = await f.candidate(); alternate = await f.candidate('alternate')
        entered, release = asyncio.Event(), asyncio.Event()
        original_save = f.service.save
        async def save(identity, command):
            entered.set(); await release.wait(); return await original_save(identity, command)
        f.service.save = save
        original = asyncio.create_task(f.finalize(first)); await entered.wait()
        duplicate = await f.finalize(alternate)
        self.assertEqual(duplicate['status'], 'pending')
        self.assertEqual(duplicate['candidateRef'], first['candidateRef'])
        release.set(); self.assertEqual((await original)['status'], 'saved')
        self.assertEqual(f.service.save_calls, 1)

    async def test_terminal_record_result_cannot_change_operation_candidate_or_scope(self):
        for field in ('operationId', 'candidateRef', 'pageId', 'resourceId'):
            f = await SubmissionFixture.create(); candidate = await f.candidate()
            await f.finalize(candidate)
            stored = next(iter(f.records.records.values()))
            if field in ('pageId', 'resourceId'): stored['result']['ref'][field] = 'wrong'
            else: stored['result'][field] = 'wrong'
            with self.subTest(field=field), self.assertRaises(LifecycleError): await f.finalize(candidate)
            self.assertEqual(f.service.save_calls, 1)

    async def test_read_program_load_cancellation_does_not_issue_exact_read(self):
        f = await SubmissionFixture.create(); candidate = await f.candidate()
        original_load = f.programs.load; reads = []
        async def load(token, identity):
            result = await original_load(token, identity)
            if result.get('kind') == 'read': f.turns.binding['status'] = 'cancelled'
            return result
        async def read(identity, ref): reads.append(ref); raise AssertionError('must be gated')
        f.programs.load, f.service.read = load, read
        self.assertEqual((await f.finalize(candidate))['status'], 'unknown')
        self.assertEqual(reads, [])
        self.assertEqual(f.service.save_calls, 1)

    async def test_failed_unknown_record_update_never_makes_resubmission_safe(self):
        f = await SubmissionFixture.create(); candidate = await f.candidate()
        f.service.lose_ack = True; f.records.fail_status = 'unknown'
        result = await f.finalize(candidate)
        self.assertEqual(result['status'], 'unknown')
        self.assertEqual((await f.finalize(candidate))['status'], 'pending')
        self.assertEqual(f.service.save_calls, 1)


if __name__ == '__main__': unittest.main()
