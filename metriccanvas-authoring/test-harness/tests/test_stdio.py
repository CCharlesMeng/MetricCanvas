from __future__ import annotations

import json
import unittest
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[2]


class FastMcpStdioTest(unittest.IsolatedAsyncioTestCase):
    async def test_bundle_info_is_a_resource_not_a_model_visible_tool(self) -> None:
        from fastmcp import Client

        async with Client(BUNDLE_ROOT / "tool" / "server.py") as client:
            tools = await client.list_tools()
            self.assertNotIn("bundle_info", {tool.name for tool in tools})

            resources = await client.list_resources()
            self.assertIn(
                "metriccanvas://bundle-info",
                {str(resource.uri) for resource in resources},
            )

            contents = await client.read_resource("metriccanvas://bundle-info")
            info = json.loads(contents[0].text)
            self.assertEqual(info["bundleVersion"], "0.1.0")
            self.assertEqual(info["transport"], "stdio")


if __name__ == "__main__":
    unittest.main()
