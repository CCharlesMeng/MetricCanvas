"""Thin adapter to the existing content reader; no duplicated content rules."""
import sys
from pathlib import Path

OPERATIONS = {
    "content.read": {
        "inputSchema": {"type": "object", "required": ["topic"], "additionalProperties": False,
                        "properties": {"topic": {"type": "string"}, "key": {"type": "string"},
                                       "options": {"type": "object"}}},
        "outputSchema": {"type": "object"},
        "errorCodes": [],  # Exported from the actual reader and Node transport sources.
        "sideEffects": "none",
    }
}
SELF_TESTS = [{"operation": "content.read", "input": {"topic": "index", "key": "knowledge"}, "expectedStatus": "ok"}]


def invoke(operation, value):
    import os
    from jsonschema import Draft202012Validator
    errors = list(Draft202012Validator(OPERATIONS[operation]["inputSchema"]).iter_errors(value))
    if errors:
        return {"status": "error", "data": {}, "diagnostics": [
            {"code": "QUERY_ARGUMENTS_INVALID", "path": "/" + "/".join(map(str, error.absolute_path)),
             "message": error.message} for error in errors]}
    root = Path(os.environ["METRICCANVAS_PRODUCT_ROOT"]) / "mc-content"
    sys.path.insert(0, str(root / "scripts"))
    from mc_resources import ContentError, query_content
    try:
        data = query_content(value["topic"], value.get("key", ""), value.get("options"), root=root)
        return {"status": "partial" if data["truncated"] else "ok", "data": data, "diagnostics": []}
    except ContentError as error:
        return {"status": "error", "data": {}, "diagnostics": [error.issue]}
