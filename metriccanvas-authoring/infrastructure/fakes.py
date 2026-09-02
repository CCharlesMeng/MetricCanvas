from __future__ import annotations

from copy import deepcopy
from typing import Any

from core.ports import DqeExecutionResult, JsonObject, SavedRevision


class FakeDataContextPort:
    def __init__(self, snapshot: JsonObject) -> None:
        self.snapshot = deepcopy(snapshot)
        self.calls = 0

    async def current(self) -> JsonObject:
        self.calls += 1
        return deepcopy(self.snapshot)


class FakeDqeExecutionPort:
    def __init__(self, result: DqeExecutionResult) -> None:
        self.result = result
        self.calls: list[dict[str, Any]] = []

    async def execute(self, effective_query: JsonObject) -> DqeExecutionResult:
        self.calls.append(deepcopy(dict(effective_query)))
        return deepcopy(self.result)


class FakePageAssetPort:
    def __init__(self, result: SavedRevision) -> None:
        self.result = result
        self.calls: list[dict[str, Any]] = []

    async def save_revision(self, command: JsonObject) -> SavedRevision:
        self.calls.append(deepcopy(dict(command)))
        return self.result
