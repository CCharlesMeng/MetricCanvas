from __future__ import annotations

import json
from typing import Any

from metriccanvas_authoring.runtime_assets import bundle_root


BUNDLE_ROOT = bundle_root()


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
