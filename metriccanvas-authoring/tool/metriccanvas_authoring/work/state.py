"""Persistent scoped state and shared budgets for one trusted authoring turn."""
from copy import deepcopy
from dataclasses import dataclass
import time
from typing import Protocol
from metriccanvas_authoring.application.content_ports import ContentBaselineError
from metriccanvas_authoring.domain.canonical import canonical_sha256 as digest


def require(condition, code):
    if not condition:
        raise ContentBaselineError(code)


class StateStore(Protocol):
    async def read(self, namespace: str, key: str):
        """Return (version, isolated JSON value), or (0, None)."""
        ...
    async def compare_and_swap(self, namespace: str, key: str, version: int, value: dict) -> bool: ...


@dataclass(frozen=True)
class Limits:
    calls: int = 24
    query_rounds: int = 3
    mutations: int = 2
    seconds: int = 300
    evidence_rows: int = 20
    evidence_bytes: int = 16000
    total_evidence_bytes: int = 96000

    def __post_init__(self):
        require(all(type(v) is int and v > 0 for v in vars(self).values()), 'BUDGET_CONFIG_INVALID')


class TurnState:
    def __init__(self, store, limits=Limits(), clock=time.time):
        self.store, self.limits, self.clock = store, limits, clock

    def key(self, prepared):
        return digest(dict(prepared.binding))

    async def consume(self, prepared, kind='calls', amount=1):
        require(self.store is not None, 'WORK_STORE_UNAVAILABLE')
        key = self.key(prepared)
        for _ in range(20):
            version, state = await self.store.read('budget', key)
            state = deepcopy(state) if state else {'started': self.clock(), 'calls': 0, 'query_rounds': 0, 'mutations': 0, 'total_evidence_bytes': 0}
            require(self.clock() - state['started'] < self.limits.seconds, 'AUTHORING_BUDGET_EXHAUSTED')
            state[kind] += amount
            require(state[kind] <= getattr(self.limits, kind), 'AUTHORING_BUDGET_EXHAUSTED')
            if await self.store.compare_and_swap('budget', key, version, state):
                return
        raise ContentBaselineError('WORK_BUSY')

    async def remaining(self, prepared):
        _, budget = await self.store.read('budget', self.key(prepared))
        remaining = self.limits.seconds - (self.clock() - budget['started'])
        require(remaining > 0, 'AUTHORING_BUDGET_EXHAUSTED')
        return remaining

    async def read(self, prepared):
        version, work = await self.store.read('work', self.key(prepared))
        if work is None:
            work = {'binding': deepcopy(dict(prepared.binding)), 'workVersion': 0,
                    'document': deepcopy(prepared.baseline.document) if prepared.baseline else None,
                    'base': deepcopy(prepared.binding['baseRef']), 'active': None,
                    'lastRequest': None, 'lastResult': None, 'artifact': None}
        require(work['binding'] == dict(prepared.binding), 'WORK_SCOPE_MISMATCH')
        return version, work

    async def reserve(self, prepared, expected_version, request_hash):
        version, work = await self.read(prepared)
        if work['lastRequest'] == request_hash:
            return None, work, deepcopy(work['lastResult'])
        require(work['active'] is None, 'WORK_BUSY')
        require(work['lastResult'] is None or work['lastResult'].get('saveStatus') not in {'unknown', 'pending', 'rejected'}, 'SAVE_RECONCILIATION_REQUIRED')
        require(work['workVersion'] == expected_version, 'WORK_VERSION_CONFLICT')
        work.pop('submission', None)
        work['active'] = request_hash
        require(await self.store.compare_and_swap('work', self.key(prepared), version, work), 'WORK_VERSION_CONFLICT')
        return version + 1, work, None

    async def finish(self, prepared, version, work, request_hash, result):
        require(work['active'] == request_hash, 'WORK_VERSION_CONFLICT')
        updated = deepcopy(work)
        updated.update(active=None, lastRequest=request_hash, lastResult=deepcopy(result))
        require(await self.store.compare_and_swap('work', self.key(prepared), version, updated), 'WORK_VERSION_CONFLICT')
