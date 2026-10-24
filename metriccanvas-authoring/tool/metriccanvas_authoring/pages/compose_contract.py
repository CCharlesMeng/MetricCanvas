"""Active compose input contract; stdlib-only so build exports use the same source.

No service construction, query, normalization or persistence belongs here.
"""
from copy import deepcopy
import json

from metriccanvas_authoring.runtime_assets import bundle_root
from metriccanvas_authoring.schema_projection import inline_local_refs

ROOT = bundle_root()
PATTERNS = json.loads((ROOT / 'contracts/authored/section-patterns.json').read_text())
PLAN_SCHEMA = json.loads((ROOT / 'contracts/authored/page-structure-plan.schema.json').read_text())
CURRENT_PLAN_SCHEMA, = PLAN_SCHEMA['oneOf']
for version_schema in PLAN_SCHEMA['oneOf']:
    version_schema['properties']['scene']['enum'] = list(PATTERNS['scenes'])
    version_schema['properties']['sections']['items']['properties']['pattern']['enum'] = list(PATTERNS['patterns'])
SECTION = CURRENT_PLAN_SCHEMA['properties']['sections']['items']
BLOCK = SECTION['properties']['blocks']['items']
TEXT_BLOCK, DATA_BLOCK = BLOCK['oneOf']
ID = DATA_BLOCK['properties']['id']
TEXT = TEXT_BLOCK['properties']['body']
NAME = CURRENT_PLAN_SCHEMA['properties']['dataContextVersion']


def obj(properties, required):
    return {'type': 'object', 'additionalProperties': False, 'properties': properties, 'required': required}


SOURCE_REFS = {'type': 'object', 'propertyNames': ID, 'maxProperties': 6, 'additionalProperties': NAME}
RESULT_SECTION = deepcopy(SECTION)
RESULT_SECTION['required'] = ['id', 'pattern', 'blocks']
for block_schema in RESULT_SECTION['properties']['blocks']['items']['oneOf']:
    block_schema['required'] = [key for key in block_schema['required'] if key != 'purpose']
_edit_schema = json.loads((ROOT / 'contracts/authored/page-edit-request.schema.json').read_text())
DATE_FILTER_OPERATIONS = [o for o in _edit_schema['properties']['operations']['items']['oneOf'] if o['properties']['type']['const'] == 'add_date_filter']
COMPOSE_SCHEMA = obj({'title': TEXT, 'layout': {'enum': ['report', 'dashboard']}, 'sources': SOURCE_REFS,
    'sections': {'type': 'array', 'minItems': 1, 'maxItems': 12, 'items': RESULT_SECTION},
    'dateFilters': {'type': 'array', 'maxItems': 8, 'items': {'oneOf': DATE_FILTER_OPERATIONS}}}, ['title', 'sources', 'sections'])
_page_schema = json.loads((ROOT / 'contract-snapshot/page/schema.json').read_text())
COMPOSE_SCHEMA['properties']['pagedJoins'] = {'type': 'object', 'propertyNames': ID,
    'additionalProperties': inline_local_refs(_page_schema['definitions']['pagedJoinSource'], _page_schema)}
