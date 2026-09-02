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
            document["sections"][0]["components"][0],
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


if __name__ == "__main__":
    unittest.main()
