"""Optional trusted source metadata; no inference of provider identity from labels."""
from typing import Any, Mapping, Protocol


class SourceDescriptionPort(Protocol):
    async def describe(self, scope: Mapping[str, Any], data_context_version: str,
                       effective_query: Mapping[str, Any]) -> dict: ...
