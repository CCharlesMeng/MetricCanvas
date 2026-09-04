from __future__ import annotations

import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))
sys.path.insert(0, str(BUNDLE_ROOT / "test-harness"))

from adapters.fakes import FakeDataContextPort  # noqa: E402
from metriccanvas_authoring.application.discover_data_context import (  # noqa: E402
    DiscoverDataContextCommand,
    DiscoverDataContextDependencies,
    create_discover_data_context,
)
from metriccanvas_authoring.domain.agent_core import (  # noqa: E402
    guard_structural_response,
    plan_metric_gap_resolution,
)


def fixture(name: str) -> dict[str, object]:
    return json.loads(
        (BUNDLE_ROOT / "test-harness" / "fixtures" / name).read_text(
            encoding="utf-8"
        )
    )


class DiscoverDataContextHarnessTest(unittest.IsolatedAsyncioTestCase):
    async def test_alias_query_returns_the_canonical_field_match(self) -> None:
        data_context = FakeDataContextPort(fixture("data-context.json"))
        discover = create_discover_data_context(
            DiscoverDataContextDependencies(data_context=data_context)
        )

        result = await discover(DiscoverDataContextCommand(query="大区"))

        self.assertTrue(result.ok)
        self.assertEqual(result.business_domains, ("运营分析",))
        self.assertEqual(result.data_context_version, "2026-09-02.1")
        self.assertEqual(data_context.calls, 1)
        self.assertEqual(len(result.matches), 1)
        self.assertEqual(
            result.matches[0],
            {
                "kind": "field",
                "environmentId": "dqe-primary",
                "schemaId": "operations-analytics",
                "objectId": "operations-surface",
                "field": {
                    "name": "区域",
                    "type": "string",
                    "description": "业务归属区域。取值域:华东、华南。",
                    "aliases": ["大区"],
                    "roleHints": ["dimension"],
                    "nullable": False,
                    "sensitive": False,
                },
            },
        )
        expected_term = {
            "kind": "dimension",
            "matchedTerm": "大区",
            "canonicalName": "区域",
            "businessDomain": "运营分析",
            "source": "alias",
            "score": 52,
            "definition": "业务归属区域。取值域:华东、华南。",
            "start": 0,
            "end": 2,
        }
        self.assertEqual(
            result.resolution,
            {
                "formatVersion": "1.0",
                "question": "大区",
                "candidates": [expected_term],
                "selected": [expected_term],
                "ambiguities": [],
            },
        )
        self.assertIsNone(result.time)
        self.assertIsNone(result.intent)
        self.assertIsNone(result.structure_operation)

    async def test_sensitive_field_is_discoverable_without_its_value_domain(self) -> None:
        snapshot = fixture("data-context.json")
        field = snapshot["executionEnvironments"][0]["schemas"][0]["objects"][0][
            "fields"
        ][0]
        field["sensitive"] = True
        data_context = FakeDataContextPort(snapshot)
        discover = create_discover_data_context(
            DiscoverDataContextDependencies(data_context=data_context)
        )

        alias_result = await discover(DiscoverDataContextCommand(query="大区"))
        secret_result = await discover(DiscoverDataContextCommand(query="华东"))

        self.assertTrue(alias_result.ok)
        self.assertEqual(len(alias_result.matches), 1)
        returned_field = alias_result.matches[0]["field"]
        self.assertTrue(returned_field["sensitive"])
        self.assertEqual(
            returned_field["description"],
            "业务归属区域。取值域:(敏感,已隐去)。",
        )
        self.assertEqual(secret_result.matches, ())
        self.assertEqual(data_context.calls, 2)

    async def test_full_question_falls_back_to_deterministic_term_resolution(self) -> None:
        data_context = FakeDataContextPort(fixture("data-context.json"))
        discover = create_discover_data_context(
            DiscoverDataContextDependencies(
                data_context=data_context,
                now=lambda: datetime(2026, 9, 3, tzinfo=timezone.utc),
            )
        )

        result = await discover(
            DiscoverDataContextCommand(
                query="再加上个月各区域 Tokens请求量趋势",
                limit=10,
            )
        )

        self.assertTrue(result.ok)
        self.assertEqual(
            [match["kind"] for match in result.matches],
            ["metric", "field", "field"],
        )
        self.assertEqual(result.matches[0]["metric"]["name"], "Tokens请求量")
        self.assertEqual(result.matches[1]["field"]["name"], "区域")
        self.assertEqual(result.matches[2]["field"]["name"], "统计周期")
        assert result.resolution is not None
        self.assertEqual(
            [candidate["kind"] for candidate in result.resolution["candidates"]],
            [
                "metric",
                "structure_operation",
                "relative_time",
                "dimension",
                "analysis_intent",
            ],
        )
        self.assertEqual(
            [candidate["kind"] for candidate in result.resolution["selected"]],
            [
                "metric",
                "structure_operation",
                "relative_time",
                "dimension",
                "analysis_intent",
            ],
        )
        self.assertEqual(result.resolution["ambiguities"], [])
        self.assertEqual(
            result.resolution["selected"][0],
            {
                "kind": "metric",
                "matchedTerm": "Tokens请求量",
                "canonicalName": "Tokens请求量",
                "businessDomain": "运营分析",
                "source": "canonical_name",
                "score": 109,
                "definition": "统计期内的模型调用请求次数",
            },
        )
        self.assertEqual(
            result.time,
            {
                "granularity": "month",
                "start": "2026-08",
                "end": "2026-08",
                "providedBy": "user",
            },
        )
        self.assertEqual(result.intent, "trend")
        self.assertEqual(result.structure_operation, "add")

        guard = guard_structural_response(
            question="Tokens请求量",
            unit_count=1,
            decision={"outcome": "operations", "operations": []},
            attempt=1,
            structure_operation=result.structure_operation,
        )
        self.assertEqual(guard.status, "correction_required")
        plan = plan_metric_gap_resolution(
            question="NPS 趋势",
            decision={
                "decisionType": "submit_data_request_units",
                "outcome": "out_of_scope",
                "reason": "没有 NPS 指标",
            },
            executable_entries=(),
            candidates=result.resolution["candidates"],
            routed_domains=("运营分析",),
            interaction_id="confirm-gap:mixed-discovery",
        )
        assert plan.pending is not None
        self.assertEqual(
            [
                candidate["metricName"]
                for candidate in plan.pending.occurrences[0][
                    "closestCandidates"
                ]
            ],
            ["Tokens请求量"],
        )

    async def test_cross_domain_tie_is_returned_as_an_explicit_ambiguity(
        self,
    ) -> None:
        vector = json.loads(
            (
                BUNDLE_ROOT
                / "contracts"
                / "exported"
                / "agent-conformance.json"
            ).read_text(encoding="utf-8")
        )
        data_context = FakeDataContextPort(vector["dataContext"])
        discover = create_discover_data_context(
            DiscoverDataContextDependencies(data_context=data_context)
        )

        result = await discover(DiscoverDataContextCommand(query="客户数"))

        self.assertTrue(result.ok)
        self.assertEqual(
            result.business_domains,
            ("客户活动", "运营分析", "客户经营"),
        )
        assert result.resolution is not None
        self.assertEqual(len(result.resolution["candidates"]), 3)
        self.assertEqual(result.resolution["selected"], [])
        self.assertEqual(
            result.resolution["ambiguities"],
            [
                {
                    "matchedTerm": "客户数",
                    "candidates": [
                        {
                            "kind": "metric",
                            "canonicalName": "客户数",
                            "businessDomain": "客户经营",
                            "score": 103,
                            "definition": "期末在册客户总数,与运营分析域的在用调用口径不同",
                        },
                        {
                            "kind": "metric",
                            "canonicalName": "客户数",
                            "businessDomain": "运营分析",
                            "score": 103,
                            "definition": "统计期内发起过模型调用的去重客户数,与客户经营域的期末在册口径不同",
                        },
                        {
                            "kind": "metric",
                            "canonicalName": "NA客户数",
                            "businessDomain": "客户活动",
                            "score": 53,
                            "definition": "符合当前查询条件的 NA 客户数量",
                        },
                    ],
                }
            ],
        )

    async def test_success_without_a_known_term_has_empty_resolution_arrays(
        self,
    ) -> None:
        discover = create_discover_data_context(
            DiscoverDataContextDependencies(
                data_context=FakeDataContextPort(fixture("data-context.json"))
            )
        )

        result = await discover(DiscoverDataContextCommand(query="完全未知的词"))

        self.assertTrue(result.ok)
        self.assertEqual(result.matches, ())
        self.assertEqual(
            result.resolution,
            {
                "formatVersion": "1.0",
                "question": "完全未知的词",
                "candidates": [],
                "selected": [],
                "ambiguities": [],
            },
        )

    async def test_invalid_data_context_has_no_partial_resolution(self) -> None:
        snapshot = fixture("data-context.json")
        del snapshot["version"]
        discover = create_discover_data_context(
            DiscoverDataContextDependencies(
                data_context=FakeDataContextPort(snapshot)
            )
        )

        result = await discover(DiscoverDataContextCommand(query="大区"))

        self.assertFalse(result.ok)
        self.assertEqual(result.business_domains, ())
        self.assertIsNone(result.resolution)
        self.assertEqual(result.matches, ())
        self.assertIsNone(result.time)
        self.assertIsNone(result.intent)
        self.assertIsNone(result.structure_operation)


if __name__ == "__main__":
    unittest.main()
