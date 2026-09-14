"""Independent content stdio entry point; no page-asset/save configuration."""
import os
from pathlib import Path

from metriccanvas_authoring.adapters.inbound.content_mcp import create_content_mcp_server
from metriccanvas_authoring.adapters.outbound.content_baselines import FileContentBaselines
from metriccanvas_authoring.application.compose_page import ComposePageDependencies
from metriccanvas_authoring.server import configure_data_context, configure_dqe

BASELINES_DIRECTORY_ENV = "METRICCANVAS_CONTENT_BASELINES_DIR"


def create_production_content_server():
    directory = (os.environ.get(BASELINES_DIRECTORY_ENV) or "").strip()
    return create_content_mcp_server(
        ComposePageDependencies(configure_data_context(), configure_dqe()),
        FileContentBaselines(Path(directory) if directory else None),
    )


def main() -> None:
    create_production_content_server().run()


if __name__ == "__main__":
    main()
