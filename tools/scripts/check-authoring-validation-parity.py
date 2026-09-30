"""Compare page validation with the pre-complexity-refactor baseline.

Run with metriccanvas-authoring/tool/.venv/bin/python. Uses the same contract
snapshot on both sides and isolates baseline validation and grouped parameters.
This one-time evidence check covers exact issue order and input immutability;
it does not establish equivalence for arbitrary inputs.
"""
from copy import deepcopy
from dataclasses import asdict
import json
from pathlib import Path
import subprocess
import sys
from types import ModuleType

ROOT = Path(__file__).resolve().parents[2]
BASELINE = "b0b20dc94013e53734789298fe2b1306fd4ff5fa"
sys.path.insert(0, str(ROOT / "metriccanvas-authoring/tool"))
from metriccanvas_authoring.pages.validation import page_validation as current


def baseline_validator():
    prefix = "metriccanvas_authoring.pages.validation._complexity_baseline"
    package = ModuleType(prefix)
    package.__path__ = []
    sys.modules[prefix] = package
    for name in ("grouped_params", "page_validation"):
        path = f"metriccanvas-authoring/tool/metriccanvas_authoring/pages/validation/{name}.py"
        source = subprocess.check_output(
            ["git", "show", f"{BASELINE}:{path}"], cwd=ROOT, text=True
        )
        module = ModuleType(prefix + "." + name)
        module.__package__ = prefix
        module.__file__ = path
        sys.modules[module.__name__] = module
        exec(compile(source, path, "exec"), module.__dict__)
    return sys.modules[prefix + ".page_validation"]


def page_inputs(value, label):
    if not isinstance(value, dict):
        return
    if "sections" in value and "dataSources" in value:
        yield label, value
    if "input" in value:
        yield from page_inputs(value["input"], label + ":input")
    for index, case in enumerate(value.get("cases", [])):
        yield from page_inputs(case, f"{label}:{index}")


def main():
    before = baseline_validator()
    count = 0
    folders = ("packages/page/fixtures", "metriccanvas-authoring/contract-snapshot/page/conformance")
    for folder in folders:
        for path in sorted((ROOT / folder).rglob("*.json")):
            for label, value in page_inputs(json.loads(path.read_text()), str(path.relative_to(ROOT))):
                original = deepcopy(value)
                expected = [asdict(issue) for issue in before.validate_page_document(value)]
                actual = [asdict(issue) for issue in current.validate_page_document(value)]
                if expected != actual or original != value:
                    raise SystemExit(f"Validation parity/input immutability failed: {label}")
                count += 1
    if not count:
        raise SystemExit("No page vectors found")
    print(f"{count} valid/invalid page inputs: full ordered issues identical; inputs unchanged")


if __name__ == "__main__":
    main()
