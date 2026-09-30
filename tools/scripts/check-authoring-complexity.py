"""Reproducible local CC gate for the CodeCheck feedback's active public modules.

Run: uv run --with radon==6.0.1 --no-project python tools/scripts/check-authoring-complexity.py
This is a Radon measurement, not a claim about an unavailable CodeCheck ruleset.
Every function, method and nested helper in FILES is checked; class aggregates
are excluded because they are not callable functions. No per-function waivers.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess

import radon
from radon.complexity import cc_visit

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = Path("metriccanvas-authoring/tool/metriccanvas_authoring")
MAXIMUM = 15
FILES = (
    "data/discovery/service.py",
    "data/page_build_spec.py",
    "pages/validation/page_validation.py",
    "pages/validation/grouped_params.py",
    "assets/lifecycle_publish.py",
    "work/authoring_turns.py",
    "data/semantic_catalog.py",
    "data/results.py",
    "pages/components/section_presentation.py",
    "pages/composition/page_building.py",
    "pages/editing/page_editing.py",
    "ask/rules.py",
    "pages/input_tolerance.py",
    "pages/editing/operation_batch.py",
    "data/field_presentation.py",
)


def functions(blocks, file, prefix=""):
    for block in blocks:
        # Radon exposes methods both on Class.methods and in its flat list.
        if not prefix and getattr(block, "classname", None):
            continue
        name = prefix + block.name
        if hasattr(block, "methods"):
            yield from functions(block.methods, file, name + ".")
        else:
            yield {"file": file, "function": name, "line": block.lineno,
                   "complexity": block.complexity}
            yield from functions(block.closures, file, name + ".")


def measure(commit=None):
    rows = []
    for file in FILES:
        relative = PACKAGE / file
        source = (subprocess.check_output(
            ["git", "show", f"{commit}:{relative.as_posix()}"], cwd=ROOT, text=True
        ) if commit else (ROOT / relative).read_text())
        rows.extend(functions(cc_visit(source), file))
    return rows


def summary(rows):
    return {"files": len(FILES), "functions": len(rows),
            "maximum": max(row["complexity"] for row in rows),
            "overLimit": sum(row["complexity"] > MAXIMUM for row in rows)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", help="Optional Git ref for a before/after report")
    parser.add_argument("--json", action="store_true", help="Print all function measurements")
    args = parser.parse_args()
    if radon.__version__ != "6.0.1":
        parser.error("Use radon==6.0.1 so the counting rules remain reproducible")
    rows = measure()
    report = {"analyzer": "radon/6.0.1", "limit": MAXIMUM, "current": summary(rows),
              "violations": [row for row in rows if row["complexity"] > MAXIMUM]}
    if args.baseline:
        commit = subprocess.check_output(
            ["git", "rev-parse", "--verify", args.baseline + "^{commit}"], cwd=ROOT, text=True
        ).strip()
        baseline = measure(commit)
        report["baseline"] = {"commit": commit, **summary(baseline)}
        if args.json:
            report["baselineFunctions"] = baseline
    if args.json:
        report["functions"] = rows
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return int(bool(report["violations"]))


if __name__ == "__main__":
    raise SystemExit(main())
