"""Selective projection of actual Lab model JSON; no physical SQL enters discovery.

The host provider searches accessible models or reuses its semantic summary. Its
optional detail method resolves an exact source/model/metric reference; this
module does not guess a business-detail URL or match another metric by name.
"""
from copy import deepcopy
import json
import re
from metriccanvas_authoring.work.state import digest, require
from metriccanvas_authoring.data.lab_projection import business_domain, dimension_name, time_granularities, is_time_dimension


def decoded(value, default):
    if isinstance(value, str):
        try: return json.loads(value)
        except ValueError: return default
    return value if value is not None else default


def metric_card(model, metric):
    def text(value, limit=256):
        return value if isinstance(value, str) and value.strip() and len(value) <= limit else None
    reference = {'workspaceId': model.get('workspace_id'), 'modelId': model['id'], 'metricId': metric['id'],
                 'modelVersion': digest(model)}
    ref = 'metric-' + digest(reference)
    name = metric.get('name', '')
    description = decoded(metric.get('description'), {})
    description = description if isinstance(description, dict) else {}
    definition = text(metric.get('definition'), 4096)
    unit, frequency = text(metric.get('unit')), text(metric.get('frequency'))
    definition_known = isinstance(definition, str) and bool(definition.strip()) and definition != name
    dimensions = metric.get('dimensions')
    dimensions = [d for d in dimensions if isinstance(d, dict)] if isinstance(dimensions, list) else []
    formula = metric.get('formula') if isinstance(metric.get('formula'), str) else None
    configured = decoded(metric.get('calculate_conf'), {})
    synonyms = metric.get('synonyms') or []
    if isinstance(synonyms, str): synonyms = [s.strip() for s in synonyms.split(',') if s.strip()]
    synonyms = [s for s in synonyms if text(s)] if isinstance(synonyms, list) else []
    conflicts = []
    requested = re.search(r'近(\d+)天', name)
    used = set(re.findall(r'(\d+)天前', formula or ''))
    if requested and used and requested.group(1) not in used:
        conflicts.append({'code': 'DECLARED_TIME_FORMULA_CONFLICT', 'declaredDays': int(requested.group(1)), 'referencedDays': sorted(map(int, used))})
    return {'kind': 'metric', 'businessDomain': business_domain(model), 'metricRef': ref, 'source': reference, 'name': name, 'aliases': synonyms[:100],
        'definition': {'status': 'source-known' if definition_known else 'unknown', 'value': definition if definition_known else None},
        'unit': {'status': 'source-known' if unit else 'unknown', 'value': unit},
        'frequency': {'status': 'source-known' if frequency else 'unknown', 'value': frequency},
        'dimensions': {'status': 'source-known' if dimensions else 'unknown', 'values': [
            {'id': text(d.get('column_id', d.get('id'))), 'label': text(d.get('caption', d.get('name')))} for d in dimensions]},
        'executionDefinition': 'calculate_conf' if configured else 'formula' if formula else 'unknown',
        'metricCode': text(description.get('metricCode')), 'conflicts': conflicts,
        'status': 'conflict' if conflicts else 'source-known', 'detailRef': ref}


class SemanticCatalog:
    def __init__(self, provider, store, *, discovery=None):
        self.provider, self.store = provider, store
        self.discovery = None
        if discovery is not None:
            from metriccanvas_authoring.data.discovery.service import DiscoveryService
            require(discovery.trusted_context is not None, 'DISCOVERY_CONTEXT_UNAVAILABLE')
            self.discovery = DiscoveryService(self, discovery)
        self.discovery_protocol_version = '1.0' if self.discovery is not None else None

    @staticmethod
    def source_cards(value):
        models = value['models']
        domains = [business_domain(m) for m in models]
        require(len(domains) == len(set(domains)), 'DATA_CONTEXT_DOMAIN_AMBIGUOUS')
        metrics, dimensions = [], []
        for model in models:
            fields = model.get('logical_schema', {}).get('field_schema', {})
            metrics.extend(metric_card(model, m) for m in fields.get('metrics', []))
            dimensions.extend(dimension_card(model, d) for d in fields.get('dimensions', []))
        return metrics, dimensions

    async def query_issues(self, binding, request):
        return await self._query_issues(binding, request)

    async def query_issues_for_context(self, binding, request, snapshot):
        if self.discovery:
            await self.discovery.require_query(binding, request, snapshot['version'])
        return await self._query_issues(binding, request, snapshot['version'])

    async def _query_issues(self, binding, request, expected_version=None):
        # Query checks never call discover, knowledge, interpretation or review UI.
        value = await self.provider.search(deepcopy(binding), '', 50)
        if expected_version is not None:
            require(value['dataContextVersion'] == expected_version, 'DATA_CONTEXT_VERSION_CHANGED')
        cards, _ = self.source_cards(value)
        issues = []
        for metric in request['metrics']:
            exact = [c for c in cards if c['name'] == metric['name'] and c['businessDomain'] == request['businessDomain']]
            if any(c['conflicts'] for c in exact):
                issues.append({'code': 'METRIC_DEFINITION_CONFLICT', 'path': '/metrics', 'metric': metric['name']})
        return issues

    async def details(self, binding, version, detail_refs):
        details = []
        for ref in detail_refs:
            key = digest([binding, version, ref])
            _, selected = await self.store.read('metric', key)
            require(selected is not None, 'METRIC_DETAIL_IDENTITY_REQUIRED')
            _, cached = await self.store.read('metric-detail', key)
            if cached is None:
                detail = await self.provider.detail(deepcopy(binding), deepcopy(selected['card']['source']))
                cached = {'status': 'unknown'}
                if isinstance(detail, dict) and detail.get('source') == selected['card']['source']:
                    values = {k: deepcopy(detail[k]) for k in ('unit', 'frequency', 'definition', 'scale')
                              if k in detail and detail[k] is not None and detail[k] != ''}
                    if values:
                        cached = {'status': 'source-known', 'values': values}
                await self.store.compare_and_swap('metric-detail', key, 0, cached)
            details.append({'metricRef': ref, **cached})
        return details

    async def discover(self, binding, query, limit, detail_refs):
        require(1 <= limit <= 50 and len(detail_refs) <= 6 and len(query) <= 4096, 'DISCOVERY_LIMIT')
        if self.discovery:
            return await self.discovery.discover(binding, query, limit, detail_refs)
        from metriccanvas_authoring.data.discovery.retrieval import rank, score
        value = await self.provider.search(deepcopy(binding), query, limit)
        version = value['dataContextVersion']
        metrics, dimensions = self.source_cards(value)
        ranked = rank(query, metrics, max(1, len(metrics)))
        matching_dimensions = [d for d in dimensions if score(query, d)[0]]
        relevant_domains = {c['businessDomain'] for c in ranked}
        shown_dimensions = [d for d in dimensions if d['businessDomain'] in relevant_domains or d in matching_dimensions]
        cards = rank(query, [*metrics, *dimensions], limit)
        for card in cards:
            if card['kind'] == 'metric':
                await self.store.compare_and_swap('metric', digest([binding, version, card['metricRef']]), 0, {'card': card})
        issues = deepcopy(value.get('issues', []))
        status = 'partial' if issues and value['models'] else 'failed' if issues else 'ready'
        count = len(ranked) + len(matching_dimensions)
        return {'ok': status != 'failed', 'status': status, 'dataContextVersion': version,
                'businessDomains': list(dict.fromkeys(business_domain(m) for m in value['models'])),
                'matches': cards, 'dimensions': shown_dimensions[:50],
                'dimensionCombinations': 'unknown unless declared by the metric',
                'dimensionCoverage': {'returnedCount': min(len(shown_dimensions), 50), 'matchedCount': len(shown_dimensions), 'truncated': len(shown_dimensions)>50},
                'executionReadiness': 'not_checked',
                'matchCoverage': {'returnedCount': len(cards), 'matchedCount': count, 'truncated': count>len(cards)},
                'details': await self.details(binding, version, detail_refs), 'issues': issues,
                **({'coverage': deepcopy(value['coverage'])} if 'coverage' in value else {})}


def dimension_card(model, raw):
    name = dimension_name(raw)
    require(isinstance(name, str) and 0 < len(name) <= 256, 'DATA_CONTEXT_DIMENSION_NAME_INVALID')
    aliases = raw.get('synonyms', [])
    if isinstance(aliases, str):
        aliases = [s.strip() for s in aliases.split(',')]
    return {'kind': 'dimension', 'businessDomain': business_domain(model),
        'name': name, 'label': raw.get('caption') if isinstance(raw.get('caption'), str) else name,
        'aliases': [s for s in aliases if isinstance(s, str) and s.strip()][:10] if isinstance(aliases, list) else [],
        'source': {'modelId': model['id'], 'dimensionId': raw['id'] if isinstance(raw.get('id'), str) else name, 'modelVersion': digest(model)},
        'isTime': is_time_dimension(raw), 'granularities': time_granularities(raw),
        'filterability': 'time' if is_time_dimension(raw) else 'dimension',
        'values': {'status': 'unknown'}, 'metricCompatibility': 'unknown'}
