from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

BUNDLE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))
from metriccanvas_authoring.build_issues import PageBuildingIssue  # noqa: E402
from metriccanvas_authoring.data.executable_units import ExecutableUnit, UnitScope  # noqa: E402
from metriccanvas_authoring.pages.composition.page_building import (  # noqa: E402
    build_data_component,
)
from metriccanvas_authoring.data.execution import DqeExecutionResult  # noqa: E402
from metriccanvas_authoring.domain.page_validation import validate_page_document  # noqa: E402


class ComponentBuildingConformanceTest(unittest.TestCase):
    """Fixed expectations shared with the browser; neither implementation writes them."""

    def test_shared_component_vectors(self) -> None:
        vectors = json.loads((BUNDLE_ROOT / "test-harness/fixtures/component-building.json").read_text())
        self.assertEqual(len({case["type"] for case in vectors["accepted"]}), 10)
        for accepted in (True, False):
            for case in vectors["accepted" if accepted else "rejected"]:
                with self.subTest(component=case["type"], accepted=accepted):
                    unit = ExecutableUnit(
                        data_source_id="result", title=case.get("title"),
                        fields=case["fields"], query_body={}, intent="detail",
                        pinned_component=case["type"],
                        scope=UnitScope("example", (), "", "", ()), formula_traces=(),
                    )
                    execution = DqeExecutionResult(rows=case["rows"], total_count=case.get("totalCount"))
                    if accepted:
                        built = build_data_component(unit, execution, 0)
                        self.assertEqual(built["type"], case["type"])
                        self.assertEqual(built["props"], case["expectedProps"])
                        for layout in ("report", "dashboard"):
                            page = {
                                "schemaVersion": "6.1", "layout": layout,
                                "id": "component-building",
                                "dataSources": {"result": {
                                    "fields": {
                                        key: {k: v for k, v in field.items() if k != "queryField"}
                                        for key, field in case["fields"].items()
                                    },
                                    "source": {"type": "inline", "rows": case["rows"]},
                                }},
                                "sections": [{"id": "main", "components": [built]}],
                            }
                            self.assertEqual(validate_page_document(page), [], layout)
                    else:
                        with self.assertRaises(PageBuildingIssue):
                            build_data_component(unit, execution, 0)
