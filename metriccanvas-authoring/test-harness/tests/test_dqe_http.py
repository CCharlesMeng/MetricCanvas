from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))

from metriccanvas_authoring.adapters.outbound.dqe_http import (  # noqa: E402
    DqeHttpExecutionPort,
)
from metriccanvas_authoring.application.ports import (  # noqa: E402
    ServiceIdentity,
)
from metriccanvas_authoring.domain.execution import (  # noqa: E402
    DqeExecutionError,
    DqeExecutionResult,
)


class StaticIdentity:
    def __init__(self, operator_id: str, auth_token: str | None) -> None:
        self._identity = ServiceIdentity(operator_id, auth_token)

    def current(self) -> ServiceIdentity:
        return self._identity


class RecordingTransport:
    def __init__(self, status: int, body: object) -> None:
        self.status = status
        self.body = body
        self.calls: list[tuple[str, str, dict[str, str], bytes | None]] = []

    def __call__(
        self,
        method: str,
        url: str,
        headers: dict[str, str],
        payload: bytes | None,
    ) -> tuple[int, bytes]:
        self.calls.append((method, url, headers, payload))
        raw = self.body if isinstance(self.body, bytes) else json.dumps(self.body).encode()
        return self.status, raw


EFFECTIVE_QUERY = {
    "language": "dqe",
    "body": {
        "dsl_list": [
            {
                "output_dims": ["区域"],
                "output_metrics": ["Tokens请求量"],
                "filter": {"dims": [], "metrics": []},
                "order": {},
            }
        ]
    },
    "fieldMappings": {
        "field-1": {
            "queryField": "区域",
            "type": "string",
            "role": "dimension",
            "nullable": False,
        },
        "field-2": {
            "queryField": "Tokens请求量",
            "type": "number",
            "role": "measure",
            "nullable": False,
        },
    },
    "filterValues": [],
}


def envelope(
    *,
    code: str = "SUCCESS",
    data: object | None = None,
    total_count: object = 1,
) -> dict[str, object]:
    return {
        "retCode": "CBC.0000",
        "retDesc": "success",
        "results": [
            {
                "code": code,
                "data": (
                    [{"区域": "华东", "Tokens请求量": 18}]
                    if data is None
                    else data
                ),
                "total_count": total_count,
            }
        ],
    }


class DqeHttpExecutionPortTest(unittest.IsolatedAsyncioTestCase):
    def port(self, transport: RecordingTransport) -> DqeHttpExecutionPort:
        return DqeHttpExecutionPort(
            "http://dqe.local/rest/cdi/cdinl2databuilderservice/v1/",
            "workspace-1",
            StaticIdentity("operator-1", "token-1"),
            transport=transport,
            timestamp=lambda: "2026-09-03T08:00:00.000Z",
        )

    async def test_posts_exact_dsl_envelope_with_identity_headers(self) -> None:
        transport = RecordingTransport(200, envelope(total_count=3))

        result = await self.port(transport).execute(EFFECTIVE_QUERY)

        self.assertEqual(
            result,
            DqeExecutionResult(
                rows=({"区域": "华东", "Tokens请求量": 18},),
                total_count=3,
                captured_at="2026-09-03T08:00:00.000Z",
            ),
        )
        method, url, headers, payload = transport.calls[0]
        self.assertEqual(method, "POST")
        self.assertEqual(
            url,
            "http://dqe.local/rest/cdi/cdinl2databuilderservice/v1/dsl/execute",
        )
        self.assertEqual(headers["X-Auth-Token"], "token-1")
        self.assertEqual(headers["X-Operator-Id"], "operator-1")
        self.assertEqual(headers["X-Workspace-Id"], "workspace-1")
        self.assertEqual(json.loads(payload), EFFECTIVE_QUERY["body"])

    async def test_item_codes_map_to_stable_authoring_codes(self) -> None:
        mappings = {
            "NO_PERMISSION": "DQE_FORBIDDEN",
            "NO_MATCH": "DQE_QUERY_REJECTED",
            "FILTER_NO_MATCH": "DQE_QUERY_REJECTED",
            "ERROR": "DQE_ITEM_ERROR",
        }
        for item_code, expected in mappings.items():
            with self.subTest(item_code=item_code):
                port = self.port(RecordingTransport(200, envelope(code=item_code)))
                with self.assertRaises(DqeExecutionError) as raised:
                    await port.execute(EFFECTIVE_QUERY)
                self.assertEqual(raised.exception.code, expected)

    async def test_http_auth_and_permission_failures_are_distinct(self) -> None:
        for status, expected in ((401, "DQE_AUTH_REQUIRED"), (403, "DQE_FORBIDDEN")):
            with self.subTest(status=status):
                port = self.port(RecordingTransport(status, {}))
                with self.assertRaises(DqeExecutionError) as raised:
                    await port.execute(EFFECTIVE_QUERY)
                self.assertEqual(raised.exception.code, expected)

    async def test_permission_hint_is_appended_without_changing_error_code(self) -> None:
        port = DqeHttpExecutionPort(
            "http://dqe.local/v1",
            "workspace-1",
            StaticIdentity("operator-1", "token-1"),
            transport=RecordingTransport(200, envelope(code="NO_PERMISSION")),
            forbidden_hint="在 DataHub 申请该指标权限",
        )
        with self.assertRaises(DqeExecutionError) as raised:
            await port.execute(EFFECTIVE_QUERY)
        self.assertEqual(raised.exception.code, "DQE_FORBIDDEN")
        self.assertIn("在 DataHub 申请该指标权限", str(raised.exception))

    async def test_malformed_envelope_is_not_reported_as_empty_data(self) -> None:
        for body in (b"not-json", {"retCode": "CBC.0000", "results": []}):
            with self.subTest(body=body):
                with self.assertRaises(DqeExecutionError) as raised:
                    await self.port(RecordingTransport(200, body)).execute(
                        EFFECTIVE_QUERY
                    )
                self.assertEqual(raised.exception.code, "DQE_ENVELOPE_ERROR")

    async def test_rows_must_match_every_declared_query_field(self) -> None:
        invalid_rows = (
            [{"区域": "华东"}],
            [{"区域": "华东", "Tokens请求量": "18"}],
            ["not-an-object"],
        )
        for rows in invalid_rows:
            with self.subTest(rows=rows):
                port = self.port(RecordingTransport(200, envelope(data=rows)))
                with self.assertRaises(DqeExecutionError) as raised:
                    await port.execute(EFFECTIVE_QUERY)
                self.assertEqual(raised.exception.code, "DQE_ROW_CONTRACT_ERROR")

    async def test_date_and_datetime_contracts_do_not_accept_each_other(self) -> None:
        for field_type, value in (
            ("date", "2026-09-03T08:00:00Z"),
            ("datetime", "2026-09-03"),
        ):
            with self.subTest(field_type=field_type):
                query = json.loads(json.dumps(EFFECTIVE_QUERY))
                query["fieldMappings"]["field-1"]["type"] = field_type
                rows = [{"区域": value, "Tokens请求量": 18}]
                port = self.port(RecordingTransport(200, envelope(data=rows)))
                with self.assertRaises(DqeExecutionError) as raised:
                    await port.execute(query)
                self.assertEqual(raised.exception.code, "DQE_ROW_CONTRACT_ERROR")

    async def test_adapter_rejects_invalid_query_before_transport(self) -> None:
        transport = RecordingTransport(200, envelope())
        invalid = {**EFFECTIVE_QUERY, "language": "sql"}
        with self.assertRaises(DqeExecutionError) as raised:
            await self.port(transport).execute(invalid)
        self.assertEqual(raised.exception.code, "DQE_CONFIG_ERROR")
        self.assertEqual(transport.calls, [])

    async def test_missing_token_is_configuration_error(self) -> None:
        port = DqeHttpExecutionPort(
            "http://dqe.local/v1",
            "workspace-1",
            StaticIdentity("operator-1", None),
            transport=RecordingTransport(200, envelope()),
        )
        with self.assertRaises(DqeExecutionError) as raised:
            await port.execute(EFFECTIVE_QUERY)
        self.assertEqual(raised.exception.code, "DQE_CONFIG_ERROR")

    async def test_timeout_and_network_are_distinct(self) -> None:
        def timeout(*args: object) -> tuple[int, bytes]:
            raise TimeoutError("late")

        def unavailable(*args: object) -> tuple[int, bytes]:
            raise OSError("down")

        for transport, expected in (
            (timeout, "DQE_TIMEOUT"),
            (unavailable, "DQE_TRANSPORT_ERROR"),
        ):
            with self.subTest(expected=expected):
                port = DqeHttpExecutionPort(
                    "http://dqe.local/v1",
                    "workspace-1",
                    StaticIdentity("operator-1", "token-1"),
                    transport=transport,
                )
                with self.assertRaises(DqeExecutionError) as raised:
                    await port.execute(EFFECTIVE_QUERY)
                self.assertEqual(raised.exception.code, expected)


if __name__ == "__main__":
    unittest.main()
