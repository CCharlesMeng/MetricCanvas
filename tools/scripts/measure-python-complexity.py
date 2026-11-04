"""Measure every Python callable with pinned Radon; class aggregates are not functions."""
from __future__ import annotations

import json
from pathlib import Path
import sys

import radon
from radon.complexity import cc_visit


def callable_rows(blocks, prefix=""):
    for block in blocks:
        if not prefix and getattr(block, "classname", None):
            continue  # Methods are visited through their owning class, exactly once.
        name = prefix + block.name
        if hasattr(block, "methods"):
            yield from callable_rows(block.methods, name + ".")
        else:
            yield {"name": block.name, "qualifiedName": name, "line": block.lineno,
                   "endLine": block.endline, "selfCC": block.complexity}
            yield from callable_rows(block.closures, name + "/")


def measure(item):
    file = item if isinstance(item, str) else item["file"]
    try:
        source = Path(file).read_text(encoding="utf-8") if isinstance(item, str) else item["source"]
        return {"file": file, "functions": list(callable_rows(cc_visit(source)))}
    except (OSError, SyntaxError) as error:
        return {"file": file, "error": str(error), "functions": []}


def main():
    if radon.__version__ != "6.0.1":
        raise RuntimeError("Use radon==6.0.1 to preserve the counting contract")
    files = json.load(sys.stdin)
    print(json.dumps({"analyzer": "radon/6.0.1", "files": [measure(file) for file in files]}))


if __name__ == "__main__":
    main()
