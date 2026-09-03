from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Protocol, Sequence

from metriccanvas_authoring.domain.execution import DqeExecutionResult


JsonObject = Mapping[str, Any]


@dataclass(frozen=True, slots=True)
class SavedRevision:
    page_id: str
    revision_id: str
    revision_number: int


@dataclass(frozen=True, slots=True)
class ServiceIdentity:
    """Identity the Tool acts as when calling first-party services.

    ADR-0063: the first adapter reads a service-state pair from the MCP config
    ``env``; per-user identity injection is a production gate, not this port.
    """

    operator_id: str
    auth_token: str | None = None


class PageAssetError(Exception):
    """Stable page-asset failure: ``code`` is the Java error envelope code."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        details: JsonObject | None = None,
        status: int | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.details = dict(details) if details is not None else None
        self.status = status


class DataContextError(Exception):
    """Stable failure while loading or normalizing governed metadata."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class DataContextPort(Protocol):
    async def current(self) -> JsonObject: ...


class DimensionValuePort(Protocol):
    """Optional MetricService seam; Lab does not provide dimension values."""

    async def values_for(
        self, dataset_id: str, dimensions: Sequence[str]
    ) -> Mapping[str, Sequence[str]]: ...


class DqeExecutionPort(Protocol):
    async def execute(self, effective_query: JsonObject) -> DqeExecutionResult: ...


class PageAssetPort(Protocol):
    async def save_revision(self, command: JsonObject) -> SavedRevision: ...


class IdentityPort(Protocol):
    def current(self) -> ServiceIdentity: ...
