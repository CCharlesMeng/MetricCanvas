"""Compatibility entrypoint: content editing without page-asset configuration."""
from metriccanvas_authoring.bootstrap.compatibility import create_production_content_server
from metriccanvas_authoring.bootstrap.environment import (
    CONTENT_BASELINES_DIRECTORY_ENV as BASELINES_DIRECTORY_ENV,
)

__all__ = ["BASELINES_DIRECTORY_ENV", "create_production_content_server", "main"]


def main() -> None:
    create_production_content_server().run()


if __name__ == "__main__":
    main()
