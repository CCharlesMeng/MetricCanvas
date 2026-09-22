import sys
import unittest
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'tool'), str(ROOT / 'test-harness')]
from test_authoring_turns import Turns
from metriccanvas_authoring.work.authoring_turns import AuthoringTurnGate
from metriccanvas_authoring.work.authoring_candidates import AuthoringCandidates
from metriccanvas_authoring.work.content_ports import ContentBaselineError


class MemoryCandidates:
    """Test-only immutable adapter. Does not claim persistence across restarts."""
    def __init__(self): self.records = {}
    async def put(self, record):
        ref = record['candidateRef']
        if ref in self.records and self.records[ref] != record:
            raise ContentBaselineError('CANDIDATE_IMMUTABLE')
        self.records[ref] = deepcopy(record)
    async def get(self, ref):
        if ref not in self.records: raise ContentBaselineError('CANDIDATE_NOT_FOUND')
        return deepcopy(self.records[ref])


class AuthoringCandidatesTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.prepared = await AuthoringTurnGate(Turns()).require('current-context')
        self.store = MemoryCandidates()
        self.candidates = AuthoringCandidates(self.store)

    async def test_immutable_chain_and_isolated_reads(self):
        first = await self.candidates.put(self.prepared, self.prepared.baseline.document, [])
        document = deepcopy(first['document']); document['meta']['description'] = 'next'
        second = await self.candidates.put(self.prepared, document, [], first['candidateRef'])
        self.assertEqual(second['candidateVersion'], 2)
        self.assertEqual(second['rootBinding'], first['rootBinding'])
        self.assertEqual(second['parentRef'], first['candidateRef'])
        document['meta']['description'] = 'mutation'
        self.assertEqual((await self.candidates.require(second['candidateRef'], self.prepared))['document']['meta']['description'], 'next')
        corrupted = deepcopy(first); corrupted['operations'] = [{}]
        with self.assertRaisesRegex(ContentBaselineError, 'IMMUTABLE'): await self.store.put(corrupted)

    async def test_missing_provider_invalid_hash_page_schema_root_and_version(self):
        with self.assertRaisesRegex(ContentBaselineError, 'UNAVAILABLE'):
            await AuthoringCandidates(None).put(self.prepared, self.prepared.baseline.document, [])
        original = await self.candidates.put(self.prepared, self.prepared.baseline.document, [])
        for field, value in [('documentSha256', 'a'*64), ('candidateVersion', 2), ('rootBinding', {**original['rootBinding'], 'actorId': 'other'}), ('document', {'id': original['document']['id']})]:
            corrupted = deepcopy(original); corrupted[field] = value
            self.store.records[original['candidateRef']] = corrupted
            with self.subTest(field=field), self.assertRaises(ContentBaselineError):
                await self.candidates.require(original['candidateRef'], self.prepared)
        other = deepcopy(original['document']); other['id'] = 'other-page'
        with self.assertRaisesRegex(ContentBaselineError, 'PAGE_MISMATCH'):
            await self.candidates.put(self.prepared, other, [])

    async def test_store_cannot_acknowledge_changed_payload(self):
        class BrokenStore(MemoryCandidates):
            async def put(self, record):
                record['operations'] = [{'changed': True}]
                await super().put(record)
        with self.assertRaisesRegex(ContentBaselineError, 'STORE_MISMATCH'):
            await AuthoringCandidates(BrokenStore()).put(self.prepared, self.prepared.baseline.document, [])

    async def test_invalid_documents_and_operations_never_reach_store(self):
        for document, operations in [({'id': self.prepared.binding['pageId']}, []),
                                     (self.prepared.baseline.document, ['invalid-operation']),
                                     ({'id': self.prepared.binding['pageId'], 'bad': object()}, [])]:
            with self.assertRaises(ContentBaselineError):
                await self.candidates.put(self.prepared, document, operations)
            self.assertEqual(self.store.records, {})
