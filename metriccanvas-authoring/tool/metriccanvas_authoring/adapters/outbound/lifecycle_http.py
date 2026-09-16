"""Only the #105 current resource GET is known. No speculative strong endpoints."""
import json
from urllib.parse import quote
import httpx
from metriccanvas_authoring.application.lifecycle_ports import LifecycleCapabilities, LifecycleError
from metriccanvas_authoring.application.lifecycle import require, valid_ref
from metriccanvas_authoring.domain.page_validation import validate_page_document


class KnownLifecycleHttp:
    capabilities = LifecycleCapabilities(current_read=True)

    def __init__(self, collection_url: str, transport=None):
        self.collection_url = collection_url.rstrip('/')
        self.transport = transport

    async def current_match(self, identity, ref):
        """Read only the currently stored revision if it matches; never an exactRead port."""
        require(valid_ref(ref), 'INVALID_REQUEST')
        require(bool(identity.actor_id and identity.auth_token), 'UNAUTHENTICATED')
        require(bool(self.collection_url), 'CAPABILITY_UNAVAILABLE')
        async with httpx.AsyncClient(transport=self.transport, follow_redirects=False, timeout=30) as client:
            response = await client.get(self.collection_url + '/' + quote(ref['resourceId'], safe=''),
                headers={'X-Operator-Id':identity.actor_id, 'X-Auth-Token':identity.auth_token})
        if response.status_code in {401,403,404}:
            raise LifecycleError({401:'UNAUTHENTICATED',403:'FORBIDDEN',404:'REVISION_NOT_FOUND'}[response.status_code])
        require(response.status_code == 200)
        try:
            value = response.json()
            require(isinstance(value,dict) and value.get('retCode') in ('CBC.0000', '0'))
            require({k:value.get(v) for k,v in [('pageId','page_id'),('revisionId','revision_id'),('resourceId','page_metadata_id')]} == ref)
            require(isinstance(value.get('page_metadata_definition'),str))
            document = json.loads(value['page_metadata_definition'])
            require(isinstance(document,dict) and document.get('id') == ref['pageId'])
            require(not validate_page_document(document), 'INVALID_PAGE')
            return {'ref':ref.copy(), 'document':document, 'assurance':'provider-response'}
        except (ValueError, TypeError):
            raise LifecycleError('RESPONSE_MISMATCH') from None

    async def save(self, identity, command):
        raise LifecycleError('CAPABILITY_UNAVAILABLE')

    async def lookup(self, identity, command):
        raise LifecycleError('CAPABILITY_UNAVAILABLE')

    async def read(self, identity, ref):
        raise LifecycleError('CAPABILITY_UNAVAILABLE')

    async def history(self, identity, command):
        raise LifecycleError('CAPABILITY_UNAVAILABLE')

    def verify_document(self, document, content_hash, canonicalization):
        # #105 has no authenticated persisted hash/canonicalization contract.
        return False
