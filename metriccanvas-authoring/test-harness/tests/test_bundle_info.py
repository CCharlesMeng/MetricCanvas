from __future__ import annotations

import sys
import unittest
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))

from metriccanvas_authoring.application.bundle_info import load_bundle_info  # noqa: E402


class BundleInfoTest(unittest.TestCase):
    def test_reports_locked_bundle_and_page_contract(self) -> None:
        info = load_bundle_info()

        self.assertEqual(info["bundleVersion"], "0.1.0")
        self.assertRegex(str(info["pageSchemaVersion"]), r"^\d+\.\d+$")
        self.assertEqual(info["productContractVersion"], "0.1.0")
        self.assertEqual(info["authoringContractVersion"], "0.1.0")
        self.assertEqual(info["transport"], "stdio")


if __name__ == "__main__":
    unittest.main()
