"""Relay-owned provider implementations belong here and in sibling modules.

Replace this deliberate startup stop only after the existing Relay plugin can
provide a trusted per-invocation turn, exact authorization, identity and an
artifact receipt. Do not read these values from MCP tool arguments, mutate the
Relay parent process environment, or clear the shared work DB on shutdown.
"""
from metriccanvas_relay_authoring.host import AdapterContractError, HostAdapters


def create_host_adapters() -> HostAdapters:
    """Return providers for this stdio invocation from trusted Relay context."""
    raise AdapterContractError('RELAY_ADAPTERS_NOT_CONFIGURED')
