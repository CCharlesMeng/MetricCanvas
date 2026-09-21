"""What the page-asset capability needs from outside: save one revision.

The save receipt is the only thing this side treats as proof. A local digest
never stands in for the page service's own revision identity.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Protocol

JsonObject = Mapping[str, Any]


@dataclass(frozen=True, slots=True)
class SavedRevision:
    page_id: str
    revision_id: str
    revision_number: int


class PageAssetError(Exception):
    """Stable page-asset failure: ``code`` is the Java error envelope code."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        details: JsonObject | None = None,
        status: int | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.details = dict(details) if details is not None else None
        self.status = status


class PageAssetPort(Protocol):
    async def save_revision(self, command: JsonObject) -> SavedRevision: ...
