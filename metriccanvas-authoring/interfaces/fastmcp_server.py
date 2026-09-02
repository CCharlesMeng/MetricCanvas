from __future__ import annotations

from fastmcp import FastMCP

from core.bundle_info import load_bundle_info


mcp = FastMCP(
    "metriccanvas-authoring",
    instructions="Use the MetricCanvas Skill and governed stage tools to build pages.",
)


@mcp.tool
def bundle_info() -> dict[str, object]:
    """Return the immutable authoring Bundle and page-contract identity."""
    return load_bundle_info()
