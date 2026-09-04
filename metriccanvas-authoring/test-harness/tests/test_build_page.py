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
from metriccanvas_authoring.application.bundle_info import load_bundle_info  # noqa: E402
from metriccanvas_authoring.domain.idempotency import derive_idempotency_key  # noqa: E402
from metriccanvas_authoring.domain.page_validation import validate_page_document  # noqa: E402


def fixture(name: str) -> dict[str, object]:
    return json.loads(
        (BUNDLE_ROOT / "test-harness" / "fixtures" / name).read_text(
            encoding="utf-8"
        )
    )


def exported_contract(name: str) -> dict[str, object]:
    return json.loads(
        (BUNDLE_ROOT / "contracts" / "exported" / name).read_text(
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
    async def test_matches_typescript_build_page_conformance_vector(self) -> None:
        vector = exported_contract("build-page-conformance.json")
        vector_input = vector["input"]
        execution = vector_input["executions"][0]
        data_context = FakeDataContextPort(vector_input["dataContext"])
        dqe = FakeDqeExecutionPort(
            DqeExecutionResult(
                rows=execution["rows"],
                total_count=execution.get("totalCount"),
                captured_at=execution.get("capturedAt"),
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
        command = vector_input["command"]

        result = await build_page(
            BuildPageCommand(
                page_id=command["pageId"],
                page_id_confirmed=command["pageIdConfirmed"],
                spec=vector_input["spec"],
            )
        )

        self.assertTrue(result.ok, result.issues)
        self.assertEqual(dqe.calls, vector["expected"]["effectiveQueries"])
        self.assertEqual(
            pages.calls[0]["document"], vector["expected"]["document"]
        )

    async def test_matches_typescript_manifest_error_conformance_vectors(self) -> None:
        vector = exported_contract("build-page-conformance.json")
        for case in vector["errorCases"]:
            with self.subTest(case=case["case"]):
                data_context = FakeDataContextPort(case["input"]["dataContext"])
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
                        page_id="error-conformance",
                        spec=case["input"]["spec"],
                    )
                )

                self.assertFalse(result.ok)
                self.assertEqual(
                    [(issue.code, issue.path) for issue in result.issues],
                    [
                        (issue["code"], issue["path"])
                        for issue in case["expectedIssues"]
                    ],
                )
                self.assertEqual(dqe.calls, [])
                self.assertEqual(pages.calls, [])

    async def test_matches_typescript_page_validation_error_vectors(self) -> None:
        vector = exported_contract("build-page-conformance.json")
        vector_input = vector["input"]
        for case in vector["pageValidationErrorCases"]:
            with self.subTest(case=case["case"]):
                execution = case["execution"]
                dqe = FakeDqeExecutionPort(
                    DqeExecutionResult(
                        rows=execution["rows"],
                        total_count=execution.get("totalCount"),
                        captured_at=execution.get("capturedAt"),
                    )
                )
                pages = FakePageAssetPort(SavedRevision("unused", "unused", 1))
                build_page = create_build_page(
                    BuildPageDependencies(
                        data_context=FakeDataContextPort(vector_input["dataContext"]),
                        dqe=dqe,
                        page_assets=pages,
                    )
                )

                result = await build_page(
                    BuildPageCommand(
                        page_id="error-conformance",
                        spec=vector_input["spec"],
                    )
                )

                self.assertFalse(result.ok)
                self.assertEqual(
                    [(issue.code, issue.path, issue.stage) for issue in result.issues],
                    [
                        (issue["type"], issue["path"], "presentation")
                        for issue in case["expectedIssues"]
                    ],
                )
                self.assertEqual(len(dqe.calls), 1)
                self.assertEqual(pages.calls, [])

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
                page_id_confirmed=True,
                spec=fixture("page-build-spec.json"),
            )
        )

        self.assertTrue(result.ok)
        self.assertEqual(
            result.completed_stages,
            ("discovery", "generation", "execution", "presentation", "save"),
        )
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
        self.assertEqual(
            save_command["idempotencyKey"],
            derive_idempotency_key("tokens-by-region", None, fixture("page-build-spec.json")),
        )
        self.assertTrue(save_command["pageIdConfirmed"])
        self.assertEqual(
            save_command["source"],
            {"type": "relay", "skillVersion": load_bundle_info()["bundleVersion"]},
        )
        self.assertEqual(save_command["dataContextVersion"], "2026-09-02.1")

        document = save_command["document"]
        self.assertEqual(validate_page_document(document), [])
        self.assertEqual(document["schemaVersion"], "5.4")
        self.assertEqual(document["id"], "tokens-by-region")
        self.assertEqual(
            document["dataSources"]["result"]["source"]["initial"],
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
                "id": "result-bar-chart",
                "type": "barChart",
                "layout": {"span": 12},
                "data": {"main": "result"},
                "props": {
                    "title": "各区域 Tokens 请求量",
                    "categoryField": "field-1",
                    "series": [{"field": "field-2", "label": "Tokens请求量"}],
                },
            },
        )

    async def test_idempotency_key_is_derived_from_page_base_and_spec(self) -> None:
        spec = fixture("page-build-spec.json")
        base = {"pageId": "tokens-by-region", "revisionId": "a" * 32, "revisionNumber": 1}
        same = derive_idempotency_key("tokens-by-region", "a" * 32, {**spec, "baseRevision": base})
        reordered = derive_idempotency_key(
            "tokens-by-region",
            "a" * 32,
            dict(reversed(list({**spec, "baseRevision": base}.items()))),
        )
        self.assertEqual(same, reordered)
        self.assertEqual(len(same), 64)
        self.assertNotEqual(same, derive_idempotency_key("other-page", "a" * 32, spec))
        self.assertNotEqual(same, derive_idempotency_key("tokens-by-region", None, spec))
        changed = json.loads(json.dumps(spec))
        changed["units"][0]["title"] = "另一个标题"
        self.assertNotEqual(same, derive_idempotency_key("tokens-by-region", "a" * 32, changed))

    async def test_same_intent_twice_sends_the_same_key_and_base_revision(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["baseRevision"] = {
            "pageId": "tokens-by-region",
            "revisionId": "b" * 32,
            "revisionNumber": 3,
        }
        pages = FakePageAssetPort(SavedRevision("tokens-by-region", "revision-4", 4))
        build_page = create_build_page(
            BuildPageDependencies(
                data_context=FakeDataContextPort(fixture("data-context.json")),
                dqe=FakeDqeExecutionPort(
                    DqeExecutionResult(rows=[{"区域": "华东", "Tokens请求量": 18}])
                ),
                page_assets=pages,
            )
        )
        command = BuildPageCommand(
            page_id="tokens-by-region",
            spec=spec,
            session_id="relay-session-9",
            run_id="run-42",
        )

        first = await build_page(command)
        second = await build_page(command)

        self.assertTrue(first.ok and second.ok)
        self.assertEqual(pages.calls[0]["idempotencyKey"], pages.calls[1]["idempotencyKey"])
        self.assertEqual(pages.calls[0]["baseRevisionId"], "b" * 32)
        self.assertEqual(
            pages.calls[0]["source"],
            {
                "type": "relay",
                "skillVersion": load_bundle_info()["bundleVersion"],
                "sessionId": "relay-session-9",
                "runId": "run-42",
            },
        )

    async def test_base_revision_of_another_page_stops_before_discovery(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["baseRevision"] = {"pageId": "some-other-page", "revisionId": "c" * 32, "revisionNumber": 1}
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(DqeExecutionResult(rows=[]))
        pages = FakePageAssetPort(SavedRevision("unused", "unused", 1))
        build_page = create_build_page(
            BuildPageDependencies(data_context=data_context, dqe=dqe, page_assets=pages)
        )

        result = await build_page(BuildPageCommand(page_id="tokens-by-region", spec=spec))

        self.assertFalse(result.ok)
        self.assertEqual(
            [(issue.code, issue.path, issue.stage) for issue in result.issues],
            [("BASE_REVISION_PAGE_ID_MISMATCH", "/baseRevision/pageId", "generation")],
        )
        self.assertEqual(data_context.calls, 0)
        self.assertEqual(dqe.calls, [])
        self.assertEqual(pages.calls, [])

    async def test_save_failure_preserves_code_and_completed_stages(self) -> None:
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(
            DqeExecutionResult(
                rows=[{"区域": "华东", "Tokens请求量": 18}],
                total_count=1,
                captured_at="2026-09-02T00:00:01.000Z",
            )
        )
        pages = FakePageAssetPort(
            error=RuntimeQueryError("REVISION_CONFLICT", "revision conflict")
        )
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
                spec=fixture("page-build-spec.json"),
            )
        )

        self.assertFalse(result.ok)
        self.assertEqual(
            [(issue.code, issue.path, issue.stage) for issue in result.issues],
            [("REVISION_CONFLICT", "/", "save")],
        )
        self.assertEqual(
            result.completed_stages,
            ("discovery", "generation", "execution", "presentation"),
        )
        self.assertEqual(len(pages.calls), 1)

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
                spec=spec,
            )
        )

        self.assertTrue(result.ok)
        document = pages.calls[0]["document"]
        component = first_bound_component(document)
        self.assertEqual(component["type"], "lineChart")
        self.assertEqual(component["props"]["xField"], "field-1")
        self.assertEqual(document["dataSources"]["result"]["fields"]["field-1"]["type"], "string")

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

    async def test_every_data_component_that_passes_the_gate_can_be_assembled(
        self,
    ) -> None:
        cases = (
            (
                "gauge",
                [],
                {"Tokens请求量": 30},
                {"valueField": "field-1"},
            ),
            (
                "keyValuePanel",
                ["区域"],
                {"区域": "华东", "Tokens请求量": 18},
                {
                    "items": [
                        {"label": "区域", "field": "field-1"},
                        {"label": "Tokens请求量", "field": "field-2"},
                    ]
                },
            ),
            (
                "categoryBreakdown",
                ["区域"],
                {"区域": "华东", "Tokens请求量": 18},
                {
                    "categoryField": "field-1",
                    "columns": [
                        {"label": "Tokens请求量", "field": "field-2"}
                    ],
                },
            ),
        )
        for component_type, group_by, row, expected_props in cases:
            with self.subTest(component_type=component_type):
                spec = fixture("page-build-spec.json")
                spec["units"][0]["groupBy"] = group_by
                spec["units"][0]["pinnedComponent"] = component_type
                data_context = FakeDataContextPort(fixture("data-context.json"))
                dqe = FakeDqeExecutionPort(DqeExecutionResult(rows=[row]))
                pages = FakePageAssetPort(
                    SavedRevision("component-page", "revision-1", 1)
                )
                build_page = create_build_page(
                    BuildPageDependencies(
                        data_context=data_context,
                        dqe=dqe,
                        page_assets=pages,
                    )
                )

                result = await build_page(
                    BuildPageCommand(page_id="component-page", spec=spec)
                )

                self.assertTrue(result.ok, result.issues)
                component = first_bound_component(pages.calls[0]["document"])
                self.assertEqual(component["type"], component_type)
                for key, expected in expected_props.items():
                    self.assertEqual(component["props"][key], expected)

    async def test_page_header_and_content_sections_are_derived_from_scope(self) -> None:
        spec = fixture("page-build-spec.json")
        summary_unit = json.loads(json.dumps(spec["units"][0]))
        summary_unit["dataSourceId"] = "result-2"
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
                (
                    section["id"],
                    section["title"],
                    section["container"],
                    section["components"][0]["type"],
                )
                for section in sections[1:]
            ],
            [
                ("scope-1", "按区域", "panel", "barChart"),
                ("scope-2", "总量", "panel", "metricCard"),
            ],
        )

    async def test_same_scope_components_share_one_fully_packed_row(self) -> None:
        spec = fixture("page-build-spec.json")
        second_unit = json.loads(json.dumps(spec["units"][0]))
        second_unit["dataSourceId"] = "result-2"
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
                spec=spec,
            )
        )

        self.assertFalse(result.ok)
        self.assertEqual(
            [(issue.code, issue.path) for issue in result.issues],
            [("METRIC_NOT_IN_DATA_CONTEXT", "/units/0/metrics/0/name")],
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
                spec=spec,
            )
        )

        self.assertFalse(result.ok)
        self.assertEqual(
            [(issue.code, issue.path) for issue in result.issues],
            [("DIMENSION_NOT_IN_DATA_CONTEXT", "/units/0/groupBy/0")],
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
                spec=spec,
            )
        )

        self.assertFalse(result.ok)
        self.assertEqual(
            [(issue.code, issue.path) for issue in result.issues],
            [("DIMENSION_NOT_IN_DATA_CONTEXT", "/units/0/filters/0/dimension")],
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
