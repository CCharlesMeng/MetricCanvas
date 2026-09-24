from __future__ import annotations

import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str((_Path(__file__).resolve().parent / '../../examples').resolve()))

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))

from metriccanvas_authoring.data.ports import DataContextError  # noqa: E402
from metriccanvas_authoring.data.execution import DqeExecutionError  # noqa: E402
from adapter_template.environment import (  # noqa: E402
    configure_data_context,
    configure_dqe,
)


class ProductionServerConfigurationTest(unittest.IsolatedAsyncioTestCase):
    async def test_missing_data_context_configuration_is_structured(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            port = configure_data_context()

        with self.assertRaises(DataContextError) as raised:
            await port.current()
        self.assertEqual(raised.exception.code, "DATA_CONTEXT_CONFIG_ERROR")

    async def test_invalid_projection_file_does_not_prevent_tool_startup(self) -> None:
        values = {
            "METRICCANVAS_DATA_CONTEXT_DATASETS_URL_TEMPLATE": "http://x/{subjectId}",
            "METRICCANVAS_DATA_CONTEXT_DETAIL_URL_TEMPLATE": "http://x/{datasetId}",
            "METRICCANVAS_DATA_CONTEXT_SUBJECT_ID": "subject",
            "METRICCANVAS_DATA_CONTEXT_WORKSPACE_ID": "workspace",
            "METRICCANVAS_DATA_CONTEXT_APP_CODE": "app",
            "METRICCANVAS_DATA_CONTEXT_PROJECTION_CONFIG": "/missing/config.json",
        }
        with patch.dict(os.environ, values, clear=True):
            port = configure_data_context()

        with self.assertRaises(DataContextError) as raised:
            await port.current()
        self.assertEqual(raised.exception.code, "DATA_CONTEXT_CONFIG_ERROR")

    async def test_missing_dqe_configuration_keeps_stable_generation_code(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            port = configure_dqe()

        with self.assertRaises(DqeExecutionError) as raised:
            await port.execute({})
        self.assertEqual(raised.exception.code, "DQE_CONFIG_ERROR")

    async def test_default_and_relay_servers_never_expose_legacy_save_tool(self):
        from fastmcp import Client
        from metriccanvas_authoring.bootstrap.compatibility import create_production_server
        for config in ({}, {'METRICCANVAS_TOOL_SURFACE': 'relay'}):
            with patch.dict(os.environ, config, clear=True):
                async with Client(create_production_server()) as client:
                    self.assertEqual({t.name for t in await client.list_tools()},
                                     {'discover_data_context', 'compose_page'})

    def test_explicit_old_save_surface_is_rejected(self):
        from metriccanvas_authoring.bootstrap.compatibility import create_production_server
        with patch.dict(os.environ, {'METRICCANVAS_TOOL_SURFACE': 'compatibility'}, clear=True):
            with self.assertRaisesRegex(RuntimeError, 'legacy save surface retired'):
                create_production_server()


if __name__ == "__main__":
    unittest.main()
