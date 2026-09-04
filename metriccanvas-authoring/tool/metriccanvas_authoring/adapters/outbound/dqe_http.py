from __future__ import annotations

import asyncio
import json
import socket
import urllib.error
from collections.abc import Callable
from datetime import date, datetime, timezone
from typing import Any, Mapping

import httpx

from metriccanvas_authoring.application.ports import IdentityPort, JsonObject
from metriccanvas_authoring.domain.execution import (
    DqeExecutionError,
    DqeExecutionResult,
)


DQE_BASE_URL_ENV = "METRICCANVAS_DQE_BASE_URL"
DQE_WORKSPACE_ID_ENV = "METRICCANVAS_DQE_WORKSPACE_ID"
DQE_FORBIDDEN_HINT_ENV = "METRICCANVAS_DQE_FORBIDDEN_HINT"
DEFAULT_TIMEOUT_SECONDS = 25.0
SUCCESS_RET_CODE = "CBC.0000"

HttpResponse = tuple[int, bytes]
HttpTransport = Callable[[str, str, dict[str, str], bytes | None], HttpResponse]
TimestampFactory = Callable[[], str]


class DqeHttpExecutionPort:
    """Execute one derived DQE item through CDINL2DataBuilderService."""

    def __init__(
        self,
        base_url: str,
        workspace_id: str,
        identity: IdentityPort,
        *,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        transport: HttpTransport | None = None,
        async_transport: httpx.AsyncBaseTransport | None = None,
        timestamp: TimestampFactory | None = None,
        forbidden_hint: str | None = None,
    ) -> None:
        if not base_url or not base_url.strip():
            raise ValueError("base_url is required")
        if not workspace_id or not workspace_id.strip():
            raise ValueError("workspace_id is required")
        if transport is not None and async_transport is not None:
            raise ValueError("transport and async_transport are mutually exclusive")
        self._base_url = base_url.strip().rstrip("/")
        self._workspace_id = workspace_id.strip()
        self._identity = identity
        self._timeout_seconds = timeout_seconds
        self._transport = transport
        self._async_transport = async_transport
        self._timestamp = timestamp or _utc_timestamp
        self._forbidden_hint = (forbidden_hint or "").strip() or None

    async def execute(self, effective_query: JsonObject) -> DqeExecutionResult:
        body, fields = _validate_effective_query(effective_query)
        try:
            identity = self._identity.current()
        except RuntimeError as error:
            raise DqeExecutionError("DQE_CONFIG_ERROR", str(error)) from error
        if not identity.auth_token:
            raise DqeExecutionError(
                "DQE_CONFIG_ERROR",
                "METRICCANVAS_AUTH_TOKEN is required by DQE",
            )

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Auth-Token": identity.auth_token,
            "X-Operator-Id": identity.operator_id,
            "X-Workspace-Id": self._workspace_id,
        }
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        url = f"{self._base_url}/dsl/execute"
        try:
            status, raw = await self._request("POST", url, headers, payload)
        except DqeExecutionError:
            raise
        except (TimeoutError, socket.timeout, httpx.TimeoutException) as error:
            raise DqeExecutionError(
                "DQE_TIMEOUT", f"DQE timed out after {self._timeout_seconds:g}s"
            ) from error
        except httpx.RequestError as error:
            raise DqeExecutionError(
                "DQE_TRANSPORT_ERROR",
                f"DQE is unreachable at {self._base_url}: {error}",
            ) from error
        except urllib.error.URLError as error:
            if isinstance(error.reason, (TimeoutError, socket.timeout)):
                raise DqeExecutionError(
                    "DQE_TIMEOUT",
                    f"DQE timed out after {self._timeout_seconds:g}s",
                ) from error
            raise DqeExecutionError(
                "DQE_TRANSPORT_ERROR", f"DQE is unreachable at {self._base_url}: {error}"
            ) from error
        except OSError as error:
            raise DqeExecutionError(
                "DQE_TRANSPORT_ERROR", f"DQE is unreachable at {self._base_url}: {error}"
            ) from error

        if status == 401:
            raise DqeExecutionError("DQE_AUTH_REQUIRED", "DQE rejected authentication")
        if status == 403:
            raise DqeExecutionError(
                "DQE_FORBIDDEN",
                _with_forbidden_hint(
                    "DQE denied this execution", self._forbidden_hint
                ),
            )
        if status < 200 or status >= 300:
            raise DqeExecutionError(
                "DQE_TRANSPORT_ERROR", f"DQE returned HTTP {status}"
            )

        envelope = _decode_envelope(raw)
        item = _successful_item(envelope, self._forbidden_hint)
        rows = _normalize_rows(item.get("data"), fields)
        total_count = item.get("total_count")
        if total_count is not None and (
            not isinstance(total_count, int) or isinstance(total_count, bool)
            or total_count < 0
        ):
            raise DqeExecutionError(
                "DQE_ENVELOPE_ERROR", "DQE result total_count must be an integer"
            )
        return DqeExecutionResult(
            rows=rows,
            total_count=total_count,
            captured_at=self._timestamp(),
        )

    async def _request(
        self,
        method: str,
        url: str,
        headers: dict[str, str],
        payload: bytes | None,
    ) -> HttpResponse:
        if self._transport is not None:
            return await asyncio.to_thread(
                self._transport, method, url, headers, payload
            )
        async with httpx.AsyncClient(
            timeout=self._timeout_seconds,
            transport=self._async_transport,
            follow_redirects=True,
        ) as client:
            response = await client.request(
                method,
                url,
                headers=headers,
                content=payload,
            )
            return response.status_code, response.content


def _validate_effective_query(
    effective_query: JsonObject,
) -> tuple[dict[str, Any], Mapping[str, Any]]:
    if effective_query.get("language") != "dqe":
        raise DqeExecutionError(
            "DQE_CONFIG_ERROR", "effective query language must be dqe"
        )
    raw_body = effective_query.get("body")
    if not isinstance(raw_body, Mapping):
        raise DqeExecutionError("DQE_CONFIG_ERROR", "effective query body is missing")
    dsl_list = raw_body.get("dsl_list")
    if (
        not isinstance(dsl_list, list)
        or len(dsl_list) != 1
        or not isinstance(dsl_list[0], Mapping)
    ):
        raise DqeExecutionError(
            "DQE_CONFIG_ERROR", "effective query must contain exactly one DQE item"
        )
    raw_fields = effective_query.get("fieldMappings")
    if not isinstance(raw_fields, Mapping) or not raw_fields:
        raise DqeExecutionError(
            "DQE_FIELD_MAPPING_ERROR", "effective query has no field mappings"
        )
    query_fields: set[str] = set()
    for field_id, raw_field in raw_fields.items():
        if not isinstance(raw_field, Mapping):
            raise DqeExecutionError(
                "DQE_FIELD_MAPPING_ERROR", f"field mapping {field_id} is not an object"
            )
        query_field = raw_field.get("queryField")
        if not isinstance(query_field, str) or not query_field:
            raise DqeExecutionError(
                "DQE_FIELD_MAPPING_ERROR", f"field mapping {field_id} has no queryField"
            )
        if query_field in query_fields:
            raise DqeExecutionError(
                "DQE_FIELD_MAPPING_ERROR", f"queryField is mapped more than once: {query_field}"
            )
        query_fields.add(query_field)
    return dict(raw_body), raw_fields


def _decode_envelope(raw: bytes) -> Mapping[str, Any]:
    try:
        decoded = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise DqeExecutionError(
            "DQE_ENVELOPE_ERROR", "DQE returned malformed JSON"
        ) from error
    if not isinstance(decoded, Mapping):
        raise DqeExecutionError(
            "DQE_ENVELOPE_ERROR", "DQE response envelope must be an object"
        )
    return decoded


def _successful_item(
    envelope: Mapping[str, Any], forbidden_hint: str | None
) -> Mapping[str, Any]:
    if envelope.get("retCode") != SUCCESS_RET_CODE:
        description = str(envelope.get("retDesc") or envelope.get("retCode") or "unknown")
        raise DqeExecutionError(
            "DQE_ENVELOPE_ERROR", f"DQE envelope rejected the request: {description}"
        )
    results = envelope.get("results")
    if (
        not isinstance(results, list)
        or len(results) != 1
        or not isinstance(results[0], Mapping)
    ):
        raise DqeExecutionError(
            "DQE_ENVELOPE_ERROR", "DQE envelope must contain exactly one result item"
        )
    item = results[0]
    code = item.get("code")
    if code == "SUCCESS":
        return item
    mappings = {
        "NO_PERMISSION": "DQE_FORBIDDEN",
        "NO_MATCH": "DQE_QUERY_REJECTED",
        "FILTER_NO_MATCH": "DQE_QUERY_REJECTED",
        "ERROR": "DQE_ITEM_ERROR",
    }
    mapped = mappings.get(code)
    if mapped is None:
        raise DqeExecutionError(
            "DQE_ENVELOPE_ERROR", f"DQE returned unknown result code: {code!r}"
        )
    message = str(item.get("message") or item.get("msg") or code)
    if mapped == "DQE_FORBIDDEN":
        message = _with_forbidden_hint(message, forbidden_hint)
    raise DqeExecutionError(mapped, f"DQE item failed: {message}")


def _with_forbidden_hint(message: str, hint: str | None) -> str:
    return message if hint is None else f"{message}; {hint}"


def _normalize_rows(
    raw_rows: Any, fields: Mapping[str, Any]
) -> tuple[dict[str, Any], ...]:
    if not isinstance(raw_rows, list):
        raise DqeExecutionError(
            "DQE_ENVELOPE_ERROR", "DQE result data must be an array"
        )
    rows: list[dict[str, Any]] = []
    for row_index, raw_row in enumerate(raw_rows):
        if not isinstance(raw_row, Mapping):
            raise DqeExecutionError(
                "DQE_ROW_CONTRACT_ERROR", f"DQE row {row_index} is not an object"
            )
        row = dict(raw_row)
        for field_id, raw_field in fields.items():
            field = raw_field if isinstance(raw_field, Mapping) else {}
            query_field = str(field["queryField"])
            if query_field not in row:
                raise DqeExecutionError(
                    "DQE_ROW_CONTRACT_ERROR",
                    f"DQE row {row_index} is missing mapped field {query_field!r}",
                )
            if _violates_field(row[query_field], field):
                raise DqeExecutionError(
                    "DQE_ROW_CONTRACT_ERROR",
                    f"DQE row {row_index} field {query_field!r} violates mapping {field_id!r}",
                )
        rows.append(row)
    return tuple(rows)


def _violates_field(value: Any, field: Mapping[str, Any]) -> bool:
    if value is None:
        return field.get("nullable") is False
    field_type = field.get("type")
    if field_type == "string":
        return not isinstance(value, str)
    if field_type in {"number", "money"}:
        return not isinstance(value, (int, float)) or isinstance(value, bool)
    if field_type == "boolean":
        return not isinstance(value, bool)
    if field_type == "date":
        if not isinstance(value, str) or "T" in value:
            return True
        try:
            date.fromisoformat(value)
        except ValueError:
            return True
        return False
    if field_type == "datetime":
        if not isinstance(value, str) or "T" not in value:
            return True
        try:
            datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return True
        return False
    return False


def _utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00", "Z"
    )
