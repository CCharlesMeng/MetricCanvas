from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[1]
CONTRACT_ROOT = BUNDLE_ROOT / "contracts" / "generated"
sys.path.insert(0, str(BUNDLE_ROOT))

from core.page_contract import validate_page_schema  # noqa: E402


class PageContractConformanceTest(unittest.TestCase):
    def test_accepts_every_exported_valid_page(self) -> None:
        fixture_root = CONTRACT_ROOT / "conformance" / "page-valid"
        for fixture_path in sorted(fixture_root.glob("*.json")):
            with self.subTest(fixture=fixture_path.name):
                value = json.loads(fixture_path.read_text(encoding="utf-8"))
                self.assertEqual(validate_page_schema(value), [])

    def test_matches_exported_structural_error_type_and_path(self) -> None:
        vector = json.loads(
            (
                CONTRACT_ROOT
                / "conformance"
                / "page-invalid"
                / "missing-schema-version.json"
            ).read_text(encoding="utf-8")
        )

        actual = validate_page_schema(vector["input"])

        self.assertEqual(
            {(issue.type, issue.path) for issue in actual},
            {(issue["type"], issue["path"]) for issue in vector["expected"]},
        )


if __name__ == "__main__":
    unittest.main()
