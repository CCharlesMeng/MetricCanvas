"""Durable recovery consumer tests against the SQLite adapters, never real providers."""
import asyncio
from copy import deepcopy
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'tool'), str(ROOT / 'test-harness')]
from test_authoring_submission import SubmissionFixture
from metriccanvas_authoring.adapters.storage.sqlite_authoring_state import SqliteCandidateStore, SqliteExecutionRecords, SqliteLifecyclePrograms
from metriccanvas_authoring.work.authoring_candidates import AuthoringCandidates
from metriccanvas_authoring.work.authoring_recovery import AuthoringRecoveryCoordinator
from metriccanvas_authoring.assets.lifecycle_ports import LifecycleError, LifecycleIdentity
from metriccanvas_authoring.assets.lifecycle import Lifecycle


class RecoveryAuthority:
    def __init__(self): self.allowed = True
    async def authorize(self, binding, command):
        if not self.allowed: raise LifecycleError('FORBIDDEN')


class AuthoringRecoveryTest(unittest.IsolatedAsyncioTestCase):
    async def fixture(self, *, max_attempts=20, deadline=None):
        temporary = tempfile.TemporaryDirectory(); self.addCleanup(temporary.cleanup)
        f = await SubmissionFixture.create(); f.path = Path(temporary.name) / 'state.sqlite'
        f.records = SqliteExecutionRecords(f.path, max_attempts=max_attempts, deadline_epoch_ms=deadline)
        f.candidates = AuthoringCandidates(SqliteCandidateStore(f.path))
        f.programs = SqliteLifecyclePrograms(f.path)
        f.lifecycle = Lifecycle(f.service, f.programs, f.identities)
        f.coordinator.records, f.coordinator.candidates, f.coordinator.lifecycle = f.records, f.candidates, f.lifecycle
        f.key = tuple(f.prepared.binding[k] for k in ('actorId', 'workspaceId', 'runId', 'turnId', 'pageId'))
        f.authority = RecoveryAuthority()
        f.recovery = AuthoringRecoveryCoordinator(f.candidates, f.records, f.lifecycle, f.authority, clock_ms=lambda: 100)
        return f

    async def unknown(self, **kwargs):
        f = await self.fixture(**kwargs); f.service.lose_ack = True
        f.candidate_record = await f.candidate()
        self.assertEqual((await f.finalize(f.candidate_record))['status'], 'unknown')
        return f

    async def test_restart_reads_original_operation_and_precise_saved_revision(self):
        f = await self.unknown()
        original = await f.records.get(f.key)
        # Recreate all durable adapters and coordinator; no original in-memory execution state.
        programs = SqliteLifecyclePrograms(f.path)
        recovery = AuthoringRecoveryCoordinator(AuthoringCandidates(SqliteCandidateStore(f.path)),
            SqliteExecutionRecords(f.path), Lifecycle(f.service, programs, f.identities), f.authority, clock_ms=lambda: 100)
        result = await recovery.recover(f.key, 'restart-1')
        self.assertEqual(result['status'], 'saved')
        self.assertEqual(result['operationId'], original['record']['operationId'])
        self.assertEqual(f.service.save_calls, 1)
        current = await f.records.get(f.key)
        self.assertEqual(current['verificationState'], 'verified')
        self.assertEqual(current['saveReceipt']['ref'], result['ref'])
        self.assertEqual(current['record']['command'], original['record']['command'])

    async def test_cancelled_turn_can_query_but_cannot_retry_original(self):
        f = await self.unknown(); await f.recovery.cancel(f.key)
        f.turns.binding['status'] = 'cancelled'
        self.assertEqual((await f.recovery.recover(f.key, 'after-cancel'))['status'], 'saved')
        with self.assertRaisesRegex(LifecycleError, 'EXECUTION_CANCELLED'):
            await f.recovery.retry_original(f.key, 'forbidden-retry')
        self.assertEqual(f.service.save_calls, 1)

    async def test_s3_initial_save_observes_persisted_cancellation_after_lookup(self):
        f = await self.fixture(); candidate = await f.candidate(); lookup = f.service.lookup
        async def cancel_during_lookup(identity, command):
            response = await lookup(identity, command)
            await f.recovery.cancel(f.key)
            return response
        f.service.lookup = cancel_during_lookup
        self.assertEqual((await f.finalize(candidate))['status'], 'unknown')
        self.assertEqual(f.service.save_calls, 0)
        self.assertTrue((await f.records.get(f.key))['control']['cancelRequested'])

    async def test_retry_requires_authoritative_not_applied_and_same_command(self):
        f = await self.fixture(); candidate = await f.candidate()
        f.service.lookup_status = {'status': 'unknown'}
        await f.finalize(candidate); frozen = await f.records.get(f.key)
        f.service.lookup_status = {'status': 'not-applied', 'retrySafe': False}
        self.assertEqual((await f.recovery.retry_original(f.key, 'unsafe'))['status'], 'not-applied')
        self.assertEqual(f.service.save_calls, 0)
        f.service.lookup_status = None
        result = await f.recovery.retry_original(f.key, 'safe')
        self.assertEqual(result['status'], 'saved')
        self.assertEqual(f.service.save_calls, 1)
        self.assertEqual((await f.records.get(f.key))['record']['command'], frozen['record']['command'])

    async def test_receipt_survives_read_failure_then_preview_failure(self):
        f = await self.unknown(); read = f.service.read
        async def fail(*args): raise OSError('private transport details')
        f.service.read = fail
        partial = await f.recovery.recover(f.key, 'read-fail')
        self.assertEqual(partial['status'], 'saved-unverified')
        snapshot = await f.records.get(f.key)
        self.assertEqual(snapshot['saveReceipt']['ref'], partial['ref'])
        self.assertEqual(snapshot['verificationState'], 'pending')
        f.service.read = read
        result = await f.recovery.recover(f.key, 'read-retry')
        self.assertEqual(result['status'], 'saved')
        previewed = await f.recovery.retry_preview(f.key, 'preview-fail', fail)
        self.assertEqual(previewed['status'], 'saved')
        self.assertEqual(previewed['previewState'], 'failed')
        seen = []
        async def preview(ref, document): seen.append((ref, document))
        good = await f.recovery.retry_preview(f.key, 'preview-retry', preview)
        self.assertEqual(good['previewState'], 'ready')
        self.assertEqual(seen[0][0], partial['ref'])
        self.assertEqual(f.service.save_calls, 1)

    async def test_duplicate_attempt_has_no_network_and_budget_does_not_reset(self):
        f = await self.unknown(max_attempts=1)
        await f.recovery.recover(f.key, 'once')
        async def unexpected(*args): raise AssertionError('duplicate must not call provider')
        f.service.lookup = unexpected; f.service.read = unexpected
        self.assertEqual((await f.recovery.recover(f.key, 'once'))['status'], 'saved')
        self.assertEqual((await f.recovery.recover(f.key, 'second'))['status'], 'budget-exhausted')
        self.assertEqual((await SqliteExecutionRecords(f.path, max_attempts=100).get(f.key))['control']['maxAttempts'], 1)

    async def test_deadline_exhaustion_retains_unknown_record(self):
        f = await self.unknown(deadline=99)
        self.assertEqual((await f.recovery.recover(f.key, 'late'))['status'], 'budget-exhausted')
        self.assertEqual((await f.records.get(f.key))['record']['status'], 'unknown')

    async def test_permission_loss_during_lookup_does_not_record_rejection(self):
        f = await self.unknown()
        async def lost(identity, command):
            f.authority.allowed = False
            raise LifecycleError('FORBIDDEN')
        f.service.lookup = lost
        with self.assertRaisesRegex(LifecycleError, 'FORBIDDEN'): await f.recovery.recover(f.key, 'permission-change')
        self.assertEqual((await f.records.get(f.key))['record']['status'], 'unknown')

    async def test_missing_or_wrong_program_is_unavailable_not_new_payload(self):
        f = await self.unknown(); load = f.programs.load
        async def corrupt(token, identity):
            command = await load(token, identity)
            if command.get('kind') == 'save': command['description'] = 'corrupted'
            return command
        f.programs.load = corrupt
        result = await f.recovery.recover(f.key, 'corrupt-token')
        self.assertEqual(result['status'], 'unavailable')
        self.assertEqual(f.service.save_calls, 1)
        self.assertEqual((await f.records.get(f.key))['record']['status'], 'unknown')

    async def test_missing_authority_and_changed_identity_fail_closed(self):
        f = await self.unknown(); f.recovery.authority = None
        with self.assertRaisesRegex(LifecycleError, 'CAPABILITY_UNAVAILABLE'): await f.recovery.recover(f.key, 'no-authority')
        f.recovery.authority = f.authority
        f.identities.value = LifecycleIdentity('other', 'workspace-a', 'new-secret')
        with self.assertRaisesRegex(LifecycleError, 'FORBIDDEN'): await f.recovery.recover(f.key, 'wrong-actor')
        self.assertEqual((await f.records.get(f.key))['record']['status'], 'unknown')

    async def test_cancel_during_retry_lookup_prevents_send(self):
        f = await self.fixture(); f.service.lookup_status = {'status': 'unknown'}
        await f.finalize(await f.candidate()); f.service.lookup_status = None
        lookup = f.service.lookup; calls = 0
        async def cancel(identity, command):
            nonlocal calls
            result = await lookup(identity, command); calls += 1
            if calls == 2: await f.recovery.cancel(f.key)
            return result
        f.service.lookup = cancel
        self.assertEqual((await f.recovery.retry_original(f.key, 'cancel-race'))['status'], 'unknown')
        self.assertEqual(f.service.save_calls, 0)


    async def test_late_not_applied_cannot_overwrite_a_newer_sending_checkpoint(self):
        f = await self.fixture(); f.service.lookup_status = {'status': 'unknown'}
        await f.finalize(await f.candidate()); f.service.lookup_status = None
        entered, release = asyncio.Event(), asyncio.Event()
        async def delayed(identity, command):
            entered.set(); await release.wait()
            return {'status': 'not-applied', 'retrySafe': True, 'operationId': command['context']['operationId']}
        f.service.lookup = delayed
        task = asyncio.create_task(f.recovery.recover(f.key, 'old-query')); await entered.wait()
        current = await f.records.get(f.key); replacement = deepcopy(current)
        replacement['record']['status'] = 'sending'; replacement['record']['result'] = None
        await f.records.compare_and_swap(f.key, current['recordVersion'], replacement)
        release.set(); self.assertEqual((await task)['status'], 'unknown')
        self.assertEqual((await f.records.get(f.key))['record']['status'], 'sending')
        self.assertEqual(f.service.save_calls, 0)

    async def test_duplicate_pending_verification_attempt_preserves_saved_reference(self):
        f = await self.unknown()
        async def fail(*args): raise OSError('cannot read now')
        f.service.read = fail
        original = await f.recovery.recover(f.key, 'same-attempt')
        self.assertEqual(original['status'], 'saved-unverified')
        duplicate = await f.recovery.recover(f.key, 'same-attempt')
        self.assertEqual(duplicate, original)
        self.assertEqual(f.service.save_calls, 1)


    async def test_claim_before_program_store_crash_recovers_first_token_without_automatic_save(self):
        f = await self.fixture(); candidate = await f.candidate()
        class CrashBeforeStore(BaseException): pass
        async def crash(*args): raise CrashBeforeStore()
        f.programs.store = crash
        with self.assertRaises(CrashBeforeStore): await f.finalize(candidate)
        frozen = await f.records.get(f.key)
        self.assertEqual(frozen['record']['status'], 'selected')
        self.assertIsNone(frozen['record']['programToken'])
        programs = SqliteLifecyclePrograms(f.path)
        records = SqliteExecutionRecords(f.path)
        recovery = AuthoringRecoveryCoordinator(AuthoringCandidates(SqliteCandidateStore(f.path)), records,
            Lifecycle(f.service, programs, f.identities), f.authority, clock_ms=lambda: 100)
        result = await recovery.recover(f.key, 'claim-crash')
        self.assertEqual(result['status'], 'not-applied')
        self.assertEqual(f.service.save_calls, 0)
        installed = await records.get(f.key)
        self.assertIsNotNone(installed['record']['programToken'])
        self.assertEqual(installed['record']['operationId'], frozen['record']['operationId'])
        self.assertEqual(installed['record']['command'], frozen['record']['command'])
        saved = await recovery.retry_original(f.key, 'explicit-retry')
        self.assertEqual(saved['status'], 'saved')
        self.assertEqual(saved['operationId'], frozen['record']['operationId'])
        self.assertEqual(f.service.save_calls, 1)
        self.assertEqual((await records.get(f.key))['record']['programToken'], installed['record']['programToken'])

    async def test_concurrent_first_token_install_reuses_cas_winner(self):
        f = await self.fixture(); candidate = await f.candidate()
        class CrashBeforeStore(BaseException): pass
        async def crash(*args): raise CrashBeforeStore()
        f.programs.store = crash
        with self.assertRaises(CrashBeforeStore): await f.finalize(candidate)
        programs = SqliteLifecyclePrograms(f.path); stored = []
        original_store = programs.store
        entered, release = asyncio.Event(), asyncio.Event()
        async def overlapping(value, identity):
            token = await original_store(value, identity); stored.append(token)
            if len(stored) == 1: entered.set(); await release.wait()
            else: release.set()
            return token
        programs.store = overlapping
        recovery = AuthoringRecoveryCoordinator(f.candidates, f.records, Lifecycle(f.service, programs, f.identities), f.authority, clock_ms=lambda: 100)
        snapshot = await f.records.get(f.key)
        first = asyncio.create_task(recovery._token(f.key, snapshot)); await entered.wait()
        second = asyncio.create_task(recovery._token(f.key, snapshot))
        tokens = await asyncio.gather(first, second)
        self.assertEqual(tokens[0], tokens[1])
        self.assertEqual(tokens[0], (await f.records.get(f.key))['record']['programToken'])
        self.assertEqual(f.service.save_calls, 0)


if __name__ == '__main__': unittest.main()
