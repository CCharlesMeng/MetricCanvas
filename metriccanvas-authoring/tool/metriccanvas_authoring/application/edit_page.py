"""No save or publish dependency: return a trusted artifact and a bounded summary."""
import hashlib
import re
from typing import Any

from metriccanvas_authoring.application.content_ports import ContentBaselineError, ContentBaselinePort
from metriccanvas_authoring.application.bundle_info import load_bundle_info
from metriccanvas_authoring.domain.idempotency import canonical_json
from metriccanvas_authoring.domain.page_editing import edit_page_document


def document_sha256(document: Any) -> str:
    return hashlib.sha256(canonical_json(document).encode("utf-8")).hexdigest()


def create_edit_page(baselines: ContentBaselinePort):
    async def edit_page(token: str, request: Any) -> dict[str, Any]:
        try:
            baseline = await baselines.read(token)
            ref = baseline.ref
            if (not isinstance(ref, dict) or set(ref) != {"pageId", "revisionId", "resourceId"}
                    or any(not isinstance(v, str) or not v.strip() for v in ref.values())
                    or not isinstance(baseline.document, dict) or baseline.document.get("id") != ref["pageId"]):
                raise ContentBaselineError("BASELINE_REF_MISMATCH")
            if (not isinstance(baseline.document_sha256, str)
                    or not re.fullmatch(r"[a-f0-9]{64}", baseline.document_sha256)
                    or document_sha256(baseline.document) != baseline.document_sha256):
                raise ContentBaselineError("BASELINE_HASH_MISMATCH")
            result = edit_page_document(baseline.document, request)
        except ContentBaselineError as error:
            return {"ok": False, "artifactEnvelope": None, "modelSummary": {
                "status": "invalid_baseline", "operations": [], "issues": [{"code": error.code, "path": ""}],
            }}
        summary = {"status": result["status"], "operations": result["operations"], "issues": result["issues"]}
        envelope = None
        if result["document"] is not None:
            envelope = {
                "kind": "metriccanvas.page-edit-artifact", "formatVersion": "1.0",
                "artifact": {"baseRef": dict(ref), "baseDocumentSha256": baseline.document_sha256,
                    "document": result["document"], "documentSha256": document_sha256(result["document"]),
                    "bundleVersion": load_bundle_info()["bundleVersion"]},
            }
        return {"ok": result["status"] in {"changed", "partial", "unchanged"}, "artifactEnvelope": envelope, "modelSummary": summary}
    return edit_page
