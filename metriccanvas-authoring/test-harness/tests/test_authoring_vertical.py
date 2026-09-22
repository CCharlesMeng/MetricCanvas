"""S3 public content → final selection → Lifecycle exact read, with explicit provider fakes."""
import sys
import json
import hashlib
import unittest
from copy import deepcopy
from pathlib import Path
from fastmcp import Client

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'tool'), str(ROOT / 'test-harness')]
from test_authoring_turns import Turns
from test_authoring_candidates import MemoryCandidates
from test_unified_content_mcp import dependencies
from test_page_editing import title
from lifecycle_stdio_server import ProposedService, Identities, digest
from metriccanvas_authoring.work.authoring_turns import AuthoringTurnGate
from metriccanvas_authoring.work.authoring_candidates import AuthoringCandidates
from metriccanvas_authoring.work.authoring_submission import AuthoringSubmissionCoordinator
from metriccanvas_authoring.work.content_ports import ContentBaseline
from metriccanvas_authoring.assets.lifecycle import Lifecycle
from metriccanvas_authoring.entrypoints.compat.unified_content_mcp import create_unified_content_mcp_server


class RoundtripPrograms:
    def __init__(self): self.values = {}
    async def store(self, value, identity):
        token = 'program-' + str(len(self.values))
        self.values[token] = (identity, deepcopy(value))
        return token
    async def load(self, token, identity):
        owner, value = self.values[token]
        assert owner == identity
        return deepcopy(value)


class AtomicRecords:
    def __init__(self): self.values = {}
    async def claim(self, key, value):
        if key in self.values: return deepcopy(self.values[key]), False
        self.values[key] = deepcopy(value)
        return deepcopy(value), True
    async def update(self, key, value):
        before = self.values[key]
        assert {k:v for k,v in before.items() if k not in {'status','result','programToken'}} == {k:v for k,v in value.items() if k not in {'status','result','programToken'}}
        self.values[key] = deepcopy(value)


class AuthoringVerticalTest(unittest.IsolatedAsyncioTestCase):
    async def setup_run(self):
        turns, service = Turns(), ProposedService()
        turns.binding.update(actorId='actor-a', workspaceId='workspace-a')
        turns.scope.update(actorId='actor-a', workspaceId='workspace-a')
        turns.baseline.ref['resourceId'] = 'resource-opaque'
        turns.binding['baseRef']['resourceId'] = 'resource-opaque'
        doc = deepcopy(turns.baseline.document)
        # Simulates a manual width already persisted before latest preparation.
        table = next(c for s in doc['sections'] for c in s['components'] if c['id'] == 'table')
        table['props']['columns'][0]['width'] = 237
        turns.baseline = ContentBaseline(turns.baseline.ref, doc, digest(doc))
        turns.document_json = json.dumps(doc)
        turns.binding['documentSha256'] = hashlib.sha256(turns.document_json.encode()).hexdigest()
        service.head = deepcopy(turns.baseline.ref)
        service.revisions['r1'] = {'ref':service.head,'document':deepcopy(doc),'contentHash':digest(doc),'canonicalization':'test-python-sorted-json/1'}
        store, records = MemoryCandidates(), AtomicRecords()
        coordinator = AuthoringSubmissionCoordinator(AuthoringCandidates(store), records, AuthoringTurnGate(turns), Lifecycle(service, RoundtripPrograms(), Identities()))
        return turns, service, store, records, coordinator

    async def test_two_public_edits_only_final_saved_preserves_manual_width(self):
        turns, service, store, records, coordinator = await self.setup_run()
        async with Client(create_unified_content_mcp_server(dependencies(), turns, candidate_store=store)) as client:
            first = (await client.call_tool('edit_page', {'context_ref':'current-context','request':{'operations':[title()]}})).structured_content
            first_ref = first['modelSummary']['candidateRef']
            op = title(); op['title'] = 'Final wording'
            second = (await client.call_tool('edit_page', {'context_ref':'current-context','candidate_ref':first_ref,'request':{'operations':[op]}})).structured_content
            final_ref = second['modelSummary']['candidateRef']
            self.assertEqual(service.save_calls, 0)
            self.assertEqual(second['modelSummary']['candidateVersion'], 2)
            self.assertNotIn('dataSources', json.dumps(second['modelSummary']))
        result = await coordinator.finalize('current-context', final_ref, description='Final wording', retain_dimension_values=False)
        self.assertEqual(result['status'], 'saved', result)
        replay = await coordinator.finalize('current-context', first_ref, description='Different choice', retain_dimension_values=True)
        self.assertEqual(replay['status'], 'saved', replay)
        self.assertEqual(service.save_calls, 1)
        self.assertEqual(len(service.revisions), 2)
        saved = service.revisions[service.head['revisionId']]['document']
        self.assertEqual(saved, second['artifactEnvelope']['artifact']['document'])
        expected = deepcopy(turns.baseline.document)
        expected['sections'][0]['components'][0]['props']['title'] = 'Final wording'
        self.assertEqual(saved, expected)

    async def test_public_candidate_lost_receipt_retains_original_operation(self):
        turns, service, store, records, coordinator = await self.setup_run()
        async with Client(create_unified_content_mcp_server(dependencies(), turns, candidate_store=store)) as client:
            payload = (await client.call_tool('edit_page', {'context_ref':'current-context','request':{'operations':[title()]}})).structured_content
        ref = payload['modelSummary']['candidateRef']
        service.lose_ack = True
        unknown = await coordinator.finalize('current-context', ref, description='First', retain_dimension_values=False)
        self.assertEqual(unknown['status'], 'unknown')
        self.assertEqual(service.save_calls, 1)
        recovered = await coordinator.finalize('current-context', ref, description='Must not replace command', retain_dimension_values=True)
        self.assertEqual(recovered['status'], 'saved', recovered)
        self.assertEqual(unknown['operationId'], recovered['operationId'])
        self.assertEqual(service.save_calls, 1)
        record = next(iter(records.values.values()))
        self.assertEqual(record['command']['description'], 'First')
        self.assertFalse(record['command']['retainDimensionValues'])

    async def test_public_candidate_cannot_overwrite_other_window_head(self):
        turns, service, store, records, coordinator = await self.setup_run()
        async with Client(create_unified_content_mcp_server(dependencies(), turns, candidate_store=store)) as client:
            payload = (await client.call_tool('edit_page', {'context_ref':'current-context','request':{'operations':[title()]}})).structured_content
        service.head = {**service.head, 'revisionId':'other-window-r2'}
        result = await coordinator.finalize('current-context', payload['modelSummary']['candidateRef'], description='Stale', retain_dimension_values=False)
        self.assertEqual(result['status'], 'rejected', result)
        self.assertEqual(result['code'], 'REVISION_CONFLICT')
        self.assertEqual(service.head['revisionId'], 'other-window-r2')
        self.assertEqual(len(service.revisions), 1)
