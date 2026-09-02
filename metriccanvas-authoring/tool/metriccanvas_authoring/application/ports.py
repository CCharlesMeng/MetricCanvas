from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Protocol

from metriccanvas_authoring.domain.execution import DqeExecutionResult


JsonObject = Mapping[str, Any]


@dataclass(frozen=True, slots=True)
class SavedRevision:
    page_id: str
    revision_id: str
    revision_number: int


class DataContextPort(Protocol):
    async def current(self) -> JsonObject: ...


class DqeExecutionPort(Protocol):
    async def execute(self, effective_query: JsonObject) -> DqeExecutionResult: ...


class PageAssetPort(Protocol):
    async def save_revision(self, command: JsonObject) -> SavedRevision: ...
