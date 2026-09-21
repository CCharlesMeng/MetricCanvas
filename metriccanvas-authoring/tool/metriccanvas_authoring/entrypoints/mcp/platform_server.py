"""Target entrypoint; assembly lives in ``metriccanvas_authoring.bootstrap``.

Standalone invocation advertises v2 but fails closed without trusted
providers. The old unified_content_server remains the v1 compatibility
entrypoint, not a fallback for this one.
"""
from metriccanvas_authoring.bootstrap.platform import (
    create_platform_server,
    create_production_platform_server,
)

__all__ = ["create_platform_server", "create_production_platform_server", "main"]


def main():
    create_production_platform_server().run()


if __name__ == '__main__':
    main()
