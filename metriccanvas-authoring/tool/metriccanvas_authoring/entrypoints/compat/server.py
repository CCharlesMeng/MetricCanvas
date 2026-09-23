"""Compatibility entrypoint: discover_data_context + compose_page (no asset writes).

Kept for deployments already registered against the ``metriccanvas-authoring``
CLI. The target Platform entrypoint is ``entrypoints.mcp.platform_server``;
adapter selection belongs to ``bootstrap.environment`` and assembly to
``bootstrap.compatibility``.
"""
from __future__ import annotations

from metriccanvas_authoring.bootstrap.compatibility import create_production_server
from metriccanvas_authoring.bootstrap.environment import (
    configure_data_context,
    configure_dqe,
)

__all__ = [
    "configure_data_context",
    "configure_dqe",
    "create_production_server",
    "main",
]


def main() -> None:
    create_production_server().run()
