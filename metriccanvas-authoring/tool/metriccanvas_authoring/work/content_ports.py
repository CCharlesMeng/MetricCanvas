"""Trusted program boundary for complete, precisely identified edit baselines."""
from dataclasses import dataclass
from typing import Any, Mapping, Protocol


@dataclass(frozen=True, slots=True)
class ContentBaseline:
    ref: Mapping[str, str]
    document: Mapping[str, Any]
    document_sha256: str


class ContentBaselineError(Exception):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


class ContentBaselinePort(Protocol):
    async def read(self, token: str) -> ContentBaseline: ...
