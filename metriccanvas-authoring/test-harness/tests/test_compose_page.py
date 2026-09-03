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
        self.assertEqual(result.artifact.document, vector["expected"]["document"])
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
                    vector["expected"]["document"],
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
        second_unit = json.loads(json.dumps(spec["units"][0]))
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
                sources["unit-1"]["source"]["initial"]["rows"][0]["Tokens请求量"],
                sources["unit-2"]["source"]["initial"]["rows"][0]["Tokens请求量"],
            ],
            [1, 2],
        )

    async def test_concurrent_failures_are_reported_by_lowest_unit_index(self) -> None:
        spec = fixture("page-build-spec.json")
        second_unit = json.loads(json.dumps(spec["units"][0]))
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

    async def test_invalid_spec_stops_before_discovery_and_execution(self) -> None:
        data_context = FakeDataContextPort(fixture("data-context.json"))
        dqe = FakeDqeExecutionPort(DqeExecutionResult(rows=[]))
        compose_page = create_compose_page(
            ComposePageDependencies(data_context=data_context, dqe=dqe)
        )

        result = await compose_page(
            ComposePageCommand(
                page_id="invalid",
                spec={"question": "invalid", "units": []},
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


if __name__ == "__main__":
    unittest.main()
