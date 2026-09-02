from __future__ import annotations

import sys
import unittest
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[1]


class FastMcpStdioTest(unittest.IsolatedAsyncioTestCase):
    async def test_bundle_info_round_trips_through_real_stdio_process(self) -> None:
        from fastmcp import Client

        async with Client(BUNDLE_ROOT / "server.py") as client:
            tools = await client.list_tools()
            self.assertIn("bundle_info", {tool.name for tool in tools})

            result = await client.call_tool("bundle_info", {})
            self.assertEqual(result.data["bundleVersion"], "0.1.0")
            self.assertEqual(result.data["transport"], "stdio")


if __name__ == "__main__":
    unittest.main()
