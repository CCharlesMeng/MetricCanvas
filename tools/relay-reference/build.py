"""Build on the MC side using the shared authoring output graph."""
from pathlib import Path
import argparse
import os
import subprocess
import sys

sys.dont_write_bytecode = True

from config import ROOT, load_config, python_executable
from release import require


def build(candidate, config, root=ROOT):
    require(not candidate.exists(), "PRODUCT_OUTPUT_EXISTS", str(candidate))
    command = ["node", "--import", "tsx", str(root / "tools/scripts/export-authoring-contracts.ts"),
               "--relay-reference-output", str(candidate), "--relay-release-version", config["releaseVersion"],
               "--relay-interface-version", config["interfaceVersion"]]
    for module in config["pythonOperations"]:
        command.extend(["--relay-python-operations", module])
    subprocess.run(command, cwd=root, env={**os.environ, "METRICCANVAS_PYTHON": python_executable(root),
                   "PYTHONDONTWRITEBYTECODE": "1"}, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    config = load_config(args.config)
    build((args.output or ROOT / config["output"]).resolve(), config)


if __name__ == "__main__":
    main()
