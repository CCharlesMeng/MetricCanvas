"""Explicit local mock knowledge adapter. Never a production fallback."""
import json
from copy import deepcopy
from pathlib import Path
from metriccanvas_authoring.data.discovery.contracts import validate
from metriccanvas_authoring.data.discovery.retrieval import normalized


class MockBusinessKnowledge:
    def __init__(self, path):
        self.snapshot = validate('knowledge', json.loads(Path(path).read_text()))
        if not self.snapshot['source']['namespace'].startswith('mock-'):
            raise ValueError('Mock adapter requires an explicitly mock source')

    async def search(self, binding, query, business_domains, limit):
        # Only fictional public fixtures. Production adapters must enforce binding permissions.
        result = deepcopy(self.snapshot)
        found = []
        for item in result['items']:
            if business_domains and not set(business_domains) & set(item['businessDomains']): continue
            terms = [item.get('canonicalTerm', ''), item.get('name', ''), *item.get('aliases', []), *item.get('terms', [])]
            if not query or any(t and normalized(t) in normalized(query) for t in terms):
                found.append(item)
        result['items'] = found[:limit]
        result['coverage']['returnedTruncated'] = len(found) > limit
        return result
