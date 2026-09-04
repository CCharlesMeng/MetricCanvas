from __future__ import annotations

import itertools
import json
import sys
import unittest
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))

from metriccanvas_authoring.domain.section_layout import (  # noqa: E402
    SECTION_COLUMN_COUNT,
    pack_section_spans,
)


class SectionLayoutParityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        catalog = json.loads(
            (
                BUNDLE_ROOT
                / "contract-snapshot"
                / "page"
                / "component-catalog.json"
            ).read_text(encoding="utf-8")
        )
        cls.default_spans = {
            entry["type"]: entry["defaultSpan"] for entry in catalog
        }

    def spans_of(self, component_types: tuple[str, ...]) -> list[int]:
        return pack_section_spans(
            [self.default_spans[name] for name in component_types]
        )

    def test_known_dashboard_recipes_preserve_ratios_and_fill_rows(self) -> None:
        cases = (
            (("metricCard",), [12]),
            (("metricCard", "metricCard"), [6, 6]),
            (("metricCard", "metricCard", "metricCard"), [4, 4, 4]),
            (("metricCard", "barChart"), [4, 8]),
            (("lineChart", "pieChart"), [8, 4]),
            (("metricCard", "metricCard", "barChart"), [3, 3, 6]),
            (("lineChart", "lineChart"), [12, 12]),
        )
        for component_types, expected in cases:
            with self.subTest(component_types=component_types):
                self.assertEqual(self.spans_of(component_types), expected)

    def test_every_supported_sequence_fills_each_visual_row(self) -> None:
        component_types = (
            "metricCard",
            "lineChart",
            "barChart",
            "pieChart",
            "table",
            "gauge",
            "keyValuePanel",
            "categoryBreakdown",
            "rankingCard",
            "rankingDetailCard",
        )
        for length in range(1, 5):
            for sequence in itertools.product(component_types, repeat=length):
                ratios = [self.default_spans[name] for name in sequence]
                spans = pack_section_spans(ratios)
                self.assertEqual(len(spans), len(ratios))
                row_start = 0
                filled = 0
                for index, ratio in enumerate(ratios):
                    if index > row_start and filled + ratio > SECTION_COLUMN_COUNT:
                        self.assertEqual(
                            sum(spans[row_start:index]), SECTION_COLUMN_COUNT
                        )
                        row_start = index
                        filled = 0
                    filled += ratio
                self.assertEqual(sum(spans[row_start:]), SECTION_COLUMN_COUNT)
                self.assertTrue(
                    all(1 <= span <= SECTION_COLUMN_COUNT for span in spans)
                )

    def test_controlled_column_tracks_only_change_integer_allocation(self) -> None:
        self.assertEqual(pack_section_spans([4, 4, 3], 3), [1, 1, 1])
        self.assertEqual(pack_section_spans([4], 3), [3])


if __name__ == "__main__":
    unittest.main()
