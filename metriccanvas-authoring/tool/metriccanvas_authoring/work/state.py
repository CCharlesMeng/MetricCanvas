"""Persistent scoped state and shared budgets for one trusted authoring turn."""
from copy import deepcopy
from dataclasses import dataclass
import time
from typing import Protocol
from metriccanvas_authoring.work.content_ports import ContentBaselineError
from metriccanvas_authoring.canonical import canonical_sha256 as digest


def require(condition, code):
    if not condition:
        raise ContentBaselineError(code)


class StateStore(Protocol):
    async def read(self, namespace: str, key: str) -> tuple[int, dict | None]:
        """Return (version, isolated JSON value), or (0, None)."""
        ...
    async def compare_and_swap(self, namespace: str, key: str, version: int, value: dict) -> bool: ...


@dataclass(frozen=True)
class Limits:
    # Cumulative authoring budgets are temporarily opt-in; None means unbounded.
    calls: int | None = None
    query_rounds: int | None = None
    mutations: int | None = None
    seconds: int | None = None
    evidence_rows: int = 20
    evidence_bytes: int = 16000
    total_evidence_bytes: int | None = None

    def __post_init__(self):
        optional = {'calls', 'query_rounds', 'mutations', 'seconds', 'total_evidence_bytes'}
        require(all((v is None and k in optional) or (type(v) is int and v > 0)
                    for k, v in vars(self).items()), 'BUDGET_CONFIG_INVALID')


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
            if self.limits.seconds is not None:
                require(self.clock() - state['started'] < self.limits.seconds, 'AUTHORING_BUDGET_EXHAUSTED')
            state[kind] += amount
            limit = getattr(self.limits, kind)
            require(limit is None or state[kind] <= limit, 'AUTHORING_BUDGET_EXHAUSTED')
            if await self.store.compare_and_swap('budget', key, version, state):
                return
        raise ContentBaselineError('WORK_BUSY')

    async def remaining(self, prepared):
        if self.limits.seconds is None:
            return None
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
