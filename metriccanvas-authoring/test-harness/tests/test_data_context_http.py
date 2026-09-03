from __future__ import annotations

import hashlib
import json
import sys
import unittest
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))

from metriccanvas_authoring.adapters.outbound.data_context_http import (  # noqa: E402
    DataContextProjection,
    LabDataContextHttpPort,
)
from metriccanvas_authoring.application.discover_data_context import (  # noqa: E402
    DiscoverDataContextCommand,
    DiscoverDataContextDependencies,
    create_discover_data_context,
)
from metriccanvas_authoring.application.ports import (  # noqa: E402
    DataContextError,
    ServiceIdentity,
)
from metriccanvas_authoring.domain.data_context import parse_data_context  # noqa: E402


class StaticIdentity:
    def current(self) -> ServiceIdentity:
        return ServiceIdentity("service-operator", "metadata-token")


class StaticDimensionValues:
    def __init__(self) -> None:
        self.calls: list[tuple[str, tuple[str, ...]]] = []

    async def values_for(
        self, dataset_id: str, dimensions: tuple[str, ...] | list[str]
    ) -> dict[str, tuple[str, ...]]:
        self.calls.append((dataset_id, tuple(dimensions)))
        return {"区域": ("华东", "华南")}


DATASET_DETAIL = {
    "id": "operations-dataset",
    "caption": "运营分析",
    "description": "Tokens 服务运营分析",
    "workspace_id": "workspace-1",
    "update_date": 1788400000000,
    "logical_schema": {
        "field_schema": {
            "dimensions": [
                {
                    "name": "区域",
                    "description": "业务归属区域",
                    "synonyms": ["大区"],
                    "dimensionType": "stringDimension",
                },
                {
                    "name": "统计周期",
                    "description": "按查询时间粒度展开的统计周期",
                    "dimensionType": "strDateTypeDimension",
                    "hierarchies": [
                        {
                            "levels": [
                                {"levelType": "yearLevel"},
                                {"levelType": "monthLevel"},
                                {"levelType": "dayLevel"},
                            ]
                        }
                    ],
                },
            ],
            "measures": [],
            "metrics": [
                {
                    "name": "Tokens请求量",
                    "code": "tokens_requests",
                    "synonyms": ["调用次数"],
                    "publicSynonyms": "Tokens量,请求数",
                    "definition": "统计期内的模型调用请求次数",
                    "unit": "次",
                    "isAgg": True,
                    "aggregator": "SUM",
                    "dimensions": [{"name": "区域"}],
                    "timeDimensions": [{"name": "统计周期"}],
                }
            ],
        }
    },
}


PROJECTION = DataContextProjection.from_mapping(
    {
        "environment": {
            "id": "dqe-primary",
            "name": "MetricCanvas DQE",
            "endpointRef": "dqe-primary",
            "constraints": {
                "readOnly": True,
                "maxRows": 1000,
                "maxColumns": 20,
                "maxQueriesPerBatch": 6,
                "timeoutMs": 20000,
            },
            "security": {"scope": "authoring-service-state"},
        },
        "defaults": {"nullable": False, "sensitive": False},
        "metricGovernance": {
            "operations-dataset": {"Tokens请求量": {"isRatio": False}}
        },
    }
)


class RoutingTransport:
    def __init__(self, *, status: int = 200, detail: object = DATASET_DETAIL) -> None:
        self.status = status
        self.detail = detail
        self.calls: list[tuple[str, str, dict[str, str], bytes | None]] = []

    def __call__(
        self,
        method: str,
        url: str,
        headers: dict[str, str],
        payload: bytes | None,
    ) -> tuple[int, bytes]:
        self.calls.append((method, url, headers, payload))
        if self.status != 200:
            return self.status, b"{}"
        body = (
            {"datasets": [{"id": "operations-dataset"}]}
            if "/subjects/" in url
            else self.detail
        )
        raw = body if isinstance(body, bytes) else json.dumps(body).encode("utf-8")
        return 200, raw


def create_port(
    transport: RoutingTransport,
    projection: DataContextProjection = PROJECTION,
    dimension_values: StaticDimensionValues | None = None,
) -> LabDataContextHttpPort:
    return LabDataContextHttpPort(
        datasets_url_template="http://lab.local/subjects/{subjectId}/datasets",
        detail_url_template="http://lab.local/datasets/{datasetId}",
        subject_id="subject one",
        workspace_id="workspace-1",
        app_code="metriccanvas",
        identity=StaticIdentity(),
        projection=projection,
        dimension_values=dimension_values,
        transport=transport,
    )


class LabDataContextHttpPortTest(unittest.IsolatedAsyncioTestCase):
    async def test_projects_list_and_detail_to_valid_schema_1_1(self) -> None:
        transport = RoutingTransport()
        port = create_port(transport)

        snapshot = await port.current()

        context, issues = parse_data_context(snapshot)
        self.assertEqual(issues, ())
        assert context is not None
        self.assertEqual(snapshot["id"], "lab-subject:subject one")
        expected_version = hashlib.sha256(
            json.dumps(
                [["operations-dataset", "1788400000000"]],
                ensure_ascii=False,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()
        self.assertEqual(snapshot["version"], expected_version)
        schema = snapshot["executionEnvironments"][0]["schemas"][0]
        self.assertEqual(schema["name"], "运营分析")
        self.assertEqual(
            schema["metrics"][0],
            {
                "name": "Tokens请求量",
                "type": "number",
                "description": "统计期内的模型调用请求次数",
                "additivity": "可加",
                "timeAggregation": "求和",
                "isRatio": False,
                "dimensions": ["区域", "统计周期"],
                "nullable": False,
                "sensitive": False,
                "aliases": ["调用次数", "Tokens量", "请求数"],
                "unit": "次",
            },
        )
        fields = schema["objects"][0]["fields"]
        self.assertEqual(fields[0]["aliases"], ["大区"])
        self.assertEqual(fields[1]["roleHints"], ["dimension", "time"])
        self.assertEqual(fields[1]["granularity"], "year,month,day")

        self.assertEqual(len(transport.calls), 2)
        list_call, detail_call = transport.calls
        self.assertEqual(
            list_call[1], "http://lab.local/subjects/subject%20one/datasets"
        )
        self.assertEqual(
            detail_call[1], "http://lab.local/datasets/operations-dataset"
        )
        for call in transport.calls:
            self.assertEqual(call[0], "GET")
            self.assertEqual(call[2]["X-Auth-Token"], "metadata-token")
            self.assertEqual(call[2]["X-Workspace-Id"], "workspace-1")
            self.assertEqual(call[2]["apiGw-app-code"], "metriccanvas")

        second = await port.current()
        self.assertEqual(second, snapshot)
        self.assertIsNot(second, snapshot)
        self.assertEqual(len(transport.calls), 2)

    async def test_missing_ratio_governance_fails_closed(self) -> None:
        projection = DataContextProjection.from_mapping(
            {
                "environment": PROJECTION.environment,
                "defaults": {"nullable": False, "sensitive": False},
            }
        )
        with self.assertRaises(DataContextError) as raised:
            await create_port(RoutingTransport(), projection).current()
        self.assertEqual(
            raised.exception.code, "DATA_CONTEXT_GOVERNANCE_REQUIRED"
        )

    async def test_optional_dimension_value_port_enriches_discovery(self) -> None:
        values = StaticDimensionValues()
        snapshot = await create_port(
            RoutingTransport(), dimension_values=values
        ).current()

        context, issues = parse_data_context(snapshot)
        self.assertEqual(issues, ())
        assert context is not None
        self.assertEqual(
            values.calls,
            [
                (
                    "operations-dataset",
                    ("区域", "统计周期"),
                )
            ],
        )
        self.assertEqual(context.search("华东")[0]["field"]["name"], "区域")

    async def test_http_and_envelope_errors_remain_discoverable(self) -> None:
        for transport, expected in (
            (RoutingTransport(status=401), "DATA_CONTEXT_AUTH_REQUIRED"),
            (RoutingTransport(status=403), "DATA_CONTEXT_FORBIDDEN"),
            (RoutingTransport(detail=b"not-json"), "DATA_CONTEXT_ENVELOPE_ERROR"),
        ):
            with self.subTest(expected=expected):
                discover = create_discover_data_context(
                    DiscoverDataContextDependencies(
                        data_context=create_port(transport)
                    )
                )
                result = await discover(DiscoverDataContextCommand("区域"))
                self.assertFalse(result.ok)
                self.assertEqual(result.issues[0].code, expected)
                self.assertEqual(result.issues[0].stage, "discovery")

    async def test_timeout_and_network_failures_are_distinct(self) -> None:
        def timeout(*args: object) -> tuple[int, bytes]:
            raise TimeoutError("late")

        def unavailable(*args: object) -> tuple[int, bytes]:
            raise OSError("down")

        for transport, expected in (
            (timeout, "DATA_CONTEXT_TIMEOUT"),
            (unavailable, "DATA_CONTEXT_TRANSPORT_ERROR"),
        ):
            with self.subTest(expected=expected):
                with self.assertRaises(DataContextError) as raised:
                    await create_port(transport).current()  # type: ignore[arg-type]
                self.assertEqual(raised.exception.code, expected)


if __name__ == "__main__":
    unittest.main()
