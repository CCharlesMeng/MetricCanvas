"""Versioned seam between the MetricCanvas Bundle and Relay-owned adapters."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from metriccanvas_authoring.adapters.firstparty.lifecycle_http import KnownLifecycleHttp
from metriccanvas_authoring.adapters.storage.platform_state import SqlitePlatformState
from metriccanvas_authoring.bootstrap.platform import DeploymentReadinessError, create_platform_server
from metriccanvas_authoring.bootstrap.readiness import platform_readiness
from metriccanvas_authoring.pages.composition.compose_page import ComposePageDependencies


ADAPTER_INTERFACE_VERSION = 'relay-authoring/1.0'


@dataclass(frozen=True)
class HostAdapters:
    """Trusted providers for one stdio invocation; no model-supplied authority."""

    interface_version: str
    current_turns: Any
    analysis_authorization: Any
    lifecycle_identities: Any
    relay_preview: Any
    data_context: Any
    dqe: Any
    store: Any = None
    lifecycle_service: Any = None
    source_description: Any = None
    parameter_dependencies: Any = None


class AdapterContractError(RuntimeError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def create_relay_server(adapters: HostAdapters, *, work_db: str = '',
                        lifecycle_collection_url: str = ''):
    """Assemble nine tools and fail closed when a required provider is absent.

    Static readiness checks provider assembly. A real current turn is checked
    separately on invocation; one need not exist while this process starts.
    """
    if not isinstance(adapters, HostAdapters) or adapters.interface_version != ADAPTER_INTERFACE_VERSION:
        raise AdapterContractError('RELAY_ADAPTER_CONTRACT_MISMATCH')
    store = adapters.store
    if store is None and work_db:
        store = SqlitePlatformState(work_db)
    lifecycle = adapters.lifecycle_service
    if lifecycle is None and lifecycle_collection_url:
        lifecycle = KnownLifecycleHttp(lifecycle_collection_url)
    dependencies = ComposePageDependencies(
        adapters.data_context, adapters.dqe,
        source_description=adapters.source_description,
    )
    inputs = dict(
        current_turns=adapters.current_turns,
        store=store,
        analysis_authorization=adapters.analysis_authorization,
        lifecycle_service=lifecycle,
        lifecycle_identities=adapters.lifecycle_identities,
        relay_preview=adapters.relay_preview,
        parameter_dependencies=adapters.parameter_dependencies,
    )
    report = platform_readiness(dependencies, **inputs)
    if not report['deploymentReady']:
        raise DeploymentReadinessError(report)
    return create_platform_server(dependencies, **inputs)
