"""Java YAML adapter. Current reads and single-attempt saves; no remote retry guarantees."""
import json
import re
from urllib.parse import quote
import httpx
from metriccanvas_authoring.assets.lifecycle_ports import LifecycleCapabilities, LifecycleError
from metriccanvas_authoring.assets.lifecycle import require, valid_ref
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document


class KnownLifecycleHttp:
    capabilities = LifecycleCapabilities(current_read=True, single_save=True)

    def __init__(self, collection_url: str, transport=None, *, diagnostics=None):
        self.collection_url = collection_url.rstrip('/')
        self.transport = transport
        self.diagnostics = diagnostics

    def _diagnose(self, operation, stage, **fields):
        """Program-only allowlisted events; sink failures must never alter a save."""
        if self.diagnostics is not None:
            try:
                self.diagnostics({'operationId': operation, 'stage': stage, **fields})
            except Exception:
                pass

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
            require({k:value.get(v) for k,v in [('pageId','page_id'),('revisionId','revision_id'),('resourceId','page_metadata_id')]} == ref, 'CURRENT_PAGE_STALE')
            require(isinstance(value.get('page_metadata_definition'),str))
            document = json.loads(value['page_metadata_definition'])
            require(isinstance(document,dict) and document.get('id') == ref['pageId'])
            require(not validate_page_document(document), 'INVALID_PAGE')
            return {'ref':ref.copy(), 'document':document, 'assurance':'provider-response'}
        except (ValueError, TypeError):
            raise LifecycleError('RESPONSE_MISMATCH') from None

    async def save(self, identity, command):
        require(bool(identity.actor_id and identity.auth_token), 'UNAUTHENTICATED')
        require(bool(self.collection_url), 'CAPABILITY_UNAVAILABLE')
        require(isinstance(command, dict) and isinstance(command.get('document'), dict), 'INVALID_REQUEST')
        require(command['document'].get('id') == command.get('pageId') and not validate_page_document(command['document']), 'INVALID_PAGE')
        base = command.get('base')
        require(base is None or valid_ref(base) and base['pageId'] == command['pageId'], 'INVALID_REQUEST')
        operation = command['context']['operationId']
        body = {'page_metadata_definition':command['document'], 'is_draft':True}
        url = self.collection_url
        if base:
            url += '/' + quote(base['resourceId'], safe='')
            body.update(base_revision_id=base['revisionId'], comment=command.get('description',''))
        else:
            body['page_id'] = command['pageId']
        path, business_code = '/', None
        self._diagnose(operation, 'send_started')
        try:
            async with httpx.AsyncClient(transport=self.transport, follow_redirects=False, timeout=30) as client:
                response = await client.request('PUT' if base else 'POST', url, json=body,
                    headers={'X-Operator-Id':identity.actor_id,'X-Auth-Token':identity.auth_token})
            self._diagnose(operation, 'response_received', httpStatus=response.status_code)
            if response.status_code in {400,401,403,404,409}:
                code = {400:'INVALID_REQUEST',401:'UNAUTHENTICATED',403:'FORBIDDEN',404:'REVISION_NOT_FOUND',409:'REVISION_CONFLICT'}[response.status_code]
                self._diagnose(operation, 'rejected', httpStatus=response.status_code, code=code)
                return {'status':'rejected','operationId':operation,'code':code}
            require(response.status_code == 200)
            value = response.json()
            path = '/retCode'
            require(isinstance(value, dict))
            raw_code = value.get('retCode')
            # Never record provider prose, SQL, headers, URL or document contents.
            if isinstance(raw_code, str) and re.fullmatch(r'(?:CBC\.[0-9]{4}|[0-9]{1,8})', raw_code):
                business_code = raw_code
            require(raw_code in ('CBC.0000','0'))
            path = '/page_metadata_definition'
            require(isinstance(value.get('page_metadata_definition'),str))
            document = json.loads(value['page_metadata_definition'])
            ref = {k:value.get(v) for k,v in [('pageId','page_id'),('revisionId','revision_id'),('resourceId','page_metadata_id')]}
            for field in ('page_id', 'revision_id', 'page_metadata_id'):
                path = '/' + field
                require(isinstance(value.get(field), str) and 0 < len(value[field]) <= 256)
            path = '/page_id'
            require(valid_ref(ref) and ref['pageId'] == command['pageId'])
            if base:
                path = '/page_metadata_id'
                require(ref['resourceId'] == base['resourceId'])
                path = '/revision_id'
                require(ref['revisionId'] != base['revisionId'])
            path = '/is_draft'
            require(value.get('is_draft') is True)
            path = '/revision_number'
            require(type(value.get('revision_number')) is int and value['revision_number'] > 0)
            path = '/page_metadata_definition'
            require(isinstance(document,dict) and not validate_page_document(document))
            from metriccanvas_authoring.canonical import canonical_json
            require(canonical_json(document) == canonical_json(command['document']))
            self._diagnose(operation, 'saved', businessCode=business_code)
            return {'status':'saved','operationId':operation,'ref':ref,'base':base,
                    'revisionNumber':value['revision_number'],'isDraft':value['is_draft'],'document':document,'assurance':'provider-response'}
        except httpx.RequestError as error:
            self._diagnose(operation, 'transport_unknown',
                           code='TIMEOUT' if isinstance(error, httpx.TimeoutException) else 'TRANSPORT_ERROR')
        except Exception:
            self._diagnose(operation, 'receipt_invalid', path=path, businessCode=business_code)
        return {'status':'unknown','operationId':operation}


    async def lookup(self, identity, command):
        raise LifecycleError('CAPABILITY_UNAVAILABLE')

    async def read(self, identity, ref):
        raise LifecycleError('CAPABILITY_UNAVAILABLE')

    async def history(self, identity, command):
        raise LifecycleError('CAPABILITY_UNAVAILABLE')

    def verify_document(self, document, content_hash, canonicalization):
        # #105 has no authenticated persisted hash/canonicalization contract.
        return False
