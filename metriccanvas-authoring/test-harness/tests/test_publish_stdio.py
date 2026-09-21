import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from fastmcp import Client
from fastmcp.client.transports import StdioTransport
ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'tool'), str(ROOT / 'test-harness')]
from publish_stdio_server import Programs, Identities, PublicationSources, PublicationProvider, HumanEvents, prepare_request, context
from metriccanvas_authoring.application.publish_ports import PublicationDependencies
from metriccanvas_authoring.entrypoints.compat.lifecycle_mcp import create_lifecycle_mcp_server

NAMES = {'save_draft', 'get_save_result', 'read_revision', 'list_revisions', 'prepare_candidate',
         'read_candidate', 'revise_candidate', 'confirm_publish', 'get_publish_operation_result'}


def assert_model_safe(test, result):
    value = json.dumps(result.structured_content)
    text = ' '.join(c.text for c in result.content if c.type == 'text')
    for forbidden in ['dataSources', 'private-', 'authenticated-human-proof', 'secret-token', 'proof']:
        test.assertNotIn(forbidden, value); test.assertNotIn(forbidden, text)


class PublishStdioTest(unittest.IsolatedAsyncioTestCase):
    async def test_public_mcp_correction_requires_new_human_confirmation(self):
        programs, identities, humans = Programs(), Identities(), HumanEvents()
        provider = PublicationProvider(humans)
        programs.inputs['prepare-token'] = prepare_request()
        server = create_lifecycle_mcp_server(PublicationSources(), programs, identities,
            publication=PublicationDependencies(provider, humans))
        async with Client(server) as client:
            self.assertEqual({t.name for t in await client.list_tools()}, NAMES)
            prepared = await client.call_tool('prepare_candidate', {'request_token': 'prepare-token'})
            self.assertEqual(prepared.data['status'], 'completed', prepared.data)
            old = provider.candidates['v1']; old_proof_token = humans.simulate_human_action(old)
            programs.inputs['revise-token'] = {'kind': 'revise', 'context': context('revise-1'), 'ref': old['ref'],
                'corrections': {'retainDimensionValues': False, 'parameterSelections': [{'parameterId': 'segment', 'selected': False}]}}
            revised = await client.call_tool('revise_candidate', {'request_token': 'revise-token'})
            self.assertEqual(revised.data['status'], 'completed', revised.data)
            value = provider.candidates['v2']
            programs.inputs['read-token'] = {'kind': 'read', 'ref': value['ref']}
            read = await client.call_tool('read_candidate', {'request_token': 'read-token'})
            self.assertEqual(read.data['status'], 'read')
            programs.inputs['publish-token'] = {'kind': 'publish', 'context': context('publish-1'), 'ref': value['ref'], 'confirmationToken': old_proof_token}
            stale = await client.call_tool('confirm_publish', {'request_token': 'publish-token'})
            self.assertEqual(stale.data['code'], 'CANDIDATE_CHANGED'); self.assertFalse(provider.templates)
            programs.inputs['publish-token'] = {'kind': 'publish', 'context': context('publish-2'),
                'ref': value['ref'], 'confirmationToken': humans.simulate_human_action(value)}
            published = await client.call_tool('confirm_publish', {'request_token': 'publish-token'})
            self.assertEqual(published.data['status'], 'completed', published.data)
            repeated = await client.call_tool('get_publish_operation_result', {'request_token': 'publish-token'})
            self.assertEqual(published.data['template'], repeated.data['template'])
            self.assertEqual(provider.writes['publish'], 1)
            for result in [prepared, revised, read, stale, published, repeated]: assert_model_safe(self, result)
    async def test_real_stdio_nine_tools_and_independent_human_boundary(self):
        env = {'S4_LIFECYCLE_INSTALLED_ROOT': os.environ['S4_LIFECYCLE_INSTALLED_ROOT']} if os.environ.get('S4_LIFECYCLE_INSTALLED_ROOT') else {}
        transport = StdioTransport(command=sys.executable, args=[str(ROOT / 'test-harness/publish_stdio_server.py')], env=env)
        async with Client(transport) as client:
            tools = await client.list_tools(); self.assertEqual({t.name for t in tools}, NAMES)
            for tool in tools: self.assertEqual(set(tool.inputSchema['properties']), {'request_token'})
            refused = await client.call_tool('confirm_publish', {'request_token': 'publish-unconfirmed-token'})
            self.assertEqual(refused.data['code'], 'CONFIRMATION_REQUIRED', refused.data)
            result = await client.call_tool('confirm_publish', {'request_token': 'publish-request-token'})
            self.assertEqual(result.data['status'], 'completed', result.data)
            repeat = await client.call_tool('get_publish_operation_result', {'request_token': 'publish-request-token'})
            self.assertEqual(repeat.data['template'], result.data['template'])
            injected = await client.call_tool('confirm_publish', {'request_token': 'publish-request-token', 'proof': True}, raise_on_error=False)
            self.assertTrue(injected.is_error)
            assert_model_safe(self, result); assert_model_safe(self, repeat)
    async def test_production_stdio_registers_nine_with_unavailable_publication(self):
        with tempfile.TemporaryDirectory() as directory:
            installed = os.environ.get('S4_LIFECYCLE_INSTALLED_ROOT')
            env = {'PYTHONPATH': installed or str(ROOT / 'tool'), 'METRICCANVAS_TOOL_SURFACE': 'invalid-unused'}
            args = [str(Path(installed) / 'bin/metriccanvas-lifecycle')] if installed else ['-m', 'metriccanvas_authoring.entrypoints.compat.lifecycle_server']
            async with Client(StdioTransport(command=sys.executable, args=args, env=env, cwd=directory)) as client:
                self.assertEqual({t.name for t in await client.list_tools()}, NAMES)
                for name in NAMES - {'save_draft', 'get_save_result', 'read_revision', 'list_revisions'}:
                    result = await client.call_tool(name, {'request_token': 'unconfigured-request-token'})
                    self.assertEqual(result.data['code'], 'CAPABILITY_UNAVAILABLE')
                    assert_model_safe(self, result)
