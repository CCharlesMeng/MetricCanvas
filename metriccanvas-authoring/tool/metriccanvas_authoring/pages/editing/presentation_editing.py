"""Closed presentation edits; target resolution and all semantics belong to product TS."""
from metriccanvas_authoring.pages.validation.node_validator import edit_presentation_with_node
from metriccanvas_authoring.pages.components.component_editing import EditFailure


def edit_presentation(page, op):
    operation = {key: value for key, value in op.items() if key not in ('id', 'dependsOn')}
    receipt = edit_presentation_with_node(page, operation)
    if receipt is None:
        raise EditFailure('PRODUCT_BRIDGE_UNAVAILABLE', '/operation')
    if not receipt.get('ok') or not isinstance(receipt.get('document'), dict):
        error = next(iter(receipt.get('errors', [])), {})
        raise EditFailure(error.get('type', 'PRESENTATION_EDIT_INVALID'), error.get('path', '/operation'))
    page.clear()
    page.update(receipt['document'])
    return []


PRESENTATION_HANDLERS = {name: edit_presentation for name in ('set_presentation_condition', 'add_button', 'set_text_parts')}
