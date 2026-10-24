"""Bounded JSON Schema facts, keeping ancestors and explicit continuation pointers."""
from copy import deepcopy
from mc_resources import ContentError

CHILDREN = {'properties', 'items', 'anyOf', 'oneOf', 'allOf', 'definitions', '$defs', 'patternProperties', 'additionalProperties'}


def token(value):
    return str(value).replace('~', '~0').replace('/', '~1')


def child_pointer(pointer, key):
    return pointer + '/' + token(key)


def compact(value, pointer):
    if isinstance(value, list):
        return [child_pointer(pointer, index) for index in range(len(value))]
    if not isinstance(value, dict):
        return value
    if pointer.rsplit('/', 1)[-1] in {'properties', 'definitions', '$defs', 'patternProperties'}:
        return {key: child_pointer(pointer, key) for key in value}
    facts = deepcopy(value)
    for key in CHILDREN & value.keys():
        child = value[key]
        location = child_pointer(pointer, key)
        if key in {'properties', 'definitions', '$defs', 'patternProperties'}:
            facts[key] = {name: child_pointer(location, name) for name in child}
        elif isinstance(child, list):
            facts[key] = compact(child, location)
        elif isinstance(child, dict):
            facts[key] = location
    return facts


def schema_selection(schema, pointer):
    if not isinstance(pointer, str) or (pointer != '#' and not pointer.startswith('#/')):
        raise ContentError('SCHEMA_POINTER_INVALID')
    value, location = schema, '#'
    ancestors = []
    try:
        for raw in pointer[2:].split('/') if pointer != '#' else []:
            ancestors.append({'pointer': location, 'facts': compact(value, location)})
            key = raw.replace('~1', '/').replace('~0', '~')
            value = value[int(key)] if isinstance(value, list) else value[key]
            location = child_pointer(location, key)
    except (KeyError, IndexError, TypeError, ValueError) as error:
        raise ContentError('SCHEMA_POINTER_UNKNOWN', pointer) from error
    facts = compact(value, pointer)
    return {'scope': 'partial; not a standalone validator', 'pointer': pointer, 'ancestors': ancestors,
        'facts': facts, 'unresolvedRefs': references(value),
        'continuation': 'Read child pointers and $ref targets with the same topic/key and options.pointer; complete Schema remains installed.'}


def references(value):
    if isinstance(value, dict):
        return ([value['$ref']] if '$ref' in value else []) + [ref for item in value.values() for ref in references(item)]
    if isinstance(value, list):
        return [ref for item in value for ref in references(item)]
    return []
