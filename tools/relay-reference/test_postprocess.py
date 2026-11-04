"""Private build/runtime transport tests; product audit/merge rules belong to A/B."""
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from export import postprocess_metadata
from product_runtime import postprocess
from release import ReleaseError


class PostprocessTests(unittest.TestCase):
    def module(self):
        return SimpleNamespace(OPERATIONS={"page.edit.v2": {}},
            POSTPROCESS={"page.edit.v2": {"operation": "page.presentation", "baseline": True}}, apply_postprocess=Mock())

    def test_build_requires_actual_node_registration_and_product_merger(self):
        module = self.module()
        with self.assertRaises(ReleaseError):
            postprocess_metadata(module, {}, {})
        with self.assertRaises(ReleaseError):
            postprocess_metadata(module, {"page.presentation": {}}, {"page.presentation": {"kind": "python"}})
        actual = postprocess_metadata(module, {"page.presentation": {}}, {"page.presentation": {"kind": "node"}})
        self.assertEqual(actual, module.POSTPROCESS)
        actual["page.edit.v2"]["baseline"] = False
        self.assertTrue(module.POSTPROCESS["page.edit.v2"]["baseline"])
        module.apply_postprocess = None
        with self.assertRaises(ReleaseError):
            postprocess_metadata(module, {"page.presentation": {}}, {"page.presentation": {"kind": "node"}})

    def test_legacy_hooks_unknown_fields_and_unowned_operation_are_rejected(self):
        module = self.module()
        module.POSTPROCESS = {"page.edit": {"operation": "page.presentation", "baseline": True}}
        module.OPERATIONS["page.edit"] = {}
        with self.assertRaises(ReleaseError):
            postprocess_metadata(module, {"page.presentation": {}}, {"page.presentation": {"kind": "node"}})
        module = self.module()
        module.POSTPROCESS["page.edit.v2"]["path"] = "/model-selected-script"
        with self.assertRaises(ReleaseError):
            postprocess_metadata(module, {}, {})
        module = self.module()
        module.OPERATIONS.clear()
        with self.assertRaises(ReleaseError):
            postprocess_metadata(module, {}, {})

    def test_transports_exact_context_to_real_node_and_delegates_merge(self):
        module = self.module()
        value = {"baseline": {"id": "base"}, "evaluation": {"instant": "2026-12-31T16:30:00Z", "timeZone": "Asia/Shanghai"},
                 "presentationIntent": {"rawValuePaths": ["/sections/0"]}}
        result = {"status": "ok", "data": {"document": {"id": "candidate"}}, "diagnostics": [{"code": "BEFORE"}]}
        before = deepcopy((value, result))
        audit = {"status": "partial", "data": {"findings": []}, "diagnostics": [{"code": "AUDIT"}]}
        merged = {"status": "partial", "data": {"document": {"id": "candidate"}}, "diagnostics": []}
        module.apply_postprocess.return_value = merged
        handler = {"postprocess": module.POSTPROCESS}
        node = {"kind": "node", "path": "scripts/actual-program.mjs"}
        with patch("product_runtime.node_operation", return_value=audit) as transport:
            self.assertIs(postprocess(Path("/verified-release"), {"page.presentation": node}, handler,
                                      module, "page.edit.v2", value, result), merged)
        payload = {"document": result["data"]["document"], **value}
        transport.assert_called_once_with(Path("/verified-release"), node, "page.presentation", payload)
        module.apply_postprocess.assert_called_once_with("page.edit.v2", value, result, audit)
        self.assertEqual((value, result), before)

    def test_no_hook_failed_or_missing_candidate_has_no_extra_step(self):
        module = self.module()
        candidates = [None, {"status": "error", "data": {}, "diagnostics": []},
                      {"status": "ok", "data": {"document": None}, "diagnostics": []}]
        with patch("product_runtime.node_operation") as transport:
            for result in candidates:
                self.assertIs(postprocess(Path("/release"), {}, {"postprocess": module.POSTPROCESS}, module,
                                          "page.edit.v2", {}, result), result)
            legacy = {"status": "ok", "data": {"document": {}}, "diagnostics": []}
            self.assertIs(postprocess(Path("/release"), {}, {}, module, "page.edit", {}, legacy), legacy)
        transport.assert_not_called()
        module.apply_postprocess.assert_not_called()


if __name__ == "__main__":
    unittest.main()
