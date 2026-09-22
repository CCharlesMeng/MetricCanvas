from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))

from metriccanvas_authoring.bundle_info import load_bundle_info  # noqa: E402


class BundleInfoTest(unittest.TestCase):
    def test_reports_locked_bundle_and_page_contract(self) -> None:
        info = load_bundle_info()

        self.assertEqual(info["bundleVersion"], "0.3.0")
        self.assertRegex(str(info["pageSchemaVersion"]), r"^\d+\.\d+$")
        lock = json.loads((BUNDLE_ROOT / "contract-lock.json").read_text(encoding="utf-8"))
        self.assertEqual(info["productContractVersion"], lock["productContractVersion"])
        self.assertEqual(info["authoringContractVersion"], "0.3.0")
        self.assertEqual(info["transport"], "stdio")


if __name__ == "__main__":
    unittest.main()
