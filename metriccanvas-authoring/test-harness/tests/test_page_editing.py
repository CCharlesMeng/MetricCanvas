import json
import sys
import unittest
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tool"))
from metriccanvas_authoring.domain.page_editing import edit_page_document, EDIT_SCHEMA
from metriccanvas_authoring.domain.page_validation import validate_page_document
from jsonschema import Draft202012Validator


def page():
    return {
        "schemaVersion": "6.1", "layout": "report", "id": "edit-example",
        "meta": {"description": "manual-description"},
        "dataSources": {"sales": {"fields": {
            "region": {"type": "string", "role": "dimension"},
            "amount": {"type": "number", "role": "measure"}},
            "source": {"type": "inline", "rows": [{"region": "private-region", "amount": 12}]}},
            "total": {"fields": {"amount": {"type": "number", "role": "measure"}},
                "source": {"type": "inline", "rows": [{"amount": 12}]}}},
        "sections": [{"id": "main", "container": "panel", "components": [
            {"id": "header", "type": "reportHeader", "layout": {"span": 12}, "props": {"title": "Original", "tags": ["manual"]}},
            {"id": "chart", "type": "barChart", "layout": {"span": 6}, "data": {"main": "sales"}, "props": {
                "title": "Chart", "categoryField": "region", "series": [{"field": "amount", "label": "Manual"}], "rounded": True}},
            {"id": "table", "type": "table", "layout": {"span": 6}, "data": {"main": "sales"}, "props": {
                "title": "Table", "columns": [{"field": "region", "title": "Region", "width": 150}, {"field": "amount", "title": "Amount"}]}},
            {"id": "metric", "type": "metricCard", "layout": {"span": 12}, "data": {"main": "total"}, "props": {
                "title": "Metric", "rows": [{"label": "Amount", "valueField": "amount", "context": "Manual context"}]}}
        ]}]
    }


def edit(value, *operations):
    return edit_page_document(value, {"operations": list(operations)})


def title(id="title", component="header", value="Changed", **extra):
    return {"id": id, "type": "set_title", "componentId": component, "title": value, **extra}


class PageEditingTest(unittest.TestCase):
    def test_valid_fixture_and_request_schema(self):
        self.assertEqual(validate_page_document(page()), [])
        Draft202012Validator.check_schema(EDIT_SCHEMA)

    def test_partial_success_rolls_back_failed_operation_and_skips_dependency(self):
        baseline = page(); original = deepcopy(baseline)
        result = edit(baseline, title(),
            {"id": "bad", "type": "set_properties", "componentId": "chart", "properties": {"rounded": False, "query": {"sql": "no"}}},
            title("dependent", "table", dependsOn=["bad"]),
            {"id": "independent", "type": "set_table_column", "componentId": "table", "fieldId": "amount", "properties": {"width": 200}})
        self.assertEqual(result["status"], "partial")
        self.assertEqual([o["status"] for o in result["operations"]], ["applied", "failed", "skipped", "applied"])
        expected = deepcopy(original)
        expected["sections"][0]["components"][0]["props"]["title"] = "Changed"
        expected["sections"][0]["components"][2]["props"]["columns"][1]["width"] = 200
        self.assertEqual(result["document"], expected)
        self.assertEqual(baseline, original)
        self.assertEqual(validate_page_document(result["document"]), [])

    def test_schema_invalid_operation_does_not_block_independent_success(self):
        result = edit(page(), {"id": "invalid", "type": "set_title", "componentId": "header", "title": 99}, title())
        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["operations"][0]["issues"][0]["code"], "OPERATION_INVALID")

    def test_whole_page_validation_rolls_back_empty_required_title(self):
        result = edit(page(), title(value=""), title("second", "table"))
        self.assertEqual([r["status"] for r in result["operations"]], ["failed", "applied"])
        self.assertEqual(result["document"]["sections"][0]["components"][0]["props"]["title"], "Original")

    def test_all_failure_and_missing_target_do_not_return_artifact(self):
        result = edit(page(), title(component="absent"))
        self.assertEqual(result["status"], "failed")
        self.assertIsNone(result["document"])

    def test_unchanged_and_net_zero_operations_do_not_return_artifact(self):
        for operations in [(title(value="Original"),), (title(), title("restore", value="Original"))]:
            result = edit(page(), *operations)
            self.assertEqual(result["status"], "unchanged")
            self.assertIsNone(result["document"])

    def test_normalization_alone_is_not_a_content_change(self):
        baseline = page(); baseline["schemaVersion"] = "6.0"; baseline["layoutForm"] = baseline.pop("layout")
        result = edit(baseline, title(value="Original"))
        self.assertEqual(result["status"], "unchanged")
        self.assertIsNone(result["document"])

    def test_dependency_on_noop_succeeds_and_forward_dependency_skips(self):
        result = edit(page(), title(value="Original"), title("dependent", "table", dependsOn=["title"]), title("forward", dependsOn=["later"]), title("later"))
        self.assertEqual([r["status"] for r in result["operations"]], ["unchanged", "applied", "skipped", "applied"])

    def test_duplicate_ids_and_invalid_batch_fail_before_mutation(self):
        for request in [{"operations": [title(), title()]}, {"operations": []}, {"operations": [title()], "document": page()}, {"operations": [{"id": []}]}]:
            result = edit_page_document(page(), request)
            self.assertEqual(result["status"], "invalid_request")
            self.assertIsNone(result["document"])

    def test_invalid_baseline_cannot_be_repaired_by_dropping_bad_fields(self):
        baseline = page(); baseline["layoutForm"] = "report"
        result = edit(baseline, title())
        self.assertEqual(result["status"], "invalid_baseline")
        self.assertIsNone(result["document"])

    def test_safe_type_switch_reuses_shape_gate_and_preserves_manual_layout(self):
        baseline = page()
        result = edit(baseline, {"id": "type", "type": "change_component_type", "componentId": "chart", "componentType": "lineChart"})
        self.assertEqual(result["status"], "changed")
        chart = result["document"]["sections"][0]["components"][1]
        self.assertEqual(chart["type"], "lineChart")
        self.assertEqual(chart["layout"], baseline["sections"][0]["components"][1]["layout"])
        self.assertEqual(chart["props"]["series"], baseline["sections"][0]["components"][1]["props"]["series"])
        self.assertIn("props.rounded", result["operations"][0]["adjustments"])
        rejected = edit(baseline, {"id": "type", "type": "change_component_type", "componentId": "chart", "componentType": "metricCard"})
        self.assertEqual(rejected["status"], "failed")

    def test_display_property_operations_preserve_bindings(self):
        result = edit(page(),
            {"id": "series", "type": "set_series_label", "componentId": "chart", "index": 0, "label": "Revenue"},
            {"id": "row", "type": "set_metric_row", "componentId": "metric", "index": 0, "properties": {"context": "new", "unit": "元"}},
            {"id": "props", "type": "set_properties", "componentId": "metric", "properties": {"showTrendArrows": True}})
        self.assertEqual(result["status"], "changed")
        components = result["document"]["sections"][0]["components"]
        self.assertEqual(components[1]["props"]["series"][0]["field"], "amount")
        self.assertEqual(components[3]["props"]["rows"][0]["valueField"], "amount")
        self.assertEqual(result["document"]["dataSources"], page()["dataSources"])

    def test_explicit_page_layout_keeps_section_container_and_all_business_content(self):
        expected = page(); expected["layout"] = "dashboard"
        result = edit(page(), {"id": "layout", "type": "set_page_layout", "layout": "dashboard"})
        self.assertEqual(result["document"], expected)
        self.assertEqual(result["operations"][0]["adjustments"], ["page.layout"])

    def test_move_and_resize_preserve_other_components(self):
        result = edit(page(), {"id": "move", "type": "move_component", "componentId": "metric", "sectionId": "main", "beforeId": "chart"},
            {"id": "span", "type": "set_component_layout", "componentId": "metric", "changes": {"span": 6}})
        self.assertEqual(result["status"], "changed")
        self.assertEqual([c["id"] for c in result["document"]["sections"][0]["components"]], ["header", "metric", "chart", "table"])
        self.assertEqual(result["document"]["sections"][0]["components"][1]["layout"]["span"], 6)

    def test_unsupported_properties_and_pagination_remain_closed(self):
        for properties in [{"pagination": {"mode": "query"}}, {"columns": []}, {"actions": []}, {"title.foo": "bad"}]:
            result = edit(page(), {"id": "bad", "type": "set_properties", "componentId": "table", "properties": properties})
            self.assertEqual(result["status"], "failed")
            self.assertIsNone(result["document"])

    def test_nested_component_title_keeps_unrelated_full_document(self):
        baseline = json.loads((ROOT / "contract-snapshot/page/conformance/valid/composite-page.json").read_text())
        from metriccanvas_authoring.domain.component_editing import walk_components
        target = next(c for c in walk_components(baseline) if c["type"] == "metricCard")
        expected = deepcopy(baseline)
        next(c for c in walk_components(expected) if c["id"] == target["id"])["props"]["title"] = "nested"
        result = edit(baseline, title(component=target["id"], value="nested"))
        self.assertEqual(result["document"], expected)

    def test_move_failure_restores_source_and_independent_resize_continues(self):
        result = edit(page(), {"id": "move", "type": "move_component", "componentId": "chart", "sectionId": "main", "beforeId": "absent"},
            {"id": "resize", "type": "set_component_layout", "componentId": "metric", "changes": {"span": 6}})
        self.assertEqual(result["status"], "partial")
        self.assertEqual([c["id"] for c in result["document"]["sections"][0]["components"]], ["header", "chart", "table", "metric"])

    def test_parameter_references_queries_and_original_rows_are_untouched(self):
        from metriccanvas_authoring.domain.component_editing import walk_components
        for name in ("params-page", "grouped-fields-page", "query-dashboard", "filters-page"):
            with self.subTest(page=name):
                baseline = json.loads((ROOT / f"contract-snapshot/page/conformance/valid/{name}.json").read_text())
                target = next(c for c in walk_components(baseline) if c["type"] in {"reportHeader", "table", "barChart", "metricCard"})
                expected = deepcopy(baseline)
                next(c for c in walk_components(expected) if c["id"] == target["id"])["props"]["title"] = "changed"
                result = edit(baseline, title(component=target["id"], value="changed"))
                self.assertEqual(result["document"], expected)

    def test_multi_round_manual_then_language_keeps_other_changes(self):
        manual = page(); manual["sections"][0]["components"][2]["props"]["columns"][0]["width"] = 230
        first = edit(manual, title())["document"]
        second = edit(first, {"id": "series", "type": "set_series_label", "componentId": "chart", "index": 0, "label": "Later"})["document"]
        self.assertEqual(second["sections"][0]["components"][2]["props"]["columns"][0]["width"], 230)
        self.assertEqual(second["sections"][0]["components"][0]["props"]["title"], "Changed")

    def test_grouped_query_type_switch_uses_resolved_shape_without_rewriting_source(self):
        baseline = json.loads((ROOT / "contract-snapshot/page/conformance/valid/grouped-fields-page.json").read_text())
        result = edit(baseline, {"id": "type", "type": "change_component_type", "componentId": "grouped-table", "componentType": "barChart"})
        self.assertEqual(result["status"], "changed")
        self.assertEqual(result["document"]["dataSources"], baseline["dataSources"])
        self.assertEqual(validate_page_document(result["document"]), [])
