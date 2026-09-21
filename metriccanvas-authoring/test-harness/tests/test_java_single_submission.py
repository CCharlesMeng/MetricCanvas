import json
import sys
import unittest
from pathlib import Path
import httpx
ROOT=Path(__file__).resolve().parents[2]
sys.path[:0]=[str(ROOT/'tool'),str(ROOT/'test-harness')]
from test_authoring_submission import SubmissionFixture
from lifecycle_stdio_server import save_command, Identities
from metriccanvas_authoring.adapters.firstparty.lifecycle_http import KnownLifecycleHttp
from metriccanvas_authoring.application.lifecycle import Lifecycle

VECTORS=json.loads((ROOT/'test-harness/fixtures/java-page-assets.json').read_text())

class JavaSingleSubmissionTest(unittest.IsolatedAsyncioTestCase):
    async def configured(self, mode='existing', failure=False):
        f=await SubmissionFixture.create(mode)
        self.calls=[]
        def handle(request):
            self.calls.append(request)
            if failure: raise httpx.ReadTimeout('lost acknowledgement')
            body=json.loads(request.content)
            return httpx.Response(200,json={'retCode':'CBC.0000','page_id':body['page_metadata_definition']['id'],
                'page_metadata_id':'resource-opaque','revision_id':'java-next','revision_number':2,'is_draft':True,
                'page_metadata_definition':json.dumps(body['page_metadata_definition'])})
        f.lifecycle.service=KnownLifecycleHttp('https://java.test/user-page-metadata',httpx.MockTransport(handle))
        return f

    async def test_existing_candidate_single_put_program_receipt_and_no_exact_get(self):
        f=await self.configured()
        candidate=await f.candidate()
        result=await f.finalize(candidate)
        self.assertEqual(result['status'],'saved')
        self.assertEqual([r.method for r in self.calls],['PUT'])
        body=json.loads(self.calls[0].content)
        self.assertIs(body['is_draft'],True)
        self.assertEqual(body['base_revision_id'],f.prepared.binding['baseRef']['revisionId'])
        self.assertNotIn('idempotencyKey',body)
        self.assertNotIn('document',result)
        envelope=await f.programs.load(result['programToken'],f.identities.current())
        self.assertEqual(envelope['receipt']['document'],candidate['document'])
        self.assertEqual(await f.finalize(candidate),result)
        self.assertEqual(len(self.calls),1)

    async def test_new_candidate_single_post(self):
        f=await self.configured('new');candidate=await f.candidate()
        self.assertEqual((await f.finalize(candidate))['status'],'saved')
        self.assertEqual([r.method for r in self.calls],['POST'])
        self.assertNotIn('base_revision_id',json.loads(self.calls[0].content))

    async def test_unknown_duplicate_and_reconstructed_coordinator_never_resend(self):
        f=await self.configured(failure=True);candidate=await f.candidate()
        self.assertEqual((await f.finalize(candidate))['status'],'unknown')
        self.assertEqual((await f.finalize(candidate))['status'],'unknown')
        from metriccanvas_authoring.application.authoring_submission import AuthoringSubmissionCoordinator
        f.coordinator=AuthoringSubmissionCoordinator(f.candidates,f.records,f.gate,f.lifecycle)
        self.assertEqual((await f.finalize(candidate))['status'],'unknown')
        self.assertEqual(len(self.calls),1)

    async def test_wire_vectors_and_uncoordinated_tool_cannot_write(self):
        command=save_command()
        for ret in VECTORS['successCodes']:
            def handle(request):
                return httpx.Response(200,json={'retCode':ret,'page_id':command['pageId'],'page_metadata_id':'resource','revision_id':'r1','revision_number':1,'is_draft':True,'page_metadata_definition':json.dumps(command['document'])})
            adapter=KnownLifecycleHttp('https://java.test/user-page-metadata',httpx.MockTransport(handle))
            self.assertEqual((await adapter.save(Identities().current(),command))['status'],'saved')
        for status in VECTORS['unknownHttp']:
            adapter=KnownLifecycleHttp('https://java.test/user-page-metadata',httpx.MockTransport(lambda _:httpx.Response(status)))
            self.assertEqual((await adapter.save(Identities().current(),command))['status'],'unknown')
        for case in VECTORS['rejectedHttp']:
            adapter=KnownLifecycleHttp('https://java.test/user-page-metadata',httpx.MockTransport(lambda _:httpx.Response(case['status'])))
            self.assertEqual((await adapter.save(Identities().current(),command))['code'],case['code'])
        from lifecycle_stdio_server import Programs
        lifecycle=Lifecycle(adapter,Programs(),Identities())
        self.assertEqual((await lifecycle.call('save_draft','save-request-token'))['code'],'CAPABILITY_UNAVAILABLE')
