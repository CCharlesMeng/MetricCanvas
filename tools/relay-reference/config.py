"""One version/config entry point; no target-side dependency installation."""
from pathlib import Path
import os
import sys
import shutil

from consumer import load_consumer
from release import read_json, require, shape, version

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = Path(__file__).resolve().parent / "release-config.json"


def load_config(path=None):
    value = read_json(path or DEFAULT_CONFIG)
    shape(value, {"format", "releaseVersion", "interfaceVersion", "output", "pythonOperations", "coreTests", "consumers", "adoption"}, "release config")
    require(value["format"] == "metriccanvas-relay-release-config/2", "RELEASE_CONFIG_INVALID", "Unknown release config")
    version(value["releaseVersion"])
    version(value["interfaceVersion"])
    for name in ("pythonOperations", "coreTests", "consumers"):
        require(isinstance(value[name], list) and bool(value[name]), "RELEASE_CONFIG_INVALID", name)
    return value


def consumers(config, root=ROOT):
    return [load_consumer(root / item["path"], item["sha256"]) for item in config["consumers"]]


def python_executable(root=ROOT):
    configured = os.environ.get("METRICCANVAS_PYTHON")
    if configured:
        resolved = shutil.which(configured)
        require(resolved is not None, "PRODUCT_RUNTIME_UNAVAILABLE", "Configured build Python was not found")
        return resolved
    for relative in ("metriccanvas-authoring/tool/.venv/bin/python", "metriccanvas-authoring/tool/.venv/Scripts/python.exe"):
        path = root / relative
        if path.is_file():
            return str(path)
    return sys.executable
