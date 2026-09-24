"""Authorization of the exact governed request before DQE execution."""
from typing import Protocol, TypedDict


class AnalysisGrant(TypedDict):
    binding: dict
    dataContextVersion: str
    requestSha256: str
    planConfirmed: bool
    modelEvidenceAllowed: bool


class AnalysisAuthorizationPort(Protocol):
    async def authorize(self, binding: dict, request: dict,
                        data_context_version: str) -> AnalysisGrant: ...
