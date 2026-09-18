"""Map verified semantic selections to stable fields without transforming values."""
from copy import deepcopy
from dataclasses import replace
import hashlib
import json
import math
import re
from collections import Counter
from collections.abc import Mapping
from jsonschema import Draft202012Validator, FormatChecker

from metriccanvas_authoring.runtime_assets import bundle_root
from metriccanvas_authoring.domain.idempotency import canonical_json

_ROOT = bundle_root()
_DESCRIPTOR = Draft202012Validator(json.loads((_ROOT / 'contracts/authored/source-description.schema.json').read_text()))
_PAGE_SCHEMA = json.loads((_ROOT / 'contract-snapshot/page/schema.json').read_text())
_FIELD = Draft202012Validator(_PAGE_SCHEMA['definitions']['queryScalarField'])
_FORMAT_CHECKER = FormatChecker()


class SourceMappingError(Exception):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


def query_sha256(effective_query):
    return hashlib.sha256(canonical_json({key: effective_query[key] for key in ('language', 'body')}).encode('utf-8')).hexdigest()


def _require(condition, code):
    if not condition: raise SourceMappingError(code)


def _id_part(value):
    # Do not silently discard Chinese text or invent a translation.
    if not value.isascii(): return ''
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')


def _new_field_ids(source_id, description):
    """Allocate readable IDs for a new source, never migrate existing documents."""
    prefix = source_id if re.match(r'^[A-Za-z_]', source_id) else 'source-' + source_id
    entries = description['fields']
    identities = [canonical_json([description['providerNamespace'], f['logicalId'], f['projectionId']]) for f in entries]
    _require(len(set(identities)) == len(identities), 'SOURCE_FIELD_IDENTITY_DUPLICATE')
    digests = [hashlib.sha256(identity.encode('utf-8')).hexdigest() for identity in identities]
    bases = [prefix + '-field-' + (_id_part(f['queryField']) or _id_part(f['logicalId']) or 'identity-' + digest[:10])
             for f, digest in zip(entries, digests)]
    names = list(bases)
    for key in ('logicalId', 'projectionId'):
        counts = Counter(names)
        names = [name + '-' + part if counts[name] > 1 and (part := _id_part(f[key])) else name
                 for name, f in zip(names, entries)]
    # Check the entire namespace, including collisions with another field's base.
    for length in (10, 20, 64):
        counts = Counter(names)
        if max(counts.values()) == 1: break
        names = [name + '-' + digest[:length] if counts[name] > 1 else name
                 for name, digest in zip(names, digests)]
    _require(len(set(names)) == len(names), 'SOURCE_FIELD_IDENTITY_DUPLICATE')
    return {f['semanticName']: name for f, name in zip(entries, names)}


def map_source_description(unit, description, data_context_version):
    _require(_DESCRIPTOR.is_valid(description), 'SOURCE_DESCRIPTION_INVALID')
    _require(description['querySha256'] == query_sha256(unit.effective_query()), 'SOURCE_QUERY_MISMATCH')
    _require(description['dataContextVersion'] == data_context_version, 'SOURCE_CONTEXT_MISMATCH')
    _require(not description['rules'] and not description['unresolved'], 'SOURCE_RULES_UNSUPPORTED')
    selected = [value['queryField'] for value in unit.fields.values()]
    provided = [value['semanticName'] for value in description['fields']]
    _require(len(set(selected)) == len(selected) and len(set(provided)) == len(provided) and set(selected) == set(provided), 'SOURCE_SEMANTIC_MAPPING_MISMATCH')
    descriptors = {field['semanticName']: field for field in description['fields']}
    field_ids = _new_field_ids(unit.data_source_id, description)
    fields = {}
    query_names = set()
    for original in unit.fields.values():
        field = descriptors[original['queryField']]
        allowed_money = original['type'] == 'number' and field['type'] == 'money' and field.get('currency') == 'CNY' and field['scale'] == 'currency-base'
        _require((field['type'] == original['type'] or allowed_money) and field['role'] == original['role'] and field['nullable'] == original.get('nullable', False), 'SOURCE_FIELD_CONTRACT_MISMATCH')
        scale, kind, fmt = field['scale'], field['type'], field.get('defaultFormat')
        numeric = kind in {'number', 'money'}
        _require(kind != 'money' or field.get('currency') == 'CNY' and scale == 'currency-base', 'SOURCE_SCALE_UNSUPPORTED')
        _require(numeric or scale in {'none', 'unknown'}, 'SOURCE_SCALE_UNSUPPORTED')
        if fmt is not None:
            if fmt.startswith('percent-'):
                _require(numeric and scale == 'percent', 'SOURCE_SCALE_UNSUPPORTED')
            elif fmt.startswith('compact-') or fmt == 'cny-adaptive':
                _require(numeric and scale in {'none', 'currency-base'}, 'SOURCE_SCALE_UNSUPPORTED')
            elif fmt.startswith('number'):
                _require(numeric, 'SOURCE_FORMAT_UNSUPPORTED')
            elif fmt in {'date', 'date-month-day'}:
                _require(kind in {'date', 'datetime'}, 'SOURCE_FORMAT_UNSUPPORTED')
        field_id = field_ids[field['semanticName']]
        _require(field_id not in fields and field['queryField'] not in query_names, 'SOURCE_FIELD_IDENTITY_DUPLICATE')
        page_field = {key: deepcopy(field[key]) for key in ('queryField', 'type', 'role', 'nullable', 'label', 'unit', 'currency', 'defaultFormat') if key in field}
        if 'label' not in page_field: page_field['label'] = original.get('label', original['queryField'])
        _require(_FIELD.is_valid(page_field), 'SOURCE_FORMAT_UNSUPPORTED')
        fields[field_id] = page_field
        query_names.add(field['queryField'])
    return replace(unit, fields=fields)


def validate_mapped_rows(fields, rows):
    """Validate every returned raw row, including rows beyond the initial sample.

    HTTP DQE already checks mappings; this boundary also protects other adapters.
    It never renames fields or rescales values (runtime owns row materialization).
    """
    _require(isinstance(rows, (list, tuple)), 'SOURCE_ROWS_INVALID')
    for row in rows:
        _require(isinstance(row, Mapping), 'SOURCE_ROWS_INVALID')
        for field in fields.values():
            name = field['queryField']
            _require(name in row, 'SOURCE_ROW_MAPPING_MISSING')
            value = row[name]
            if value is None:
                _require(field['nullable'], 'SOURCE_ROW_TYPE_MISMATCH')
                continue
            kind = field['type']
            schema = {'type': 'number' if kind == 'money' else 'string' if kind in {'date', 'datetime'} else kind}
            if kind in {'date', 'datetime'}: schema['format'] = 'date' if kind == 'date' else 'date-time'
            _require(Draft202012Validator(schema, format_checker=_FORMAT_CHECKER).is_valid(value), 'SOURCE_ROW_TYPE_MISMATCH')
            _require(not isinstance(value, float) or math.isfinite(value), 'SOURCE_ROW_TYPE_MISMATCH')
