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
