from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))
sys.path.insert(0, str(BUNDLE_ROOT / "test-harness"))

from adapters.fakes import FakeDataContextPort  # noqa: E402
from metriccanvas_authoring.application.discover_data_context import (  # noqa: E402
    DiscoverDataContextCommand,
    DiscoverDataContextDependencies,
    create_discover_data_context,
)


def fixture(name: str) -> dict[str, object]:
    return json.loads(
        (BUNDLE_ROOT / "test-harness" / "fixtures" / name).read_text(
            encoding="utf-8"
        )
    )


class DiscoverDataContextHarnessTest(unittest.IsolatedAsyncioTestCase):
    async def test_alias_query_returns_the_canonical_field_match(self) -> None:
        data_context = FakeDataContextPort(fixture("data-context.json"))
        discover = create_discover_data_context(
            DiscoverDataContextDependencies(data_context=data_context)
        )

        result = await discover(DiscoverDataContextCommand(query="大区"))

        self.assertTrue(result.ok)
        self.assertEqual(result.data_context_version, "2026-09-02.1")
        self.assertEqual(data_context.calls, 1)
        self.assertEqual(len(result.matches), 1)
        self.assertEqual(
            result.matches[0],
            {
                "kind": "field",
                "environmentId": "dqe-primary",
                "schemaId": "operations-analytics",
                "objectId": "operations-surface",
                "field": {
                    "name": "区域",
                    "type": "string",
                    "description": "业务归属区域。取值域:华东、华南。",
                    "aliases": ["大区"],
                    "roleHints": ["dimension"],
                    "nullable": False,
                    "sensitive": False,
                },
            },
        )

    async def test_sensitive_field_is_discoverable_without_its_value_domain(self) -> None:
        snapshot = fixture("data-context.json")
        field = snapshot["executionEnvironments"][0]["schemas"][0]["objects"][0][
            "fields"
        ][0]
        field["sensitive"] = True
        data_context = FakeDataContextPort(snapshot)
        discover = create_discover_data_context(
            DiscoverDataContextDependencies(data_context=data_context)
        )

        alias_result = await discover(DiscoverDataContextCommand(query="大区"))
        secret_result = await discover(DiscoverDataContextCommand(query="华东"))

        self.assertTrue(alias_result.ok)
        self.assertEqual(len(alias_result.matches), 1)
        returned_field = alias_result.matches[0]["field"]
        self.assertTrue(returned_field["sensitive"])
        self.assertEqual(
            returned_field["description"],
            "业务归属区域。取值域:(敏感,已隐去)。",
        )
        self.assertEqual(secret_result.matches, ())
        self.assertEqual(data_context.calls, 2)


if __name__ == "__main__":
    unittest.main()
