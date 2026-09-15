"""Host composition root for a verified deployment's public content server."""
from metriccanvas_authoring.adapters.inbound.unified_content_mcp import create_unified_content_mcp_server
from metriccanvas_authoring.application.authoring_deployment import Deployment


def create_deployment_content_server(deployment: Deployment, *, summary_config=None):
    system = deployment.system
    return create_unified_content_mcp_server(
        deployment.dependencies,
        system.current_turns if system else None,
        summary_config=summary_config,
        candidate_store=system.candidate_store if system else None,
    )
