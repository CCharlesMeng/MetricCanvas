from __future__ import annotations

import json

from fastmcp import FastMCP

from metriccanvas_authoring.application.bundle_info import load_bundle_info


mcp = FastMCP(
    "metriccanvas-authoring",
    instructions="Use the MetricCanvas Skill and governed stage tools to build pages.",
)


@mcp.resource("metriccanvas://bundle-info")
def bundle_info() -> str:
    """Return operational Bundle and contract identity outside the model tool surface."""
    return json.dumps(load_bundle_info(), ensure_ascii=False)
