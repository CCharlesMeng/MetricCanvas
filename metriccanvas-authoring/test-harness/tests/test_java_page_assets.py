from __future__ import annotations

import json
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))

from metriccanvas_authoring.adapters.outbound.env_identity import (  # noqa: E402
    AUTH_TOKEN_ENV,
    OPERATOR_ID_ENV,
    EnvIdentityPort,
)
from metriccanvas_authoring.adapters.outbound.java_page_assets import (  # noqa: E402
    JavaPageAssetPort,
)
from metriccanvas_authoring.application.ports import (  # noqa: E402
    PageAssetError,
    SavedRevision,
    ServiceIdentity,
)


class StaticIdentity:
    def __init__(self, operator_id: str, auth_token: str | None = None) -> None:
        self.identity = ServiceIdentity(operator_id, auth_token)

    def current(self) -> ServiceIdentity:
        return self.identity


SAVE_COMMAND = {
    "pageId": "tokens-by-region",
    "baseRevisionId": None,
    "document": {"id": "tokens-by-region", "schemaVersion": "5.4"},
    "idempotencyKey": "k" * 64,
    "pageIdConfirmed": True,
    "source": {"type": "relay", "skillVersion": "0.1.0"},
    "dataContextVersion": "2026-09-02.1",
}

REVISION_201 = {
    "revisionId": "0123456789abcdef0123456789abcdef",
    "revisionNumber": 1,
    "pageId": "tokens-by-region",
    "baseRevisionId": None,
    "document": SAVE_COMMAND["document"],
    "contentHash": "f" * 64,
    "dataContextVersion": "2026-09-02.1",
    "source": {"type": "relay", "skillVersion": "0.1.0"},
    "createdBy": "operator-a",
    "createdAt": "2026-09-02T10:00:00.000Z",
}


class RecordingTransport:
    def __init__(self, status: int, body: object) -> None:
        self.status = status
        self.body = body
        self.calls: list[tuple[str, str, dict[str, str], bytes | None]] = []

    def __call__(self, method: str, url: str, headers: dict[str, str], payload: bytes | None):
        self.calls.append((method, url, headers, payload))
        raw = b"" if self.body is None else json.dumps(self.body).encode("utf-8")
        return self.status, raw


class JavaPageAssetPortTest(unittest.IsolatedAsyncioTestCase):
    async def test_posts_the_interface_body_with_operator_header(self) -> None:
        transport = RecordingTransport(201, REVISION_201)
        port = JavaPageAssetPort(
            "http://java.local:8080/rest/cdi/pageassets/v1/",
            StaticIdentity("operator-a", "token-1"),
            transport=transport,
        )

        saved = await port.save_revision(SAVE_COMMAND)

        self.assertEqual(saved, SavedRevision("tokens-by-region", REVISION_201["revisionId"], 1))
        method, url, headers, payload = transport.calls[0]
        self.assertEqual(method, "POST")
        self.assertEqual(
            url, "http://java.local:8080/rest/cdi/pageassets/v1/pages/tokens-by-region/revisions"
        )
        self.assertEqual(headers["X-Operator-Id"], "operator-a")
        self.assertEqual(headers["X-Auth-Token"], "token-1")
        self.assertEqual(headers["Content-Type"], "application/json")
        body = json.loads(payload.decode("utf-8"))
        self.assertEqual(
            body,
            {key: value for key, value in SAVE_COMMAND.items() if key != "pageId"},
        )

    async def test_error_envelope_becomes_page_asset_error_with_java_code(self) -> None:
        transport = RecordingTransport(
            409,
            {
                "code": "REVISION_CONFLICT",
                "message": "保存基线不是当前最新页面修订",
                "details": {"currentLatest": {"revisionId": "a" * 32, "revisionNumber": 2}},
            },
        )
        port = JavaPageAssetPort("http://java.local", StaticIdentity("operator-a"), transport=transport)

        with self.assertRaises(PageAssetError) as raised:
            await port.save_revision(SAVE_COMMAND)

        self.assertEqual(raised.exception.code, "REVISION_CONFLICT")
        self.assertEqual(raised.exception.status, 409)
        self.assertEqual(
            raised.exception.details,
            {"currentLatest": {"revisionId": "a" * 32, "revisionNumber": 2}},
        )
        self.assertNotIn("X-Auth-Token", transport.calls[0][2])

    async def test_non_envelope_failure_is_unavailable_not_a_business_code(self) -> None:
        port = JavaPageAssetPort(
            "http://java.local",
            StaticIdentity("operator-a"),
            transport=RecordingTransport(502, None),
        )
        with self.assertRaises(PageAssetError) as raised:
            await port.save_revision(SAVE_COMMAND)
        self.assertEqual(raised.exception.code, "PAGE_ASSETS_UNAVAILABLE")
        self.assertEqual(raised.exception.status, 502)

    async def test_real_http_round_trip_over_urllib(self) -> None:
        received: dict[str, object] = {}

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self) -> None:  # noqa: N802 - http.server naming
                length = int(self.headers.get("Content-Length", "0"))
                received["path"] = self.path
                received["operator"] = self.headers.get("X-Operator-Id")
                received["body"] = json.loads(self.rfile.read(length))
                if self.path.endswith("/pages/missing-base/revisions"):
                    payload = json.dumps(
                        {"code": "PAGE_ID_CONFIRMATION_REQUIRED", "message": "confirm", "details": None}
                    ).encode("utf-8")
                    self.send_response(409)
                else:
                    payload = json.dumps(REVISION_201).encode("utf-8")
                    self.send_response(201)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def log_message(self, *args: object) -> None:
                return

        server = HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            base = f"http://127.0.0.1:{server.server_port}/rest/cdi/pageassets/v1"
            port = JavaPageAssetPort(base, StaticIdentity("operator-b"), timeout_seconds=5)

            saved = await port.save_revision(SAVE_COMMAND)
            self.assertEqual(saved.revision_number, 1)
            self.assertEqual(received["path"], "/rest/cdi/pageassets/v1/pages/tokens-by-region/revisions")
            self.assertEqual(received["operator"], "operator-b")
            self.assertEqual(received["body"]["idempotencyKey"], "k" * 64)

            with self.assertRaises(PageAssetError) as raised:
                await port.save_revision({**SAVE_COMMAND, "pageId": "missing-base"})
            self.assertEqual(raised.exception.code, "PAGE_ID_CONFIRMATION_REQUIRED")
        finally:
            server.shutdown()
            server.server_close()

    async def test_unreachable_service_is_reported_as_unavailable(self) -> None:
        probe = HTTPServer(("127.0.0.1", 0), BaseHTTPRequestHandler)
        free_port = probe.server_port
        probe.server_close()
        port = JavaPageAssetPort(
            f"http://127.0.0.1:{free_port}", StaticIdentity("operator-a"), timeout_seconds=2
        )
        with self.assertRaises(PageAssetError) as raised:
            await port.save_revision(SAVE_COMMAND)
        self.assertEqual(raised.exception.code, "PAGE_ASSETS_UNAVAILABLE")


class EnvIdentityPortTest(unittest.TestCase):
    def test_reads_service_identity_from_mcp_env(self) -> None:
        identity = EnvIdentityPort({OPERATOR_ID_ENV: " svc-operator ", AUTH_TOKEN_ENV: "tok"}).current()
        self.assertEqual(identity, ServiceIdentity("svc-operator", "tok"))
        self.assertIsNone(EnvIdentityPort({OPERATOR_ID_ENV: "svc"}).current().auth_token)

    def test_missing_operator_is_a_configuration_error(self) -> None:
        with self.assertRaises(RuntimeError):
            EnvIdentityPort({}).current()


if __name__ == "__main__":
    unittest.main()
