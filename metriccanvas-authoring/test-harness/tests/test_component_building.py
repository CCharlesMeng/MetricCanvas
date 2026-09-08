from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

BUNDLE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))
from metriccanvas_authoring.domain.page_building import (  # noqa: E402
    ExecutableUnit, UnitScope, PageBuildingIssue, _component_for,
)
from metriccanvas_authoring.domain.execution import DqeExecutionResult  # noqa: E402


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
                        built = _component_for(unit, execution, 0)
                        self.assertEqual(built["type"], case["type"])
                        self.assertEqual(built["props"], case["expectedProps"])
                    else:
                        with self.assertRaises(PageBuildingIssue):
                            _component_for(unit, execution, 0)
