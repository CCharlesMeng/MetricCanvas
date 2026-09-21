"""Source-checkout entry point; installed distributions use the package CLI."""

from metriccanvas_authoring.entrypoints.compat.server import main


if __name__ == "__main__":
    main()
