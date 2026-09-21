import sys
import json
import hashlib
import unittest
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'tool'), str(ROOT / 'test-harness')]
from test_page_editing import page
from metriccanvas_authoring.application.authoring_turns import AuthoringTurnGate, PreparedAuthoringTurn, SCOPE_KEYS, read_page_projection
from metriccanvas_authoring.application.content_ports import ContentBaseline, ContentBaselineError
from metriccanvas_authoring.pages.editing.edit_page import document_sha256


class Turns:
    def __init__(self, mode='existing', access='write'):
        document = page()
        ref = {'pageId': document['id'], 'revisionId': 'r1', 'resourceId': 'resource1'}
        self.baseline = ContentBaseline(ref, document, document_sha256(document)) if mode == 'existing' else None
        self.binding = {'version': '1.0', 'contextRef': 'current-context', 'actorId': 'alice', 'workspaceId': 'w',
                        'requestId': 'request1', 'runId': 'run1', 'turnId': 'turn1', 'pageId': document['id'],
                        'capabilityVersion': '1.0', 'status': 'active', 'mode': mode, 'access': access,
                        'baseRef': ref if self.baseline else None, 'documentSha256': self.baseline.document_sha256 if self.baseline else None,
                        'selectedComponentId': 'table' if self.baseline else None}
        self.document_json = json.dumps(document) if self.baseline else None
        self.binding['documentSha256'] = hashlib.sha256(self.document_json.encode()).hexdigest() if self.document_json else None
        self.scope = {k: self.binding[k] for k in SCOPE_KEYS}

    async def current_scope(self): return deepcopy(self.scope)
    async def current_turn(self): return PreparedAuthoringTurn(deepcopy(self.binding), deepcopy(self.baseline), self.document_json)


class AuthoringTurnsTest(unittest.IsolatedAsyncioTestCase):
    async def test_scope_ref_hash_version_status_and_read_only(self):
        for key in SCOPE_KEYS:
            turns = Turns()
            turns.scope[key] = 'different'
            with self.subTest(key=key), self.assertRaises(ContentBaselineError):
                await AuthoringTurnGate(turns).require('current-context')
        for key, value in [('documentSha256', 'a'*64), ('baseRef', {'pageId': 'other'}), ('version', '2.0'), ('status', 'cancelled'), ('contextRef', 'old')]:
            turns = Turns(); turns.binding[key] = value
            with self.subTest(key=key), self.assertRaises(ContentBaselineError):
                await AuthoringTurnGate(turns).require('current-context')
        with self.assertRaisesRegex(ContentBaselineError, 'READ_ONLY'):
            await AuthoringTurnGate(Turns(access='read')).require('current-context', write=True)
        with self.assertRaisesRegex(ContentBaselineError, 'UNAVAILABLE'):
            await AuthoringTurnGate(None).require('old-file-token')

    async def test_full_document_hash_verified_not_only_binding(self):
        turns = Turns(); turns.baseline.document['layout'] = 'dashboard'
        with self.assertRaisesRegex(ContentBaselineError, 'HASH_MISMATCH'):
            await AuthoringTurnGate(turns).require('current-context')

    async def test_new_baseline_and_late_response(self):
        turns = Turns(mode='new'); gate = AuthoringTurnGate(turns)
        prepared = await gate.require('current-context', write=True, mode='new')
        self.assertIsNone(prepared.baseline)
        turns.binding['status'] = 'closed'
        with self.assertRaises(ContentBaselineError): await gate.unchanged(prepared)
        turns = Turns(mode='new'); turns.baseline = Turns().baseline
        with self.assertRaises(ContentBaselineError): await AuthoringTurnGate(turns).require('current-context')

    async def test_bounded_projection_explicit_id_cursor_and_deleted(self):
        turns = Turns(); prepared = await AuthoringTurnGate(turns).require('current-context')
        first = read_page_projection(prepared, target_component_id='table', limit=1)
        self.assertEqual(len(first['entries']), 1)
        self.assertIsNotNone(first['nextCursor'])
        second = read_page_projection(prepared, target_component_id='table', limit=1, offset=1, cursor=first['nextCursor'])
        self.assertNotEqual(first['entries'], second['entries'])
        with self.assertRaises(ContentBaselineError): read_page_projection(prepared, offset=1, cursor=first['nextCursor'])
        turns.binding['selectedComponentId'] = 'deleted'
        prepared = await AuthoringTurnGate(turns).require('current-context')
        self.assertEqual(read_page_projection(prepared, target_component_id='table', use_selection=True)['targetComponentId'], 'table')
        with self.assertRaises(ContentBaselineError): read_page_projection(prepared, use_selection=True)

    async def test_common_byte_vectors_and_strict_json(self):
        vectors = json.loads((ROOT / 'contracts/authored/authoring-turn.bytes.json').read_text())['cases']
        for vector in vectors:
            self.assertEqual(hashlib.sha256(vector['documentJson'].encode('utf-8')).hexdigest(), vector['sha256'])
            self.assertEqual(json.loads(vector['documentJson']), vector['input'])
        for raw in ('{"id":"x","id":"x"}', '{"value":NaN}', '{"value":Infinity}', '{"value":1e999}'):
            turns = Turns(); turns.document_json = raw
            turns.binding['documentSha256'] = hashlib.sha256(raw.encode()).hexdigest()
            with self.subTest(raw=raw), self.assertRaises(ContentBaselineError):
                await AuthoringTurnGate(turns).require('current-context')

    async def test_unknown_extension_values_never_project_and_duplicate_ids_reject(self):
        turns = Turns()
        document = turns.baseline.document
        component = document['sections'][0]['components'][2]
        component['props']['extension'] = {'innocentName': 'secret-query-credential'}
        turns.baseline = ContentBaseline(turns.baseline.ref, document, document_sha256(document))
        turns.document_json = json.dumps(document)
        turns.binding['documentSha256'] = hashlib.sha256(turns.document_json.encode()).hexdigest()
        prepared = await AuthoringTurnGate(turns).require('current-context')
        self.assertNotIn('secret-query-credential', json.dumps(read_page_projection(prepared, target_component_id='table')))
        document['sections'][0]['components'].append(deepcopy(component))
        prepared = PreparedAuthoringTurn(turns.binding, ContentBaseline(turns.baseline.ref, document, document_sha256(document)))
        with self.assertRaisesRegex(ContentBaselineError, 'AMBIGUOUS'):
            read_page_projection(prepared, target_component_id='table')

    async def test_existing_missing_baseline_and_oversized_bytes_are_stable_rejections(self):
        turns = Turns(); turns.baseline = None
        with self.assertRaisesRegex(ContentBaselineError, 'BASELINE_REQUIRED'):
            await AuthoringTurnGate(turns).require('current-context')
        turns = Turns(); turns.document_json = ' ' * (20 * 1024 * 1024 + 1)
        with self.assertRaisesRegex(ContentBaselineError, 'SIZE_LIMIT'):
            await AuthoringTurnGate(turns).require('current-context')

    async def test_malformed_page_projection_is_stably_rejected(self):
        prepared = await AuthoringTurnGate(Turns()).require('current-context')
        prepared.baseline.document['sections'] = [{'id': 'main', 'components': [None]}]
        with self.assertRaisesRegex(ContentBaselineError, 'PAGE_CONTEXT_INVALID'):
            read_page_projection(prepared)
