"""Unified deployment entry point. No legacy baseline-directory fallback.

The provider must be injected by a trusted embedding adapter. Standalone stdio
currently advertises the surface but fails closed: a production identity/latest
and model-summary handoff adapter has not yet been supplied.
"""
import json
import os
from metriccanvas_authoring.adapters.inbound.unified_content_mcp import create_unified_content_mcp_server
from metriccanvas_authoring.application.compose_page import ComposePageDependencies
from metriccanvas_authoring.server import configure_data_context, configure_dqe


def create_production_unified_content_server(*, current_turns=None, candidate_store=None, parameter_dependencies=None):
    try:
        summary_config = json.loads(os.environ.get('METRICCANVAS_CONTENT_AI_SUMMARY_CONFIG', 'null'))
    except ValueError:
        summary_config = None
    return create_unified_content_mcp_server(
        ComposePageDependencies(configure_data_context(), configure_dqe()),
        current_turns, summary_config=summary_config, candidate_store=candidate_store,
        parameter_dependencies=parameter_dependencies)


def main():
    create_production_unified_content_server().run()


if __name__ == '__main__':
    main()
