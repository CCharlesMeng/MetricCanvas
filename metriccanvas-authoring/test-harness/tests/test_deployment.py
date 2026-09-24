"""Public deployment contract: one entrypoint, exact providers, no mock fallback."""
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch
from types import SimpleNamespace

BUNDLE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BUNDLE / 'tool'))
from fastmcp import Client
from metriccanvas_authoring.assets.lifecycle_ports import LifecycleCapabilities
from metriccanvas_authoring.bootstrap.adapter_contract import ADAPTER_INTERFACE_VERSION, AdapterContractError, AuthoringAdapters
from metriccanvas_authoring.bootstrap.deployment import assemble, load_adapters, prepare
from metriccanvas_authoring.bootstrap.platform import DeploymentReadinessError, create_production_platform_server


async def unused(*args):
    raise AssertionError('Assembly must not access live data')


def assembled(**overrides):
    values = dict(interface_version=ADAPTER_INTERFACE_VERSION,
        current_turns=SimpleNamespace(current_scope=unused, current_turn=unused),
        store=SimpleNamespace(read=unused, compare_and_swap=unused),
        analysis_authorization=SimpleNamespace(authorize=unused),
        lifecycle_service=SimpleNamespace(current_match=unused, save=unused,
            capabilities=LifecycleCapabilities(single_save=True, current_read=True)),
        lifecycle_identities=SimpleNamespace(current=unused),
        relay_preview=SimpleNamespace(prepare=unused),
        data_context=SimpleNamespace(current=unused), dqe=SimpleNamespace(execute=unused))
    values.update(overrides)
    return AuthoringAdapters(**values)


class DeploymentTest(unittest.IsolatedAsyncioTestCase):
    async def test_production_loads_company_factory_and_exposes_nine_tools(self):
        with patch('metriccanvas_authoring.bootstrap.deployment.importlib.import_module',
                   return_value=SimpleNamespace(create_adapters=lambda: assembled())) as loader:
            server = create_production_platform_server()
        async with Client(server) as client:
            names = {tool.name for tool in await client.list_tools()}
        loader.assert_called_once_with('metriccanvas_authoring.adapters.factory')
        self.assertEqual(names, {'read_page_context','discover_data_context','query_data',
            'compose_page','edit_page','page_metadata_emit_preview','extract_page_parameters',
            'apply_page_parameter_selection','resolve_page_parameters'})

    def test_discovery_never_loads_internal_factory(self):
        with patch('metriccanvas_authoring.bootstrap.deployment.importlib.import_module', side_effect=AssertionError):
            self.assertIsNotNone(create_production_platform_server(protocol_discovery=True))

    def test_missing_provider_and_bad_version_fail_closed(self):
        with self.assertRaises(DeploymentReadinessError) as caught:
            assemble(assembled(current_turns=None))
        self.assertIn('current_turns', [row['provider'] for row in caught.exception.report['missing']])
        with self.assertRaisesRegex(AdapterContractError, 'ADAPTER_CONTRACT_MISMATCH'):
            assemble(assembled(interface_version='other'))

    def test_custom_semantic_capability_is_explicit(self):
        catalog = SimpleNamespace(discover=unused, query_issues=unused)
        values = assembled(semantic_catalog=catalog)
        _, _, report = prepare(values)
        self.assertEqual(report['semanticCatalog'], 'assembled')
        with patch('metriccanvas_authoring.bootstrap.deployment.create_platform_server') as create:
            assemble(values)
        self.assertIs(create.call_args.kwargs['semantic_catalog'], catalog)
        with self.assertRaisesRegex(AdapterContractError, 'SEMANTIC_CATALOG_CONTRACT_MISMATCH'):
            prepare(assembled(semantic_catalog=object()))

    def test_factory_errors_are_sanitized(self):
        with patch('metriccanvas_authoring.bootstrap.deployment.importlib.import_module', side_effect=RuntimeError('secret')):
            with self.assertRaisesRegex(AdapterContractError, '^ADAPTER_LOAD_FAILED$'):
                load_adapters()

    def test_initial_template_refuses_to_start(self):
        # Test the public template, not a potentially modified internal factory.
        sys.path.insert(0, str(BUNDLE / 'examples'))
        from adapter_template.factory import create_adapters
        with self.assertRaisesRegex(AdapterContractError, 'ADAPTERS_NOT_CONFIGURED'):
            create_adapters()

    def test_no_public_interface_is_owned_by_internal_tree(self):
        for name in ('data', 'assets', 'work', 'delivery', 'pages'):
            for path in (BUNDLE/'tool/metriccanvas_authoring'/name).rglob('*.py'):
                self.assertNotIn('metriccanvas_authoring.adapters', path.read_text(), str(path))
