
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
from lifecycle_stdio_server import document, Identities
from adapter_template.firstparty.lifecycle_http import KnownLifecycleHttp
from metriccanvas_authoring.assets.lifecycle_ports import LifecycleError


class KnownHttpTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.ref={'pageId':'lifecycle-page','revisionId':'r1','resourceId':'opaque/resource'}
        self.response={'retCode':'CBC.0000','page_id':'lifecycle-page','revision_id':'r1','page_metadata_id':'opaque/resource','page_metadata_definition':json.dumps(document())}
        self.requests=[]; self.status=200
        def handle(request):
            self.requests.append(request)
            return httpx.Response(self.status,json=self.response)
        self.adapter=KnownLifecycleHttp('https://provider.test/rest/cdi/cdinl2databuilderservice/v1/user-page-metadata',httpx.MockTransport(handle))
    async def test_known_get_only_two_identity_headers_encoded_resource_and_string_document(self):
        result=await self.adapter.current_match(Identities().current(),self.ref)
        self.assertEqual(result['document'],document()); self.assertEqual(result['assurance'],'provider-response')
        request=self.requests[0]
        self.assertEqual(request.method,'GET'); self.assertTrue(str(request.url).endswith('/opaque%2Fresource'))
        self.assertEqual(request.headers['X-Operator-Id'],'actor-a'); self.assertEqual(request.headers['X-Auth-Token'],'secret-token')
        self.assertNotIn('x-workspace-id',request.headers); self.assertNotIn('contentHash',result)
        self.assertFalse(self.adapter.capabilities.exact_read)
    async def test_wrong_revision_business_failure_missing_retcode_and_object_document_rejected(self):
        original=self.response.copy()
        for changes in [{'revision_id':'r2'},{'page_metadata_id':'other'},{'retCode':'1'},{'retCode':0},{'page_metadata_definition':document()}]:
            self.response={**original,**changes}
            with self.assertRaises(LifecycleError): await self.adapter.current_match(Identities().current(),self.ref)
        self.response={k:v for k,v in original.items() if k!='retCode'}
        with self.assertRaises(LifecycleError): await self.adapter.current_match(Identities().current(),self.ref)
    async def test_previous_deployment_success_code_remains_compatible(self):
        self.response['retCode']='0'
        self.assertEqual((await self.adapter.current_match(Identities().current(),self.ref))['document'],document())
    async def test_http_authorization_and_redirect_do_not_forward_credentials(self):
        for status,code in [(401,'UNAUTHENTICATED'),(403,'FORBIDDEN'),(404,'REVISION_NOT_FOUND'),(302,'RESPONSE_MISMATCH'),(500,'RESPONSE_MISMATCH')]:
            self.status=status
            with self.assertRaises(LifecycleError) as caught: await self.adapter.current_match(Identities().current(),self.ref)
            self.assertEqual(caught.exception.code,code)
        self.assertEqual(len(self.requests),5)
    async def test_future_capabilities_make_no_http_request(self):
        for operation in ['lookup','read','history']:
            with self.assertRaises(LifecycleError) as caught: await getattr(self.adapter,operation)(Identities().current(),{})
            self.assertEqual(caught.exception.code,'CAPABILITY_UNAVAILABLE')
        self.assertFalse(self.requests)

    async def test_save_diagnostics_locate_mismatch_without_exposing_payload(self):
        from lifecycle_stdio_server import save_command
        events = []
        command = save_command()
        self.response.update(is_draft=True, revision_number=1)
        self.response['page_metadata_definition'] = 'PRIVATE invalid JSON'
        self.adapter = KnownLifecycleHttp(self.adapter.collection_url, self.adapter.transport,
                                          diagnostics=events.append)
        result = await self.adapter.save(Identities().current(), command)
        self.assertEqual(result, {'status': 'unknown', 'operationId': command['context']['operationId']})
        self.assertEqual([e['stage'] for e in events], ['send_started', 'response_received', 'receipt_invalid'])
        self.assertEqual(events[-1]['path'], '/page_metadata_definition')
        self.assertEqual(events[1]['httpStatus'], 200)
        self.assertEqual(events[-1]['businessCode'], 'CBC.0000')
        self.assertTrue(all(e['operationId'] == result['operationId'] for e in events))
        self.assertNotIn('PRIVATE', json.dumps(events))
        self.assertNotIn('secret-token', json.dumps(events))
        self.assertEqual(len(self.requests), 1)

    async def test_save_diagnostics_distinguish_timeout_and_rejection_and_cannot_change_save(self):
        from lifecycle_stdio_server import save_command
        events = []
        def timeout(request):
            self.requests.append(request)
            raise httpx.ReadTimeout('PRIVATE token in exception')
        adapter = KnownLifecycleHttp(self.adapter.collection_url, httpx.MockTransport(timeout),
                                     diagnostics=events.append)
        result = await adapter.save(Identities().current(), save_command())
        self.assertEqual(result['status'], 'unknown')
        self.assertEqual(events[-1]['stage'], 'transport_unknown')
        self.assertEqual(events[-1]['code'], 'TIMEOUT')
        self.assertNotIn('PRIVATE', json.dumps(events))
        self.assertEqual(len(self.requests), 1)
        events.clear()
        self.status = 409
        self.adapter = KnownLifecycleHttp(self.adapter.collection_url, self.adapter.transport,
                                          diagnostics=events.append)
        self.assertEqual((await self.adapter.save(Identities().current(), save_command()))['status'], 'rejected')
        self.assertEqual(events[-1]['stage'], 'rejected')
        def broken_sink(event):
            raise RuntimeError('sink unavailable')
        self.adapter.diagnostics = broken_sink
        self.response.update(is_draft=True, revision_number=1)
        self.status = 200
        self.assertEqual((await self.adapter.save(Identities().current(), save_command()))['status'], 'saved')
