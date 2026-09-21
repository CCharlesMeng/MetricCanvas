"""Compatibility entrypoint: draft lifecycle stdio, known HTTP only."""
from metriccanvas_authoring.bootstrap.compatibility import create_production_lifecycle_server

__all__ = ["create_production_lifecycle_server", "main"]


def main():
    create_production_lifecycle_server().run()


if __name__ == '__main__':
    main()
