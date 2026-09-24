"""Internal entrypoint. Replace with real company adapters; no mock fallback.

See RELAY-HANDOFF.md and contracts/authored/adapter-interface.md.
Return AuthoringAdapters with invocation-scoped identity and durable state.
"""
from metriccanvas_authoring.bootstrap.adapter_contract import (
    ADAPTER_INTERFACE_VERSION, AdapterContractError, AuthoringAdapters,
)


def create_adapters() -> AuthoringAdapters:
    raise AdapterContractError('ADAPTERS_NOT_CONFIGURED')
