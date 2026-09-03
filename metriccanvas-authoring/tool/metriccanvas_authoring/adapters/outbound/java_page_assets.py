from __future__ import annotations

import asyncio
import json
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable
from typing import Any

from metriccanvas_authoring.application.ports import (
    IdentityPort,
    JsonObject,
    PageAssetError,
    SavedRevision,
)


# Interface base URL including the `{service}` prefix, e.g.
# http://host:8080/rest/cdi/pageassets/v1 (ADR-0062: consumers only change this).
PAGE_ASSETS_BASE_URL_ENV = "METRICCANVAS_PAGE_ASSETS_BASE_URL"
DEFAULT_TIMEOUT_SECONDS = 30.0

# Fields the Interface accepts in the save body; anything else on the
# application command (e.g. pageId, which lives in the path) is not sent.
_SAVE_BODY_FIELDS = (
    "baseRevisionId",
    "document",
    "idempotencyKey",
    "pageIdConfirmed",
    "source",
    "dataContextVersion",
)

HttpResponse = tuple[int, bytes]
HttpTransport = Callable[[str, str, dict[str, str], bytes | None], HttpResponse]


class JavaPageAssetPort:
    """`PageAssetPort` over the first-party Java page assets Interface (ADR-0062).

    Talks to ``POST {base}/pages/{pageId}/revisions`` exactly as declared in
    ``contracts/metriccanvas/page-assets/rest-services-page-assets.yaml``:
    ``X-Operator-Id`` carries the acting identity, the ``{code, message,
    details}`` envelope becomes :class:`PageAssetError` so ``build_page`` keeps
    the Java code verbatim in its ``save`` stage issue.
    """

    def __init__(
        self,
        base_url: str,
        identity: IdentityPort,
        *,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        transport: HttpTransport | None = None,
    ) -> None:
        if not base_url or not base_url.strip():
            raise ValueError("base_url is required")
        self._base_url = base_url.strip().rstrip("/")
        self._identity = identity
        self._timeout_seconds = timeout_seconds
        self._transport = transport or self._urllib_transport

    async def save_revision(self, command: JsonObject) -> SavedRevision:
        page_id = command.get("pageId")
        if not isinstance(page_id, str) or not page_id:
            raise PageAssetError("INVALID_REQUEST", "save command has no pageId")
        body = {field: command.get(field) for field in _SAVE_BODY_FIELDS if field in command}
        url = f"{self._base_url}/pages/{urllib.parse.quote(page_id, safe='')}/revisions"
        identity = self._identity.current()
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Operator-Id": identity.operator_id,
        }
        if identity.auth_token:
            headers["X-Auth-Token"] = identity.auth_token
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")

        status, raw = await asyncio.to_thread(self._transport, "POST", url, headers, payload)
        decoded = _decode_json(raw)
        if status == 201 and isinstance(decoded, dict):
            return SavedRevision(
                page_id=str(decoded["pageId"]),
                revision_id=str(decoded["revisionId"]),
                revision_number=int(decoded["revisionNumber"]),
            )
        raise _envelope_error(status, decoded)

    def _urllib_transport(
        self,
        method: str,
        url: str,
        headers: dict[str, str],
        payload: bytes | None,
    ) -> HttpResponse:
        request = urllib.request.Request(url, data=payload, method=method, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=self._timeout_seconds) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            return error.code, error.read()
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            raise PageAssetError(
                "PAGE_ASSETS_UNAVAILABLE",
                f"Java page assets unreachable at {self._base_url}: {error}",
            ) from error


def _decode_json(raw: bytes) -> Any:
    if not raw:
        return None
    try:
        return json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None


def _envelope_error(status: int, decoded: Any) -> PageAssetError:
    if isinstance(decoded, dict) and isinstance(decoded.get("code"), str):
        details = decoded.get("details")
        return PageAssetError(
            decoded["code"],
            str(decoded.get("message") or decoded["code"]),
            details=details if isinstance(details, dict) else None,
            status=status,
        )
    return PageAssetError(
        "PAGE_ASSETS_UNAVAILABLE",
        f"Java page assets returned HTTP {status} without an error envelope",
        status=status,
    )
