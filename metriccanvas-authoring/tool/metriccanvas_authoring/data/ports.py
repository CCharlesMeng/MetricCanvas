"""What the data capability needs from outside: governed metadata and execution.

Declared here because this module consumes them. Adapters implement them; no
use case depends on a concrete adapter.
"""
from __future__ import annotations

from typing import Any, Mapping, Protocol, Sequence, TYPE_CHECKING

if TYPE_CHECKING:
    from metriccanvas_authoring.data.validation_policy import QueryValidationPolicy

from metriccanvas_authoring.data.execution import DqeExecutionResult

JsonObject = Mapping[str, Any]


class DataContextError(Exception):
    """Stable failure while loading or normalizing governed metadata."""

    def __init__(self, code: str, message: str, *, diagnostics: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.code = code
        # Trusted local diagnostics only; never automatically sent to the model.
        self.diagnostics = diagnostics


class DataContextPort(Protocol):
    async def current(self) -> JsonObject: ...


class PolicyAwareDataContextPort(DataContextPort, Protocol):
    """Optional query-context/1 extension. The policy is fixed by public code per batch.

    current() remains neutral Schema 1.1; current_for_query may return the marked
    private execution view with unknown optional governance omitted. It must
    preserve identity, security, source facts and the discovery version.
    """
    async def current_for_query(self, policy: "QueryValidationPolicy") -> JsonObject: ...


class DimensionValuePort(Protocol):
    """Optional MetricService seam; Lab does not provide dimension values."""

    async def values_for(
        self, dataset_id: str, dimensions: Sequence[str]
    ) -> Mapping[str, Sequence[str]]: ...


class DqeExecutionPort(Protocol):
    async def execute(self, effective_query: JsonObject) -> DqeExecutionResult: ...
