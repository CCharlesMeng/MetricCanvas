from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))

from metriccanvas_authoring.domain.page_build_spec import (  # noqa: E402
    validate_page_build_spec,
)


class PageBuildSpecTest(unittest.TestCase):
    def test_accepts_business_semantic_fixture(self) -> None:
        fixture = json.loads(
            (BUNDLE_ROOT / "test-harness" / "fixtures" / "page-build-spec.json").read_text(
                encoding="utf-8"
            )
        )

        self.assertEqual(validate_page_build_spec(fixture), [])

    def test_rejects_algorithm_owned_fields(self) -> None:
        fixture = json.loads(
            (BUNDLE_ROOT / "test-harness" / "fixtures" / "page-build-spec.json").read_text(
                encoding="utf-8"
            )
        )
        fixture["units"][0]["query"] = {"dsl_list": []}

        issues = validate_page_build_spec(fixture)

        self.assertTrue(any(issue.code == "PAGE_BUILD_SPEC_SCHEMA_ERROR" for issue in issues))

    def test_uses_exported_intent_and_component_closed_sets(self) -> None:
        fixture = json.loads(
            (BUNDLE_ROOT / "test-harness" / "fixtures" / "page-build-spec.json").read_text(
                encoding="utf-8"
            )
        )
        fixture["units"][0]["intent"] = "invented"
        fixture["units"][0]["pinnedComponent"] = "inventedChart"

        issues = validate_page_build_spec(fixture)

        self.assertEqual(
            {(issue.code, issue.path) for issue in issues},
            {
                ("PAGE_BUILD_SPEC_CLOSED_SET_ERROR", "/units/0/intent"),
                ("PAGE_BUILD_SPEC_CLOSED_SET_ERROR", "/units/0/pinnedComponent"),
            },
        )
        by_path = {issue.path: issue for issue in issues}
        self.assertIn("comparison", by_path["/units/0/intent"].candidates)
        self.assertIn(
            "barChart",
            by_path["/units/0/pinnedComponent"].candidates,
        )

    def test_requires_discovery_version_and_page_safe_stable_unit_id(self) -> None:
        fixture = json.loads(
            (BUNDLE_ROOT / "test-harness" / "fixtures" / "page-build-spec.json").read_text(
                encoding="utf-8"
            )
        )
        del fixture["dataContextVersion"]
        fixture["units"][0]["dataSourceId"] = "Result_1"

        issues = validate_page_build_spec(fixture)

        self.assertEqual(
            {issue.path for issue in issues},
            {"", "/units/0/dataSourceId"},
        )

    def test_accepts_stable_unit_ids_and_rejects_duplicates(self) -> None:
        fixture = json.loads(
            (BUNDLE_ROOT / "test-harness" / "fixtures" / "page-build-spec.json").read_text(
                encoding="utf-8"
            )
        )
        second = json.loads(json.dumps(fixture["units"][0]))
        fixture["units"][0]["dataSourceId"] = "result-4"
        second["dataSourceId"] = "result-4"
        fixture["units"].append(second)

        issues = validate_page_build_spec(fixture)

        self.assertEqual(
            {(issue.code, issue.path) for issue in issues},
            {("PAGE_BUILD_SPEC_DUPLICATE_UNIT_ID", "/units/1/dataSourceId")},
        )


if __name__ == "__main__":
    unittest.main()
