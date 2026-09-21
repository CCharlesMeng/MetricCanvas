"""Atomic controlled operations over a complete canonical page baseline."""
import json
from typing import Any

from metriccanvas_authoring.pages.components.component_editing import EditFailure, OPERATION_HANDLERS as COMPONENT_HANDLERS
from metriccanvas_authoring.pages.editing.interaction_editing import INTERACTION_HANDLERS
from metriccanvas_authoring.pages.components.container_building import CONTAINER_HANDLERS, add_ai_summary
from metriccanvas_authoring.pages.components.text_map_building import TEXT_MAP_HANDLERS
from metriccanvas_authoring.runtime_assets import bundle_root

EDIT_SCHEMA = json.loads((bundle_root() / "contracts/authored/page-edit-request.schema.json").read_text())
OPERATION_SCHEMA = EDIT_SCHEMA["properties"]["operations"]["items"]
OPERATION_HANDLERS = {**COMPONENT_HANDLERS, **TEXT_MAP_HANDLERS, **CONTAINER_HANDLERS, **INTERACTION_HANDLERS}


def apply_page_operation(document, op, *, summary_enabled=False):
    """Apply one isolated operation; the shared batch owns validation and rollback."""
    try:
        adjustments = (add_ai_summary(document, op, summary_enabled=summary_enabled)
            if op['type'] == 'add_ai_summary' else OPERATION_HANDLERS[op['type']](document, op))
        return document, [], adjustments
    except EditFailure as error:
        return None, [{'code': error.code, 'path': error.path}], []


def edit_page_document(baseline: Any, request: Any, *, summary_enabled: bool = False) -> dict[str, Any]:
    from metriccanvas_authoring.pages.editing.operation_batch import operation_batch
    batch = operation_batch(baseline, request, OPERATION_SCHEMA)
    result = None
    while True:
        try:
            document, op = batch.send(result)
        except StopIteration as completed:
            return completed.value
        result = apply_page_operation(document, op, summary_enabled=summary_enabled)
