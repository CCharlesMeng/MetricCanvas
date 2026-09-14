"""Lifecycle orchestration: no content editing, persistence transaction or identity authority."""
import json
import re
from copy import deepcopy
from jsonschema import Draft202012Validator
from metriccanvas_authoring.runtime_assets import bundle_root
from metriccanvas_authoring.domain.page_validation import validate_page_document
from .lifecycle_ports import LifecycleError, LifecycleServicePort, LifecycleProgramPort, LifecycleIdentityPort

REQUEST_SCHEMA = json.loads((bundle_root() / 'contracts/authored/lifecycle-request.schema.json').read_text())
VALIDATOR = Draft202012Validator(REQUEST_SCHEMA)
REF_KEYS = {'pageId', 'revisionId', 'resourceId'}
SAFE_CODES = {'INVALID_PAGE', 'INVALID_REQUEST', 'UNAUTHENTICATED', 'FORBIDDEN',
    'REVISION_NOT_FOUND', 'REVISION_CONFLICT', 'IDEMPOTENCY_CONFLICT',
    'CAPABILITY_UNAVAILABLE', 'RESPONSE_MISMATCH', 'PROGRAM_UNAVAILABLE',
    'PROGRAM_TOKEN_INVALID', 'PROGRAM_NOT_FOUND'}


def valid_ref(ref):
    return isinstance(ref, dict) and set(ref) == REF_KEYS and all(
        isinstance(v, str) and 0 < len(v) <= 256 for v in ref.values())


def require(condition, code='RESPONSE_MISMATCH'):
    if not condition:
        raise LifecycleError(code)


class Lifecycle:
    def __init__(self, service: LifecycleServicePort, programs: LifecycleProgramPort, identities: LifecycleIdentityPort):
        self.service, self.programs, self.identities = service, programs, identities

    def identity(self):
        identity = self.identities.current()
        require(all(isinstance(v, str) and v.strip() for v in
            (identity.actor_id, identity.workspace_id, identity.auth_token)), 'UNAUTHENTICATED')
        return identity

    def still_current(self, identity):
        require(self.identity() == identity, 'UNAUTHENTICATED')

    async def request(self, token, kind, identity):
        command = deepcopy(await self.programs.load(token, identity))
        require(not list(VALIDATOR.iter_errors(command)) and command['kind'] == kind, 'INVALID_REQUEST')
        if kind == 'save':
            ctx = command['context']
            require(ctx['actorId'] == identity.actor_id and ctx['workspaceId'] == identity.workspace_id, 'FORBIDDEN')
            require(command['document'].get('id') == command['pageId'], 'INVALID_PAGE')
            require(command['base'] is None or command['base']['pageId'] == command['pageId'], 'INVALID_REQUEST')
            require(not validate_page_document(command['document']), 'INVALID_PAGE')
        if kind == 'history':
            require(command['snapshot'] is None or command['snapshot']['pageId'] == command['pageId'], 'INVALID_REQUEST')
            require(command['cursor'] is None or command['snapshot'] is not None, 'INVALID_REQUEST')
        self.still_current(identity)
        return command

    def saved(self, response, command):
        require(isinstance(response, dict))
        require(response.get('operationId') == command['context']['operationId'])
        status = response.get('status')
        require(status in {'saved', 'pending', 'unknown', 'rejected', 'not-applied'})
        if status != 'saved':
            require('ref' not in response)
            result = {'status': status, 'operationId': response['operationId']}
            if status == 'not-applied':
                require(type(response.get('retrySafe')) is bool)
                result['retrySafe'] = response['retrySafe']
            if status == 'rejected':
                result['code'] = response.get('code') if response.get('code') in SAFE_CODES else 'SERVICE_REJECTED'
                result['retryable'] = False
                result['message'] = result['code']
            return result
        require({'ref','base','contentHash','canonicalization','revisionNumber'} <= set(response))
        require(isinstance(response['contentHash'], str) and re.fullmatch('[a-f0-9]{64}', response['contentHash']))
        require(isinstance(response['canonicalization'], str) and bool(response['canonicalization']))
        ref = response.get('ref')
        require(valid_ref(ref) and ref['pageId'] == command['pageId'])
        require(response.get('base') == command['base'])
        require(command['base'] is None or ref['revisionId'] != command['base']['revisionId'])
        require(type(response.get('revisionNumber')) is int and response['revisionNumber'] > 0)
        require(self.service.verify_document(command['document'], response.get('contentHash'), response.get('canonicalization')))
        return {k: deepcopy(response[k]) for k in ('status','operationId','ref','base','contentHash','canonicalization','revisionNumber')}

    async def save(self, token, *, lookup=False):
        identity = self.identity()
        command = await self.request(token, 'save', identity)
        caps = self.service.capabilities
        require(caps.operation_lookup if lookup else caps.stable_save and caps.operation_lookup and caps.exact_read, 'CAPABILITY_UNAVAILABLE')
        try:
            response = await self.service.lookup(identity, deepcopy(command))
            prior = self.saved(response, command)
            if not lookup and prior['status'] == 'not-applied' and prior['retrySafe']:
                self.still_current(identity)
                response = await self.service.save(identity, deepcopy(command))
                require(response.get('status') != 'not-applied')
        except LifecycleError as error:
            if error.code in {'UNAUTHENTICATED','FORBIDDEN','CAPABILITY_UNAVAILABLE','REVISION_CONFLICT','IDEMPOTENCY_CONFLICT','INVALID_PAGE','INVALID_REQUEST'}:
                return {'status':'rejected','operationId':command['context']['operationId'],
                    'code':error.code,'message':error.code,'retryable':False}
            response = {'status':'unknown','operationId':command['context']['operationId']}
        except Exception:
            # A transport exception says nothing about whether the transaction committed.
            response = {'status':'unknown', 'operationId':command['context']['operationId']}
        self.still_current(identity)
        try:
            result = self.saved(response, command)
            if result['status'] == 'saved':
                result['programToken'] = await self.programs.store({'receipt':deepcopy(result),
                    'context':command['context'], 'base':command['base']}, identity)
                self.still_current(identity)
            return result
        except LifecycleError:
            # A malformed success could still have committed. Never advise a new key.
            return {'status':'unknown', 'operationId':command['context']['operationId'], 'code':'RESPONSE_MISMATCH'}

    async def read(self, token):
        identity = self.identity()
        command = await self.request(token, 'read', identity)
        require(self.service.capabilities.exact_read, 'CAPABILITY_UNAVAILABLE')
        result = deepcopy(await self.service.read(identity, deepcopy(command['ref'])))
        self.still_current(identity)
        require(isinstance(result, dict) and result.get('ref') == command['ref'])
        document = result.get('document')
        require(isinstance(document, dict) and document.get('id') == command['ref']['pageId'])
        # Original document/hash first; normalization is a downstream content boundary.
        require(self.service.verify_document(document, result.get('contentHash'), result.get('canonicalization')))
        require(not validate_page_document(document), 'INVALID_PAGE')
        envelope = {k: deepcopy(result[k]) for k in ('ref','document','contentHash','canonicalization')}
        program_token = await self.programs.store(envelope, identity)
        self.still_current(identity)
        return {'status':'read', 'ref':command['ref'], 'programToken':program_token,
            'contentHash':result['contentHash'], 'canonicalization':result['canonicalization']}

    async def history(self, token):
        identity = self.identity()
        command = await self.request(token, 'history', identity)
        require(self.service.capabilities.history, 'CAPABILITY_UNAVAILABLE')
        result = deepcopy(await self.service.history(identity, deepcopy(command)))
        self.still_current(identity)
        require(isinstance(result, dict) and {'snapshot','cursor','nextCursor','items'} <= set(result) and valid_ref(result.get('snapshot')))
        require(result['snapshot']['pageId'] == command['pageId'])
        require(command['snapshot'] is None or result['snapshot'] == command['snapshot'])
        require(result.get('cursor') == command['cursor'])
        require(result.get('nextCursor') is None or isinstance(result.get('nextCursor'), str) and bool(result['nextCursor']))
        require(result.get('nextCursor') is None or result['nextCursor'] != command['cursor'])
        items = result.get('items')
        require(isinstance(items, list) and len(items) <= command['limit'])
        require(result['nextCursor'] is None or bool(items))
        refs = []
        for item in items:
            require(isinstance(item, dict) and valid_ref(item.get('ref')))
            require(item['ref']['pageId'] == command['pageId'] and item['ref'] not in refs)
            require('base' in item and (item['base'] is None or valid_ref(item['base']) and item['base']['pageId'] == command['pageId']))
            refs.append(item['ref'])
        program_token = await self.programs.store(result, identity)
        self.still_current(identity)
        return {'status':'history', 'snapshot':result['snapshot'], 'refs':refs,
            'nextCursor':result['nextCursor'], 'programToken':program_token}

    async def call(self, operation, token):
        try:
            if operation == 'get_save_result':
                return await self.save(token, lookup=True)
            return await {'save_draft':self.save, 'read_revision':self.read, 'list_revisions':self.history}[operation](token)
        except LifecycleError as error:
            return {'status':'rejected', 'code':error.code if error.code in SAFE_CODES else 'SERVICE_REJECTED'}
        except Exception:
            # Never return raw provider errors, request payloads or credentials.
            return {'status':'unavailable', 'code':'SERVICE_UNAVAILABLE'}
