"""Trusted program-channel delivery; ready is acceptance, not screen visibility."""
from typing import Protocol, TypedDict, Literal


class PreviewReceipt(TypedDict):
    status: Literal['ready']
    artifactRef: str
    ref: dict


class PreviewPort(Protocol):
    async def prepare(self, artifact: dict) -> PreviewReceipt: ...
