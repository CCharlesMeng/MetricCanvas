"""Local SQLite durability tests, not evidence for Relay/page-service guarantees."""
import asyncio
from copy import deepcopy
from dataclasses import replace
import multiprocessing
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'tool'), str(ROOT / 'test-harness')]
from test_authoring_turns import Turns
from metriccanvas_authoring.work.authoring_turns import AuthoringTurnGate
from metriccanvas_authoring.work.authoring_candidates import AuthoringCandidates
from metriccanvas_authoring.assets.lifecycle_ports import LifecycleIdentity, LifecycleError
from metriccanvas_authoring.work.content_ports import ContentBaselineError
from metriccanvas_authoring.adapters.storage.sqlite_authoring_state import SqliteCandidateStore, SqliteExecutionRecords, SqliteLifecyclePrograms


def process_mutation(path, key, record, snapshot, barrier, queue):
    async def run():
        records = SqliteExecutionRecords(path)
        barrier.wait(timeout=10)
        try:
            if snapshot is None:
                import os
                record['operationId'] = 'operation-' + str(os.getpid())
                record['command']['context']['operationId'] = record['operationId']
                value, created = await records.claim(key, record)
                queue.put(('claim', created, value['operationId']))
            else:
                result = await records.compare_and_swap(key, snapshot['recordVersion'], snapshot)
                queue.put(('cas', result['recordVersion']))
        except LifecycleError as error:
            queue.put(('error', error.code))
    asyncio.run(run())


def process_program_load(path, token, identity, queue):
    queue.put(asyncio.run(SqliteLifecyclePrograms(path).load(token, identity)))


class SqliteAuthoringStateTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = str(Path(self.directory.name) / 'state.sqlite')
        self.prepared = await AuthoringTurnGate(Turns()).require('current-context')
        b = self.prepared.binding
        self.key = tuple(b[k] for k in ('actorId', 'workspaceId', 'runId', 'turnId', 'pageId'))
        self.record = {'candidateRef': 'candidate-one', 'rootBinding': deepcopy(dict(b)), 'operationId': 'operation-one',
            'command': {'kind': 'save', 'context': {'operationId': 'operation-one', 'actorId': b['actorId'],
                'workspaceId': b['workspaceId'], 'origin': {'kind': 'relay', 'skillVersion': '1.0', 'runId': b['runId']}},
                'pageId': b['pageId'], 'base': deepcopy(b['baseRef']), 'document': deepcopy(self.prepared.baseline.document),
                'description': 'test', 'retainDimensionValues': False}, 'programToken': None, 'status': 'selected', 'result': None}

    async def test_restart_candidates_and_programs_immutable_identity_isolation(self):
        candidates = AuthoringCandidates(SqliteCandidateStore(self.path))
        candidate = await candidates.put(self.prepared, self.prepared.baseline.document, [])
        restored = await AuthoringCandidates(SqliteCandidateStore(self.path)).require(candidate['candidateRef'], self.prepared)
        self.assertEqual(candidate, restored)
        changed = deepcopy(candidate); changed['operations'] = [{}]
        with self.assertRaisesRegex(ContentBaselineError, 'IMMUTABLE'):
            await SqliteCandidateStore(self.path).put(changed)
        identity = LifecycleIdentity('actor', 'workspace', 'NEVER-PERSIST-CREDENTIAL')
        token = await SqliteLifecyclePrograms(self.path).store(self.record['command'], identity)
        reloaded = await SqliteLifecyclePrograms(self.path).load(token, replace(identity, auth_token='rotated'))
        self.assertEqual(reloaded, self.record['command'])
        context = multiprocessing.get_context('spawn')
        queue = context.Queue()
        worker = context.Process(target=process_program_load, args=(self.path, token, identity, queue))
        worker.start()
        self.assertEqual(queue.get(timeout=20), self.record['command'])
        worker.join(timeout=10)
        if worker.is_alive(): worker.terminate(); worker.join(); self.fail('restart worker timed out')
        self.assertEqual(worker.exitcode, 0)
        queue.close()
        reloaded['pageId'] = 'mutated'
        self.assertEqual((await SqliteLifecyclePrograms(self.path).load(token, identity))['pageId'], self.record['command']['pageId'])
        for stranger in (replace(identity, actor_id='other'), replace(identity, workspace_id='other')):
            with self.assertRaisesRegex(LifecycleError, 'FORBIDDEN'):
                await SqliteLifecyclePrograms(self.path).load(token, stranger)
        self.assertNotIn(b'NEVER-PERSIST-CREDENTIAL', Path(self.path).read_bytes())

    async def test_claim_cas_budget_cancel_monotonic_and_duplicate_defaults(self):
        records = SqliteExecutionRecords(self.path, max_attempts=2, deadline_epoch_ms=12345)
        original, created = await records.claim(self.key, self.record)
        self.assertTrue(created)
        original['operationId'] = 'mutated'
        other = deepcopy(self.record); other['candidateRef'] = 'other-candidate'
        restored, created = await SqliteExecutionRecords(self.path, max_attempts=99).claim(self.key, other)
        self.assertFalse(created); self.assertEqual(restored, self.record)
        snapshot = await records.get(self.key)
        self.assertEqual(snapshot['control']['maxAttempts'], 2)
        self.assertEqual(snapshot['control']['deadlineEpochMs'], 12345)
        snapshot['control']['attemptIds'].append('attempt-one')
        snapshot['control']['cancelRequested'] = True
        saved = await records.compare_and_swap(self.key, 1, snapshot)
        self.assertEqual(saved['recordVersion'], 2)
        with self.assertRaisesRegex(LifecycleError, 'VERSION_CONFLICT'):
            await records.compare_and_swap(self.key, 1, snapshot)
        for change in ({'cancelRequested': False}, {'attemptIds': []}, {'maxAttempts': 3}, {'deadlineEpochMs': None}, {'attemptIds': ['attempt-one','two','three']}):
            invalid = deepcopy(saved); invalid['control'].update(change)
            with self.assertRaises(LifecycleError): await records.compare_and_swap(self.key, 2, invalid)
        self.assertEqual(await SqliteExecutionRecords(self.path).get(self.key), saved)

    async def test_immutable_command_token_terminal_receipt_and_verification(self):
        records = SqliteExecutionRecords(self.path); await records.claim(self.key, self.record)
        first = await records.get(self.key)
        first['record']['programToken'] = 'frozen-token'
        first = await records.compare_and_swap(self.key, 1, first)
        for mutation in ('operationId', 'candidateRef', 'programToken'):
            bad = deepcopy(first); bad['record'][mutation] = 'replacement'
            with self.assertRaises(LifecycleError): await records.compare_and_swap(self.key, 2, bad)
        receipt = {'status': 'saved', 'operationId': 'operation-one', 'ref': {'pageId': self.key[-1], 'revisionId': 'r2', 'resourceId': 'resource1'}, 'base': self.record['command']['base'], 'contentHash': 'a'*64, 'canonicalization': 'test/1', 'revisionNumber': 2}
        first['saveReceipt'] = receipt; first['record']['status'] = 'unknown'
        first = await records.compare_and_swap(self.key, 2, first)
        bad = deepcopy(first); bad['saveReceipt']['ref']['revisionId'] = 'other'
        with self.assertRaisesRegex(LifecycleError, 'RECEIPT_IMMUTABLE'):
            await records.compare_and_swap(self.key, 3, bad)
        first['verificationState'] = 'verified'; first['record']['status'] = 'saved'
        first['record']['result'] = {'status': 'saved'}
        first = await records.compare_and_swap(self.key, 3, first)
        stale = deepcopy(first['record']); stale['status'] = 'unknown'; stale['result'] = None
        with self.assertRaisesRegex(LifecycleError, 'TERMINAL'): await records.update(self.key, stale)
        downgrade = deepcopy(first); downgrade['verificationState'] = 'pending'
        with self.assertRaisesRegex(LifecycleError, 'VERIFICATION_REGRESSION'):
            await records.compare_and_swap(self.key, 4, downgrade)

    async def test_unknown_database_and_snapshot_versions_rejected(self):
        records = SqliteExecutionRecords(self.path); await records.claim(self.key, self.record)
        value = await records.get(self.key); value['formatVersion'] = '2.0'
        with self.assertRaisesRegex(LifecycleError, 'FORMAT_UNSUPPORTED'):
            await records.compare_and_swap(self.key, 1, value)
        with sqlite3.connect(self.path) as db: db.execute('PRAGMA user_version=2')
        with self.assertRaisesRegex(LifecycleError, 'VERSION_UNSUPPORTED'): SqliteLifecyclePrograms(self.path)
        with self.assertRaisesRegex(LifecycleError, 'VERSION_UNSUPPORTED'): await records.get(self.key)

    async def test_two_processes_claim_and_cas_have_one_winner(self):
        records = SqliteExecutionRecords(self.path)
        context = multiprocessing.get_context('spawn')
        def race(snapshot):
            barrier, queue = context.Barrier(2), context.Queue()
            workers = [context.Process(target=process_mutation, args=(self.path, self.key, self.record, snapshot, barrier, queue)) for _ in range(2)]
            for worker in workers: worker.start()
            results = [queue.get(timeout=20) for _ in workers]
            for worker in workers:
                worker.join(timeout=10)
                if worker.is_alive(): worker.terminate(); worker.join(); self.fail('worker timed out')
                self.assertEqual(worker.exitcode, 0)
            queue.close()
            return results
        claims = race(None)
        self.assertEqual(sum(result[1] is True for result in claims), 1)
        self.assertEqual(claims[0][2], claims[1][2])
        snapshot = await records.get(self.key); snapshot['control']['attemptIds'] = ['concurrent-attempt']
        results = race(snapshot)
        self.assertEqual(sorted(result[0] for result in results), ['cas', 'error'])
        self.assertIn(('error', 'EXECUTION_VERSION_CONFLICT'), results)
        self.assertEqual((await SqliteExecutionRecords(self.path).get(self.key))['recordVersion'], 2)

    async def test_unsafe_database_paths_rejected(self):
        import os
        from unittest.mock import patch
        records = SqliteExecutionRecords(self.path)
        link = str(Path(self.directory.name) / 'link.sqlite')
        os.symlink(self.path, link)
        with self.assertRaisesRegex(LifecycleError, 'FILE_UNSAFE'): SqliteLifecyclePrograms(link)
        with self.assertRaisesRegex(LifecycleError, 'FILE_UNSAFE'): SqliteLifecyclePrograms(self.directory.name)
        os.chmod(self.path, 0o644)
        with self.assertRaisesRegex(LifecycleError, 'FILE_UNSAFE'): SqliteLifecyclePrograms(self.path)
        with self.assertRaisesRegex(LifecycleError, 'FILE_UNSAFE'): await records.get(self.key)
        os.chmod(self.path, 0o600)
        with patch('metriccanvas_authoring.adapters.storage.sqlite_authoring_state.os.getuid', return_value=os.getuid() + 1):
            with self.assertRaisesRegex(LifecycleError, 'FILE_UNSAFE'): SqliteLifecyclePrograms(self.path)

    async def test_not_applied_cas_evidence_and_guarded_retry(self):
        records = SqliteExecutionRecords(self.path)
        record = deepcopy(self.record); record['status'] = 'not-applied'; record['result'] = {'status': 'not-applied', 'retrySafe': False}
        await records.claim(self.key, record)
        value = await records.get(self.key)
        unsafe = deepcopy(value); unsafe['record']['status'] = 'sending'
        with self.assertRaisesRegex(LifecycleError, 'TERMINAL'): await records.compare_and_swap(self.key, 1, unsafe)
        value['record']['result']['retrySafe'] = True
        value = await records.compare_and_swap(self.key, 1, value)
        unsafe = deepcopy(value); unsafe['record']['status'] = 'sending'; unsafe['control']['cancelRequested'] = True
        with self.assertRaisesRegex(LifecycleError, 'TERMINAL'): await records.compare_and_swap(self.key, 2, unsafe)
        latest = deepcopy(value); latest['record']['status'] = 'unknown'; latest['record']['result'] = {'status': 'unknown'}
        await records.compare_and_swap(self.key, 2, latest)
        self.assertEqual((await records.get(self.key))['record']['status'], 'unknown')
