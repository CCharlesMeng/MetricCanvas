"""Source-checkout entry point; installed distributions use the package CLI."""

from metriccanvas_authoring.server import mcp


if __name__ == "__main__":
    mcp.run()
