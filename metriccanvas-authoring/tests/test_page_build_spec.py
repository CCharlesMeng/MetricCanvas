from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BUNDLE_ROOT))

from core.page_build_spec import validate_page_build_spec  # noqa: E402


class PageBuildSpecTest(unittest.TestCase):
    def test_accepts_business_semantic_fixture(self) -> None:
        fixture = json.loads(
            (BUNDLE_ROOT / "fixtures" / "page-build-spec.json").read_text(encoding="utf-8")
        )

        self.assertEqual(validate_page_build_spec(fixture), [])

    def test_rejects_algorithm_owned_fields(self) -> None:
        fixture = json.loads(
            (BUNDLE_ROOT / "fixtures" / "page-build-spec.json").read_text(encoding="utf-8")
        )
        fixture["units"][0]["query"] = {"dsl_list": []}

        issues = validate_page_build_spec(fixture)

        self.assertTrue(any(issue.code == "PAGE_BUILD_SPEC_SCHEMA_ERROR" for issue in issues))

    def test_uses_exported_intent_and_component_closed_sets(self) -> None:
        fixture = json.loads(
            (BUNDLE_ROOT / "fixtures" / "page-build-spec.json").read_text(encoding="utf-8")
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


if __name__ == "__main__":
    unittest.main()
