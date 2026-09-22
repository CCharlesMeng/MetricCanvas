import asyncio
import json
import os
import sys
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path[:0]=[str(ROOT/'tool'),str(ROOT/'test-harness')]
from lifecycle_stdio_server import ProposedService, Programs, Identities, save_command, digest
from metriccanvas_authoring.assets.lifecycle import Lifecycle
from metriccanvas_authoring.assets.lifecycle_ports import LifecycleIdentity, LifecycleCapabilities, LifecycleError
from metriccanvas_authoring.adapters.relay.lifecycle_spool import FileLifecyclePrograms


class LifecycleTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.service,self.programs,self.identities=ProposedService(),Programs(),Identities()
        self.app=Lifecycle(self.service,self.programs,self.identities)
    async def call(self, op='save_draft',token='save-request-token'):
        return await self.app.call(op,token)
    async def test_success_duplicate_lookup_and_trusted_origin(self):
        a=await self.call(); b=await self.call(); c=await self.call('get_save_result')
        self.assertEqual([x['status'] for x in (a,b,c)],['saved']*3)
        self.assertEqual(a['ref'],b['ref']); self.assertEqual(a['ref'],c['ref'])
        self.assertEqual(self.service.save_calls,1)
        envelope=self.programs.outputs[a['programToken']]
        self.assertEqual(envelope['context']['origin']['runId'],'run-1')
        self.assertNotIn('document',json.dumps(a)); self.assertNotIn('private',json.dumps(a))
    async def test_lost_ack_query_recovers_original_without_resubmission(self):
        self.service.lose_ack=True
        a=await self.call(); self.assertEqual(a['status'],'unknown'); self.assertNotIn('ref',a)
        b=await self.call('get_save_result'); self.assertEqual(b['status'],'saved')
        self.assertEqual(self.service.save_calls,1)
    async def test_changed_payload_or_origin_or_retention_same_key_rejected(self):
        await self.call()
        original=deepcopy(self.programs.inputs['save-request-token'])
        for field,value in [('description','changed'),('retainDimensionValues',True),('document',{**original['document'],'meta':{'description':'changed'}}),('context',{**original['context'],'origin':{'kind':'manual'}})]:
            with self.subTest(field=field):
                self.programs.inputs['save-request-token']={**deepcopy(original),field:value}
                self.assertEqual((await self.call())['code'],'IDEMPOTENCY_CONFLICT')
        self.assertEqual(self.service.save_calls,1)
    async def test_unknown_pending_expired_dedup_never_submit(self):
        for state in [{'status':'unknown'},{'status':'pending'},{'status':'not-applied','retrySafe':False}]:
            self.service.lookup_status=state
            self.assertEqual((await self.call())['status'],state['status'] if state['status'] != 'not-applied' else 'unknown')
            self.assertEqual((await self.call('get_save_result'))['status'],state['status'])
        self.assertEqual(self.service.save_calls,0)
    async def test_conflict_does_not_advance_revision(self):
        await self.call()
        self.programs.inputs['save-request-token']=save_command('new-operation')
        self.assertEqual((await self.call())['code'],'REVISION_CONFLICT')
        self.assertEqual(len(self.service.revisions),1)
    async def test_precise_r1_after_r2_and_original_hash_before_normalization(self):
        command=self.programs.inputs['save-request-token']
        command['document']['schemaVersion']='6.5'; command['document']['layoutForm']=command['document'].pop('layout')
        first=await self.call()
        self.programs.inputs['save-request-token']=save_command('operation-2',first['ref'])
        await self.call()
        self.programs.inputs['read-token']={'kind':'read','ref':first['ref']}
        read=await self.call('read_revision','read-token')
        raw=self.programs.outputs[read['programToken']]['document']
        self.assertEqual(raw['schemaVersion'],'6.5'); self.assertIn('layoutForm',raw)
        self.assertEqual(read['contentHash'],digest(raw)); self.assertEqual(read['ref'],first['ref'])
    async def test_latest_wrong_resource_hash_or_invalid_page_rejected(self):
        first=await self.call(); original=deepcopy(self.service.revisions['r1'])
        self.programs.inputs['read-token']={'kind':'read','ref':first['ref']}
        for field,value in [('ref',{**first['ref'],'revisionId':'latest'}),('ref',{**first['ref'],'resourceId':'wrong'}),('contentHash','0'*64),('canonicalization','unknown')]:
            self.service.read_override={**deepcopy(original),field:value}
            self.assertEqual((await self.call('read_revision','read-token'))['code'],'RESPONSE_MISMATCH')
        bad=deepcopy(original); bad['document']['sections']='invalid'; bad['contentHash']=digest(bad['document']); self.service.read_override=bad
        self.assertEqual((await self.call('read_revision','read-token'))['code'],'INVALID_PAGE')
    async def test_history_snapshot_stays_fixed_while_head_advances(self):
        r1=await self.call(); self.programs.inputs['save-request-token']=save_command('op2',r1['ref']); r2=await self.call()
        request={'kind':'history','pageId':'lifecycle-page','snapshot':None,'cursor':None,'limit':1}
        self.programs.inputs['history-token']=request
        h1=await self.call('list_revisions','history-token')
        self.programs.inputs['save-request-token']=save_command('op3',r2['ref']); await self.call()
        self.programs.inputs['history-token']={**request,'snapshot':h1['snapshot'],'cursor':h1['nextCursor']}
        h2=await self.call('list_revisions','history-token')
        self.assertEqual(h2['snapshot'],r2['ref']); self.assertEqual(h2['refs'],[r2['ref']]); self.assertIsNone(h2['nextCursor'])
        self.assertNotIn('private',json.dumps(h2))
    async def test_unavailable_capabilities_zero_calls(self):
        self.service.capabilities=LifecycleCapabilities()
        self.assertEqual((await self.call())['code'],'CAPABILITY_UNAVAILABLE')
        self.assertEqual((await self.call('get_save_result'))['code'],'CAPABILITY_UNAVAILABLE')
        self.programs.inputs['read-token']={'kind':'read','ref':{'pageId':'p','revisionId':'r','resourceId':'x'}}
        self.programs.inputs['history-token']={'kind':'history','pageId':'p','snapshot':None,'cursor':None,'limit':10}
        for op,token in [('read_revision','read-token'),('list_revisions','history-token')]:
            self.assertEqual((await self.call(op,token))['code'],'CAPABILITY_UNAVAILABLE')
        self.assertEqual(self.service.save_calls,0)
    async def test_identity_missing_mismatched_and_service_forbidden(self):
        for identity,code in [(LifecycleIdentity('','',''),'UNAUTHENTICATED'),(LifecycleIdentity('actor-b','workspace-a','secret-token'),'FORBIDDEN'),(LifecycleIdentity('actor-a','workspace-b','secret-token'),'FORBIDDEN'),(LifecycleIdentity('actor-a','workspace-a','wrong'),'FORBIDDEN')]:
            self.identities.value=identity
            self.assertEqual((await self.call())['code'],code)
        self.assertEqual(self.service.save_calls,0)
    async def test_identity_switch_inflight_does_not_deliver_receipt(self):
        original=self.service.save
        async def changed(identity,command):
            result=await original(identity,command)
            self.identities.value=LifecycleIdentity('actor-b','workspace-a','secret-token')
            return result
        self.service.save=changed
        self.assertEqual((await self.call())['code'],'UNAUTHENTICATED')
        self.assertFalse(self.programs.outputs)
        self.identities.value=LifecycleIdentity('actor-a','workspace-a','secret-token')
        self.assertEqual((await self.call('get_save_result'))['status'],'saved')
    async def test_invalid_document_and_missing_explicit_fields_never_saved(self):
        original=deepcopy(self.programs.inputs['save-request-token'])
        for key in ['retainDimensionValues','description','base','context']:
            request=deepcopy(original); del request[key]; self.programs.inputs['save-request-token']=request
            self.assertEqual((await self.call())['code'],'INVALID_REQUEST')
        self.programs.inputs['save-request-token']=deepcopy(original); self.programs.inputs['save-request-token']['document']['sections']='bad'
        self.assertEqual((await self.call())['code'],'INVALID_PAGE'); self.assertEqual(self.service.save_calls,0)
    async def test_malformed_saved_response_is_unknown_not_success_or_retry(self):
        original=self.service.save
        async def bad(identity,command):
            result=await original(identity,command); result['operationId']='other'; return result
        self.service.save=bad
        self.assertEqual((await self.call())['status'],'unknown')
        self.assertEqual((await self.call('get_save_result'))['status'],'saved')

    async def test_concurrent_same_operation_and_same_baseline_are_service_decisions(self):
        results=await asyncio.gather(self.call(),self.call())
        self.assertEqual(results[0]['ref'],results[1]['ref'])
        self.assertEqual(len(self.service.revisions),1)
        self.programs.inputs['second-token']=save_command('op2',results[0]['ref'])
        self.programs.inputs['third-token']=save_command('op3',results[0]['ref'])
        results=await asyncio.gather(self.call(token='second-token'),self.call(token='third-token'))
        self.assertEqual(sorted(x['status'] for x in results),['rejected','saved'])
        self.assertEqual(len(self.service.revisions),2)

    async def test_cancelled_local_receiver_can_query_committed_save(self):
        committed=asyncio.Event(); release=asyncio.Event(); original=self.service.save
        async def delayed(identity,command):
            result=await original(identity,command); committed.set(); await release.wait(); return result
        self.service.save=delayed
        task=asyncio.create_task(self.call()); await committed.wait(); task.cancel()
        with self.assertRaises(asyncio.CancelledError): await task
        self.assertEqual((await self.call('get_save_result'))['status'],'saved')
        self.assertEqual(self.service.save_calls,1)

    async def test_history_wrong_snapshot_duplicates_and_missing_cursor_rejected(self):
        saved=await self.call()
        self.programs.inputs['history-token']={'kind':'history','pageId':'lifecycle-page','snapshot':saved['ref'],'cursor':None,'limit':10}
        original=await self.service.history(self.identities.current(),self.programs.inputs['history-token'])
        bads=[{**original,'snapshot':{**saved['ref'],'revisionId':'r999'}},
            {**original,'items':original['items']*2},
            {k:v for k,v in original.items() if k!='nextCursor'},
            {**original,'items':[],'nextCursor':'next'}]
        for bad in bads:
            async def history(identity,command): return deepcopy(bad)
            self.service.history=history
            self.assertEqual((await self.call('list_revisions','history-token'))['code'],'RESPONSE_MISMATCH')

    async def test_program_delivery_failure_retains_unknown_original_operation(self):
        store=self.programs.store
        async def unavailable(value,identity): raise OSError('private output path')
        self.programs.store=unavailable
        result=await self.call()
        self.assertEqual(result['status'],'unknown')
        self.assertEqual(result['operationId'],'operation-1'); self.assertNotIn('ref',result)
        self.programs.store=store
        recovered=await self.call('get_save_result')
        self.assertEqual(recovered['status'],'saved'); self.assertEqual(self.service.save_calls,1)


class SpoolTest(unittest.IsolatedAsyncioTestCase):
    async def test_scope_traversal_symlink_and_private_roundtrip(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); spool=FileLifecyclePrograms(root,root); identity=Identities().current()
            path=root/'input-token-long.json'
            path.write_text(json.dumps({'actorId':'actor-a','workspaceId':'workspace-a','request':save_command()})); path.chmod(0o600)
            self.assertEqual((await spool.load('input-token-long',identity))['context']['operationId'],'operation-1')
            for token,who in [('../input-token-long',identity),('input-token-long',LifecycleIdentity('actor-b','workspace-a','secret-token'))]:
                with self.assertRaises(LifecycleError): await spool.load(token,who)
            (root/'symlink-token-long.json').symlink_to(path)
            with self.assertRaises(LifecycleError): await spool.load('symlink-token-long',identity)
            token=await spool.store({'document':{'private':'value'}},identity)
            output=root/(token+'.json'); self.assertEqual(output.stat().st_mode & 0o777,0o600)
            self.assertNotIn('secret-token',output.read_text())
            root.chmod(0o755)
            with self.assertRaises(LifecycleError): await spool.load('input-token-long',identity)
