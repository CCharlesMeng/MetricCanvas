from __future__ import annotations

import os
from pathlib import Path


BUNDLE_ROOT_ENV = "METRICCANVAS_BUNDLE_ROOT"


def bundle_root() -> Path:
    """Resolve authoring contracts in source, an override, or an installed wheel."""
    configured = (os.environ.get(BUNDLE_ROOT_ENV) or "").strip()
    if configured:
        root = Path(configured).expanduser().resolve()
        if not (root / "bundle.json").is_file():
            raise RuntimeError(
                f"{BUNDLE_ROOT_ENV} does not point to a MetricCanvas Authoring Bundle: "
                f"{root}"
            )
        return root

    source_root = Path(__file__).resolve().parents[2]
    if (source_root / "bundle.json").is_file():
        return source_root

    packaged_root = Path(__file__).resolve().parent / "_bundle"
    if (packaged_root / "bundle.json").is_file():
        return packaged_root

    raise RuntimeError(
        "MetricCanvas Authoring runtime contracts are unavailable; reinstall the "
        f"distribution or set {BUNDLE_ROOT_ENV}"
    )
