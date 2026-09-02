from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Protocol, Sequence


JsonObject = Mapping[str, Any]


@dataclass(frozen=True, slots=True)
class DqeExecutionResult:
    rows: Sequence[JsonObject]
    total_count: int | None = None


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
