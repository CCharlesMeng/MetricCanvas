"""Development release checks; does not implement the mc-tool product facade."""
from __future__ import annotations

import argparse
from pathlib import Path
import sys

sys.dont_write_bytecode = True

from compatibility import compare
from release import RECEIPT_FORMAT, canonical, read_json, seal, verify


def execute(args):
    if args.command == "compare":
        return compare(Path(args.root), Path(args.candidate))
    manifest = (seal(Path(args.root), read_json(Path(args.metadata))) if args.command == "seal"
                else verify(Path(args.root))["manifest"])
    return {"status": "ok", "code": "RELEASE_SEALED" if args.command == "seal" else "RELEASE_VERIFIED",
            "details": [], "eligibleForSmoke": False, "releaseId": manifest["releaseId"]}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("seal", "verify", "compare"):
        command = commands.add_parser(name)
        command.add_argument("root")
        if name == "seal":
            command.add_argument("--metadata", required=True)
        if name == "compare":
            command.add_argument("candidate")
    args = parser.parse_args(argv)
    try:
        result = execute(args)
    except (ValueError, OSError, TypeError, KeyError) as error:
        result = {"status": "error", "code": getattr(error, "code", "RELEASE_INPUT_INVALID"),
                  "details": [str(error)], "eligibleForSmoke": False}
    result = {"format": RECEIPT_FORMAT, **result, "automaticPromotion": False}
    sys.stdout.buffer.write(canonical(result) + b"\n")
    return {"ok": 0, "needs_migration": 2, "error": 3}[result["status"]]


if __name__ == "__main__":
    raise SystemExit(main())
