from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
CONTRACT_ROOT = BUNDLE_ROOT / "contract-snapshot"
PENDING_PATH = BUNDLE_ROOT / "test-harness" / "fixtures" / "page-conformance-pending.json"
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))

from metriccanvas_authoring.domain.page_validation import validate_page_document  # noqa: E402


def _load_pending() -> tuple[frozenset[str], frozenset[str]]:
    registry = json.loads(PENDING_PATH.read_text(encoding="utf-8"))
    return frozenset(registry["pendingValid"]), frozenset(registry["pending"])


def _issue_keys(issues) -> set[tuple[str, str]]:
    return {(issue.type, issue.path) for issue in issues}


class PageContractConformanceTest(unittest.TestCase):
    """
    共享 conformance 向量由 TypeScript 单向导出，Java 与 TypeScript 同跑全部向量（ADR-0062）。
    Python 侧的页面校验是创作期预检，必须对齐全部导出不变式。
    pending 注册表现在为空；新向量必须直接命中，不得通过扩大清单静默豁免。
    """

    def test_accepts_every_exported_valid_page(self) -> None:
        pending_valid, _pending = _load_pending()
        self.assertEqual(
            pending_valid,
            frozenset(),
            "page conformance pendingValid 已封闭，不得重新引入豁免",
        )
        fixture_root = CONTRACT_ROOT / "page" / "conformance" / "valid"
        seen: set[str] = set()
        for fixture_path in sorted(fixture_root.glob("*.json")):
            seen.add(fixture_path.stem)
            value = json.loads(fixture_path.read_text(encoding="utf-8"))
            issues = validate_page_document(value)
            with self.subTest(fixture=fixture_path.name):
                if fixture_path.stem in pending_valid:
                    self.assertNotEqual(
                        issues,
                        [],
                        f"{fixture_path.stem} 已被 Python 接受，请从 page-conformance-pending.json 移出",
                    )
                else:
                    self.assertEqual(issues, [])
        self.assertTrue(
            pending_valid <= seen,
            f"pendingValid 清单里有已不存在的合法样例: {sorted(pending_valid - seen)}",
        )

    def test_matches_every_covered_error_type_and_path(self) -> None:
        _pending_valid, pending = _load_pending()
        self.assertEqual(
            pending,
            frozenset(),
            "page conformance pending 已封闭，不得重新引入豁免",
        )
        fixture_root = CONTRACT_ROOT / "page" / "conformance" / "invalid"
        seen: set[str] = set()
        for fixture_path in sorted(fixture_root.glob("*.json")):
            vector = json.loads(fixture_path.read_text(encoding="utf-8"))
            seen.add(vector["case"])
            expected = {(issue["type"], issue["path"]) for issue in vector["expected"]}
            actual = _issue_keys(validate_page_document(vector["input"]))
            with self.subTest(fixture=fixture_path.name):
                if vector["case"] in pending:
                    self.assertNotEqual(
                        actual,
                        expected,
                        f"{vector['case']} 已被 Python 复现，请从 page-conformance-pending.json 移出",
                    )
                else:
                    self.assertEqual(actual, expected)
        self.assertTrue(
            pending <= seen,
            f"pending 清单里有已不存在的反例: {sorted(pending - seen)}",
        )


if __name__ == "__main__":
    unittest.main()
