"""One deployment loader and assembly path, with no concrete adapter dependency."""
import importlib
from metriccanvas_authoring.bootstrap.adapter_contract import (
    ADAPTER_INTERFACE_VERSION, AdapterContractError, AuthoringAdapters,
)
from metriccanvas_authoring.bootstrap.platform import create_platform_server, DeploymentReadinessError
from metriccanvas_authoring.bootstrap.readiness import platform_readiness
from metriccanvas_authoring.pages.composition.compose_page import ComposePageDependencies


def load_adapters() -> AuthoringAdapters:
    try:
        factory = importlib.import_module('metriccanvas_authoring.adapters.factory')
        adapters = factory.create_adapters()
    except AdapterContractError:
        raise
    except Exception:
        raise AdapterContractError('ADAPTER_LOAD_FAILED') from None
    if not isinstance(adapters, AuthoringAdapters) or adapters.interface_version != ADAPTER_INTERFACE_VERSION:
        raise AdapterContractError('ADAPTER_CONTRACT_MISMATCH')
    return adapters


def prepare(adapters: AuthoringAdapters):
    if not isinstance(adapters, AuthoringAdapters) or adapters.interface_version != ADAPTER_INTERFACE_VERSION:
        raise AdapterContractError('ADAPTER_CONTRACT_MISMATCH')
    dependencies = ComposePageDependencies(adapters.data_context, adapters.dqe,
        source_description=adapters.source_description, metric_relations=adapters.metric_relations)
    inputs = dict(current_turns=adapters.current_turns, store=adapters.store,
        analysis_authorization=adapters.analysis_authorization,
        lifecycle_service=adapters.lifecycle_service,
        lifecycle_identities=adapters.lifecycle_identities, relay_preview=adapters.relay_preview,
        parameter_dependencies=adapters.parameter_dependencies)
    report = platform_readiness(dependencies, **inputs)
    if adapters.semantic_catalog is not None and not all(callable(getattr(adapters.semantic_catalog, name, None))
            for name in ('discover', 'query_issues')):
        raise AdapterContractError('SEMANTIC_CATALOG_CONTRACT_MISMATCH')
    report['discoveryProtocolVersion'] = getattr(adapters.semantic_catalog, 'discovery_protocol_version', None)
    report['adapterInterfaceVersion'] = ADAPTER_INTERFACE_VERSION
    report['semanticCatalog'] = 'assembled' if adapters.semantic_catalog is not None else 'optional_unconfigured'
    return dependencies, inputs, report


def assemble(adapters: AuthoringAdapters):
    dependencies, inputs, report = prepare(adapters)
    if not report['deploymentReady']:
        raise DeploymentReadinessError(report)
    return create_platform_server(dependencies, semantic_catalog=adapters.semantic_catalog, **inputs)
