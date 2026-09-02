from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, Mapping, Sequence


JsonObject = Mapping[str, Any]
FailureStage = Literal[
    "discovery", "generation", "execution", "presentation", "save"
]

RUNTIME_QUERY_ERROR_STAGES: Mapping[str, FailureStage] = {
    "DQE_CONFIG_ERROR": "generation",
    "DQE_FILTER_BINDING_ERROR": "generation",
    "DQE_CANCELLED": "execution",
    "DQE_AUTH_REQUIRED": "execution",
    "DQE_FORBIDDEN": "execution",
    "DQE_TIMEOUT": "execution",
    "DQE_QUERY_REJECTED": "execution",
    "DQE_TRANSPORT_ERROR": "execution",
    "DQE_ENVELOPE_ERROR": "execution",
    "DQE_ITEM_ERROR": "execution",
    "DQE_FIELD_MAPPING_ERROR": "presentation",
    "DQE_ROW_CONTRACT_ERROR": "presentation",
}


@dataclass(frozen=True, slots=True)
class DqeExecutionResult:
    """Normalized DQE rows plus the capture facts needed by Page assembly."""

    rows: Sequence[JsonObject]
    total_count: int | None = None
    captured_at: str | None = None


@dataclass(frozen=True, slots=True)
class AuthoringExecutionFailure:
    stage: FailureStage
    code: str
    message: str


def failure_from_execution_error(cause: Exception) -> AuthoringExecutionFailure:
    raw_code = getattr(cause, "code", None)
    code = raw_code if isinstance(raw_code, str) else "UNIT_EXECUTION_FAILED"
    return AuthoringExecutionFailure(
        stage=RUNTIME_QUERY_ERROR_STAGES.get(code, "execution"),
        code=code,
        message=str(cause),
    )
