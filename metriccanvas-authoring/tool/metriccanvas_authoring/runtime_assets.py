from __future__ import annotations

import os
from pathlib import Path


BUNDLE_ROOT_ENV = "METRICCANVAS_BUNDLE_ROOT"
PRODUCT_ROOT_ENV = "METRICCANVAS_PRODUCT_ROOT"


def bundle_root() -> Path:
    """Resolve authoring contracts in source, an override, or an installed wheel."""
    product = (os.environ.get(PRODUCT_ROOT_ENV) or "").strip()
    if product:
        return product_resources(Path(product))
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


def product_resources(root: Path) -> Path:
    """An explicit four-artifact root never falls back to a development checkout."""
    root = root.expanduser().resolve()
    resources = root / "mc-tools" / "resources"
    required = [root / "mc-content" / "index.json", root / "mc-tools" / "interface.json",
                resources / "bundle.json"]
    if not all(path.is_file() for path in required):
        raise RuntimeError(f"{PRODUCT_ROOT_ENV} has incomplete product resources: {root}")
    return resources
