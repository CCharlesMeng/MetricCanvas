from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


BUNDLE_ROOT = Path(__file__).resolve().parents[1]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def verify_manifest(
    root: Path,
    manifest_path: Path,
    label: str,
    drift: list[str],
) -> int:
    manifest = read_json(manifest_path)
    for artifact in manifest["files"]:
        path = root / artifact["file"]
        artifact_label = f"{label}/{artifact['file']}"
        if not path.is_file():
            drift.append(f"{artifact_label}: missing")
        elif sha256(path) != artifact["sha256"]:
            drift.append(f"{artifact_label}: digest mismatch")
    return len(manifest["files"])


def main() -> None:
    bundle = read_json(BUNDLE_ROOT / "bundle.json")
    bundle_lock = read_json(BUNDLE_ROOT / "bundle.lock.json")
    contract_lock = read_json(BUNDLE_ROOT / bundle["contracts"]["productLock"])
    if bundle["bundleVersion"] != bundle_lock["bundleVersion"]:
        raise SystemExit("bundleVersion does not match bundle.lock.json")

    drift: list[str] = []
    for artifact in bundle_lock["artifacts"]:
        path = BUNDLE_ROOT / artifact["file"]
        if not path.is_file():
            drift.append(f"{artifact['file']}: missing")
        elif sha256(path) != artifact["sha256"]:
            drift.append(f"{artifact['file']}: digest mismatch")

    product_manifest_path = BUNDLE_ROOT / contract_lock["productManifest"]
    authoring_manifest_path = BUNDLE_ROOT / contract_lock["authoringManifest"]
    if sha256(product_manifest_path) != contract_lock["productManifestSha256"]:
        drift.append("contract-snapshot/manifest.json: lock digest mismatch")
    if sha256(authoring_manifest_path) != contract_lock["authoringManifestSha256"]:
        drift.append("contracts/manifest.json: lock digest mismatch")

    product_count = verify_manifest(
        BUNDLE_ROOT / "contract-snapshot",
        product_manifest_path,
        "contract-snapshot",
        drift,
    )
    authoring_count = verify_manifest(
        BUNDLE_ROOT / "contracts",
        authoring_manifest_path,
        "contracts",
        drift,
    )
    if drift:
        raise SystemExit("bundle drifted:\n" + "\n".join(drift))
    total = len(bundle_lock["artifacts"]) + product_count + authoring_count
    print(f"bundle {bundle['bundleVersion']} verified ({total} digest checks)")


if __name__ == "__main__":
    main()
