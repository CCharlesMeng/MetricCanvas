"""Public candidate with durable program/record storage survives coordinator replacement."""
import sys
import tempfile
import unittest
from pathlib import Path
from fastmcp import Client

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT/'tool'), str(ROOT/'test-harness')]
from test_authoring_submission import SubmissionFixture
from test_unified_content_mcp import dependencies
from test_page_editing import title
from metriccanvas_authoring.application.authoring_candidates import AuthoringCandidates
from metriccanvas_authoring.application.authoring_submission import AuthoringSubmissionCoordinator
from metriccanvas_authoring.application.authoring_recovery import AuthoringRecoveryCoordinator
from metriccanvas_authoring.application.lifecycle import Lifecycle
from metriccanvas_authoring.application.lifecycle_ports import LifecycleError
from metriccanvas_authoring.adapters.inbound.unified_content_mcp import create_unified_content_mcp_server
from metriccanvas_authoring.adapters.outbound.sqlite_authoring_state import SqliteCandidateStore, SqliteExecutionRecords, SqliteLifecyclePrograms


class AuthoringRestartVerticalTest(unittest.IsolatedAsyncioTestCase):
    async def test_public_edit_lost_receipt_cancel_restart_and_preview_no_second_save(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'authoring.sqlite'
            fixture = await SubmissionFixture.create()
            store = SqliteCandidateStore(path)
            records = SqliteExecutionRecords(path)
            programs = SqliteLifecyclePrograms(path)
            candidates = AuthoringCandidates(store)
            lifecycle = Lifecycle(fixture.service, programs, fixture.identities)
            submission = AuthoringSubmissionCoordinator(candidates, records, fixture.gate, lifecycle)
            async with Client(create_unified_content_mcp_server(dependencies(), fixture.turns, candidate_store=store)) as client:
                output = (await client.call_tool('edit_page', {'context_ref':'current-context', 'request':{'operations':[title()]}})).structured_content
            candidate_ref = output['modelSummary']['candidateRef']
            fixture.service.lose_ack = True
            unknown = await submission.finalize('current-context', candidate_ref, description='Durable final', retain_dimension_values=False)
            self.assertEqual(unknown['status'], 'unknown', unknown)
            original = fixture.turns.binding
            key = tuple(original[k] for k in ('actorId','workspaceId','runId','turnId','pageId'))

            class Authority:
                async def authorize(self, binding, command):
                    identity = fixture.identities.current()
                    if (identity.actor_id, identity.workspace_id) != (binding['actorId'], binding['workspaceId']):
                        raise LifecycleError('FORBIDDEN')
                    if command['pageId'] != original['pageId']: raise LifecycleError('FORBIDDEN')

            def restart():
                durable_records = SqliteExecutionRecords(path)
                durable_candidates = AuthoringCandidates(SqliteCandidateStore(path))
                durable_lifecycle = Lifecycle(fixture.service, SqliteLifecyclePrograms(path), fixture.identities)
                return AuthoringRecoveryCoordinator(durable_candidates, durable_records, durable_lifecycle, Authority(), clock_ms=lambda:0)

            fixture.turns.binding['status'] = 'cancelled'
            recovery = restart()
            await recovery.cancel(key)
            recovery = restart()
            saved = await recovery.recover(key, 'after-restart')
            self.assertEqual(saved['status'], 'saved', saved)
            self.assertEqual(saved['operationId'], unknown['operationId'])
            self.assertEqual(fixture.service.save_calls, 1)
            self.assertEqual(fixture.service.revisions[saved['ref']['revisionId']]['document'], output['artifactEnvelope']['artifact']['document'])
            seen = []
            async def preview_failure(ref, document):
                seen.append(ref)
                raise RuntimeError('private preview failure')
            failed_preview = await recovery.retry_preview(key, 'preview-failure', preview_failure)
            self.assertEqual(failed_preview['status'], 'saved', failed_preview)
            self.assertEqual(failed_preview['previewState'], 'failed')
            recovery = restart()
            async def preview_success(ref, document): seen.append(ref)
            completed = await recovery.retry_preview(key, 'preview-retry', preview_success)
            self.assertEqual(completed['previewState'], 'ready', completed)
            self.assertEqual(seen, [saved['ref'], saved['ref']])
            self.assertEqual(fixture.service.save_calls, 1)
