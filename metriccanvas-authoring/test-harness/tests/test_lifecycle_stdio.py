import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from fastmcp import Client
from fastmcp.client.transports import StdioTransport
ROOT=Path(__file__).resolve().parents[2]
sys.path[:0]=[str(ROOT/'tool'),str(ROOT/'test-harness')]
from lifecycle_stdio_server import save_command


class LifecycleStdioTest(unittest.IsolatedAsyncioTestCase):
    async def test_public_stdio_success_and_program_only_documents(self):
        env={'S4_LIFECYCLE_INSTALLED_ROOT':os.environ['S4_LIFECYCLE_INSTALLED_ROOT']} if os.environ.get('S4_LIFECYCLE_INSTALLED_ROOT') else {}
        transport=StdioTransport(command=sys.executable,args=[str(ROOT/'test-harness/lifecycle_stdio_server.py')],env=env)
        async with Client(transport) as client:
            tools=await client.list_tools()
            self.assertEqual({t.name for t in tools},{'save_draft','get_save_result','read_revision','list_revisions','prepare_candidate','read_candidate','revise_candidate','confirm_publish','get_publish_operation_result'})
            for tool in tools:
                self.assertEqual(set(tool.inputSchema['properties']),{'request_token'})
            saved=await client.call_tool('save_draft',{'request_token':'save-request-token'})
            self.assertEqual(saved.data['status'],'saved')
            for name,token in [('get_save_result','save-request-token'),('read_revision','read-request-token'),('list_revisions','history-request-token')]:
                result=await client.call_tool(name,{'request_token':token})
                self.assertIn(result.data['status'],{'saved','read','history'})
                self.assertNotIn('private',json.dumps(result.structured_content))
                self.assertNotIn('dataSources',json.dumps(result.structured_content))
                self.assertNotIn('secret-token',json.dumps(result.structured_content))
                self.assertNotIn('private',' '.join(x.text for x in result.content if x.type=='text'))
            injected=await client.call_tool('save_draft',{'request_token':'save-request-token','document':{},'actorId':'actor-b'},raise_on_error=False)
            self.assertTrue(injected.is_error)
    async def test_production_stdio_starts_without_content_or_service_and_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            request=root/'production-token.json'
            request.write_text(json.dumps({'actorId':'actor-a','workspaceId':'workspace-a','request':save_command()})); request.chmod(0o600)
            installed=os.environ.get('S4_LIFECYCLE_INSTALLED_ROOT')
            env={'PYTHONPATH':installed or str(ROOT/'tool'),'METRICCANVAS_OPERATOR_ID':'actor-a','METRICCANVAS_WORKSPACE_ID':'workspace-a','METRICCANVAS_AUTH_TOKEN':'secret-token','METRICCANVAS_LIFECYCLE_INPUTS_DIR':directory,'METRICCANVAS_LIFECYCLE_OUTPUTS_DIR':directory}
            # Invalid compatibility/content settings must never be initialized.
            env['METRICCANVAS_TOOL_SURFACE']='invalid-unused'
            args=[str(Path(installed)/'bin/metriccanvas-lifecycle')] if installed else ['-m','metriccanvas_authoring.lifecycle_server']
            transport=StdioTransport(command=sys.executable,args=args,env=env,cwd=directory)
            async with Client(transport) as client:
                self.assertEqual(len(await client.list_tools()),9)
                result=await client.call_tool('save_draft',{'request_token':'production-token'})
                self.assertEqual(result.data['code'],'CAPABILITY_UNAVAILABLE')
                result=await client.call_tool('get_save_result',{'request_token':'production-token'})
                self.assertEqual(result.data['code'],'CAPABILITY_UNAVAILABLE')
