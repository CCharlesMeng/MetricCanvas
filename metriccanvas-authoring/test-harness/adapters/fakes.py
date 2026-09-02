from __future__ import annotations

from copy import deepcopy
from typing import Any

from metriccanvas_authoring.application.ports import (
    DqeExecutionResult,
    JsonObject,
    SavedRevision,
)


class FakeDataContextPort:
    def __init__(self, snapshot: JsonObject) -> None:
        self.snapshot = deepcopy(snapshot)
        self.calls = 0

    async def current(self) -> JsonObject:
        self.calls += 1
        return deepcopy(self.snapshot)


class FakeDqeExecutionPort:
    def __init__(
        self,
        result: DqeExecutionResult | None = None,
        *,
        error: Exception | None = None,
    ) -> None:
        if result is None and error is None:
            raise ValueError("result or error is required")
        self.result = result
        self.error = error
        self.calls: list[dict[str, Any]] = []

    async def execute(self, effective_query: JsonObject) -> DqeExecutionResult:
        self.calls.append(deepcopy(dict(effective_query)))
        if self.error is not None:
            raise self.error
        assert self.result is not None
        return deepcopy(self.result)


class FakePageAssetPort:
    def __init__(
        self,
        result: SavedRevision | None = None,
        *,
        error: Exception | None = None,
    ) -> None:
        if result is None and error is None:
            raise ValueError("result or error is required")
        self.result = result
        self.error = error
        self.calls: list[dict[str, Any]] = []

    async def save_revision(self, command: JsonObject) -> SavedRevision:
        self.calls.append(deepcopy(dict(command)))
        if self.error is not None:
            raise self.error
        assert self.result is not None
        return self.result
