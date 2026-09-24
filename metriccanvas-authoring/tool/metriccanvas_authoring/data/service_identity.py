"""Identity the Tool acts as when calling first-party services.

Public identity contract consumed by data adapters. ADR-0063: the
first adapter reads a service-state pair from the MCP config ``env``; per-user
identity injection is a production gate, not this port.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class ServiceIdentity:
    operator_id: str
    auth_token: str | None = None


class IdentityPort(Protocol):
    def current(self) -> ServiceIdentity: ...
