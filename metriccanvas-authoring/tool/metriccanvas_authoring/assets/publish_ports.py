"""T19 compatibility boundaries, not current Java HTTP definitions.

6.5 deterministic preparation uses parameter_preparation.ParameterProgram and
the existing single-save coordinator. It must not assume these lookup/lease
capabilities are implemented by a current Java deployment.
"""
from dataclasses import dataclass
from typing import Protocol
from .lifecycle_ports import LifecycleIdentity


class PublicationServicePort(Protocol):
    available: bool

    async def lookup(self, identity: LifecycleIdentity, command: dict) -> dict:
        """Authorize current access; check the entire original operation fingerprint."""
        ...

    async def prepare(self, identity: LifecycleIdentity, command: dict) -> dict: ...
    async def read(self, identity: LifecycleIdentity, ref: dict) -> dict: ...
    async def revise(self, identity: LifecycleIdentity, command: dict) -> dict: ...
    async def publish(self, identity: LifecycleIdentity, command: dict,
                      candidate: dict, confirmation: dict) -> dict:
        """Atomically verify rights/head/version/review/proof/lease/time and persist."""
        ...

    def verify_document(self, document: dict, digest: str, algorithm: str) -> bool: ...
    def verify_review(self, candidate: dict) -> bool:
        """Bind the negotiated review algorithm and exact T19 review payload."""
        ...
    def verify_result(self, identity: LifecycleIdentity, command: dict, result: dict) -> bool:
        """Verify full original request fingerprint, operation and result association.

        This must not be implemented as a nonempty hash/ID test. The adapter must
        verify the provider's authoritative binding to the original request.
        Completed operations still require current permission to read their result.
        """
        ...


class HumanConfirmationPort(Protocol):
    async def read(self, token: str, identity: LifecycleIdentity) -> dict:
        """Resolve an authenticated human event, never a model-authored proof.

        The implementation must authenticate provenance and current access before
        returning the record. An arbitrary spool value or UUID is not evidence.
        """
        ...


@dataclass(frozen=True)
class PublicationDependencies:
    service: PublicationServicePort
    confirmations: HumanConfirmationPort
