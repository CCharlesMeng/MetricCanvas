from __future__ import annotations

import json
import tomllib
import unittest
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
TOOL_ROOT = BUNDLE_ROOT / "tool"
PYPROJECT = TOOL_ROOT / "pyproject.toml"
RELAY_CONFIG = (
    BUNDLE_ROOT / "relay" / "mcp_configs" / "metriccanvas-authoring.json"
)


class DistributionContractTest(unittest.TestCase):
    def test_distribution_exposes_pinned_stdio_cli(self) -> None:
        project = tomllib.loads(PYPROJECT.read_text(encoding="utf-8"))

        self.assertEqual(project["project"]["version"], "0.2.0")
        self.assertEqual(
            project["project"]["scripts"]["metriccanvas-authoring"],
            "metriccanvas_authoring.server:main",
        )
        requirements = {
            line
            for line in (TOOL_ROOT / "requirements.in").read_text(
                encoding="utf-8"
            ).splitlines()
            if line and not line.startswith("#")
        }
        self.assertEqual(set(project["project"]["dependencies"]), requirements)

    def test_sdist_embeds_all_runtime_contracts_for_wheel_build(self) -> None:
        project = tomllib.loads(PYPROJECT.read_text(encoding="utf-8"))
        expected = {
            "metriccanvas_authoring/_bundle/bundle.json",
            "metriccanvas_authoring/_bundle/contract-lock.json",
            "metriccanvas_authoring/_bundle/contracts/authored/page-build-spec.schema.json",
            "metriccanvas_authoring/_bundle/contracts/exported/analysis-intents.json",
            "metriccanvas_authoring/_bundle/contract-snapshot/data-context/schema.json",
            "metriccanvas_authoring/_bundle/contract-snapshot/page/component-catalog.json",
            "metriccanvas_authoring/_bundle/contract-snapshot/page/schema.json",
        }
        force_include = project["tool"]["hatch"]["build"]["targets"]["sdist"][
            "force-include"
        ]
        self.assertEqual(set(force_include.values()), expected)

    def test_relay_config_uses_sdist_cli_and_relay_surface(self) -> None:
        config = json.loads(RELAY_CONFIG.read_text(encoding="utf-8"))
        server = config["mcpServers"]["metriccanvas-authoring"]

        self.assertEqual(server["command"], "uvx")
        self.assertEqual(server["args"][-1], "metriccanvas-authoring")
        self.assertTrue(str(server["args"][1]).endswith(".tar.gz>"))
        self.assertEqual(server["env"]["METRICCANVAS_TOOL_SURFACE"], "relay")
        self.assertIn("METRICCANVAS_OPERATOR_ID", server["env"])
        self.assertIn("METRICCANVAS_AUTH_TOKEN", server["env"])


if __name__ == "__main__":
    unittest.main()
