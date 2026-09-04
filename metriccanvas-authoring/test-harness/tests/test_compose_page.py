from __future__ import annotations

import asyncio
import hashlib
import json
import sys
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))
sys.path.insert(0, str(BUNDLE_ROOT / "test-harness"))

from adapters.fakes import FakeDataContextPort, FakeDqeExecutionPort  # noqa: E402
from metriccanvas_authoring.application.bundle_info import load_bundle_info  # noqa: E402
from metriccanvas_authoring.application.compose_page import (  # noqa: E402
    ComposePageCommand,
    ComposePageDependencies,
    create_compose_page,
)
from metriccanvas_authoring.application.ports import DqeExecutionResult  # noqa: E402


class ConcurrentDqePort:
    def __init__(self, *, failures: dict[int, Exception] | None = None) -> None:
        self.failures = failures or {}
        self.calls: list[dict[str, object]] = []
        self.in_flight = 0
        self.max_in_flight = 0
        self._all_started = asyncio.Event()

    async def execute(self, effective_query: dict[str, object]) -> DqeExecutionResult:
        index = len(self.calls)
        self.calls.append(effective_query)
        self.in_flight += 1
        self.max_in_flight = max(self.max_in_flight, self.in_flight)
        if len(self.calls) == 2:
            self._all_started.set()
        try:
            await self._all_started.wait()
            if index == 0:
                await asyncio.sleep(0.01)
            failure = self.failures.get(index)
            if failure is not None:
                raise failure
            return DqeExecutionResult(
                rows=[{"区域": "华东", "Tokens请求量": index + 1}],
                total_count=1,
                captured_at=f"2026-09-03T00:00:0{index}.000Z",
            )
        finally:
            self.in_flight -= 1


class DqeTestError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


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


class ComposePageHarnessTest(unittest.IsolatedAsyncioTestCase):
    async def test_valid_spec_returns_validated_artifact_without_save_dependency(
        self,
    ) -> None:
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
        compose_page = create_compose_page(
            ComposePageDependencies(data_context=data_context, dqe=dqe)
        )

        result = await compose_page(
            ComposePageCommand(
                page_id=vector_input["command"]["pageId"],
                spec=vector_input["spec"],
            )
        )

        self.assertTrue(result.ok, result.issues)
        self.assertEqual(
            result.completed_stages,
            ("discovery", "generation", "execution", "presentation"),
        )
        self.assertIsNotNone(result.artifact)
        assert result.artifact is not None
        self.assertEqual(result.artifact.format_version, "1.0")
        expected_document = vector["expected"]["document"]
        self.assertEqual(result.artifact.document, expected_document)
        self.assertEqual(
            result.artifact.data_context_version,
            vector_input["dataContext"]["version"],
        )
        self.assertEqual(
            result.artifact.bundle_version,
            load_bundle_info()["bundleVersion"],
        )
        self.assertEqual(
            result.artifact.document_sha256,
            hashlib.sha256(
                json.dumps(
                    expected_document,
                    sort_keys=True,
                    separators=(",", ":"),
                    ensure_ascii=False,
                ).encode("utf-8")
            ).hexdigest(),
        )
        artifact_schema = json.loads(
            (
                BUNDLE_ROOT
                / "contracts"
                / "authored"
                / "page-build-artifact.schema.json"
            ).read_text(encoding="utf-8")
        )
        self.assertEqual(
            list(
                Draft202012Validator(artifact_schema).iter_errors(
                    result.artifact.to_payload()
                )
            ),
            [],
        )
        self.assertEqual(dqe.calls, vector["expected"]["effectiveQueries"])

    async def test_executes_units_concurrently_but_keeps_artifact_order(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["units"][0]["dataSourceId"] = "result-4"
        second_unit = json.loads(json.dumps(spec["units"][0]))
        second_unit["dataSourceId"] = "result-9"
        second_unit["title"] = "第二个取数单元"
        spec["units"].append(second_unit)
        dqe = ConcurrentDqePort()
        compose_page = create_compose_page(
            ComposePageDependencies(
                data_context=FakeDataContextPort(fixture("data-context.json")),
                dqe=dqe,
            )
        )

        result = await asyncio.wait_for(
            compose_page(ComposePageCommand(page_id="concurrent-page", spec=spec)),
            timeout=0.2,
        )

        self.assertTrue(result.ok, result.issues)
        self.assertEqual(dqe.max_in_flight, 2)
        assert result.artifact is not None
        sources = result.artifact.document["dataSources"]
        self.assertEqual(
            [
                sources["result-4"]["source"]["initial"]["rows"][0]["Tokens请求量"],
                sources["result-9"]["source"]["initial"]["rows"][0]["Tokens请求量"],
            ],
            [1, 2],
        )

    async def test_embeds_at_most_twenty_rows_and_keeps_the_returned_count(self) -> None:
        rows = [
            {"区域": f"区域-{index}", "Tokens请求量": index}
            for index in range(25)
        ]
        compose_page = create_compose_page(
            ComposePageDependencies(
                data_context=FakeDataContextPort(fixture("data-context.json")),
                dqe=FakeDqeExecutionPort(
                    DqeExecutionResult(
                        rows=rows,
                        captured_at="2026-09-03T00:00:00.000Z",
                    )
                ),
            )
        )

        result = await compose_page(
            ComposePageCommand(
                page_id="sample-row-limit",
                spec=fixture("page-build-spec.json"),
            )
        )

        self.assertTrue(result.ok, result.issues)
        assert result.artifact is not None
        initial = result.artifact.document["dataSources"]["result"]["source"][
            "initial"
        ]
        self.assertEqual(initial["rows"], rows[:20])
        self.assertEqual(initial["totalCount"], 25)

    async def test_formula_trace_and_visible_marker_are_part_of_the_artifact(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["units"][0]["metrics"] = [
            {
                "kind": "formula",
                "expression": "Tokens请求量 / 1000",
                "label": "千次请求量",
                "unit": "千次",
            }
        ]
        compose_page = create_compose_page(
            ComposePageDependencies(
                data_context=FakeDataContextPort(fixture("data-context.json")),
                dqe=FakeDqeExecutionPort(
                    DqeExecutionResult(
                        rows=[{"区域": "华东", "千次请求量": 0.018}],
                        captured_at="2026-09-03T00:00:00.000Z",
                    )
                ),
            )
        )

        result = await compose_page(
            ComposePageCommand(page_id="formula-page", spec=spec)
        )

        self.assertTrue(result.ok, result.issues)
        assert result.artifact is not None
        self.assertEqual(
            result.artifact.to_payload()["formulaTraces"],
            [
                {
                    "question": spec["question"],
                    "expression": "Tokens请求量 / 1000",
                    "referencedMetrics": ["Tokens请求量"],
                }
            ],
        )
        artifact_schema = json.loads(
            (
                BUNDLE_ROOT
                / "contracts"
                / "authored"
                / "page-build-artifact.schema.json"
            ).read_text(encoding="utf-8")
        )
        self.assertEqual(
            list(
                Draft202012Validator(artifact_schema).iter_errors(
                    result.artifact.to_payload()
                )
            ),
            [],
        )
        component = result.artifact.document["sections"][1]["components"][0]
        self.assertEqual(
            component["props"]["title"],
            "各区域 Tokens 请求量(临时指标)",
        )

    async def test_formula_marker_is_not_duplicated_in_an_explicit_title(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["units"][0]["title"] = "千次请求量(临时指标)"
        spec["units"][0]["metrics"] = [
            {
                "kind": "formula",
                "expression": "Tokens请求量 / 1000",
                "label": "千次请求量",
            }
        ]
        compose_page = create_compose_page(
            ComposePageDependencies(
                data_context=FakeDataContextPort(fixture("data-context.json")),
                dqe=FakeDqeExecutionPort(
                    DqeExecutionResult(
                        rows=[{"区域": "华东", "千次请求量": 0.018}]
                    )
                ),
            )
        )

        result = await compose_page(
            ComposePageCommand(page_id="formula-title", spec=spec)
        )

        self.assertTrue(result.ok, result.issues)
        assert result.artifact is not None
        component = result.artifact.document["sections"][1]["components"][0]
        self.assertEqual(component["props"]["title"].count("(临时指标)"), 1)

    async def test_ask_content_section_keeps_title_and_panel_container(self) -> None:
        compose_page = create_compose_page(
            ComposePageDependencies(
                data_context=FakeDataContextPort(fixture("data-context.json")),
                dqe=FakeDqeExecutionPort(
                    DqeExecutionResult(
                        rows=[{"区域": "华东", "Tokens请求量": 18}]
                    )
                ),
            )
        )

        result = await compose_page(
            ComposePageCommand(
                page_id="ask-section-defaults",
                spec=fixture("page-build-spec.json"),
            )
        )

        self.assertTrue(result.ok, result.issues)
        assert result.artifact is not None
        header, content = result.artifact.document["sections"]
        self.assertEqual(header["container"], "plain")
        self.assertEqual(content["id"], "main")
        self.assertEqual(content["title"], "问数结果")
        self.assertEqual(content["container"], "panel")

    async def test_concurrent_failures_are_reported_by_lowest_unit_index(self) -> None:
        spec = fixture("page-build-spec.json")
        second_unit = json.loads(json.dumps(spec["units"][0]))
        second_unit["dataSourceId"] = "result-2"
        second_unit["title"] = "第二个取数单元"
        spec["units"].append(second_unit)
        dqe = ConcurrentDqePort(
            failures={
                0: DqeTestError("DQE_TIMEOUT"),
                1: DqeTestError("DQE_FORBIDDEN"),
            }
        )
        compose_page = create_compose_page(
            ComposePageDependencies(
                data_context=FakeDataContextPort(fixture("data-context.json")),
                dqe=dqe,
            )
        )

        result = await compose_page(
            ComposePageCommand(page_id="concurrent-failure", spec=spec)
        )

        self.assertFalse(result.ok)
        self.assertEqual(dqe.max_in_flight, 2)
        self.assertEqual(
            [(issue.code, issue.path, issue.stage) for issue in result.issues],
            [("DQE_TIMEOUT", "/units/0", "execution")],
        )
        self.assertTrue(result.issues[0].retry_safe)

    async def test_retry_safety_is_explicit_without_retrying_inside_compose(
        self,
    ) -> None:
        for code, expected_retry_safe in (
            ("DQE_TRANSPORT_ERROR", True),
            ("DQE_FORBIDDEN", False),
        ):
            with self.subTest(code=code):
                dqe = FakeDqeExecutionPort(error=DqeTestError(code))
                compose_page = create_compose_page(
                    ComposePageDependencies(
                        data_context=FakeDataContextPort(
                            fixture("data-context.json")
                        ),
                        dqe=dqe,
                    )
                )

                result = await compose_page(
                    ComposePageCommand(
                        page_id=f"retry-safe-{code.lower()}",
                        spec=fixture("page-build-spec.json"),
                    )
                )

                self.assertFalse(result.ok)
                self.assertEqual(result.issues[0].code, code)
                self.assertEqual(
                    result.issues[0].retry_safe,
                    expected_retry_safe,
                )
                self.assertEqual(len(dqe.calls), 1)

    async def test_component_gate_reports_every_rejected_unit(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["units"][0]["pinnedComponent"] = "metricCard"
        second_unit = json.loads(json.dumps(spec["units"][0]))
        second_unit["dataSourceId"] = "result-2"
        second_unit["title"] = "第二个不适配单元"
        spec["units"].append(second_unit)
        compose_page = create_compose_page(
            ComposePageDependencies(
                data_context=FakeDataContextPort(fixture("data-context.json")),
                dqe=FakeDqeExecutionPort(
                    DqeExecutionResult(
                        rows=[
                            {"区域": "华东", "Tokens请求量": 18},
                            {"区域": "华南", "Tokens请求量": 12},
                        ]
                    )
                ),
            )
        )

        result = await compose_page(
            ComposePageCommand(page_id="gate-issues", spec=spec)
        )

        self.assertFalse(result.ok)
        self.assertEqual(
            [(issue.code, issue.path, issue.stage) for issue in result.issues],
            [
                (
                    "PINNED_COMPONENT_REJECTED",
                    "/units/0/pinnedComponent",
                    "presentation",
                ),
                (
                    "PINNED_COMPONENT_REJECTED",
                    "/units/1/pinnedComponent",
                    "presentation",
                ),
            ],
        )

    async def test_manifest_name_failure_keeps_structured_candidates(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["units"][0]["metrics"][0]["name"] = "不存在的指标"
        compose_page = create_compose_page(
            ComposePageDependencies(
                data_context=FakeDataContextPort(fixture("data-context.json")),
                dqe=FakeDqeExecutionPort(DqeExecutionResult(rows=[])),
            )
        )

        result = await compose_page(
            ComposePageCommand(page_id="manifest-candidates", spec=spec)
        )

        self.assertFalse(result.ok)
        self.assertEqual(result.issues[0].code, "METRIC_NOT_IN_DATA_CONTEXT")
        self.assertEqual(result.issues[0].candidates, ("Tokens请求量",))
        self.assertFalse(result.issues[0].retry_safe)

    async def test_manifest_candidates_match_the_rejected_closed_set(self) -> None:
        cases = (
            (
                "business-domain",
                lambda spec: spec["units"][0].__setitem__(
                    "businessDomain", "不存在的业务域"
                ),
                ("运营分析",),
            ),
            (
                "dimension",
                lambda spec: spec["units"][0]["groupBy"].__setitem__(
                    0, "不存在的维度"
                ),
                ("区域", "统计周期"),
            ),
            (
                "filter-value",
                lambda spec: spec["units"][0].__setitem__(
                    "filters", [{"dimension": "区域", "values": ["东北"]}]
                ),
                ("华东", "华南"),
            ),
            (
                "time-granularity",
                lambda spec: spec["units"][0]["time"].__setitem__(
                    "granularity", "quarter"
                ),
                ("month",),
            ),
        )
        for case, mutate, expected_candidates in cases:
            with self.subTest(case=case):
                spec = fixture("page-build-spec.json")
                mutate(spec)
                compose_page = create_compose_page(
                    ComposePageDependencies(
                        data_context=FakeDataContextPort(
                            fixture("data-context.json")
                        ),
                        dqe=FakeDqeExecutionPort(DqeExecutionResult(rows=[])),
                    )
                )

                result = await compose_page(
                    ComposePageCommand(page_id=f"candidates-{case}", spec=spec)
                )

                self.assertFalse(result.ok)
                self.assertEqual(
                    result.issues[0].candidates,
                    expected_candidates,
                )

    async def test_invalid_spec_stops_before_discovery_and_execution(self) -> None:
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(DqeExecutionResult(rows=[]))
        compose_page = create_compose_page(
            ComposePageDependencies(data_context=data_context, dqe=dqe)
        )

        result = await compose_page(
            ComposePageCommand(
                page_id="invalid",
                spec={
                    "question": "invalid",
                    "dataContextVersion": "2026-09-02.1",
                    "units": [],
                },
            )
        )

        self.assertFalse(result.ok)
        self.assertIsNone(result.artifact)
        self.assertEqual(result.completed_stages, ())
        self.assertEqual(
            [(issue.code, issue.stage) for issue in result.issues],
            [("PAGE_BUILD_SPEC_SCHEMA_ERROR", "generation")],
        )
        self.assertEqual(data_context.calls, 0)
        self.assertEqual(dqe.calls, [])

    async def test_base_revision_of_another_page_stops_before_discovery(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["baseRevision"] = {
            "pageId": "some-other-page",
            "revisionId": "c" * 32,
            "revisionNumber": 1,
        }
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(DqeExecutionResult(rows=[]))
        compose_page = create_compose_page(
            ComposePageDependencies(data_context=data_context, dqe=dqe)
        )

        result = await compose_page(
            ComposePageCommand(page_id="transient-page", spec=spec)
        )

        self.assertFalse(result.ok)
        self.assertEqual(
            [(issue.code, issue.path, issue.stage) for issue in result.issues],
            [
                (
                    "BASE_REVISION_PAGE_ID_MISMATCH",
                    "/baseRevision/pageId",
                    "generation",
                )
            ],
        )
        self.assertEqual(data_context.calls, 0)
        self.assertEqual(dqe.calls, [])

    async def test_rejects_a_data_context_version_changed_after_discovery(self) -> None:
        spec = fixture("page-build-spec.json")
        spec["dataContextVersion"] = "stale-version"
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(DqeExecutionResult(rows=[]))
        compose_page = create_compose_page(
            ComposePageDependencies(data_context=data_context, dqe=dqe)
        )

        result = await compose_page(
            ComposePageCommand(page_id="version-frozen", spec=spec)
        )

        self.assertFalse(result.ok)
        self.assertEqual(
            [(issue.code, issue.path, issue.stage) for issue in result.issues],
            [
                (
                    "DATA_CONTEXT_VERSION_CHANGED",
                    "/dataContextVersion",
                    "discovery",
                )
            ],
        )
        self.assertEqual(data_context.calls, 1)
        self.assertEqual(dqe.calls, [])


if __name__ == "__main__":
    unittest.main()
