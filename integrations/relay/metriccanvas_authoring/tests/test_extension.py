"""Contract checks for the Relay-owned extension, without internal services."""
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest


EXTENSION_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = EXTENSION_ROOT.parents[2]
TOOL_ROOT = REPO_ROOT / 'metriccanvas-authoring' / 'tool'
sys.path.insert(0, str(TOOL_ROOT))
sys.path.insert(0, str(EXTENSION_ROOT / 'src'))

from fastmcp import Client  # noqa: E402
from metriccanvas_authoring.assets.lifecycle_ports import LifecycleCapabilities  # noqa: E402
from metriccanvas_authoring.bootstrap.platform import DeploymentReadinessError  # noqa: E402
from metriccanvas_relay_authoring.host import (  # noqa: E402
    ADAPTER_INTERFACE_VERSION, AdapterContractError, HostAdapters, create_relay_server,
)


class Turns:
    def current_scope(self): pass
    def current_turn(self): pass


class Store:
    def read(self): pass
    def compare_and_swap(self): pass


class Authorization:
    def authorize(self): pass


class Identities:
    def current(self): pass


class Preview:
    def prepare(self): pass


class DataContext:
    def current(self): pass


class Dqe:
    def execute(self): pass


class Lifecycle:
    capabilities = LifecycleCapabilities(single_save=True, current_read=True)
    def current_match(self): pass
    def save(self): pass


def assembled(**overrides):
    providers = dict(
        interface_version=ADAPTER_INTERFACE_VERSION,
        current_turns=Turns(), store=Store(), analysis_authorization=Authorization(),
        lifecycle_service=Lifecycle(), lifecycle_identities=Identities(),
        relay_preview=Preview(), data_context=DataContext(), dqe=Dqe(),
    )
    providers.update(overrides)
    return HostAdapters(**providers)


class RelayExtensionTest(unittest.IsolatedAsyncioTestCase):
    async def test_separately_owned_adapters_assemble_exactly_nine_tools(self):
        server = create_relay_server(assembled())
        async with Client(server) as client:
            tools = await client.list_tools()
        self.assertEqual({tool.name for tool in tools}, {
            'read_page_context', 'discover_data_context', 'query_data', 'compose_page',
            'edit_page', 'page_metadata_emit_preview', 'extract_page_parameters',
            'apply_page_parameter_selection', 'resolve_page_parameters',
        })

    async def test_missing_current_turn_provider_fails_closed_at_startup(self):
        with self.assertRaises(DeploymentReadinessError) as caught:
            create_relay_server(assembled(current_turns=None))
        self.assertIn('current_turns', {item['provider'] for item in caught.exception.report['missing']})
        self.assertEqual(caught.exception.report['currentTurn']['status'], 'not_checked')

    async def test_adapter_version_mismatch_fails_closed(self):
        with self.assertRaises(AdapterContractError) as caught:
            create_relay_server(assembled(interface_version='other'))
        self.assertEqual(caught.exception.code, 'RELAY_ADAPTER_CONTRACT_MISMATCH')

    async def test_unimplemented_relay_provider_command_fails_without_server(self):
        env = dict(os.environ)
        env['PYTHONPATH'] = os.pathsep.join([str(TOOL_ROOT), str(EXTENSION_ROOT / 'src')])
        result = subprocess.run(
            [sys.executable, '-m', 'metriccanvas_relay_authoring'], env=env,
            capture_output=True, text=True, timeout=20,
        )
        self.assertEqual(result.returncode, 2)
        self.assertEqual(json.loads(result.stderr), {
            'deploymentReady': False, 'code': 'RELAY_ADAPTERS_NOT_CONFIGURED',
        })
        self.assertEqual(result.stdout, '')
