from __future__ import annotations

import json
from pathlib import Path
from typing import Any


BUNDLE_ROOT = Path(__file__).resolve().parents[1]


def load_bundle_info() -> dict[str, Any]:
    """Return immutable bundle and generated contract identity."""
    bundle = json.loads((BUNDLE_ROOT / "bundle.json").read_text(encoding="utf-8"))
    contracts = json.loads(
        (BUNDLE_ROOT / bundle["contracts"]).read_text(encoding="utf-8")
    )
    return {
        "bundleVersion": bundle["bundleVersion"],
        "status": bundle["status"],
        "pageSchemaVersion": contracts["pageSchemaVersion"],
        "transport": bundle["transport"],
    }
