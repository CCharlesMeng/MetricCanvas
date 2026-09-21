"""Explicit external boundary substitute. Never imported by the production entry."""
import hashlib
import json
import sys
import os
from copy import deepcopy
from pathlib import Path
sys.path.insert(0, os.environ.get('S4_LIFECYCLE_INSTALLED_ROOT') or str(Path(__file__).resolve().parents[1] / 'tool'))
from metriccanvas_authoring.assets.lifecycle_ports import LifecycleCapabilities, LifecycleIdentity, LifecycleError
from metriccanvas_authoring.entrypoints.compat.lifecycle_mcp import create_lifecycle_mcp_server


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def document():
    return {'schemaVersion':'6.2','id':'lifecycle-page','layout':'report','meta':{'description':'private-business-value'},'dataSources':{},'sections':[{'id':'main','title':'Private section','components':[{'id':'text','type':'text','layout':{'span':12},'props':{'title':'Private title','body':'private-business-value'}}]}]}


def save_command(operation='operation-1', base=None):
    return {'kind':'save','context':{'operationId':operation,'actorId':'actor-a','workspaceId':'workspace-a','origin':{'kind':'relay','skillVersion':'test/1','runId':'run-1'}},'pageId':'lifecycle-page','base':base,'document':document(),'description':'private revision description','retainDimensionValues':False}


class Identities:
    value = LifecycleIdentity('actor-a','workspace-a','secret-token')
    def current(self):
        return self.value


class Programs:
    def __init__(self):
        self.inputs = {'save-request-token':save_command()}
        self.outputs = {}
    async def load(self, token, identity):
        if identity.actor_id != 'actor-a' or identity.workspace_id != 'workspace-a':
            raise LifecycleError('FORBIDDEN')
        if token not in self.inputs:
            raise LifecycleError('PROGRAM_NOT_FOUND')
        return deepcopy(self.inputs[token])
    async def store(self, value, identity):
        token = 'output-token-' + str(len(self.outputs))
        self.outputs[token] = deepcopy(value)
        return token


class ProposedService:
    """Models service authority for consumer tests, not an implementation deliverable."""
    capabilities = LifecycleCapabilities(True,True,True,True)
    def __init__(self):
        self.operations, self.revisions = {}, {}
        self.head = None
        self.save_calls = 0
        self.lose_ack = False
        self.lookup_status = None
        self.read_override = None
    def authorize(self, identity):
        if identity.actor_id != 'actor-a' or identity.workspace_id != 'workspace-a' or identity.auth_token != 'secret-token':
            raise LifecycleError('FORBIDDEN')
    def key(self, identity, command):
        return identity.actor_id, identity.workspace_id, command['context']['operationId']
    def verify_document(self, doc, content_hash, canonicalization):
        return canonicalization == 'test-python-sorted-json/1' and isinstance(content_hash,str) and content_hash == digest(doc)
    async def lookup(self, identity, command):
        self.authorize(identity)
        key = self.key(identity,command)
        if self.lookup_status:
            return {'operationId':command['context']['operationId'],**self.lookup_status}
        if key in self.operations:
            fingerprint, result = self.operations[key]
            if digest(command) != fingerprint:
                return {'status':'rejected','operationId':key[-1],'code':'IDEMPOTENCY_CONFLICT'}
            return deepcopy(result)
        return {'status':'not-applied','operationId':key[-1],'retrySafe':True}
    async def save(self, identity, command):
        self.authorize(identity)
        self.save_calls += 1
        key = self.key(identity, command)
        if key in self.operations:
            return await self.lookup(identity,command)
        if command['base'] != self.head:
            return {'status':'rejected','operationId':key[-1],'code':'REVISION_CONFLICT'}
        number = len(self.revisions) + 1
        ref = {'pageId':command['pageId'],'revisionId':f'r{number}','resourceId':'resource-opaque'}
        result = {'status':'saved','operationId':key[-1],'ref':ref,'base':command['base'],'revisionNumber':number,'contentHash':digest(command['document']),'canonicalization':'test-python-sorted-json/1'}
        self.revisions[ref['revisionId']] = {'ref':ref,'base':command['base'],'document':deepcopy(command['document']),'contentHash':result['contentHash'],'canonicalization':result['canonicalization'],'description':command['description']}
        self.head = ref
        self.operations[key] = digest(command),deepcopy(result)
        if self.lose_ack:
            self.lose_ack = False
            raise TimeoutError('secret provider details')
        return result
    async def read(self, identity, ref):
        self.authorize(identity)
        if self.read_override is not None:
            return deepcopy(self.read_override)
        if ref['revisionId'] not in self.revisions:
            raise LifecycleError('REVISION_NOT_FOUND')
        return deepcopy(self.revisions[ref['revisionId']])
    async def history(self, identity, command):
        self.authorize(identity)
        snapshot = command['snapshot'] or self.head
        keys = list(self.revisions)[:int(snapshot['revisionId'][1:])]
        start = int(command['cursor'] or '0')
        items = [deepcopy(self.revisions[k]) for k in keys[start:start+command['limit']]]
        end = start + len(items)
        return {'snapshot':snapshot,'cursor':command['cursor'],'nextCursor':str(end) if end < len(keys) else None,'items':items}


if __name__ == '__main__':
    if installed := os.environ.get('S4_LIFECYCLE_INSTALLED_ROOT'):
        import metriccanvas_authoring
        assert Path(metriccanvas_authoring.__file__).resolve().is_relative_to(Path(installed).resolve())
    programs,service = Programs(),ProposedService()
    # Fixed precise reference for read tool testing after the first save.
    programs.inputs['read-request-token']={'kind':'read','ref':{'pageId':'lifecycle-page','revisionId':'r1','resourceId':'resource-opaque'}}
    programs.inputs['history-request-token']={'kind':'history','pageId':'lifecycle-page','cursor':None,'snapshot':None,'limit':10}
    create_lifecycle_mcp_server(service,programs,Identities()).run()
