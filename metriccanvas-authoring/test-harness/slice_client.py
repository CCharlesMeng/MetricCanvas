"""Drive `build_page` over a real stdio MCP session against `slice_server.py`.

Prints one JSON object to stdout: the tool's structured output. The TypeScript
slice runner (`pnpm slice:page-assets`) reads `savedRevision` from it and loads
the exact revision through the platform Java Adapter.

Usage: slice_client.py <page_id> [--base-revision-id <id>]
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path


HARNESS_ROOT = Path(__file__).resolve().parent
SLICE_SERVER = HARNESS_ROOT / "slice_server.py"


def fixture(name: str) -> dict[str, object]:
    return json.loads((HARNESS_ROOT / "fixtures" / name).read_text(encoding="utf-8"))


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("page_id")
    parser.add_argument("--base-revision-id")
    parser.add_argument("--base-revision-number", type=int, default=1)
    parser.add_argument("--title", default=None)
    args = parser.parse_args()

    from fastmcp import Client
    from fastmcp.client.transports import StdioTransport

    spec = fixture("page-build-spec.json")
    if args.title:
        spec["units"][0]["title"] = args.title
    if args.base_revision_id:
        spec["baseRevision"] = {
            "pageId": args.page_id,
            "revisionId": args.base_revision_id,
            "revisionNumber": args.base_revision_number,
        }

    transport = StdioTransport(
        command=sys.executable,
        args=[str(SLICE_SERVER)],
        env={key: value for key, value in os.environ.items()},
    )
    async with Client(transport) as client:
        result = await client.call_tool(
            "build_page",
            {
                "page_id": args.page_id,
                "page_id_confirmed": args.base_revision_id is None,
                "spec": spec,
            },
        )
    print(json.dumps(result.structured_content, ensure_ascii=False))
    return 0 if result.structured_content.get("ok") else 2


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
