"""What the data capability needs from outside: governed metadata and execution.

Declared here because this module consumes them. Adapters implement them; no
use case depends on a concrete adapter.
"""
from __future__ import annotations

from typing import Any, Mapping, Protocol, Sequence

from metriccanvas_authoring.data.execution import DqeExecutionResult

JsonObject = Mapping[str, Any]


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
