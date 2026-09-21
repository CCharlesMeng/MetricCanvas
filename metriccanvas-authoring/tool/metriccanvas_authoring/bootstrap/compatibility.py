"""Assembly for the surfaces that predate the platform protocol.

Deployments are already registered against these entrypoints, so each keeps
its own tools and failure behaviour. They take adapters from the same
environment selection as the target surface; none of them is a fallback for
it, and the target surface never assembles from here.
"""
from metriccanvas_authoring.entrypoints.compat.content_mcp import create_content_mcp_server
from metriccanvas_authoring.entrypoints.compat.fastmcp import create_mcp_server
from metriccanvas_authoring.entrypoints.compat.lifecycle_mcp import create_lifecycle_mcp_server
from metriccanvas_authoring.entrypoints.compat.unified_content_mcp import create_unified_content_mcp_server
from metriccanvas_authoring.adapters.firstparty.publish_unavailable import (
    UnavailableHumanConfirmations,
    UnavailablePublicationService,
)
from metriccanvas_authoring.assets.authoring_deployment import Deployment
from metriccanvas_authoring.application.build_page import BuildPageDependencies
from metriccanvas_authoring.pages.composition.compose_page import ComposePageDependencies
from metriccanvas_authoring.application.publish_ports import PublicationDependencies
from metriccanvas_authoring.bootstrap import environment


def compose_page_dependencies() -> ComposePageDependencies:
    return ComposePageDependencies(
        environment.configure_data_context(),
        environment.configure_dqe(),
    )


def create_production_server():
    """Ask/Explore surface: discovery, build_page and compose_page."""
    return create_mcp_server(
        BuildPageDependencies(
            data_context=environment.configure_data_context(),
            dqe=environment.configure_dqe(),
            page_assets=environment.configure_page_assets(),
        ),
        tool_surface=environment.configure_tool_surface(),
    )


def create_production_content_server():
    """Content editing surface: no page-asset port, so it cannot save."""
    return create_content_mcp_server(
        compose_page_dependencies(),
        environment.configure_content_baselines(),
        summary_config=environment.configure_summary_config(),
    )


def create_production_unified_content_server(*, current_turns=None):
    """Candidate protocol 1.0 surface; without an injected turn provider it fails closed."""
    return create_unified_content_mcp_server(
        compose_page_dependencies(),
        current_turns,
        summary_config=environment.configure_summary_config(),
    )


def create_deployment_content_server(deployment: Deployment, *, summary_config=None):
    """Candidate protocol 1.0 surface for a host that already verified its deployment."""
    system = deployment.system
    return create_unified_content_mcp_server(
        deployment.dependencies,
        system.current_turns if system else None,
        summary_config=summary_config,
        candidate_store=system.candidate_store if system else None,
    )


def create_production_lifecycle_server():
    """Draft lifecycle surface: known HTTP only; strong save ports stay unavailable."""
    return create_lifecycle_mcp_server(
        environment.configure_lifecycle_service(),
        environment.configure_lifecycle_programs(),
        environment.configure_lifecycle_identities(),
        publication=PublicationDependencies(
            UnavailablePublicationService(),
            UnavailableHumanConfirmations(),
        ),
    )
