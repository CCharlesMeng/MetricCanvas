"""Per-turn program-channel executions keyed by authority, snapshot and exact mapped query."""
from copy import deepcopy
from dataclasses import asdict
import hashlib
import json
from metriccanvas_authoring.domain.execution import DqeExecutionResult


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


class StructureQueryCache:
    def __init__(self, delegate, scope, snapshot, entries=None):
        self.delegate = delegate
        self.authority = fingerprint({'scope': scope, 'snapshot': snapshot})
        self.entries = deepcopy(entries or {})
        self.executions = 0
        self.hits = 0
        self.observed = {}

    async def execute(self, query):
        identity = {k: v for k, v in query.items() if k != 'dataSourceId'}
        key = fingerprint({'authority': self.authority, 'query': identity})
        entry = self.entries.get(key)
        if entry and entry['sha256'] == fingerprint(entry['result']):
            result = DqeExecutionResult(**deepcopy(entry['result']))
            if result.effective_total_count == len(result.rows):
                self.hits += 1
                self.observed[fingerprint(identity)] = deepcopy(result)
                return result
        result = await self.delegate.execute(deepcopy(query))
        self.executions += 1
        self.observed[fingerprint(identity)] = deepcopy(result)
        # Incomplete results remain evidence, never reusable complete query results.
        if result.effective_total_count == len(result.rows):
            value = asdict(result)
            self.entries[key] = {'sha256': fingerprint(value), 'result': deepcopy(value)}
        return result

    def for_source(self, source):
        query = {**source['source']['query'], 'fieldMappings': source['fields'], 'filterValues': []}
        return self.observed.get(fingerprint(query))
