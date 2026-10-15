"""Inline finite local schema references for model-visible MCP input schemas.

Pydantic WithJsonSchema cannot register arbitrary product definition references.
This is a structural projection of the product schema, not semantic validation.
"""
from typing import Any


def inline_local_refs(value: Any, root: dict[str, Any], visiting: frozenset[str] = frozenset()) -> Any:
    if isinstance(value, list):
        return [inline_local_refs(item, root, visiting) for item in value]
    if not isinstance(value, dict):
        return value
    reference = value.get('$ref')
    if isinstance(reference, str) and reference.startswith(('#/$defs/', '#/definitions/')):
        if reference in visiting:
            raise ValueError('Recursive schema requires a registered MCP definition')
        target: Any = root
        for token in reference[2:].split('/'):
            target = target[token.replace('~1', '/').replace('~0', '~')]
        siblings = {key: item for key, item in value.items() if key != '$ref'}
        return inline_local_refs({**target, **siblings}, root, visiting | {reference})
    return {key: inline_local_refs(item, root, visiting) for key, item in value.items()
            if key not in {'$defs', 'definitions', '$schema'}}
