"""Bounded metadata snapshots shared by calls in one trusted authoring turn.

Adapters supply a source/configuration identity and a loader after checking the
current caller. No model parameter controls caching or authorizes access.
"""
import asyncio
from contextvars import ContextVar
from copy import deepcopy
from functools import wraps
import json
import inspect
import time
from uuid import uuid4

from metriccanvas_authoring.canonical import canonical_sha256
from metriccanvas_authoring.data.ports import DataContextError

_scope = ContextVar('authoring_metadata_scope', default=None)


def metadata_session(method):
    @wraps(method)
    async def call(self, *args, **kwargs):
        ref = inspect.signature(method).bind(self, *args, **kwargs).arguments['context_ref']
        prepared = await self.gate.require(ref)
        token = _scope.set((self.state.store, deepcopy(dict(prepared.binding))))
        try:
            result = await method(self, *args, **kwargs)
            await self.gate.unchanged(prepared)
            return result
        finally:
            _scope.reset(token)
    return call


def metadata_session_active():
    return _scope.get() is not None


async def read_turn_metadata(source_identity, load, *, retain_partial=False):
    scope = _scope.get()
    if scope is None:
        return await load()
    store, binding = scope
    key = canonical_sha256([binding, source_identity])
    deadline = time.monotonic() + 65
    while True:
        revision, record = await store.read('metadata-snapshot-v1', key)
        if record and record.get('status') == 'ready':
            return deepcopy(record['value'])
        if record and record.get('status') == 'loading' and record['expiresAt'] > time.time():
            if time.monotonic() >= deadline:
                raise DataContextError('DATA_CONTEXT_TIMEOUT', 'Metadata read is still in progress')
            await asyncio.sleep(.05)
            continue
        claim = {'status': 'loading', 'owner': str(uuid4()), 'expiresAt': time.time() + 62}
        if not await store.compare_and_swap('metadata-snapshot-v1', key, revision, claim):
            continue
        try:
            async with asyncio.timeout(60):
                value = await load()
            complete = value.get('coverage', {}).get('complete') is True and not value.get('issues')
            bounded = len(json.dumps(value, ensure_ascii=False).encode()) <= 20 * 1024 * 1024
            partial = retain_partial and value.get('coverage', {}).get('scope') == 'authorized' and bool(value.get('models'))
            saved = {'status': 'ready', 'capturedAt': time.time(), 'value': value} if (complete or partial) and bounded else {'status': 'empty'}
            if not await store.compare_and_swap('metadata-snapshot-v1', key, revision + 1, saved):
                continue
            return deepcopy(value)
        except BaseException as error:
            await asyncio.shield(store.compare_and_swap('metadata-snapshot-v1', key, revision + 1, {'status': 'empty'}))
            if isinstance(error, TimeoutError):
                raise DataContextError('DATA_CONTEXT_TIMEOUT', 'Metadata read timed out') from None
            raise
