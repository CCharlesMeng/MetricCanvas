"""Target assembly: the platform authoring surface.

A trusted host injects its own turn, authorization, lifecycle and preview
providers. Standalone stdio advertises the surface and fails closed without
them; it never falls back to a compatibility surface to obtain them.
"""
from metriccanvas_authoring.entrypoints.mcp.platform_mcp import create_platform_mcp_server
from metriccanvas_authoring.pages.composition.compose_page import ComposePageDependencies
from metriccanvas_authoring.pages.platform_authoring import PlatformAuthoring
from metriccanvas_authoring.bootstrap import environment
from metriccanvas_authoring.work.state import Limits
from metriccanvas_authoring.data.semantic_catalog import SemanticCatalog
from metriccanvas_authoring.adapters.firstparty.dataset_metadata_http import JavaDatasetMetadataProvider


def create_platform_server(dependencies, *, current_turns=None, store=None, analysis_authorization=None,
        lifecycle_service=None, lifecycle_identities=None, relay_preview=None, limits=Limits(),
        summary_config=None, semantic_catalog=None, parameter_dependencies=None):
    if semantic_catalog is None and isinstance(dependencies.data_context, JavaDatasetMetadataProvider):
        semantic_catalog = SemanticCatalog(dependencies.data_context, store)
    return create_platform_mcp_server(PlatformAuthoring(dependencies, current_turns, store,
        analysis_authorization=analysis_authorization, lifecycle_service=lifecycle_service,
        lifecycle_identities=lifecycle_identities, relay_preview=relay_preview, limits=limits,
        summary_config=summary_config, semantic_catalog=semantic_catalog, parameter_dependencies=parameter_dependencies))


def create_production_platform_server():
    return create_platform_server(
        ComposePageDependencies(
            environment.configure_data_context(),
            environment.configure_dqe(),
        )
    )
