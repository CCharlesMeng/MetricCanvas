from __future__ import annotations

import hashlib
import json
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[1]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    bundle = json.loads((BUNDLE_ROOT / "bundle.json").read_text(encoding="utf-8"))
    lock = json.loads((BUNDLE_ROOT / "bundle.lock.json").read_text(encoding="utf-8"))
    if bundle["bundleVersion"] != lock["bundleVersion"]:
        raise SystemExit("bundleVersion does not match bundle.lock.json")

    drift: list[str] = []
    for artifact in lock["artifacts"]:
        path = BUNDLE_ROOT / artifact["file"]
        if not path.is_file():
            drift.append(f"{artifact['file']}: missing")
        elif sha256(path) != artifact["sha256"]:
            drift.append(f"{artifact['file']}: digest mismatch")

    contract_root = BUNDLE_ROOT / "contracts" / "generated"
    contract_manifest = json.loads(
        (contract_root / "manifest.json").read_text(encoding="utf-8")
    )
    for artifact in contract_manifest["files"]:
        path = contract_root / artifact["file"]
        label = f"contracts/generated/{artifact['file']}"
        if not path.is_file():
            drift.append(f"{label}: missing")
        elif sha256(path) != artifact["sha256"]:
            drift.append(f"{label}: digest mismatch")
    if drift:
        raise SystemExit("bundle drifted:\n" + "\n".join(drift))
    total = len(lock["artifacts"]) + len(contract_manifest["files"])
    print(f"bundle {bundle['bundleVersion']} verified ({total} artifacts)")


if __name__ == "__main__":
    main()
