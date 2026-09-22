"""Selective projection of actual Lab model JSON; no physical SQL enters discovery.

The host provider searches accessible models or reuses its semantic summary. Its
optional detail method resolves an exact source/model/metric reference; this
module does not guess a business-detail URL or match another metric by name.
"""
from copy import deepcopy
import json
import re
from metriccanvas_authoring.work.state import digest, require


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
    return {'metricRef': ref, 'source': reference, 'name': name, 'aliases': synonyms[:10],
        'definition': {'status': 'source-known' if definition_known else 'unknown', 'value': definition if definition_known else None},
        'unit': {'status': 'source-known' if unit else 'unknown', 'value': unit},
        'frequency': {'status': 'source-known' if frequency else 'unknown', 'value': frequency},
        'dimensions': {'status': 'source-known' if dimensions else 'unknown', 'values': [
            {'id': text(d.get('column_id', d.get('id'))), 'label': text(d.get('caption', d.get('name')))} for d in dimensions]},
        'executionDefinition': 'calculate_conf' if configured else 'formula' if formula else 'unknown',
        'metricCode': text(description.get('metricCode')), 'conflicts': conflicts,
        'status': 'conflict' if conflicts else 'source-known', 'detailRef': ref}


class SemanticCatalog:
    def __init__(self, provider, store):
        self.provider, self.store = provider, store

    async def query_issues(self, binding, request):
        issues = []
        for metric in request['metrics']:
            found = await self.discover(binding, metric['name'], 50, [])
            exact = [card for card in found['matches'] if card['name'] == metric['name']]
            if any(card['conflicts'] for card in exact):
                issues.append({'code': 'METRIC_DEFINITION_CONFLICT', 'path': '/metrics', 'metric': metric['name']})
        return issues

    async def discover(self, binding, query, limit, detail_refs):
        require(1 <= limit <= 50 and len(detail_refs) <= 6, 'DISCOVERY_LIMIT')
        # Provider search must honor the authenticated binding; full-catalog reads
        # are not required by this interface.
        value = await self.provider.search(deepcopy(binding), query, limit)
        version = value['dataContextVersion']
        cards = []
        for model in value['models']:
            for metric in model.get('logical_schema', {}).get('field_schema', {}).get('metrics', []):
                card = metric_card(model, metric)
                if query and not any(query.casefold() in text.casefold() for text in [card['name'], *card['aliases']]): continue
                if len(cards) >= limit: break
                key = digest([binding, version, card['metricRef']])
                await self.store.compare_and_swap('metric', key, 0, {'card': card, 'raw': deepcopy(metric)})
                cards.append(card)
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
        issues = deepcopy(value.get('issues', []))
        status = 'partial' if issues and value['models'] else 'failed' if issues else 'ready'
        return {'ok': status != 'failed', 'status': status, 'dataContextVersion': version,
                'matches': cards, 'details': details, 'issues': issues,
                **({'coverage': deepcopy(value['coverage'])} if 'coverage' in value else {})}
