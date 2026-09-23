"""Trusted adapter boundary for existing metadata or explicitly recorded user relations."""
from copy import deepcopy
from typing import Protocol


class MetricRelationsPort(Protocol):
    async def resolve(self, scope: dict, data_context_version: str, business_domain: str) -> dict: ...


async def load_relations(provider, scope, version, domain):
    if provider is None:
        return [], 'unknown'
    try:
        result = await provider.resolve(deepcopy(scope or {}), version, domain)
        if result.get('dataContextVersion') != version or result.get('businessDomain') != domain:
            return [], 'unavailable'
        entries = result['relations']
        required = {'evidenceRef', 'primaryField', 'changeField', 'origin', 'time'}
        if not isinstance(entries, list) or len(entries) > 100:
            return [], 'unavailable'
        for item in entries:
            if not isinstance(item, dict) or not required <= item.keys() or item['origin'] not in {'metadata', 'user'}:
                return [], 'unavailable'
            if any(not isinstance(item[k], str) or not 0 < len(item[k]) <= 128 for k in ('evidenceRef', 'primaryField', 'changeField')):
                return [], 'unavailable'
            if set(item) - (required | {'match'}):
                return [], 'unavailable'
            if not isinstance(item['time'], dict) or set(item['time']) != {'start', 'end', 'granularity'}:
                return [], 'unavailable'
            if any(not isinstance(v, str) or len(v) > 64 for v in item['time'].values()):
                return [], 'unavailable'
            if 'match' in item and (not isinstance(item['match'], dict) or set(item['match']) != {'field', 'equals'}
                    or not isinstance(item['match']['field'], str) or len(item['match']['field']) > 128
                    or not isinstance(item['match']['equals'], (str, int, float, bool))
                    or len(str(item['match']['equals'])) > 128):
                return [], 'unavailable'
        if len({r['evidenceRef'] for r in entries}) != len(entries):
            return [], 'unavailable'
        return deepcopy(entries), 'known'
    except Exception:
        return [], 'unavailable'


def query_relations(entries, request, source):
    """Keep only relations for this executed source, period and returned objects."""
    fields = source['fields']
    names = {field.get('queryField', key): field for key, field in fields.items()}
    period = {key: request['time'][key] for key in ('start', 'end', 'granularity')}
    rows = source['source'].get('initial', {}).get('rows', [])
    return [deepcopy(item) for item in entries
            if item['time'] == period
            and all(names.get(item[key], {}).get('role') == 'measure' for key in ('primaryField', 'changeField'))
            and (not item.get('match') or names.get(item['match']['field'], {}).get('role') == 'dimension'
                 and any(row.get(item['match']['field']) == item['match']['equals'] for row in rows))]


def relation_evidence(entries, fields):
    """Use the same public field IDs as query evidence; never disclose provider JSON."""
    ids = {field.get('queryField', key): key for key, field in fields.items()}
    result = []
    for entry in entries:
        if not all(entry[key] in ids for key in ('primaryField', 'changeField')):
            continue
        item = deepcopy(entry)
        for key in ('primaryField', 'changeField'): item[key] = ids[item[key]]
        if item.get('match'):
            if item['match']['field'] not in ids: continue
            item['match']['field'] = ids[item['match']['field']]
        result.append(item)
    return result
