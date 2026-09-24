
import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str((_Path(__file__).resolve().parent / '../../examples').resolve()))
import json
import sys
import unittest
from pathlib import Path
import httpx
ROOT=Path(__file__).resolve().parents[2]
sys.path[:0]=[str(ROOT/'tool'),str(ROOT/'test-harness')]
import test_platform_v2 as platform_fixture
from test_platform_v2 import text_request
from test_page_editing import title
from test_authoring_turns import Turns
from lifecycle_stdio_server import save_command, Identities
from adapter_template.firstparty.lifecycle_http import KnownLifecycleHttp
from metriccanvas_authoring.assets.lifecycle import Lifecycle

VECTORS=json.loads((ROOT/'test-harness/fixtures/java-page-assets.json').read_text())

class JavaSingleSubmissionTest(unittest.IsolatedAsyncioTestCase):
    setUp = platform_fixture.PlatformV2Test.setUp
    make = platform_fixture.PlatformV2Test.make
    async def configured(self, mode='existing', failure=False):
        self.turns = Turns(mode)
        self.calls=[]
        def handle(request):
            self.calls.append(request)
            if request.method == 'GET':
                ref = self.turns.binding['baseRef']
                return httpx.Response(200, json={'retCode': 'CBC.0000', 'page_id': ref['pageId'],
                    'revision_id': ref['revisionId'], 'page_metadata_id': ref['resourceId'],
                    'page_metadata_definition': self.turns.document_json})
            if failure: raise httpx.ReadTimeout('lost acknowledgement')
            body=json.loads(request.content)
            return httpx.Response(200,json={'retCode':'CBC.0000','page_id':body['page_metadata_definition']['id'],
                'page_metadata_id': self.turns.binding['baseRef']['resourceId'] if self.turns.binding['baseRef'] else 'resource-opaque',
                'revision_id':'java-next','revision_number':2,'is_draft':True,
                'page_metadata_definition':json.dumps(body['page_metadata_definition'])})
        self.service=KnownLifecycleHttp('https://java.test/user-page-metadata',httpx.MockTransport(handle))
        self.app=self.make()
        return self.app

    async def test_existing_work_current_get_then_single_conditional_put(self):
        app=await self.configured()
        request={'operations':[title(value='Changed')]}
        result, artifact=await app.mutate('edit','current-context',request)
        self.assertEqual(result['saveStatus'],'saved')
        self.assertEqual([r.method for r in self.calls],['GET','PUT'])
        body=json.loads(self.calls[1].content)
        self.assertIs(body['is_draft'],True)
        self.assertEqual(body['base_revision_id'],self.turns.binding['baseRef']['revisionId'])
        self.assertNotIn('idempotencyKey',body)
        self.assertEqual(await self.make().mutate('edit','current-context',request),(result,artifact))
        self.assertEqual(len(self.calls),2)

    async def test_new_work_single_post(self):
        app=await self.configured('new')
        result,_=await app.mutate('compose','current-context',text_request())
        self.assertEqual(result['saveStatus'],'saved')
        self.assertEqual([r.method for r in self.calls],['POST'])
        self.assertNotIn('base_revision_id',json.loads(self.calls[0].content))

    async def test_unknown_duplicate_and_restart_never_resend(self):
        app=await self.configured(failure=True)
        request={'operations':[title(value='Changed')]}
        for app in [app,self.make(),self.make()]:
            result,_=await app.mutate('edit','current-context',request)
            self.assertEqual(result['saveStatus'],'unknown')
        self.assertEqual(len(self.calls),2)

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
