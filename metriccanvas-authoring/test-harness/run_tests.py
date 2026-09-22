"""Run the complete classified harness by default; no implicit test exclusions."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parent
LAYERS = ("rules", "adapters", "delivery", "evaluation")


def read_inventory(root: Path = ROOT) -> dict[str, list[str]]:
    inventory = json.loads((root / "test-layers.json").read_text())
    layers = inventory["layers"]
    if inventory.get("version") != 1 or set(layers) != set(LAYERS):
        raise ValueError("Unknown test layer inventory")
    entries = [entry for files in layers.values() for entry in files]
    actual = {p.relative_to(root).as_posix() for p in (root / "tests").rglob("test_*.py")}
    if len(entries) != len(set(entries)):
        raise ValueError("A test file is classified more than once")
    if set(entries) != actual:
        raise ValueError(f"Test inventory drift: unclassified={sorted(actual-set(entries))}, missing={sorted(set(entries)-actual)}")
    return layers


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--layer", choices=LAYERS, action="append", help="Run only specified layers; default runs all")
    parser.add_argument("--check", action="store_true", help="Check exact file coverage without importing tests")
    args = parser.parse_args()
    inventory = read_inventory()
    if args.check:
        print("Test inventory current: " + ", ".join(f"{name}={len(files)} files" for name, files in inventory.items()))
        return 0
    sys.path.insert(0, str(ROOT / "tests"))
    chosen = args.layer or list(LAYERS)
    modules = [Path(file).stem for name in dict.fromkeys(chosen) for file in inventory[name]]
    suite = unittest.defaultTestLoader.loadTestsFromNames(modules)
    print(f"Layers: {', '.join(chosen)}; {len(modules)} files; {suite.countTestCases()} tests", flush=True)
    return 0 if unittest.TextTestRunner(verbosity=1).run(suite).wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
