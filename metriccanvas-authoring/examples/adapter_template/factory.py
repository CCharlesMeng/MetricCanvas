"""Internal entrypoint. Replace with real company adapters; no mock fallback.

See RELAY-HANDOFF.md and contracts/authored/adapter-interface.md.
Return AuthoringAdapters with invocation-scoped identity and durable state.
Load projection explicitly (firstparty.configuration.create_metadata_provider);
reuse that metadata instance for data_context and SemanticCatalog. Setting an
environment variable alone does not call the compatibility environment module.
"""
from metriccanvas_authoring.bootstrap.adapter_contract import (
    ADAPTER_INTERFACE_VERSION, AdapterContractError, AuthoringAdapters,
)


def create_adapters() -> AuthoringAdapters:
    raise AdapterContractError('ADAPTERS_NOT_CONFIGURED')
