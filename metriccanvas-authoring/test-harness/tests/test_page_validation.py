from __future__ import annotations

import json
import sys
import unittest
from copy import deepcopy
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
CONTRACT_ROOT = BUNDLE_ROOT / "contract-snapshot"
PENDING_PATH = BUNDLE_ROOT / "test-harness" / "fixtures" / "page-conformance-pending.json"
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))

from metriccanvas_authoring.pages.validation.page_validation import (  # noqa: E402
    normalize_page_document,
    validate_page_document,
)


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

    def test_inline_parameter_shared_vectors(self) -> None:
        matrix = json.loads((CONTRACT_ROOT / 'page/conformance/inline-params.json').read_text())
        for case in matrix['cases']:
            with self.subTest(case=case['name']):
                original = deepcopy(case['input'])
                self.assertEqual(not validate_page_document(case['input']), case['expected']['ok'])
                self.assertEqual(original, case['input'])

    def test_normalizes_all_shared_layout_cases_without_mutating_input(self) -> None:
        matrix = json.loads(
            (CONTRACT_ROOT / "page/conformance/layout-compatibility.json").read_text()
        )
        self.assertEqual(len(matrix["cases"]), 80)
        for index, case in enumerate(matrix["cases"]):
            with self.subTest(case=index):
                original = deepcopy(case["input"])
                expected = case["expected"]
                actual = normalize_page_document(case["input"])
                self.assertEqual(case["input"], original)
                self.assertEqual(actual["ok"], expected["ok"])
                if expected["ok"]:
                    self.assertEqual(actual, expected)
                    self.assertEqual(normalize_page_document(actual["document"]), actual)
                else:
                    self.assertNotIn("document", actual)
                    self.assertEqual(
                        {(e["type"], e["path"]) for e in actual["errors"]},
                        {(e["type"], e["path"]) for e in expected["errors"]},
                    )

    def test_grouped_params_match_typescript_contract(self) -> None:
        matrix = json.loads((CONTRACT_ROOT / "page/conformance/grouped-params.json").read_text())
        for case in matrix["cases"]:
            with self.subTest(case=case["name"]):
                before = deepcopy(case["input"])
                actual = normalize_page_document(case["input"])
                expected = case["expected"]
                self.assertEqual(actual["ok"], expected["ok"])
                if expected["ok"]:
                    self.assertEqual(actual, expected)
                else:
                    self.assertEqual({(e["type"], e["path"]) for e in actual["errors"]}, {(e["type"], e["path"]) for e in expected["errors"]})
                self.assertEqual(case["input"], before)

    def test_million_formats_require_65(self) -> None:
        page = json.loads((CONTRACT_ROOT / "page/conformance/valid/million-formats-page.json").read_text())
        self.assertFalse(validate_page_document(page))
        page["schemaVersion"] = "6.4"
        self.assertTrue(validate_page_document(page))

    def test_dimension_param_bindings_match_shared_contract(self) -> None:
        matrix = json.loads((CONTRACT_ROOT / "page/conformance/param-bindings.json").read_text())
        self.assertGreaterEqual(len(matrix["cases"]), 12)
        for case in matrix["cases"]:
            with self.subTest(case=case["name"]):
                before = deepcopy(case["input"])
                actual = normalize_page_document(case["input"])
                expected = case["expected"]
                self.assertEqual(actual["ok"], expected["ok"])
                if expected["ok"]:
                    self.assertEqual(actual, expected)
                else:
                    self.assertEqual({(e["type"], e["path"]) for e in actual["errors"]}, {(e["type"], e["path"]) for e in expected["errors"]})
                self.assertEqual(case["input"], before)

    def test_time_param_bindings_match_typescript_contract(self) -> None:
        matrix = json.loads((CONTRACT_ROOT / "page/conformance/time-param-bindings.json").read_text())
        for case in matrix["cases"]:
            with self.subTest(case=case["name"]):
                actual = normalize_page_document(case["input"])
                expected = case["expected"]
                self.assertEqual(actual["ok"], expected["ok"])
                if expected["ok"]:
                    self.assertEqual(actual, expected)
                else:
                    self.assertEqual({(e["type"], e["path"]) for e in actual["errors"]}, {(e["type"], e["path"]) for e in expected["errors"]})

    def test_normalization_preserves_all_valid_source_content(self) -> None:
        for path in sorted((CONTRACT_ROOT / "page/conformance/valid").glob("*.json")):
            with self.subTest(fixture=path.name):
                original = json.loads(path.read_text())
                baseline = deepcopy(original)
                expected = deepcopy(original)
                expected["schemaVersion"] = "6." + str(max(1, int(original["schemaVersion"].split(".")[1])))
                expected["layout"] = expected.pop("layoutForm", expected.get("layout", "report"))
                result = normalize_page_document(original)
                self.assertEqual(result, {"ok": True, "document": expected, "errors": []})
                self.assertEqual(original, baseline)
                # A consumer editing the returned tree cannot mutate the baseline.
                result["document"]["sections"][0]["id"] = "changed-after-reading"
                self.assertEqual(original, baseline)

    def test_normalization_rejects_all_invalid_pages_before_transforming(self) -> None:
        for path in sorted((CONTRACT_ROOT / "page/conformance/invalid").glob("*.json")):
            with self.subTest(fixture=path.name):
                case = json.loads(path.read_text())
                original = deepcopy(case["input"])
                result = normalize_page_document(case["input"])
                self.assertFalse(result["ok"])
                self.assertNotIn("document", result)
                self.assertEqual(case["input"], original)
                self.assertEqual(
                    {(e["type"], e["path"]) for e in result["errors"]},
                    {(e["type"], e["path"]) for e in case["expected"]},
                )

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
