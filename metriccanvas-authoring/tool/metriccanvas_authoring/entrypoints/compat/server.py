"""Compatibility entrypoint: discover_data_context + build_page / compose_page.

Kept for deployments already registered against the ``metriccanvas-authoring``
CLI. The target Platform entrypoint is ``entrypoints.mcp.platform_server``;
adapter selection belongs to ``bootstrap.environment`` and assembly to
``bootstrap.compatibility``.
"""
from __future__ import annotations

from metriccanvas_authoring.bootstrap.compatibility import create_production_server
from metriccanvas_authoring.bootstrap.environment import (
    TOOL_SURFACE_ENV,
    configure_data_context,
    configure_dqe,
    configure_page_assets,
    configure_tool_surface,
)

__all__ = [
    "TOOL_SURFACE_ENV",
    "configure_data_context",
    "configure_dqe",
    "configure_page_assets",
    "configure_tool_surface",
    "create_production_server",
    "main",
]


def main() -> None:
    create_production_server().run()
