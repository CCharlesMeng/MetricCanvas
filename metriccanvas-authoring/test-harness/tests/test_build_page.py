from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))
sys.path.insert(0, str(BUNDLE_ROOT / "test-harness"))

from adapters.fakes import (  # noqa: E402
    FakeDataContextPort,
    FakeDqeExecutionPort,
    FakePageAssetPort,
)
from metriccanvas_authoring.application.build_page import (  # noqa: E402
    BuildPageCommand,
    BuildPageDependencies,
    create_build_page,
)
from metriccanvas_authoring.application.ports import (  # noqa: E402
    DqeExecutionResult,
    SavedRevision,
)
from metriccanvas_authoring.domain.page_validation import validate_page_schema  # noqa: E402


def fixture(name: str) -> dict[str, object]:
    return json.loads(
        (BUNDLE_ROOT / "test-harness" / "fixtures" / name).read_text(
            encoding="utf-8"
        )
    )


def first_bound_component(document: dict[str, object]) -> dict[str, object]:
    for section in document["sections"]:
        for component in section["components"]:
            if "data" in component:
                return component
    raise AssertionError("document has no data-bound component")


class RuntimeQueryError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class BuildPageHarnessTest(unittest.IsolatedAsyncioTestCase):
    async def test_valid_spec_builds_and_saves_a_current_page_revision(self) -> None:
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(
            DqeExecutionResult(
                rows=[
                    {"区域": "华东", "Tokens请求量": 18},
                    {"区域": "华南", "Tokens请求量": 12},
                ],
                total_count=2,
                captured_at="2026-09-02T00:00:01.000Z",
            )
        )
        pages = FakePageAssetPort(SavedRevision("tokens-by-region", "revision-1", 1))
        build_page = create_build_page(
            BuildPageDependencies(
                data_context=data_context,
                dqe=dqe,
                page_assets=pages,
            )
        )

        result = await build_page(
            BuildPageCommand(
                page_id="tokens-by-region",
                idempotency_key="build:tokens-by-region:1",
                page_id_confirmed=True,
                spec=fixture("page-build-spec.json"),
            )
        )

        self.assertTrue(result.ok)
        self.assertEqual(
            result.saved_revision,
            SavedRevision("tokens-by-region", "revision-1", 1),
        )
        self.assertEqual(data_context.calls, 1)
        self.assertEqual(
            dqe.calls,
            [
                {
                    "language": "dqe",
                    "body": {
                        "dsl_list": [
                            {
                                "output_dims": ["区域"],
                                "output_metrics": ["Tokens请求量"],
                                "filter": {
                                    "time": {
                                        "period": "month",
                                        "start": "2026-08",
                                        "end": "2026-08",
                                    },
                                    "dims": [],
                                    "metrics": [],
                                },
                                "order": {},
                            }
                        ]
                    },
                    "fieldMappings": {
                        "field-1": {
                            "queryField": "区域",
                            "type": "string",
                            "role": "dimension",
                            "label": "区域",
                            "nullable": False,
                        },
                        "field-2": {
                            "queryField": "Tokens请求量",
                            "type": "number",
                            "role": "measure",
                            "label": "Tokens请求量",
                            "unit": "次",
                            "nullable": False,
                        },
                    },
                    "filterValues": [],
                }
            ],
        )
        self.assertEqual(len(pages.calls), 1)
        save_command = pages.calls[0]
        self.assertEqual(save_command["pageId"], "tokens-by-region")
        self.assertIsNone(save_command["baseRevisionId"])
        self.assertEqual(save_command["idempotencyKey"], "build:tokens-by-region:1")
        self.assertTrue(save_command["pageIdConfirmed"])

        document = save_command["document"]
        self.assertEqual(validate_page_schema(document), [])
        self.assertEqual(document["schemaVersion"], "5.4")
        self.assertEqual(document["id"], "tokens-by-region")
        self.assertEqual(
            document["dataSources"]["unit-1"]["source"]["initial"],
            {
                "capturedAt": "2026-09-02T00:00:01.000Z",
                "rows": [
                    {"区域": "华东", "Tokens请求量": 18},
                    {"区域": "华南", "Tokens请求量": 12},
                ],
                "totalCount": 2,
            },
        )
        self.assertEqual(
            first_bound_component(document),
            {
                "id": "unit-1-bar-chart",
                "type": "barChart",
                "layout": {"span": 12},
                "data": {"main": "unit-1"},
                "props": {
                    "title": "各区域 Tokens 请求量",
                    "categoryField": "field-1",
                    "series": [{"field": "field-2", "label": "Tokens请求量"}],
                },
            },
        )

    async def test_invalid_data_context_stops_before_execution_and_save(self) -> None:
        snapshot = fixture("data-context.json")
        snapshot.pop("formatVersion")
        data_context = FakeDataContextPort(snapshot)
        dqe = FakeDqeExecutionPort(DqeExecutionResult(rows=[]))
        pages = FakePageAssetPort(SavedRevision("unused", "unused", 1))
        build_page = create_build_page(
            BuildPageDependencies(
                data_context=data_context,
                dqe=dqe,
                page_assets=pages,
            )
        )

        result = await build_page(
            BuildPageCommand(
                page_id="tokens-by-region",
                idempotency_key="build:tokens-by-region:invalid-context",
                spec=fixture("page-build-spec.json"),
            )
        )

        self.assertFalse(result.ok)
        self.assertEqual(
            [(issue.code, issue.path) for issue in result.issues],
            [("DATA_CONTEXT_SCHEMA_ERROR", "/formatVersion")],
        )
        self.assertEqual(data_context.calls, 1)
        self.assertEqual(dqe.calls, [])
        self.assertEqual(pages.calls, [])

    async def test_unpinned_comparison_selects_bar_chart(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["units"][0].pop("pinnedComponent")
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(
            DqeExecutionResult(
                rows=[{"区域": "华东", "Tokens请求量": 18}],
                captured_at="2026-09-02T00:00:01.000Z",
            )
        )
        pages = FakePageAssetPort(SavedRevision("tokens-by-region", "revision-1", 1))
        build_page = create_build_page(
            BuildPageDependencies(
                data_context=data_context,
                dqe=dqe,
                page_assets=pages,
            )
        )

        result = await build_page(
            BuildPageCommand(
                page_id="tokens-by-region",
                idempotency_key="build:tokens-by-region:auto-component",
                spec=spec,
            )
        )

        self.assertTrue(result.ok, result.issues)
        component = first_bound_component(pages.calls[0]["document"])
        self.assertEqual(component["type"], "barChart")

    async def test_incompatible_pinned_component_stops_before_save(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["units"][0]["pinnedComponent"] = "metricCard"
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(
            DqeExecutionResult(
                rows=[
                    {"区域": "华东", "Tokens请求量": 18},
                    {"区域": "华南", "Tokens请求量": 12},
                ]
            )
        )
        pages = FakePageAssetPort(SavedRevision("unused", "unused", 1))
        build_page = create_build_page(
            BuildPageDependencies(
                data_context=data_context,
                dqe=dqe,
                page_assets=pages,
            )
        )

        result = await build_page(
            BuildPageCommand(
                page_id="tokens-by-region",
                idempotency_key="build:tokens-by-region:blocked-component",
                spec=spec,
            )
        )

        self.assertFalse(result.ok)
        self.assertEqual(
            [(issue.stage, issue.code, issue.path) for issue in result.issues],
            [
                (
                    "presentation",
                    "PINNED_COMPONENT_REJECTED",
                    "/units/0/pinnedComponent",
                )
            ],
        )
        self.assertEqual(data_context.calls, 1)
        self.assertEqual(len(dqe.calls), 1)
        self.assertEqual(pages.calls, [])

    async def test_unpinned_trend_selects_line_chart(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["units"][0]["groupBy"] = ["统计周期"]
        spec["units"][0]["intent"] = "trend"
        spec["units"][0].pop("pinnedComponent")
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(
            DqeExecutionResult(
                rows=[{"统计周期": "2026-08", "Tokens请求量": 18}],
                captured_at="2026-09-02T00:00:01.000Z",
            )
        )
        pages = FakePageAssetPort(SavedRevision("tokens-trend", "revision-1", 1))
        build_page = create_build_page(
            BuildPageDependencies(
                data_context=data_context,
                dqe=dqe,
                page_assets=pages,
            )
        )

        result = await build_page(
            BuildPageCommand(
                page_id="tokens-trend",
                idempotency_key="build:tokens-trend:auto-component",
                spec=spec,
            )
        )

        self.assertTrue(result.ok)
        document = pages.calls[0]["document"]
        component = first_bound_component(document)
        self.assertEqual(component["type"], "lineChart")
        self.assertEqual(component["props"]["xField"], "field-1")
        self.assertEqual(document["dataSources"]["unit-1"]["fields"]["field-1"]["type"], "string")

    async def test_unpinned_summary_selects_metric_card(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["units"][0]["groupBy"] = []
        spec["units"][0]["intent"] = "single_value"
        spec["units"][0].pop("pinnedComponent")
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(
            DqeExecutionResult(
                rows=[{"Tokens请求量": 30}],
                captured_at="2026-09-02T00:00:01.000Z",
            )
        )
        pages = FakePageAssetPort(SavedRevision("tokens-summary", "revision-1", 1))
        build_page = create_build_page(
            BuildPageDependencies(
                data_context=data_context,
                dqe=dqe,
                page_assets=pages,
            )
        )

        result = await build_page(
            BuildPageCommand(
                page_id="tokens-summary",
                idempotency_key="build:tokens-summary:auto-component",
                spec=spec,
            )
        )

        self.assertTrue(result.ok, result.issues)
        component = first_bound_component(pages.calls[0]["document"])
        self.assertEqual(component["type"], "metricCard")
        self.assertEqual(
            component["props"]["rows"],
            [{"label": "Tokens请求量", "valueField": "field-1"}],
        )

    async def test_unpinned_composition_selects_pie_chart(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["units"][0]["intent"] = "composition"
        spec["units"][0].pop("pinnedComponent")
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(
            DqeExecutionResult(
                rows=[
                    {"区域": "华东", "Tokens请求量": 18},
                    {"区域": "华南", "Tokens请求量": 12},
                ]
            )
        )
        pages = FakePageAssetPort(SavedRevision("tokens-share", "revision-1", 1))
        build_page = create_build_page(
            BuildPageDependencies(
                data_context=data_context,
                dqe=dqe,
                page_assets=pages,
            )
        )

        result = await build_page(
            BuildPageCommand(
                page_id="tokens-share",
                idempotency_key="build:tokens-share:auto-component",
                spec=spec,
            )
        )

        self.assertTrue(result.ok, result.issues)
        component = first_bound_component(pages.calls[0]["document"])
        self.assertEqual(component["type"], "pieChart")
        self.assertEqual(component["props"]["categoryField"], "field-1")
        self.assertEqual(component["props"]["valueField"], "field-2")

    async def test_unpinned_ranking_selects_ranking_card(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["units"][0]["intent"] = "ranking"
        spec["units"][0].pop("pinnedComponent")
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(
            DqeExecutionResult(rows=[{"区域": "华东", "Tokens请求量": 18}])
        )
        pages = FakePageAssetPort(SavedRevision("tokens-ranking", "revision-1", 1))
        build_page = create_build_page(
            BuildPageDependencies(
                data_context=data_context,
                dqe=dqe,
                page_assets=pages,
            )
        )

        result = await build_page(
            BuildPageCommand(
                page_id="tokens-ranking",
                idempotency_key="build:tokens-ranking:auto-component",
                spec=spec,
            )
        )

        self.assertTrue(result.ok, result.issues)
        component = first_bound_component(pages.calls[0]["document"])
        self.assertEqual(component["type"], "rankingCard")
        self.assertEqual(component["props"]["nameField"], "field-1")
        self.assertEqual(component["props"]["valueField"], "field-2")

    async def test_unpinned_detail_selects_table(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["units"][0]["intent"] = "detail"
        spec["units"][0].pop("pinnedComponent")
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(
            DqeExecutionResult(
                rows=[
                    {"区域": f"区域-{index}", "Tokens请求量": index}
                    for index in range(4)
                ]
            )
        )
        pages = FakePageAssetPort(SavedRevision("tokens-detail", "revision-1", 1))
        build_page = create_build_page(
            BuildPageDependencies(
                data_context=data_context,
                dqe=dqe,
                page_assets=pages,
            )
        )

        result = await build_page(
            BuildPageCommand(
                page_id="tokens-detail",
                idempotency_key="build:tokens-detail:auto-component",
                spec=spec,
            )
        )

        self.assertTrue(result.ok, result.issues)
        component = first_bound_component(pages.calls[0]["document"])
        self.assertEqual(component["type"], "table")
        self.assertEqual(
            component["props"]["columns"],
            [
                {"field": "field-1", "title": "区域"},
                {"field": "field-2", "title": "Tokens请求量"},
            ],
        )

    async def test_page_header_and_content_sections_are_derived_from_scope(self) -> None:
        spec = fixture("page-build-spec.json")
        summary_unit = json.loads(json.dumps(spec["units"][0]))
        summary_unit["groupBy"] = []
        summary_unit["intent"] = "single_value"
        summary_unit.pop("pinnedComponent")
        spec["units"].append(summary_unit)
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(
            DqeExecutionResult(
                rows=[
                    {"区域": "华东", "Tokens请求量": 18},
                    {"区域": "华南", "Tokens请求量": 12},
                ],
                captured_at="2026-09-02T00:00:01.000Z",
            )
        )
        pages = FakePageAssetPort(SavedRevision("tokens-scopes", "revision-1", 1))
        build_page = create_build_page(
            BuildPageDependencies(
                data_context=data_context,
                dqe=dqe,
                page_assets=pages,
            )
        )

        result = await build_page(
            BuildPageCommand(
                page_id="tokens-scopes",
                idempotency_key="build:tokens-scopes:1",
                spec=spec,
            )
        )

        self.assertTrue(result.ok, result.issues)
        sections = pages.calls[0]["document"]["sections"]
        self.assertEqual(
            sections[0],
            {
                "id": "header",
                "container": "plain",
                "components": [
                    {
                        "id": "page-header",
                        "type": "reportHeader",
                        "layout": {"span": 12},
                        "props": {
                            "title": "运营分析",
                            "asOf": {
                                "label": "数据窗口",
                                "value": "2026-08 ~ 2026-08(月)",
                            },
                        },
                    }
                ],
            },
        )
        self.assertEqual(
            [
                (section["id"], section["title"], section["components"][0]["type"])
                for section in sections[1:]
            ],
            [
                ("scope-1", "按区域", "barChart"),
                ("scope-2", "总量", "metricCard"),
            ],
        )

    async def test_same_scope_components_share_one_fully_packed_row(self) -> None:
        spec = fixture("page-build-spec.json")
        second_unit = json.loads(json.dumps(spec["units"][0]))
        second_unit["title"] = "同口径对比二"
        spec["units"].append(second_unit)
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(
            DqeExecutionResult(rows=[{"区域": "华东", "Tokens请求量": 18}])
        )
        pages = FakePageAssetPort(SavedRevision("tokens-packed", "revision-1", 1))
        build_page = create_build_page(
            BuildPageDependencies(
                data_context=data_context,
                dqe=dqe,
                page_assets=pages,
            )
        )

        result = await build_page(
            BuildPageCommand(
                page_id="tokens-packed",
                idempotency_key="build:tokens-packed:1",
                spec=spec,
            )
        )

        self.assertTrue(result.ok, result.issues)
        sections = pages.calls[0]["document"]["sections"]
        self.assertEqual([section["id"] for section in sections], ["header", "main"])
        self.assertEqual(
            [component["layout"]["span"] for component in sections[1]["components"]],
            [6, 6],
        )

    async def test_unknown_business_domain_stops_before_execution_and_save(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["units"][0]["businessDomain"] = "不存在的业务域"
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(
            DqeExecutionResult(
                rows=[],
                captured_at="2026-09-02T00:00:01.000Z",
            )
        )
        pages = FakePageAssetPort(SavedRevision("unused", "unused", 1))
        build_page = create_build_page(
            BuildPageDependencies(
                data_context=data_context,
                dqe=dqe,
                page_assets=pages,
            )
        )

        result = await build_page(
            BuildPageCommand(
                page_id="tokens-by-region",
                idempotency_key="build:tokens-by-region:unknown-domain",
                spec=spec,
            )
        )

        self.assertFalse(result.ok)
        self.assertEqual(
            [(issue.code, issue.path) for issue in result.issues],
            [("DATA_CONTEXT_NAME_NOT_FOUND", "/units/0/businessDomain")],
        )
        self.assertEqual(data_context.calls, 1)
        self.assertEqual(dqe.calls, [])
        self.assertEqual(pages.calls, [])

    async def test_unknown_metric_stops_before_execution_and_save(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["units"][0]["metrics"][0]["name"] = "不存在的指标"
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(DqeExecutionResult(rows=[]))
        pages = FakePageAssetPort(SavedRevision("unused", "unused", 1))
        build_page = create_build_page(
            BuildPageDependencies(
                data_context=data_context,
                dqe=dqe,
                page_assets=pages,
            )
        )

        result = await build_page(
            BuildPageCommand(
                page_id="tokens-by-region",
                idempotency_key="build:tokens-by-region:unknown-metric",
                spec=spec,
            )
        )

        self.assertFalse(result.ok)
        self.assertEqual(
            [(issue.code, issue.path) for issue in result.issues],
            [("DATA_CONTEXT_NAME_NOT_FOUND", "/units/0/metrics/0/name")],
        )
        self.assertEqual(data_context.calls, 1)
        self.assertEqual(dqe.calls, [])
        self.assertEqual(pages.calls, [])

    async def test_unknown_dimension_stops_before_execution_and_save(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["units"][0]["groupBy"][0] = "不存在的维度"
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(DqeExecutionResult(rows=[]))
        pages = FakePageAssetPort(SavedRevision("unused", "unused", 1))
        build_page = create_build_page(
            BuildPageDependencies(
                data_context=data_context,
                dqe=dqe,
                page_assets=pages,
            )
        )

        result = await build_page(
            BuildPageCommand(
                page_id="tokens-by-region",
                idempotency_key="build:tokens-by-region:unknown-dimension",
                spec=spec,
            )
        )

        self.assertFalse(result.ok)
        self.assertEqual(
            [(issue.code, issue.path) for issue in result.issues],
            [("DATA_CONTEXT_NAME_NOT_FOUND", "/units/0/groupBy/0")],
        )
        self.assertEqual(data_context.calls, 1)
        self.assertEqual(dqe.calls, [])
        self.assertEqual(pages.calls, [])

    async def test_data_context_aliases_are_canonicalized_before_dqe(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["units"][0]["groupBy"] = ["大区"]
        spec["units"][0]["metrics"][0]["name"] = "调用次数"
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(
            DqeExecutionResult(
                rows=[{"区域": "华东", "Tokens请求量": 18}],
                captured_at="2026-09-02T00:00:01.000Z",
            )
        )
        pages = FakePageAssetPort(SavedRevision("tokens-by-region", "revision-1", 1))
        build_page = create_build_page(
            BuildPageDependencies(
                data_context=data_context,
                dqe=dqe,
                page_assets=pages,
            )
        )

        result = await build_page(
            BuildPageCommand(
                page_id="tokens-by-region",
                idempotency_key="build:tokens-by-region:aliases",
                page_id_confirmed=True,
                spec=spec,
            )
        )

        self.assertTrue(result.ok)
        effective_query = dqe.calls[0]
        query_item = effective_query["body"]["dsl_list"][0]
        self.assertEqual(query_item["output_dims"], ["区域"])
        self.assertEqual(query_item["output_metrics"], ["Tokens请求量"])
        self.assertEqual(
            effective_query["fieldMappings"],
            {
                "field-1": {
                    "queryField": "区域",
                    "type": "string",
                    "role": "dimension",
                    "label": "区域",
                    "nullable": False,
                },
                "field-2": {
                    "queryField": "Tokens请求量",
                    "type": "number",
                    "role": "measure",
                    "label": "Tokens请求量",
                    "unit": "次",
                    "nullable": False,
                },
            },
        )

    async def test_formula_metric_becomes_dqe_formula_and_declared_field(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["units"][0]["metrics"] = [
            {
                "kind": "formula",
                "expression": "Tokens请求量 / 1000",
                "label": "千次请求量",
                "unit": "千次",
            }
        ]
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(
            DqeExecutionResult(
                rows=[{"区域": "华东", "千次请求量": 0.018}],
                captured_at="2026-09-02T00:00:01.000Z",
            )
        )
        pages = FakePageAssetPort(SavedRevision("tokens-by-region", "revision-1", 1))
        build_page = create_build_page(
            BuildPageDependencies(
                data_context=data_context,
                dqe=dqe,
                page_assets=pages,
            )
        )

        result = await build_page(
            BuildPageCommand(
                page_id="tokens-by-region",
                idempotency_key="build:tokens-by-region:formula",
                page_id_confirmed=True,
                spec=spec,
            )
        )

        self.assertTrue(result.ok)
        effective_query = dqe.calls[0]
        self.assertEqual(
            effective_query["body"]["dsl_list"][0]["output_metrics"],
            [{"formula": "Tokens请求量 / 1000", "alias": "千次请求量"}],
        )
        self.assertEqual(
            effective_query["fieldMappings"]["field-2"],
            {
                "queryField": "千次请求量",
                "type": "number",
                "role": "measure",
                "label": "千次请求量",
                "unit": "千次",
                "nullable": False,
            },
        )

    async def test_filter_dimension_alias_is_canonicalized_before_dqe(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["units"][0]["filters"] = [{"dimension": "大区", "values": ["华东"]}]
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(
            DqeExecutionResult(
                rows=[{"区域": "华东", "Tokens请求量": 18}],
                captured_at="2026-09-02T00:00:01.000Z",
            )
        )
        pages = FakePageAssetPort(SavedRevision("tokens-by-region", "revision-1", 1))
        build_page = create_build_page(
            BuildPageDependencies(
                data_context=data_context,
                dqe=dqe,
                page_assets=pages,
            )
        )

        result = await build_page(
            BuildPageCommand(
                page_id="tokens-by-region",
                idempotency_key="build:tokens-by-region:filter-alias",
                page_id_confirmed=True,
                spec=spec,
            )
        )

        self.assertTrue(result.ok)
        self.assertEqual(
            dqe.calls[0]["body"]["dsl_list"][0]["filter"]["dims"],
            [{"dim_name": "区域", "dim_value_list": ["华东"]}],
        )

    async def test_unknown_filter_dimension_stops_before_execution_and_save(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["units"][0]["filters"] = [
            {"dimension": "不存在的筛选维度", "values": ["华东"]}
        ]
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(DqeExecutionResult(rows=[]))
        pages = FakePageAssetPort(SavedRevision("unused", "unused", 1))
        build_page = create_build_page(
            BuildPageDependencies(
                data_context=data_context,
                dqe=dqe,
                page_assets=pages,
            )
        )

        result = await build_page(
            BuildPageCommand(
                page_id="tokens-by-region",
                idempotency_key="build:tokens-by-region:unknown-filter",
                spec=spec,
            )
        )

        self.assertFalse(result.ok)
        self.assertEqual(
            [(issue.code, issue.path) for issue in result.issues],
            [("DATA_CONTEXT_NAME_NOT_FOUND", "/units/0/filters/0/dimension")],
        )
        self.assertEqual(data_context.calls, 1)
        self.assertEqual(dqe.calls, [])
        self.assertEqual(pages.calls, [])

    async def test_unknown_filter_value_stops_before_execution_and_save(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["units"][0]["filters"] = [{"dimension": "区域", "values": ["东北"]}]
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(DqeExecutionResult(rows=[]))
        pages = FakePageAssetPort(SavedRevision("unused", "unused", 1))
        build_page = create_build_page(
            BuildPageDependencies(
                data_context=data_context,
                dqe=dqe,
                page_assets=pages,
            )
        )

        result = await build_page(
            BuildPageCommand(
                page_id="tokens-by-region",
                idempotency_key="build:tokens-by-region:unknown-filter-value",
                spec=spec,
            )
        )

        self.assertFalse(result.ok)
        self.assertEqual(
            [(issue.code, issue.path) for issue in result.issues],
            [("DIMENSION_VALUE_NOT_IN_DATA_CONTEXT", "/units/0/filters/0/values/0")],
        )
        self.assertEqual(data_context.calls, 1)
        self.assertEqual(dqe.calls, [])
        self.assertEqual(pages.calls, [])

    async def test_unknown_time_granularity_stops_before_execution_and_save(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["units"][0]["time"]["granularity"] = "quarter"
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(DqeExecutionResult(rows=[]))
        pages = FakePageAssetPort(SavedRevision("unused", "unused", 1))
        build_page = create_build_page(
            BuildPageDependencies(
                data_context=data_context,
                dqe=dqe,
                page_assets=pages,
            )
        )

        result = await build_page(
            BuildPageCommand(
                page_id="tokens-by-region",
                idempotency_key="build:tokens-by-region:unknown-time-granularity",
                spec=spec,
            )
        )

        self.assertFalse(result.ok)
        self.assertEqual(
            [(issue.code, issue.path) for issue in result.issues],
            [("TIME_GRANULARITY_NOT_IN_DATA_CONTEXT", "/units/0/time/granularity")],
        )
        self.assertEqual(data_context.calls, 1)
        self.assertEqual(dqe.calls, [])
        self.assertEqual(pages.calls, [])

    async def test_runtime_query_errors_keep_their_code_and_authoring_stage(self) -> None:
        cases = [
            ("DQE_CONFIG_ERROR", "generation"),
            ("DQE_TIMEOUT", "execution"),
            ("DQE_ROW_CONTRACT_ERROR", "presentation"),
            ("UNCLASSIFIED_DQE_ERROR", "execution"),
        ]
        for error_code, expected_stage in cases:
            with self.subTest(error_code=error_code):
                data_context = FakeDataContextPort(fixture("data-context.json"))
                dqe = FakeDqeExecutionPort(
                    error=RuntimeQueryError(error_code, "query failed")
                )
                pages = FakePageAssetPort(SavedRevision("unused", "unused", 1))
                build_page = create_build_page(
                    BuildPageDependencies(
                        data_context=data_context,
                        dqe=dqe,
                        page_assets=pages,
                    )
                )

                result = await build_page(
                    BuildPageCommand(
                        page_id="tokens-by-region",
                        idempotency_key=f"build:tokens-by-region:{error_code}",
                        spec=fixture("page-build-spec.json"),
                    )
                )

                self.assertFalse(result.ok)
                self.assertEqual(
                    [
                        (issue.stage, issue.code, issue.path)
                        for issue in result.issues
                    ],
                    [(expected_stage, error_code, "/units/0")],
                )
                self.assertEqual(data_context.calls, 1)
                self.assertEqual(len(dqe.calls), 1)
                self.assertEqual(pages.calls, [])


if __name__ == "__main__":
    unittest.main()
