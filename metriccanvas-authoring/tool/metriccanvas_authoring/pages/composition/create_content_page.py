"""Create a page from controlled content recipes; source data stays program-owned."""
from copy import deepcopy

from metriccanvas_authoring.application.summary_capability import summary_configured
from metriccanvas_authoring.application.content_ports import ContentBaselineError
from metriccanvas_authoring.pages.editing.edit_page import read_verified_baseline, document_sha256
from metriccanvas_authoring.application.bundle_info import load_bundle_info
from metriccanvas_authoring.pages.editing.page_editing import edit_page_document
from metriccanvas_authoring.domain.page_validation import validate_page_document
from metriccanvas_authoring.domain.layout_policy import apply_creation_layout


def create_content_page(baselines, summary_config=None):
    async def create(page_id, title, layout, request, source_token=None):
        def failure(code):
            return {"ok": False, "artifactEnvelope": None, "modelSummary": {"status": "failed", "issues": [{"code": code, "path": ""}], "operations": []}}
        if (not isinstance(request, dict) or set(request) != {"operations"}
                or not isinstance(request["operations"], list)
                or any(not isinstance(op, dict) or op.get("type") not in {"add_text", "add_field_text", "add_map_chart", "add_tab_container", "add_composite_card", "add_ai_summary"} for op in request["operations"])):
            return failure("CONTENT_CREATION_REQUEST_INVALID")
        document = {"schemaVersion": load_bundle_info()["pageSchemaVersion"], "id": page_id, "layout": layout,
            "dataSources": {}, "sections": [{"id": "main", "container": "panel", "components": [{
                "id": "page-header", "type": "reportHeader", "layout": {"span": 12}, "props": {"title": title}}]}]}
        source_ref = None
        if source_token is not None:
            try:
                source = await read_verified_baseline(baselines, source_token)
                if validate_page_document(source.document):
                    return failure("BASELINE_INVALID")
                source_ref = dict(source.ref)
                for key in ("dataSources", "filters", "params"):
                    if key in source.document: document[key] = deepcopy(source.document[key])
            except ContentBaselineError as error:
                return failure(error.code)
        result = edit_page_document(document, request, summary_enabled=summary_configured(summary_config))
        if result["document"] is not None:
            result["document"] = apply_creation_layout(result["document"], layout)
            if validate_page_document(result["document"]):
                return failure("CONTENT_CREATION_LAYOUT_INVALID")
        summary = {"status": result["status"], "operations": result["operations"], "issues": result["issues"]}
        envelope = None
        if result["document"] is not None:
            envelope = {"kind": "metriccanvas.content-page-artifact", "formatVersion": "1.0", "artifact": {
                "document": result["document"], "documentSha256": document_sha256(result["document"]),
                "sourceRef": source_ref, "bundleVersion": load_bundle_info()["bundleVersion"]}}
        return {"ok": envelope is not None, "artifactEnvelope": envelope, "modelSummary": summary}
    return create
