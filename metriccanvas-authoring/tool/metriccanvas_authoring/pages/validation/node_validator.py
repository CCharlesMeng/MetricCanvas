"""Transport to the bundled product validator; no page semantics are defined here."""
from __future__ import annotations
import json
import hashlib
import shutil
import subprocess
from typing import Any
from metriccanvas_authoring.runtime_assets import bundle_root


def validate_with_node(document: Any):
    from .page_validation import PageContractIssue
    bridge = bundle_root() / "scripts" / "page-validation-bridge.mjs"
    node = shutil.which("node")
    unavailable = [PageContractIssue("SCHEMA_ERROR", "/", "产品页面校验不可用：需要 Node.js 22+ 和 Bundle 内的 Node Bridge")]
    if not node or not bridge.is_file():
        return unavailable
    try:
        lock=json.loads((bundle_root()/'bundle.lock.json').read_text())
        expected=next((item['sha256'] for item in lock['artifacts'] if item['file']=='scripts/page-validation-bridge.mjs'),None)
        if expected!=hashlib.sha256(bridge.read_bytes()).hexdigest():return unavailable
        version = subprocess.run([node, "--version"], capture_output=True, text=True, timeout=5, check=True)
        if int(version.stdout.strip().lstrip("v").split(".")[0]) < 22:
            return unavailable
        result = subprocess.run([node, str(bridge)], input=json.dumps({"document": document}, ensure_ascii=False),
                                capture_output=True, text=True, timeout=20, check=True)
        receipt = json.loads(result.stdout)
        if not isinstance(receipt.get("ok"), bool) or not isinstance(receipt.get("errors"), list):
            return unavailable
        from metriccanvas_authoring.bundle_info import load_bundle_info
        if receipt.get('schemaVersion') != load_bundle_info()['pageSchemaVersion']:
            return unavailable
        issues = [PageContractIssue(item["type"], item["path"], item["message"]) for item in receipt["errors"]]
        if receipt["ok"] != (not issues):
            return unavailable
        return issues
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
        return unavailable
