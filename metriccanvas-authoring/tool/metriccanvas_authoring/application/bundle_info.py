from __future__ import annotations

import json
from pathlib import Path
from typing import Any


BUNDLE_ROOT = Path(__file__).resolve().parents[3]


def load_bundle_info() -> dict[str, Any]:
    """Return immutable Bundle and pinned contract identity."""
    bundle = json.loads((BUNDLE_ROOT / "bundle.json").read_text(encoding="utf-8"))
    contract_lock = json.loads(
        (BUNDLE_ROOT / bundle["contracts"]["productLock"]).read_text(encoding="utf-8")
    )
    return {
        "bundleVersion": bundle["bundleVersion"],
        "status": bundle["status"],
        "pageSchemaVersion": contract_lock["pageSchemaVersion"],
        "productContractVersion": contract_lock["productContractVersion"],
        "authoringContractVersion": contract_lock["authoringContractVersion"],
        "transport": bundle["tool"]["transport"],
    }
