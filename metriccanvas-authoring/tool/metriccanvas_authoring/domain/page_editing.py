"""Atomic controlled operations over a complete canonical page baseline."""
import json
from copy import deepcopy
from typing import Any

from jsonschema import Draft202012Validator

from metriccanvas_authoring.domain.component_editing import EditFailure, OPERATION_HANDLERS
from metriccanvas_authoring.domain.page_validation import normalize_page_document, validate_page_document
from metriccanvas_authoring.runtime_assets import bundle_root

EDIT_SCHEMA = json.loads((bundle_root() / "contracts/authored/page-edit-request.schema.json").read_text())
OPERATION_SCHEMA = EDIT_SCHEMA["properties"]["operations"]["items"]


def edit_page_document(baseline: Any, request: Any) -> dict[str, Any]:
    normalized = normalize_page_document(baseline)
    if not normalized["ok"]:
        return {"status": "invalid_baseline", "document": None, "operations": [], "issues": [
            {"code": "BASELINE_INVALID", "path": e["path"]} for e in normalized["errors"]
        ]}
    if (not isinstance(request, dict) or set(request) != {"operations"}
            or not isinstance(request["operations"], list) or not 1 <= len(request["operations"]) <= 50):
        return {"status": "invalid_request", "document": None, "operations": [], "issues": [{"code": "EDIT_REQUEST_INVALID", "path": ""}]}
    operations = request["operations"]
    # Ambiguous operation identities fail the batch before any changes are made.
    ids = [op.get("id") if isinstance(op, dict) else None for op in operations]
    if any(not isinstance(i, str) or not i or len(i) > 128 for i in ids) or len(set(ids)) != len(ids):
        return {"status": "invalid_request", "document": None, "operations": [], "issues": [{"code": "OPERATION_IDS_INVALID", "path": "/operations"}]}
    original = normalized["document"]
    current = deepcopy(original)
    results = []
    states = {}
    for index, op in enumerate(operations):
        result = {"id": op["id"], "status": "failed", "issues": [], "adjustments": []}
        if not Draft202012Validator(OPERATION_SCHEMA).is_valid(op):
            result["issues"] = [{"code": "OPERATION_INVALID", "path": f"/operations/{index}"}]
        elif any(states.get(dependency) not in {"applied", "unchanged"} for dependency in op.get("dependsOn", [])):
            result["status"] = "skipped"
            result["issues"] = [{"code": "DEPENDENCY_NOT_SUCCEEDED", "path": f"/operations/{index}/dependsOn"}]
        else:
            candidate = deepcopy(current)
            try:
                adjustments = OPERATION_HANDLERS[op["type"]](candidate, op)
                errors = validate_page_document(candidate)
                if errors:
                    result["issues"] = [{"code": e.type, "path": e.path} for e in errors]
                else:
                    result["status"] = "unchanged" if candidate == current else "applied"
                    result["adjustments"] = adjustments if result["status"] == "applied" else []
                    current = candidate
            except EditFailure as error:
                result["issues"] = [{"code": error.code, "path": error.path}]
        states[op["id"]] = result["status"]
        results.append(result)
    changed = current != original
    any_failure = any(r["status"] in {"failed", "skipped"} for r in results)
    if not changed:
        status = "failed" if all(r["status"] in {"failed", "skipped"} for r in results) else "unchanged"
    else:
        status = "partial" if any_failure else "changed"
    # A final guard protects future operation handlers too; never expose an invalid subset.
    if validate_page_document(current):
        return {"status": "failed", "document": None, "operations": [], "issues": [{"code": "EDIT_RESULT_INVALID", "path": ""}]}
    return {"status": status, "document": current if changed else None, "operations": results, "issues": []}
