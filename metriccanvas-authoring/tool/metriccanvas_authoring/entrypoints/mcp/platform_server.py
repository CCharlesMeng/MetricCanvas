"""Target entrypoint; assembly lives in ``metriccanvas_authoring.bootstrap``.

Standalone invocation advertises the current platform protocol but fails
closed without trusted providers. Historical candidate entrypoints are not
part of the production registration and are never a fallback.
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
