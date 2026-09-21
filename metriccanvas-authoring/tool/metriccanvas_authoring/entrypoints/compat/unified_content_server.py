"""Compatibility entrypoint for candidate protocol 1.0 deployments.

The provider must be injected by a trusted embedding adapter. Standalone
stdio advertises the surface but fails closed: a production identity/latest
and model-summary handoff adapter has not yet been supplied.
"""
from metriccanvas_authoring.bootstrap.compatibility import (
    create_deployment_content_server,
    create_production_unified_content_server,
)

__all__ = [
    "create_deployment_content_server",
    "create_production_unified_content_server",
    "main",
]


def main():
    create_production_unified_content_server().run()


if __name__ == '__main__':
    main()
