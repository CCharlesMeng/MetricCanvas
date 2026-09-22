"""T04 consumer ports. These are internal proposals, never invented HTTP APIs."""
from dataclasses import dataclass, field
from typing import Any, Protocol


class LifecycleError(Exception):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


@dataclass(frozen=True)
class LifecycleIdentity:
    actor_id: str
    workspace_id: str
    auth_token: str = field(repr=False)


class LifecycleIdentityPort(Protocol):
    def current(self) -> LifecycleIdentity: ...


@dataclass(frozen=True)
class LifecycleCapabilities:
    stable_save: bool = False
    exact_read: bool = False
    history: bool = False
    operation_lookup: bool = False
    current_read: bool = False
    single_save: bool = False


class LifecycleServicePort(Protocol):
    capabilities: LifecycleCapabilities

    async def save(self, identity: LifecycleIdentity, command: dict) -> dict: ...
    async def lookup(self, identity: LifecycleIdentity, command: dict) -> dict: ...
    async def read(self, identity: LifecycleIdentity, ref: dict) -> dict: ...
    async def current_match(self, identity: LifecycleIdentity, ref: dict) -> dict:
        """Read current Java resource and reject when its revision no longer matches ref."""
        ...
    async def history(self, identity: LifecycleIdentity, command: dict) -> dict: ...
    def verify_document(self, document: dict, content_hash: str, canonicalization: str) -> bool:
        """Verify original persisted content using explicitly negotiated semantics."""
        ...


class LifecycleProgramPort(Protocol):
    async def load(self, token: str, identity: LifecycleIdentity) -> dict[str, Any]: ...
    async def store(self, value: dict, identity: LifecycleIdentity) -> str:
        """Deliver complete document/history to a trusted program, never MCP content."""
        ...
