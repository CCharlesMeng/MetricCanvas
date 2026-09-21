from __future__ import annotations

import sys
import unittest
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))

from metriccanvas_authoring.pages.components import capabilities  # noqa: E402
from metriccanvas_authoring.pages.components.capabilities import (  # noqa: E402
    ASSEMBLED_COMPONENT_TYPES,
    AUTHORING_CAPABILITIES,
    AuthoringCapability,
    DATA_COMPONENTS,
    renderable_component_types,
)
from metriccanvas_authoring.pages.components.component_editing import (  # noqa: E402
    PROPERTY_WHITELIST,
)


class ComponentCapabilityRelationTest(unittest.TestCase):
    """可渲染、可自动构造、允许编辑是三种能力；后两者必须落在可渲染之内。"""

    def test_every_renderable_component_declares_authoring_capabilities(self) -> None:
        self.assertEqual(renderable_component_types(), frozenset(AUTHORING_CAPABILITIES))

    def test_assembled_and_editable_stay_inside_renderable(self) -> None:
        renderable = renderable_component_types()
        self.assertTrue(ASSEMBLED_COMPONENT_TYPES <= renderable)
        self.assertTrue(frozenset(DATA_COMPONENTS) <= renderable)

    def test_property_whitelist_only_covers_renderable_components(self) -> None:
        self.assertTrue(frozenset(PROPERTY_WHITELIST) <= renderable_component_types())

    def test_three_capabilities_are_not_collapsed_into_one_list(self) -> None:
        renderable = renderable_component_types()
        self.assertNotEqual(ASSEMBLED_COMPONENT_TYPES, renderable)
        self.assertLess(len(DATA_COMPONENTS), len(renderable))

    def test_new_product_component_without_authoring_capability_fails(self) -> None:
        original = capabilities.AUTHORING_CAPABILITIES
        capabilities.AUTHORING_CAPABILITIES = {
            name: capability
            for name, capability in original.items()
            if name != "metricCard"
        }
        try:
            with self.assertRaises(AssertionError) as caught:
                capabilities._check_capability_coverage()
        finally:
            capabilities.AUTHORING_CAPABILITIES = original
        self.assertIn("metricCard", str(caught.exception))

    def test_capability_declared_outside_product_catalog_fails(self) -> None:
        original = capabilities.AUTHORING_CAPABILITIES
        capabilities.AUTHORING_CAPABILITIES = {
            **original,
            "notARenderableComponent": AuthoringCapability(
                assembled=False, data_editable=False
            ),
        }
        try:
            with self.assertRaises(AssertionError) as caught:
                capabilities._check_capability_coverage()
        finally:
            capabilities.AUTHORING_CAPABILITIES = original
        self.assertIn("notARenderableComponent", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
