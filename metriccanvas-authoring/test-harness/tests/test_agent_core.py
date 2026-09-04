from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))

from metriccanvas_authoring.domain.agent_core import (  # noqa: E402
    AgentCoreError,
    ad_hoc_gap_key,
    apply_presentation_request,
    apply_unit_operations,
    confirm_metric_gaps,
    guard_structural_response,
    normalize_display_only_decision,
    normalize_unit_operations,
    partition_unit_decision,
    plan_metric_gap_resolution,
    prepare_ad_hoc_metric_gap,
    reroute_zero_match,
    resolve_domain_override,
    resolve_target_data_source_id,
    resolve_unit_intent,
    scope_gap_key,
    validate_metric_selection,
    validate_route_decision,
)


def unit(metric: str, *, domain: str = "客户经营") -> dict[str, Any]:
    return {
        "businessDomain": domain,
        "metrics": [{"kind": "metric", "name": metric}],
        "groupBy": ["行业"],
        "filters": [],
        "time": None,
    }


def component_catalog() -> list[dict[str, Any]]:
    return json.loads(
        (
            BUNDLE_ROOT
            / "contract-snapshot"
            / "page"
            / "component-catalog.json"
        ).read_text(encoding="utf-8")
    )


def entry(
    data_source_id: str,
    metric: str,
    *,
    requested_component: str | None = None,
) -> dict[str, Any]:
    return {
        "dataSourceId": data_source_id,
        "unit": unit(metric),
        "intent": "comparison",
        "requestedComponent": requested_component,
    }


class UnitOperationReducerTest(unittest.TestCase):
    def test_unit_and_patch_shorthands_normalize_to_targeted_operations(self) -> None:
        existing = (
            entry("result", "新增客户数"),
            entry("result-2", "流失客户数"),
        )
        full_unit = unit("客户留存率")

        self.assertEqual(
            normalize_unit_operations(
                decision={"outcome": "unit", "unit": full_unit},
                entries=(),
                target_data_source_id=None,
            ),
            ({"op": "add", "unit": full_unit},),
        )
        self.assertEqual(
            normalize_unit_operations(
                decision={"outcome": "unit", "unit": full_unit},
                entries=existing,
                target_data_source_id="result-2",
            ),
            ({"op": "replace", "dataSourceId": "result-2", "unit": full_unit},),
        )
        self.assertEqual(
            normalize_unit_operations(
                decision={"outcome": "patch", "patch": {"groupBy": []}},
                entries=existing,
                target_data_source_id=None,
            ),
            ({"op": "modify", "dataSourceId": "result", "patch": {"groupBy": []}},),
        )

    def test_add_allocates_stable_monotonic_data_source_ids(self) -> None:
        result = apply_unit_operations(
            entries=(),
            operations=(
                {"op": "add", "unit": unit("新增客户数")},
                {"op": "add", "unit": unit("流失客户数")},
            ),
            next_ordinal=1,
            routed_domains=("客户经营",),
            fallback_domain="客户经营",
            question="分别展示新增和流失客户数",
        )

        self.assertEqual(
            [entry["dataSourceId"] for entry in result.entries],
            ["result", "result-2"],
        )
        self.assertEqual(
            [entry["unit"]["title"] for entry in result.entries],
            ["新增客户数", "流失客户数"],
        )
        self.assertEqual(result.touched_data_source_ids, ("result", "result-2"))
        self.assertEqual(result.added_data_source_ids, ("result", "result-2"))
        self.assertEqual(result.next_ordinal, 3)
        self.assertEqual(result.dropped_adds, 0)

    def test_modify_updates_only_the_patch_and_preserves_untouched_identity(self) -> None:
        first = {
            "dataSourceId": "result",
            "unit": unit("新增客户数"),
            "intent": "comparison",
            "requestedComponent": "barChart",
        }
        untouched = {
            "dataSourceId": "result-2",
            "unit": unit("流失客户数"),
            "intent": "trend",
            "requestedComponent": "lineChart",
        }

        result = apply_unit_operations(
            entries=(first, untouched),
            operations=(
                {
                    "op": "modify",
                    "dataSourceId": "result",
                    "patch": {
                        "filters": [{"dimension": "行业", "values": ["金融"]}]
                    },
                },
            ),
            next_ordinal=3,
            routed_domains=("客户经营",),
            fallback_domain="客户经营",
            question="这个只看金融行业",
        )

        self.assertIsNot(result.entries[0], first)
        self.assertEqual(result.entries[0]["unit"]["metrics"], first["unit"]["metrics"])
        self.assertEqual(
            result.entries[0]["unit"]["filters"],
            [{"dimension": "行业", "values": ["金融"]}],
        )
        self.assertEqual(result.entries[0]["intent"], "comparison")
        self.assertEqual(result.entries[0]["requestedComponent"], "barChart")
        self.assertIs(result.entries[1], untouched)
        self.assertEqual(result.touched_data_source_ids, ("result",))
        self.assertEqual(result.next_ordinal, 3)

    def test_empty_patch_does_not_touch_or_copy_the_unit(self) -> None:
        existing = {
            "dataSourceId": "result",
            "unit": unit("新增客户数"),
            "intent": "comparison",
            "requestedComponent": None,
        }

        result = apply_unit_operations(
            entries=(existing,),
            operations=(
                {
                    "op": "modify",
                    "dataSourceId": "result",
                    "patch": {},
                },
            ),
            next_ordinal=2,
            routed_domains=("客户经营",),
            fallback_domain="客户经营",
            question="保持不变",
        )

        self.assertIs(result.entries[0], existing)
        self.assertEqual(result.touched_data_source_ids, ())

    def test_replace_keeps_identity_and_presentation_state_but_rewrites_scope(self) -> None:
        existing = {
            "dataSourceId": "result-4",
            "unit": unit("新增客户数"),
            "intent": "trend",
            "requestedComponent": "lineChart",
        }
        replacement = unit("流失客户数", domain="错误域")

        result = apply_unit_operations(
            entries=(existing,),
            operations=(
                {
                    "op": "replace",
                    "dataSourceId": "result-4",
                    "unit": replacement,
                },
            ),
            next_ordinal=5,
            routed_domains=("客户经营",),
            fallback_domain="客户经营",
            question="换成流失客户数",
        )

        self.assertEqual(result.entries[0]["dataSourceId"], "result-4")
        self.assertEqual(result.entries[0]["unit"]["businessDomain"], "客户经营")
        self.assertEqual(result.entries[0]["unit"]["title"], "换成流失客户数")
        self.assertEqual(result.entries[0]["intent"], "trend")
        self.assertEqual(result.entries[0]["requestedComponent"], "lineChart")
        self.assertEqual(result.touched_data_source_ids, ("result-4",))
        self.assertEqual(result.next_ordinal, 5)

    def test_remove_does_not_reuse_the_deleted_ordinal(self) -> None:
        survivor = {
            "dataSourceId": "result",
            "unit": unit("新增客户数"),
            "intent": "comparison",
            "requestedComponent": None,
        }
        removed = {
            "dataSourceId": "result-2",
            "unit": unit("流失客户数"),
            "intent": "comparison",
            "requestedComponent": None,
        }

        result = apply_unit_operations(
            entries=(survivor, removed),
            operations=(
                {"op": "remove", "dataSourceId": "result-2"},
                {"op": "add", "unit": unit("客户留存率")},
            ),
            next_ordinal=3,
            routed_domains=("客户经营",),
            fallback_domain="客户经营",
            question="删掉流失客户数，再加客户留存率",
        )

        self.assertEqual(
            [entry["dataSourceId"] for entry in result.entries],
            ["result", "result-3"],
        )
        self.assertIs(result.entries[0], survivor)
        self.assertEqual(result.touched_data_source_ids, ("result-3",))
        self.assertEqual(result.added_data_source_ids, ("result-3",))
        self.assertEqual(result.next_ordinal, 4)

    def test_unit_added_then_removed_is_not_reported_as_touched_or_added(self) -> None:
        result = apply_unit_operations(
            entries=(),
            operations=(
                {"op": "add", "unit": unit("新增客户数")},
                {"op": "remove", "dataSourceId": "result"},
            ),
            next_ordinal=1,
            routed_domains=("客户经营",),
            fallback_domain="客户经营",
            question="添加后取消",
        )

        self.assertEqual(result.entries, ())
        self.assertEqual(result.touched_data_source_ids, ())
        self.assertEqual(result.added_data_source_ids, ())
        self.assertEqual(result.next_ordinal, 2)

    def test_unknown_operation_target_fails_with_a_stable_code(self) -> None:
        with self.assertRaises(AgentCoreError) as raised:
            apply_unit_operations(
                entries=(),
                operations=(
                    {
                        "op": "modify",
                        "dataSourceId": "result-99",
                        "patch": {"groupBy": []},
                    },
                ),
                next_ordinal=1,
                routed_domains=("客户经营",),
                fallback_domain="客户经营",
                question="修改不存在的单元",
            )

        self.assertEqual(raised.exception.code, "UNKNOWN_DATA_REQUEST_UNIT")
        self.assertEqual(raised.exception.data_source_id, "result-99")

    def test_page_cap_reports_dropped_adds_without_spending_ordinals(self) -> None:
        existing = tuple(
            {
                "dataSourceId": "result" if index == 1 else f"result-{index}",
                "unit": unit(f"指标{index}"),
                "intent": None,
                "requestedComponent": None,
            }
            for index in range(1, 7)
        )

        result = apply_unit_operations(
            entries=existing,
            operations=(
                {"op": "add", "unit": unit("超额指标A")},
                {"op": "add", "unit": unit("超额指标B")},
            ),
            next_ordinal=7,
            routed_domains=("客户经营",),
            fallback_domain="客户经营",
            question="展示所有视角",
        )

        self.assertEqual(result.entries, existing)
        self.assertEqual(result.dropped_adds, 2)
        self.assertEqual(result.next_ordinal, 7)


class StructuralResponseGuardTest(unittest.TestCase):
    def test_empty_merge_response_requires_one_correction_then_rejects(self) -> None:
        empty = {"outcome": "operations", "operations": []}

        first = guard_structural_response(
            question="把两个组件合并到一起",
            unit_count=2,
            decision=empty,
            attempt=1,
        )
        second = guard_structural_response(
            question="把两个组件合并到一起",
            unit_count=2,
            decision=empty,
            attempt=2,
        )

        self.assertEqual(first.status, "correction_required")
        self.assertEqual(first.structural_intent, "合并")
        self.assertIn("合并 = remove", first.feedback or "")
        self.assertEqual(second.status, "rejected")
        self.assertEqual(second.code, "STRUCTURAL_INTENT_NOT_APPLIED")

    def test_first_question_and_already_satisfied_structure_do_not_trigger_guard(self) -> None:
        empty = {"outcome": "operations", "operations": []}

        first_question = guard_structural_response(
            question="再加一个客户指标",
            unit_count=0,
            decision=empty,
            attempt=1,
        )
        already_merged = guard_structural_response(
            question="合并成一张图",
            unit_count=1,
            decision=empty,
            attempt=1,
        )
        already_split = guard_structural_response(
            question="分别展示",
            unit_count=2,
            decision=empty,
            attempt=1,
        )

        self.assertEqual(first_question.status, "accepted")
        self.assertEqual(already_merged.status, "accepted")
        self.assertEqual(already_split.status, "accepted")

    def test_discovery_structure_operation_prevents_silent_empty_response(self) -> None:
        empty = {"outcome": "operations", "operations": []}

        for operation, expected in (("add", "增加"), ("replace", "替换")):
            with self.subTest(operation=operation):
                result = guard_structural_response(
                    question="Tokens请求量",
                    unit_count=1,
                    decision=empty,
                    attempt=1,
                    structure_operation=operation,
                )
                self.assertEqual(result.status, "correction_required")
                self.assertEqual(result.structural_intent, expected)


class PresentationRequestTest(unittest.TestCase):
    def test_display_only_request_overrides_an_out_of_scope_model_decision(self) -> None:
        rejected = {"outcome": "out_of_scope", "reason": "没有指标变更"}

        recovered = normalize_display_only_decision(
            question="这个改成柱状图",
            unit_count=2,
            decision=rejected,
            component_catalog=component_catalog(),
        )

        self.assertEqual(
            recovered,
            {"outcome": "operations", "operations": []},
        )
        self.assertIs(
            normalize_display_only_decision(
                question="这个指标怎么算",
                unit_count=2,
                decision=rejected,
                component_catalog=component_catalog(),
            ),
            rejected,
        )

    def test_target_maps_section_and_component_to_a_known_data_request_unit(self) -> None:
        entries = (
            entry("result", "新增客户数"),
            entry("result-2", "流失客户数"),
        )
        draft = {
            "sections": [
                {
                    "id": "main",
                    "components": [
                        {"id": "chart-a", "data": {"main": "result"}},
                        {"id": "chart-b", "data": {"main": "result-2"}},
                    ],
                }
            ]
        }

        self.assertEqual(
            resolve_target_data_source_id(
                draft=draft,
                target={"sectionId": "main", "componentId": "chart-b"},
                entries=entries,
            ),
            "result-2",
        )
        self.assertIsNone(
            resolve_target_data_source_id(
                draft=draft,
                target={"sectionId": "main", "componentId": "missing"},
                entries=entries,
            )
        )

    def test_last_explicit_catalog_term_wins_and_touched_scope_beats_target(self) -> None:
        target = entry("result", "新增客户数", requested_component="lineChart")
        touched = entry("result-2", "流失客户数", requested_component="pieChart")
        other = entry("result-3", "客户留存率", requested_component="metricCard")

        result = apply_presentation_request(
            entries=(target, touched, other),
            question="不要折线图，换成柱状图，用这个图表展示",
            component_catalog=component_catalog(),
            touched_data_source_ids=("result-2",),
            target_data_source_id="result",
        )

        self.assertEqual(result.request_kind, "explicit")
        self.assertEqual(result.requested_component, "barChart")
        self.assertEqual(result.affected_data_source_ids, ("result-2",))
        self.assertIs(result.entries[0], target)
        self.assertEqual(result.entries[1]["requestedComponent"], "barChart")
        self.assertIs(result.entries[2], other)

    def test_generic_wording_clears_only_the_target_component_request(self) -> None:
        first = entry("result", "新增客户数", requested_component="barChart")
        target = entry("result-2", "流失客户数", requested_component="lineChart")

        result = apply_presentation_request(
            entries=(first, target),
            question="这个换一种图表展示",
            component_catalog=component_catalog(),
            target_data_source_id="result-2",
        )

        self.assertEqual(result.request_kind, "generic")
        self.assertEqual(result.affected_data_source_ids, ("result-2",))
        self.assertIs(result.entries[0], first)
        self.assertIsNone(result.entries[1]["requestedComponent"])

    def test_without_touched_or_target_an_explicit_request_applies_to_all_units(self) -> None:
        first = entry("result", "新增客户数")
        second = entry("result-2", "流失客户数")

        result = apply_presentation_request(
            entries=(first, second),
            question="都改成明细表",
            component_catalog=component_catalog(),
        )

        self.assertEqual(result.affected_data_source_ids, ("result", "result-2"))
        self.assertEqual(
            [value["requestedComponent"] for value in result.entries],
            ["table", "table"],
        )


class UnitIntentResolutionTest(unittest.TestCase):
    def test_multi_unit_uses_its_own_title_and_falls_back_from_invalid_model_output(self) -> None:
        scoped_unit = {
            **unit("新增客户数"),
            "title": "各行业新增客户数对比",
        }

        result = resolve_unit_intent(
            question="整体指标、每月走势和各行业对比",
            unit=scoped_unit,
            unit_count=3,
            model_decision={"intent": "not-in-the-closed-set"},
        )

        self.assertEqual(result.question, "各行业新增客户数对比")
        self.assertEqual(result.intent, "comparison")
        self.assertTrue(result.used_fallback)

    def test_shape_fallbacks_and_valid_model_decision_match_the_old_chain(self) -> None:
        cases = (
            ({**unit("指标"), "groupBy": []}, "single_value"),
            (
                {
                    **unit("指标"),
                    "groupBy": ["统计周期"],
                    "time": {
                        "granularity": "month",
                        "start": "2026-01",
                        "end": "2026-06",
                        "providedBy": "user",
                    },
                },
                "trend",
            ),
            ({**unit("指标"), "groupBy": ["行业", "区域"]}, "comparison"),
        )
        for scoped_unit, expected in cases:
            with self.subTest(expected=expected):
                result = resolve_unit_intent(
                    question="原始问题",
                    unit=scoped_unit,
                    unit_count=1,
                    model_decision=None,
                )
                self.assertEqual(result.question, "原始问题")
                self.assertEqual(result.intent, expected)
                self.assertTrue(result.used_fallback)

        model_result = resolve_unit_intent(
            question="原始问题",
            unit=unit("指标"),
            unit_count=1,
            model_decision={"intent": "ranking"},
        )
        self.assertEqual(model_result.intent, "ranking")
        self.assertFalse(model_result.used_fallback)


class MetricSelectionTest(unittest.TestCase):
    def test_ambiguous_selection_reblocks_when_blank_and_rejects_unknown_candidate(self) -> None:
        candidates = (
            {"businessDomain": "客户经营", "metricName": "客户数"},
            {"businessDomain": "运营分析", "metricName": "在用客户数"},
        )

        blank = validate_metric_selection(
            ambiguous_terms=("客户数",),
            candidates=candidates,
            selection=None,
        )
        self.assertEqual(blank.status, "selection_required")

        with self.assertRaises(AgentCoreError) as raised:
            validate_metric_selection(
                ambiguous_terms=("客户数",),
                candidates=candidates,
                selection={
                    "businessDomain": "客户经营",
                    "metricName": "不在候选中",
                },
            )
        self.assertEqual(raised.exception.code, "SCOPE_SELECTION_INVALID")

        selected = validate_metric_selection(
            ambiguous_terms=("客户数",),
            candidates=candidates,
            selection={
                "businessDomain": "运营分析",
                "metricName": "在用客户数",
            },
        )
        self.assertEqual(selected.status, "selected")
        self.assertEqual(selected.selected_metric, candidates[1])

    def test_discovery_canonical_name_shape_is_candidate_bound(self) -> None:
        candidates = (
            {
                "kind": "metric",
                "canonicalName": "客户数",
                "businessDomain": "客户经营",
                "score": 103,
                "definition": "期末在册客户数",
                "matchedTerm": "客户数",
            },
            {
                "kind": "metric",
                "canonicalName": "客户数",
                "businessDomain": "运营分析",
                "score": 103,
                "definition": "发起过调用的去重客户数",
                "matchedTerm": "客户数",
            },
        )

        selected = validate_metric_selection(
            ambiguous_terms=("客户数",),
            candidates=candidates,
            selection={
                "businessDomain": "运营分析",
                "canonicalName": "客户数",
            },
        )

        self.assertIs(selected.selected_metric, candidates[1])


class DomainRoutingTest(unittest.TestCase):
    def test_user_override_keeps_valid_domains_and_rejects_an_all_invalid_override(self) -> None:
        resolved = resolve_domain_override(
            requested_domains=("不存在的域", "运营分析", "客户经营"),
            inventory_domains=("客户经营", "运营分析"),
        )
        self.assertEqual(resolved.domains, ("运营分析", "客户经营"))
        self.assertTrue(resolved.overridden_by_user)

        with self.assertRaises(AgentCoreError) as raised:
            resolve_domain_override(
                requested_domains=("不存在的域",),
                inventory_domains=("客户经营", "运营分析"),
            )
        self.assertEqual(raised.exception.code, "DOMAIN_OVERRIDE_INVALID")

    def test_model_route_must_stay_inside_discovery_inventory(self) -> None:
        self.assertEqual(
            validate_route_decision(
                routed_domains=("运营分析",),
                inventory_domains=("客户经营", "运营分析"),
            ),
            ("运营分析",),
        )
        with self.assertRaises(AgentCoreError) as raised:
            validate_route_decision(
                routed_domains=("不存在的域",),
                inventory_domains=("客户经营", "运营分析"),
            )
        self.assertEqual(
            raised.exception.code,
            "MODEL_ROUTE_DECISION_INVALID",
        )

    def test_zero_match_follow_up_reroutes_from_ranked_cross_domain_candidates(self) -> None:
        candidates = (
            {"businessDomain": "运营分析", "metricName": "Tokens消耗量"},
            {"businessDomain": "运营分析", "metricName": "Tokens请求量"},
            {"businessDomain": "客户经营", "metricName": "客户数"},
            {"businessDomain": "财务", "metricName": "流水"},
        )

        result = reroute_zero_match(
            current_domains=("客户经营",),
            all_domain_candidates=candidates,
            user_override_present=False,
            domains_overridden_by_user=True,
        )

        self.assertTrue(result.rerouted)
        self.assertEqual(result.domains, ("运营分析", "客户经营"))
        self.assertFalse(result.overridden_by_user)
        self.assertEqual(result.candidates, candidates[:3])


class MetricGapFlowTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.step_event_validator = Draft202012Validator(
            json.loads(
                (
                    BUNDLE_ROOT
                    / "contracts"
                    / "authored"
                    / "agent-step-event.schema.json"
                ).read_text(encoding="utf-8")
            )
        )

    def test_gap_keys_are_stable_for_the_same_business_semantics(self) -> None:
        self.assertEqual(
            ad_hoc_gap_key("运营分析", "计费Tokens量 / 2"),
            ad_hoc_gap_key("运营分析", "计费tokens量/2.0"),
        )
        self.assertEqual(
            ad_hoc_gap_key("运营分析", "计费Tokens量 / 2"),
            "adhoc:运营分析:计费tokens量/#",
        )
        self.assertEqual(
            scope_gap_key("运营分析", " NPS 趋势?! "),
            scope_gap_key("运营分析", "nps趋势"),
        )
        self.assertEqual(
            scope_gap_key("运营分析", " NPS 趋势?! "),
            "scope:运营分析:nps趋势",
        )

    def test_gap_plan_consumes_discovery_candidate_shape(self) -> None:
        plan = plan_metric_gap_resolution(
            question="NPS 趋势",
            decision={
                "decisionType": "submit_data_request_units",
                "outcome": "out_of_scope",
                "reason": "没有 NPS 指标",
            },
            executable_entries=(),
            candidates=(
                {
                    "kind": "metric",
                    "canonicalName": "客户数",
                    "businessDomain": "客户经营",
                    "definition": "期末在册客户数",
                    "matchedTerm": "NPS",
                    "score": 3,
                },
            ),
            routed_domains=("客户经营",),
            interaction_id="confirm-gap:canonical-shape",
        )

        assert plan.pending is not None
        self.assertEqual(
            plan.pending.occurrences[0]["closestCandidates"][0]["metricName"],
            "客户数",
        )

    def test_unit_decision_partitions_executable_scope_from_missing_aspects(self) -> None:
        decision = {
            "decisionType": "submit_data_request_units",
            "outcome": "unit",
            "unit": unit("Tokens消耗量", domain="运营分析"),
            "gaps": [
                {"aspect": "NPS 趋势", "reason": "语义面内没有 NPS 指标"}
            ],
        }

        result = partition_unit_decision(decision)

        self.assertEqual(
            result.executable_decision,
            {
                "decisionType": "submit_data_request_units",
                "outcome": "unit",
                "unit": decision["unit"],
            },
        )
        self.assertEqual(
            result.gaps,
            ({"aspect": "NPS 趋势", "reason": "语义面内没有 NPS 指标"},),
        )
        self.assertIsNone(result.out_of_scope_reason)

        out_of_scope = partition_unit_decision(
            {
                "decisionType": "submit_data_request_units",
                "outcome": "out_of_scope",
                "reason": "语义面内没有员工离职率",
            }
        )
        self.assertIsNone(out_of_scope.executable_decision)
        self.assertEqual(out_of_scope.gaps, ())
        self.assertEqual(out_of_scope.out_of_scope_reason, "语义面内没有员工离职率")

    def test_partial_answer_delivers_units_before_gap_confirmation(self) -> None:
        answer_unit = {
            **unit("Tokens消耗量", domain="运营分析"),
            "groupBy": ["统计周期"],
            "time": {
                "granularity": "month",
                "start": "2026-01",
                "end": "2026-06",
                "providedBy": "user",
            },
            "title": "Tokens 消耗趋势",
        }
        answer_entry = {
            "dataSourceId": "result",
            "unit": answer_unit,
            "intent": "trend",
            "requestedComponent": None,
        }
        decision = {
            "decisionType": "submit_data_request_units",
            "outcome": "unit",
            "unit": answer_unit,
            "gaps": [
                {"aspect": "NPS 趋势", "reason": "语义面内没有 NPS 指标"}
            ],
        }
        candidate = {
            "metricName": "Tokens消耗量",
            "businessDomain": "运营分析",
            "definition": "Tokens 消耗总量",
            "matchedTerm": "Tokens消耗量",
            "score": 111,
        }

        plan = plan_metric_gap_resolution(
            question="最近6个月Tokens消耗量和NPS的月度趋势?",
            decision=decision,
            executable_entries=(answer_entry,),
            candidates=(candidate,),
            routed_domains=("运营分析",),
            interaction_id="confirm-gap:partial",
        )

        self.assertEqual(plan.outcome, "partial_answer")
        self.assertTrue(plan.can_deliver_answer)
        self.assertTrue(plan.interaction_required)
        self.assertIs(plan.executable_entries[0], answer_entry)
        self.assertNotIn("gaps", plan.executable_decision or {})
        self.assertEqual(plan.interaction["kind"], "confirm_gap_entry")
        self.assertEqual(
            plan.pending.occurrences,
            (
                {
                    "idempotencyKey": "scope:运营分析:nps趋势",
                    "question": "最近6个月Tokens消耗量和NPS的月度趋势?",
                    "searchTerms": ["NPS 趋势"],
                    "closestCandidates": [
                        {
                            "metricName": "Tokens消耗量",
                            "businessDomain": "运营分析",
                            "definitionDifference": "Tokens 消耗总量",
                        }
                    ],
                    "adHocDefinition": None,
                    "expectedDimensions": ["统计周期"],
                    "expectedGranularity": "month",
                    "businessDomain": "运营分析",
                },
            ),
        )

        before_confirmation = confirm_metric_gaps(
            pending=plan.pending,
            confirmed=False,
        )
        self.assertEqual(before_confirmation.status, "not_recorded")
        self.assertEqual(before_confirmation.events, ())

        confirmed = confirm_metric_gaps(pending=plan.pending, confirmed=True)
        self.assertEqual(confirmed.status, "recorded")
        self.assertEqual(
            confirmed.events,
            ({"type": "metric_gap_recorded", "gap": plan.pending.occurrences[0]},),
        )
        self.assertEqual(
            list(self.step_event_validator.iter_errors(confirmed.events[0])),
            [],
        )

    def test_out_of_scope_without_units_requires_confirmation_interaction(self) -> None:
        candidate = {
            "metricName": "月活客户数",
            "businessDomain": "客户经营",
            "definitionDifference": "这是客户活跃指标，不是员工离职指标",
            "matchedTerm": "员工离职率",
        }

        plan = plan_metric_gap_resolution(
            question="上季度员工离职率是多少?",
            decision={
                "decisionType": "submit_data_request_units",
                "outcome": "out_of_scope",
                "reason": "语义面内没有员工离职率相关指标",
            },
            executable_entries=(),
            candidates=(candidate,),
            routed_domains=("人力资源", "客户经营"),
            interaction_id="confirm-gap:out-of-scope",
        )

        self.assertEqual(plan.outcome, "interaction_required")
        self.assertFalse(plan.can_deliver_answer)
        self.assertTrue(plan.interaction_required)
        self.assertIsNone(plan.executable_decision)
        self.assertEqual(plan.executable_entries, ())
        self.assertEqual(
            plan.interaction,
            {
                "id": "confirm-gap:out-of-scope",
                "kind": "confirm_gap_entry",
                "payload": {
                    "question": "上季度员工离职率是多少?",
                    "entries": [
                        {
                            "businessDomain": "人力资源",
                            "sought": "员工离职率",
                            "adHocFormula": None,
                        }
                    ],
                },
            },
        )
        self.assertEqual(
            plan.pending.occurrences,
            (
                {
                    "idempotencyKey": "scope:人力资源:上季度员工离职率是多少",
                    "question": "上季度员工离职率是多少?",
                    "searchTerms": ["员工离职率"],
                    "closestCandidates": [
                        {
                            "metricName": "月活客户数",
                            "businessDomain": "客户经营",
                            "definitionDifference": (
                                "这是客户活跃指标，不是员工离职指标"
                            ),
                        }
                    ],
                    "adHocDefinition": None,
                    "expectedDimensions": [],
                    "expectedGranularity": None,
                    "businessDomain": "人力资源",
                },
            ),
        )
        self.assertEqual(
            confirm_metric_gaps(pending=plan.pending, confirmed=False).events,
            (),
        )
        confirmed = confirm_metric_gaps(pending=plan.pending, confirmed=True)
        self.assertEqual(confirmed.status, "recorded")
        self.assertEqual(
            list(self.step_event_validator.iter_errors(confirmed.events[0])),
            [],
        )

    def test_gap_only_decision_has_no_answer_and_stops_for_interaction(self) -> None:
        plan = plan_metric_gap_resolution(
            question="给我NPS趋势",
            decision={
                "decisionType": "submit_data_request_units",
                "outcome": "operations",
                "operations": [],
                "gaps": [
                    {
                        "aspect": "NPS 趋势",
                        "reason": "语义面内没有 NPS 指标",
                    }
                ],
            },
            executable_entries=(),
            candidates=(),
            routed_domains=("运营分析",),
            interaction_id="confirm-gap:gap-only",
        )

        self.assertEqual(plan.outcome, "interaction_required")
        self.assertFalse(plan.can_deliver_answer)
        self.assertTrue(plan.interaction_required)
        self.assertEqual(plan.executable_entries, ())
        self.assertIsNotNone(plan.executable_decision)
        self.assertEqual(plan.pending.occurrences[0]["expectedDimensions"], [])
        self.assertIsNone(
            plan.pending.occurrences[0]["expectedGranularity"]
        )

    def test_ad_hoc_gap_is_complete_and_recorded_only_after_scope_confirmation(
        self,
    ) -> None:
        scoped_unit = {
            "businessDomain": "运营分析",
            "metrics": [
                {
                    "kind": "formula",
                    "expression": "计费Tokens量 / Tokens消耗量",
                    "label": "计费占比",
                    "unit": "%",
                    "description": "计费量占总消耗的比例",
                }
            ],
            "groupBy": ["区域"],
            "filters": [],
            "time": {
                "granularity": "month",
                "start": "2026-07",
                "end": "2026-07",
                "providedBy": "user",
            },
        }
        candidates = (
            {
                "metricName": "Tokens消耗量",
                "businessDomain": "运营分析",
                "definition": "统计周期内消耗的 Tokens 总量",
                "matchedTerm": "Tokens消耗量",
            },
            {
                "metricName": "计费Tokens量",
                "businessDomain": "运营分析",
                "definition": "统计周期内参与计费的 Tokens 总量",
                "matchedTerm": "Tokens消耗量",
            },
        )

        pending = prepare_ad_hoc_metric_gap(
            question="上个月各区域的计费占比是多少?",
            unit=scoped_unit,
            candidates=candidates,
        )

        self.assertIsNotNone(pending)
        self.assertEqual(
            pending.occurrences,
            (
                {
                    "idempotencyKey": (
                        "adhoc:运营分析:计费tokens量/tokens消耗量"
                    ),
                    "question": "上个月各区域的计费占比是多少?",
                    "searchTerms": ["Tokens消耗量"],
                    "closestCandidates": [
                        {
                            "metricName": "Tokens消耗量",
                            "businessDomain": "运营分析",
                            "definitionDifference": (
                                "统计周期内消耗的 Tokens 总量"
                            ),
                        },
                        {
                            "metricName": "计费Tokens量",
                            "businessDomain": "运营分析",
                            "definitionDifference": (
                                "统计周期内参与计费的 Tokens 总量"
                            ),
                        },
                    ],
                    "adHocDefinition": {
                        "formula": "计费Tokens量 / Tokens消耗量",
                        "description": "计费量占总消耗的比例",
                    },
                    "expectedDimensions": ["区域"],
                    "expectedGranularity": "month",
                    "businessDomain": "运营分析",
                },
            ),
        )

        rejected = confirm_metric_gaps(pending=pending, confirmed=False)
        self.assertEqual(rejected.status, "not_recorded")
        self.assertEqual(rejected.events, ())

        accepted = confirm_metric_gaps(pending=pending, confirmed=True)
        self.assertEqual(accepted.status, "recorded")
        self.assertEqual(len(accepted.events), 1)
        self.assertEqual(
            list(self.step_event_validator.iter_errors(accepted.events[0])),
            [],
        )

    def test_defined_metric_does_not_prepare_an_ad_hoc_gap(self) -> None:
        self.assertIsNone(
            prepare_ad_hoc_metric_gap(
                question="新增客户数是多少?",
                unit=unit("新增客户数"),
                candidates=(),
            )
        )


if __name__ == "__main__":
    unittest.main()
