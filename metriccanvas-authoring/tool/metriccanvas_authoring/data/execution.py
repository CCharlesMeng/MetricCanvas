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
RETRY_SAFETY_BY_CODE: Mapping[str, bool] = {
    "DQE_TRANSPORT_ERROR": True,
    "DQE_TIMEOUT": True,
    "DQE_CANCELLED": False,
    "DQE_AUTH_REQUIRED": False,
    "DQE_FORBIDDEN": False,
    "DQE_CONFIG_ERROR": False,
    "DQE_FILTER_BINDING_ERROR": False,
    "DQE_QUERY_REJECTED": False,
    "DQE_ENVELOPE_ERROR": False,
    "DQE_ITEM_ERROR": False,
    "DQE_FIELD_MAPPING_ERROR": False,
    "DQE_ROW_CONTRACT_ERROR": False,
}

UNIT_SAMPLE_ROW_LIMIT = 20


class DqeExecutionError(Exception):
    """Stable DQE failure surfaced through the authoring application boundary."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True, slots=True)
class FormulaTrace:
    """Audit trace for one open-form DQE formula."""

    question: str
    expression: str
    referenced_metrics: tuple[str, ...]

    def to_payload(self) -> dict[str, Any]:
        return {
            "question": self.question,
            "expression": self.expression,
            "referencedMetrics": list(self.referenced_metrics),
        }


@dataclass(frozen=True, slots=True)
class DqeExecutionResult:
    """Normalized DQE rows plus the capture facts needed by Page assembly."""

    rows: Sequence[JsonObject]
    total_count: int | None = None
    captured_at: str | None = None

    @property
    def returned_row_count(self) -> int:
        """Number of rows returned by DQE before the embedded sample is capped."""
        return len(self.rows)

    @property
    def sample_rows(self) -> Sequence[JsonObject]:
        return self.rows[:UNIT_SAMPLE_ROW_LIMIT]

    @property
    def effective_total_count(self) -> int:
        """Preserve DQE's full count, or fall back to its returned row count."""
        return (
            self.returned_row_count
            if self.total_count is None
            else self.total_count
        )


@dataclass(frozen=True, slots=True)
class AuthoringExecutionFailure:
    stage: FailureStage
    code: str
    message: str
    retry_safe: bool


def retry_safe_for_code(code: str) -> bool:
    """Classify retries centrally and fail closed for every unknown code."""
    return RETRY_SAFETY_BY_CODE.get(code, False)


def failure_from_execution_error(cause: Exception) -> AuthoringExecutionFailure:
    raw_code = getattr(cause, "code", None)
    code = raw_code if isinstance(raw_code, str) else "UNIT_EXECUTION_FAILED"
    return AuthoringExecutionFailure(
        stage=RUNTIME_QUERY_ERROR_STAGES.get(code, "execution"),
        code=code,
        message=str(cause),
        retry_safe=retry_safe_for_code(code),
    )
