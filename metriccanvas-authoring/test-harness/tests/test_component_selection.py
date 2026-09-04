from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from typing import Any


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))

from metriccanvas_authoring.domain.component_selection import (  # noqa: E402
    recommend_components,
)


def fields_of(
    *,
    dimensions: int = 1,
    measures: int = 1,
    has_time: bool = False,
) -> dict[str, dict[str, Any]]:
    fields: dict[str, dict[str, Any]] = {}
    for index in range(dimensions):
        fields[f"dimension-{index + 1}"] = {
            "role": "dimension",
            "type": "date" if has_time and index == 0 else "string",
        }
    for index in range(measures):
        fields[f"measure-{index + 1}"] = {
            "role": "measure",
            "type": "number",
        }
    return fields


def candidate_of(candidates, component_type: str):
    return next(
        candidate
        for candidate in candidates
        if candidate.component_type == component_type
    )


class ComponentSelectionParityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.catalog = json.loads(
            (
                BUNDLE_ROOT
                / "contract-snapshot"
                / "page"
                / "component-catalog.json"
            ).read_text(encoding="utf-8")
        )

    def test_candidate_surface_is_the_full_component_catalog(self) -> None:
        candidates = recommend_components(
            fields_of(), row_count=10, intent=None, pinned=None
        )

        self.assertEqual(len(candidates), len(self.catalog))
        self.assertEqual(
            {candidate.component_type for candidate in candidates},
            {entry["type"] for entry in self.catalog},
        )
        spans = {entry["type"]: entry["defaultSpan"] for entry in self.catalog}
        for candidate in candidates:
            self.assertEqual(
                candidate.default_span,
                spans[candidate.component_type],
            )
            self.assertEqual(candidate.ok, not candidate.reasons)
            if not candidate.ok:
                self.assertFalse(candidate.recommended)

    def test_hard_gate_rejections_match_the_typescript_behavior_table(self) -> None:
        cases = (
            ("barChart", fields_of(dimensions=0, measures=2), 1, "0 个维度字段"),
            ("barChart", fields_of(dimensions=3, measures=2), 100, "3 个维度字段"),
            ("lineChart", fields_of(dimensions=2, has_time=True), 10, "2 个维度字段"),
            ("lineChart", fields_of(measures=0), 10, "0 个度量字段"),
            ("pieChart", fields_of(measures=2), 10, "2 个度量字段"),
            ("rankingCard", fields_of(measures=3), 10, "3 个度量字段"),
            (
                "rankingDetailCard",
                fields_of(dimensions=4, measures=2),
                10,
                "4 个维度字段",
            ),
            ("metricCard", fields_of(), 1, "1 个维度字段"),
            ("metricCard", fields_of(dimensions=0), 12, "12 行"),
            ("metricCard", fields_of(dimensions=0), None, "行数未经真实执行证明"),
            ("mapChart", fields_of(), 10, "不得从样例值推断"),
            ("table", fields_of(dimensions=0, measures=0), 10, "不含任何 dimension/measure"),
            ("reportHeader", fields_of(), 10, "不消费页面数据源"),
            ("text", fields_of(), 10, "不消费页面数据源"),
            ("aiSummary", fields_of(), 10, "不消费页面数据源"),
            ("compositeCard", fields_of(dimensions=0, measures=2), 1, "不消费页面数据源"),
        )
        for component_type, fields, row_count, reason in cases:
            with self.subTest(component_type=component_type, reason=reason):
                candidate = candidate_of(
                    recommend_components(
                        fields,
                        row_count=row_count,
                        intent=None,
                        pinned=None,
                    ),
                    component_type,
                )
                self.assertFalse(candidate.ok)
                self.assertFalse(candidate.recommended)
                self.assertIn(reason, "；".join(candidate.reasons))

    def test_intent_sorting_and_pin_never_relax_the_hard_gate(self) -> None:
        trend_fields = fields_of(has_time=True)
        for intent, expected in (
            ("trend", "lineChart"),
            ("comparison", "barChart"),
            ("ranking", "rankingCard"),
        ):
            with self.subTest(intent=intent):
                first = recommend_components(
                    trend_fields,
                    row_count=6,
                    intent=intent,
                    pinned=None,
                )[0]
                self.assertEqual(first.component_type, expected)
                self.assertTrue(first.ok)
                self.assertTrue(first.recommended)

        pinned = recommend_components(
            trend_fields,
            row_count=6,
            intent="trend",
            pinned="barChart",
        )
        self.assertTrue(candidate_of(pinned, "barChart").recommended)
        self.assertFalse(candidate_of(pinned, "lineChart").recommended)

        rejected_pin = recommend_components(
            trend_fields,
            row_count=6,
            intent="trend",
            pinned="mapChart",
        )
        self.assertFalse(candidate_of(rejected_pin, "mapChart").ok)
        self.assertFalse(any(candidate.recommended for candidate in rejected_pin))


if __name__ == "__main__":
    unittest.main()
