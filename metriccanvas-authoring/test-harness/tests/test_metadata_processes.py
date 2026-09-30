"""Real subprocesses and SQLite; HTTP is a local fixture, not production proof."""
import asyncio
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from copy import deepcopy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch
from types import SimpleNamespace
from metriccanvas_authoring.data.metadata_session import metadata_session, read_turn_metadata
from metriccanvas_authoring.canonical import canonical_sha256
from adapter_template.storage.platform_state import SqlitePlatformState


class MetadataProcessesTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.calls = 0
        self.entered, self.release = threading.Event(), threading.Event()
        self.release.set()
        owner = self
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args): pass
            def do_GET(self):
                owner.calls += 1
                owner.entered.set()
                owner.release.wait(10)
                body = json.dumps({'coverage': {'complete': True}, 'models': [{'id': 'one'}], 'issues': []}).encode()
                self.send_response(200); self.send_header('Content-Length', str(len(body))); self.end_headers()
                try: self.wfile.write(body)
                except BrokenPipeError: pass
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(self.server.server_close); self.addCleanup(self.server.shutdown)
        self.config = {'db': str(Path(self.tmp.name)/'work.db'), 'url': f'http://127.0.0.1:{self.server.server_port}',
            'binding': {k: k+'-1' for k in ('actorId','workspaceId','turnId','runId','requestId','contextRef')},
            'source': {'url': 'source', 'credential': 'fingerprint', 'datasets': ['one'], 'projection': {'version': 1}}}

    def start(self, config=None):
        root = Path(__file__).resolve().parents[2]
        env = dict(os.environ, PYTHONPATH=os.pathsep.join(str(root/p) for p in ('tool','examples')))
        child = subprocess.Popen([sys.executable, str(root/'test-harness/metadata_worker.py'), json.dumps(config or self.config)],
                                 env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        self.addCleanup(lambda: child.kill() if child.poll() is None else None)
        return child

    def finish(self, child):
        out, err = child.communicate(timeout=20)
        self.assertEqual(child.returncode, 0, err)
        return json.loads(out)

    def test_concurrent_processes_and_restart_share_one_http_read(self):
        self.release.clear()
        first = self.start(); self.assertTrue(self.entered.wait(10))
        config=deepcopy(self.config); marker=Path(self.tmp.name)/'waiting'
        config['waitMarker']=str(marker)
        second = self.start(config)
        deadline=time.monotonic()+10
        while not marker.exists() and time.monotonic()<deadline: time.sleep(.01)
        self.assertTrue(marker.exists(), 'second process never waited on the first owner')
        self.release.set()
        self.assertEqual(self.finish(first), self.finish(second))
        self.finish(self.start())
        self.assertEqual(self.calls, 1)

    def test_every_binding_and_source_change_isolated(self):
        self.finish(self.start())
        variants=[]
        for key in self.config['binding']:
            config=deepcopy(self.config); config['binding'][key]+='-changed'; variants.append(config)
        for key, value in [('url','other'),('credential','new'),('datasets',['two']),('projection',{'version':2})]:
            config=deepcopy(self.config); config['source'][key]=value; variants.append(config)
        for config in variants:
            self.finish(self.start(config))
        self.assertEqual(self.calls, 1 + len(variants))

    def test_expired_dead_owner_can_be_recovered_by_new_process(self):
        store = SqlitePlatformState(self.config['db'])
        key=canonical_sha256([self.config['binding'],self.config['source']])
        asyncio.run(store.compare_and_swap('metadata-snapshot-v1',key,0,{'status':'loading','owner':'dead','expiresAt':0}))
        self.finish(self.start()); self.finish(self.start())
        self.assertEqual(self.calls,1)

    def test_killed_process_recovers_after_lease_expiry(self):
        self.release.clear()
        child=self.start(); self.assertTrue(self.entered.wait(10))
        child.kill(); child.communicate(timeout=5)
        store=SqlitePlatformState(self.config['db'])
        key=canonical_sha256([self.config['binding'],self.config['source']])
        revision, claim=asyncio.run(store.read('metadata-snapshot-v1',key))
        self.assertEqual(claim['status'],'loading')
        # Advance the stored lease rather than sleeping for 62 seconds.
        claim['expiresAt']=0
        self.assertTrue(asyncio.run(store.compare_and_swap('metadata-snapshot-v1',key,revision,claim)))
        self.release.set()
        self.finish(self.start()); self.finish(self.start())
        self.assertEqual(self.calls,2)


class MetadataPublicationTest(unittest.IsolatedAsyncioTestCase):
    async def test_late_owner_cannot_publish_and_logging_failure_is_ignored(self):
        with tempfile.TemporaryDirectory() as tmp:
            store=SqlitePlatformState(Path(tmp)/'state.db')
            binding={'turnId':'one'}; source={'url':'source'}
            key=canonical_sha256([binding,source])
            newer={'coverage': {'complete': True}, 'models':[{'id':'new'}]}
            class Gate:
                async def require(self, ref): return SimpleNamespace(binding=binding)
                async def unchanged(self, prepared): pass
            class App:
                gate=Gate(); state=SimpleNamespace(store=store)
                @metadata_session
                async def read(self, context_ref):
                    async def load():
                        revision, _ = await store.read('metadata-snapshot-v1',key)
                        await store.compare_and_swap('metadata-snapshot-v1',key,revision,{'status':'ready','value':newer})
                        return {'coverage':{'complete':True},'models':[{'id':'old'}]}
                    return await read_turn_metadata(source,load)
            with patch('metriccanvas_authoring.data.metadata_session._logger.log',side_effect=RuntimeError('sink down')):
                self.assertEqual(await App().read('context'),newer)

    async def test_cancellation_releases_claim_and_context(self):
        from metriccanvas_authoring.data.metadata_session import metadata_session_active
        with tempfile.TemporaryDirectory() as tmp:
            store=SqlitePlatformState(Path(tmp)/'state.db'); entered=asyncio.Event()
            binding={'turnId':'one'}; source={'url':'source'}
            class Gate:
                async def require(self, ref): return SimpleNamespace(binding=binding)
                async def unchanged(self, prepared): pass
            class App:
                gate=Gate(); state=SimpleNamespace(store=store)
                @metadata_session
                async def read(self, context_ref):
                    async def load():
                        entered.set()
                        await asyncio.Event().wait()
                    return await read_turn_metadata(source,load)
            task=asyncio.create_task(App().read('context'))
            await entered.wait(); task.cancel()
            with self.assertRaises(asyncio.CancelledError): await task
            _, value=await store.read('metadata-snapshot-v1',canonical_sha256([binding,source]))
            self.assertEqual(value['status'],'empty')
            self.assertFalse(metadata_session_active())
