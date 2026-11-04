"""Additional controlled input, separate from the frozen single-source contract."""
from copy import deepcopy
from metriccanvas_authoring.pages.compose_contract import COMPOSE_SCHEMA, DATA_BLOCK, ID, NAME, obj
from metriccanvas_authoring.pages.referenced import EDIT_RESULT_SCHEMA

_SLOT = obj({'source': ID, 'fields': deepcopy(DATA_BLOCK['properties']['fields'])}, ['source', 'fields'])
_PERIOD = obj({'start': NAME, 'end': NAME, 'granularity': {'enum': ['year', 'month', 'day']}}, ['start', 'end', 'granularity'])
MULTISLOT_BLOCK = deepcopy(DATA_BLOCK)
MULTISLOT_BLOCK['properties'].update(tableSlots={'type': 'object', 'minProperties': 1, 'maxProperties': 5,
    'propertyNames': {'pattern': '^[a-z][a-z0-9-]*$'}, 'additionalProperties': _SLOT},
    rowKey=ID, periods={'type': 'object', 'additionalProperties': _PERIOD},
    pagination={'type': 'object', 'properties': {'mode': {'enum': ['local', 'query']},
        'pageSize': {'type': 'integer', 'minimum': 1}}, 'required': ['mode'], 'additionalProperties': False})
MULTISLOT_BLOCK['required'] += ['tableSlots', 'rowKey', 'periods']
MULTISLOT_COMPOSE = deepcopy(COMPOSE_SCHEMA)
MULTISLOT_COMPOSE['properties']['sections']['items']['properties']['blocks']['items']['oneOf'].append(MULTISLOT_BLOCK)
MULTISLOT_EDIT = deepcopy(EDIT_RESULT_SCHEMA)
MULTISLOT_EDIT['properties']['operations']['items']['oneOf'].append(obj({
    'id': ID, 'type': {'const': 'add_multislot_table'}, 'sectionId': ID, 'block': MULTISLOT_BLOCK,
    'resultRefs': {'type': 'object', 'additionalProperties': NAME},
    'dependsOn': {'type': 'array', 'items': ID}}, ['id', 'type', 'sectionId', 'block', 'resultRefs']))

MULTISLOT_EDIT['properties']['operations']['items']['oneOf'].append(obj({
    'id': ID, 'type': {'const': 'extend_multislot_table'}, 'componentId': ID, 'block': MULTISLOT_BLOCK,
    'resultRefs': {'type': 'object', 'additionalProperties': NAME},
    'dependsOn': {'type': 'array', 'items': ID}}, ['id', 'type', 'componentId', 'block', 'resultRefs']))
