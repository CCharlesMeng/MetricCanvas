"""Save-free composition with layout and program/model projections.

Both compatibility transports call this use case directly.
"""
from dataclasses import replace
from .compose_page import ComposePageCommand, create_compose_page
from metriccanvas_authoring.pages.editing.edit_page import document_sha256
from metriccanvas_authoring.pages.composition.layout_policy import apply_creation_layout
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document


async def compose_content(dependencies, page_id, spec, layout='report'):
    compose = create_compose_page(dependencies)
    result = await compose(ComposePageCommand(page_id, spec))
    if result.artifact is not None:
        document = apply_creation_layout(result.artifact.document, layout)
        errors = validate_page_document(document)
        if errors:
            summary = {"status": "failed", "issues": [{"code": e.type, "path": e.path} for e in errors]}
            return {"ok": False, "artifactEnvelope": None, "modelSummary": summary}
        result = replace(result, artifact=replace(result.artifact, document=document, document_sha256=document_sha256(document)))
    summary = {"status": "created" if result.ok else "failed",
        "completedStages": list(result.completed_stages),
        "issues": [{"code": i.code, "path": i.path, "stage": i.stage} for i in result.issues]}
    envelope = None
    if result.artifact is not None:
        document = result.artifact.document
        summary = {"status": "page_composed", "pageId": page_id,
            "unitCount": len(spec["units"]),
            "topLevelComponentCount": sum(len(s["components"]) for s in document["sections"]),
            "dataContextVersion": result.artifact.data_context_version,
            "bundleVersion": result.artifact.bundle_version,
            "documentSha256": result.artifact.document_sha256}
        envelope = {"kind": "metriccanvas.page-build-artifact", "formatVersion": "1.0",
            "artifact": result.artifact.to_payload(), "modelSummary": summary}
    output = {"ok": result.ok, "artifactEnvelope": envelope, "modelSummary": summary}
    return output
