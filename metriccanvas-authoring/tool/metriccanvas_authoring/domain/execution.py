from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Sequence


JsonObject = Mapping[str, Any]


@dataclass(frozen=True, slots=True)
class DqeExecutionResult:
    """Normalized DQE rows plus the capture facts needed by Page assembly."""

    rows: Sequence[JsonObject]
    total_count: int | None = None
    captured_at: str | None = None
