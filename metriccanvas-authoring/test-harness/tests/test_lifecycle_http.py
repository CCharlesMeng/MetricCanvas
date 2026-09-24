
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
