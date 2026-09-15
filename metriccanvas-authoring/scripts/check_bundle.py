from __future__ import annotations

import hashlib
import json
import re
import unicodedata
import tomllib
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit


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


def markdown_anchors(text: str) -> set[str]:
    anchors = set(re.findall(r'<a\s+id="([^"]+)"', text))
    counts: dict[str, int] = {}
    for heading in re.findall(r"^#{1,6} +(.+)$", text, re.MULTILINE):
        slug = "".join(c for c in heading.lower() if c in "-_ " or unicodedata.category(c)[0] in "LN").replace(" ", "-")
        count = counts.get(slug, 0)
        counts[slug] = count + 1
        anchors.add(f"{slug}-{count}" if count else slug)
    return anchors


def validate_skills(root: Path, bundle: dict[str, Any], locked: set[str]) -> list[str]:
    """Validate distribution only; this registry grants no tool or Relay routing authority."""
    errors: list[str] = []
    legacy_spec = bundle.get("skill")
    legacy = legacy_spec.get("entrypoint") if isinstance(legacy_spec, dict) else None
    if legacy != "skill/metriccanvas-page-builder/SKILL.md":
        errors.append("skill.entrypoint: legacy entrypoint changed")
    entries = bundle.get("skills", [{"id": "metriccanvas-page-builder", "entrypoint": legacy}])
    if not isinstance(entries, list) or not entries:
        return errors + ["skills: expected nonempty registry"]
    ids: set[str] = set()
    paths: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            errors.append("skills: invalid entry")
            continue
        name, relative = entry.get("id"), entry.get("entrypoint")
        if (not isinstance(name, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name)
                or relative != f"skill/{name}/SKILL.md" or name in ids or relative in paths):
            errors.append(f"skills: invalid or duplicate entry {name}")
            continue
        projection = entry.get("referenceProjection", "page-metadata" if name == "metriccanvas-page-builder" else "none")
        if projection not in {"none", "page-metadata"}:
            errors.append(f"{name}: unknown reference projection")
        if name == "metriccanvas-platform-authoring" and projection != "none":
            errors.append(f"{name}: expected authored references")
        ids.add(name)
        paths.add(relative)
        folder = root / "skill" / name
        if not folder.resolve().is_relative_to(root.resolve()):
            errors.append(f"{relative}: Skill directory escapes bundle")
            continue
        if not (folder / "SKILL.md").is_file():
            errors.append(f"{relative}: missing entrypoint")
            continue
        for file in folder.rglob("*"):
            if not file.resolve().is_relative_to(folder.resolve()):
                errors.append(f"{file.relative_to(root)}: escapes standalone Skill")
                continue
            if not file.is_file():
                continue
            if file.relative_to(root).as_posix() not in locked:
                errors.append(f"{file.relative_to(root)}: absent from bundle lock")
            if file.suffix != ".md":
                continue
            text = re.sub(r"```.*?```", "", file.read_text(encoding="utf-8"), flags=re.DOTALL)
            for href in re.findall(r"\[[^\]]*\]\(([^)]+)\)", text):
                parsed = urlsplit(href)
                if parsed.scheme in {"http", "https", "mailto"}:
                    continue
                target = (file.parent / unquote(parsed.path)).resolve() if parsed.path else file.resolve()
                if parsed.scheme or parsed.netloc or not target.is_relative_to(folder.resolve()) or not target.is_file():
                    errors.append(f"{file.relative_to(root)}: invalid standalone link {href}")
                elif parsed.fragment and unquote(parsed.fragment) not in markdown_anchors(target.read_text(encoding="utf-8")):
                    errors.append(f"{file.relative_to(root)}: missing anchor {href}")
    platform_ids = {name for name in ids if name.startswith("metriccanvas-platform-")}
    if platform_ids and platform_ids != {"metriccanvas-platform-authoring"}:
        errors.append("skills: expected one unified Platform entrypoint")
    if "metriccanvas-platform-authoring" in ids:
        registration = next(entry for entry in entries if entry.get("id") == "metriccanvas-platform-authoring")
        expected_service = {"command": "metriccanvas-platform-content", "module": "metriccanvas_authoring.unified_content_server", "contextContract": "authoring-turn/1.0"}
        if registration.get("mcpServer") != "metriccanvas-platform-content" or bundle.get("toolServices", {}).get("metriccanvas-platform-content") != expected_service:
            errors.append("Platform Skill: unified deployment must use the gated content service")
        project = root / "tool/pyproject.toml"
        if not project.is_file() or tomllib.loads(project.read_text()).get("project", {}).get("scripts", {}).get("metriccanvas-platform-content") != "metriccanvas_authoring.unified_content_server:main":
            errors.append("Platform Skill: gated CLI is missing or replaced")
        folder = root / "skill/metriccanvas-platform-authoring"
        for relative, budget in (("SKILL.md", 200), ("workflows/create.md", 250), ("workflows/edit.md", 250)):
            file = folder / relative
            if not file.is_file():
                errors.append(f"{relative}: missing workflow")
            elif len(file.read_text(encoding="utf-8").splitlines()) > budget:
                errors.append(f"{relative}: line budget exceeded")
        files = [p for p in folder.rglob("*") if p.is_file() and p.resolve().is_relative_to(folder.resolve())]
        try:
            lines = sum(len(p.read_text(encoding="utf-8").splitlines()) for p in files)
            if lines > 10000:
                errors.append("Platform Skill: distribution line budget exceeded")
        except UnicodeDecodeError:
            errors.append("Platform Skill: expected text distribution")
    if legacy not in paths or "metriccanvas-page-builder" not in ids:
        errors.append("skills: missing legacy entrypoint alias")
    return errors


def main() -> None:
    bundle = read_json(BUNDLE_ROOT / "bundle.json")
    bundle_lock = read_json(BUNDLE_ROOT / "bundle.lock.json")
    contract_lock = read_json(BUNDLE_ROOT / bundle["contracts"]["productLock"])
    if bundle["bundleVersion"] != bundle_lock["bundleVersion"]:
        raise SystemExit("bundleVersion does not match bundle.lock.json")

    drift = validate_skills(BUNDLE_ROOT, bundle, {entry["file"] for entry in bundle_lock["artifacts"]})
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
