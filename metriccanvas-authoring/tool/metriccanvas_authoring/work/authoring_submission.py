"""Trusted final selection consumer. No production wiring or persistence adapter.

Only the atomic record port owns selection exclusivity. In-memory fixtures prove
this consumer's protocol, never crash recovery or cross-process durability.
"""
import asyncio
from copy import deepcopy
from typing import Protocol
from uuid import uuid4

from .authoring_turns import AuthoringTurnGate, PreparedAuthoringTurn
from metriccanvas_authoring.pages.editing.edit_page import document_sha256
from metriccanvas_authoring.assets.lifecycle import Lifecycle, VALIDATOR, require
from metriccanvas_authoring.assets.lifecycle_ports import LifecycleError
from metriccanvas_authoring.canonical import canonical_json
from metriccanvas_authoring.work.submission_records import validate_record, validate_terminal_result


class CandidateReader(Protocol):
    async def require(self, candidate_ref: str, prepared: PreparedAuthoringTurn) -> dict: ...


class ExecutionRecordPort(Protocol):
    async def claim(self, key: tuple[str, ...], record: dict) -> tuple[dict, bool]:
        """Atomically select once; return an isolated original record on duplicates."""
        ...

    async def update(self, key: tuple[str, ...], record: dict) -> None:
        """Only status/result/programToken may change; reject all immutable edits."""
        ...


def semantic_equal(left, right):
    """JSON value equality: key order is immaterial; booleans are not numbers."""
    if isinstance(left, dict) and isinstance(right, dict):
        return left.keys() == right.keys() and all(semantic_equal(left[k], right[k]) for k in left)
    if isinstance(left, list) and isinstance(right, list):
        return len(left) == len(right) and all(semantic_equal(a, b) for a, b in zip(left, right))
    if isinstance(left, bool) or isinstance(right, bool) or left is None or right is None:
        return type(left) is type(right) and left == right
    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        return left == right
    return type(left) is type(right) and left == right


async def validate_submission_record(record, prepared, candidates: CandidateReader):
    """Check one stored record against its turn and the candidate it submits.

    Submission and recovery both judge a record they did not write, so this is
    the shared entrypoint rather than one use case reaching into the other.
    """
    validate_record(record, prepared.binding, invalid='RESPONSE_MISMATCH', command_invalid='INVALID_REQUEST')
    original = await candidates.require(record['candidateRef'], prepared)
    document = record['command']['document']
    require(document_sha256(document) == original['documentSha256'] and
            canonical_json(document) == canonical_json(original['document']))
    validate_terminal_result(record, invalid='RESPONSE_MISMATCH')
    return original


class _TurnScopedService:
    """Gate Lifecycle's internal lookup-to-save await seam without changing legacy users."""
    def __init__(self, service, current, before_save=None):
        self.service, self.current, self.before_save = service, current, before_save

    def __getattr__(self, name):
        return getattr(self.service, name)

    async def lookup(self, identity, command):
        await self.current()
        return await self.service.lookup(identity, command)

    async def save(self, identity, command):
        await self.current()
        if self.before_save is not None: await self.before_save()
        return await self.service.save(identity, command)

    async def read(self, identity, ref):
        await self.current()
        return await self.service.read(identity, ref)


class AuthoringSubmissionCoordinator:
    """Requires a program port whose store tokens are loadable for this identity.

    The legacy input/output file spool does not implement this round-trip contract.
    """
    def __init__(self, candidates: CandidateReader | None, records: ExecutionRecordPort | None,
                 turns: AuthoringTurnGate, lifecycle: Lifecycle | None, *,
                 operation_id=None, skill_version='metriccanvas-platform-authoring/1.0'):
        self.candidates, self.records, self.turns, self.lifecycle = candidates, records, turns, lifecycle
        self.operation_id = operation_id or (lambda: str(uuid4()))
        self.skill_version = skill_version

    async def _current(self, prepared, identity):
        await self.turns.unchanged(prepared, write=True)
        self.lifecycle.still_current(identity)

    def _result(self, record, status, **extra):
        return {'status': status, 'candidateRef': record['candidateRef'],
                'operationId': record['operationId'], **extra}

    async def _update(self, key, record, status, result=None):
        updated = deepcopy(record)
        updated['status'], updated['result'] = status, deepcopy(result)
        await self.records.update(key, deepcopy(updated))
        record.update(updated)

    async def _verify_saved(self, response, record, candidate, prepared, identity):
        command = record['command']
        # Reuse Lifecycle receipt validation, then independently read its exact revision.
        if self.lifecycle.service.capabilities.single_save:
            envelope = await self.lifecycle.programs.load(response['programToken'], identity)
            require(envelope.get('context') == command['context'] and envelope.get('base') == command['base'])
            receipt = self.lifecycle.saved(envelope['receipt'], command)
            require(receipt['ref'] == response.get('ref'))
            await self._current(prepared, identity)
            return self._result(record, 'saved', ref=deepcopy(receipt['ref']), programToken=response['programToken'])
        receipt = self.lifecycle.saved(response, command)
        require(receipt['status'] == 'saved')
        base = command['base']
        require(base is None or receipt['ref']['resourceId'] == base['resourceId'])
        await self._current(prepared, identity)
        token = await self.lifecycle.programs.store({'kind': 'read', 'ref': receipt['ref']}, identity)
        await self._current(prepared, identity)
        scoped = Lifecycle(_TurnScopedService(self.lifecycle.service, lambda: self._current(prepared, identity)),
                           self.lifecycle.programs, self.lifecycle.identities)
        read = await scoped.call('read_revision', token)
        await self._current(prepared, identity)
        require(read.get('status') == 'read' and read.get('ref') == receipt['ref'])
        document = await self.lifecycle.programs.load(read['programToken'], identity)
        await self._current(prepared, identity)
        require(document.get('ref') == receipt['ref'] and
                document_sha256(document.get('document')) == candidate['documentSha256'] and
                semantic_equal(document['document'], command['document']))
        return self._result(record, 'saved', ref=deepcopy(receipt['ref']))

    async def _outcome(self, response, key, record, candidate, prepared, identity):
        await self._current(prepared, identity)
        require(isinstance(response, dict))
        status = response.get('status')
        require(response.get('operationId') == record['operationId'])
        if status == 'saved':
            result = await self._verify_saved(response, record, candidate, prepared, identity)
        elif status in {'unknown', 'pending', 'rejected', 'not-applied'}:
            result = self._result(record, status)
            if status == 'rejected': result['code'] = response.get('code', 'SERVICE_REJECTED')
        else:
            raise LifecycleError('RESPONSE_MISMATCH')
        await self._current(prepared, identity)
        await self._update(key, record, result['status'], result)
        await self._current(prepared, identity)
        return result

    async def finalize(self, context_ref, candidate_ref, *, description, retain_dimension_values):
        require(self.candidates is not None and self.records is not None and self.lifecycle is not None and
                self.lifecycle.programs is not None, 'CAPABILITY_UNAVAILABLE')
        caps = self.lifecycle.service.capabilities
        require(caps.single_save or caps.stable_save and caps.operation_lookup and caps.exact_read, 'CAPABILITY_UNAVAILABLE')
        prepared = await self.turns.require(context_ref, write=True)
        identity = self.lifecycle.identity()
        binding = prepared.binding
        require((identity.actor_id, identity.workspace_id) == (binding['actorId'], binding['workspaceId']), 'FORBIDDEN')
        candidate = await self.candidates.require(candidate_ref, prepared)
        await self._current(prepared, identity)
        command = {'kind': 'save', 'context': {'operationId': self.operation_id(),
            'actorId': binding['actorId'], 'workspaceId': binding['workspaceId'],
            'origin': {'kind': 'relay', 'skillVersion': self.skill_version, 'runId': binding['runId']}},
            'pageId': binding['pageId'], 'base': deepcopy(binding['baseRef']),
            'document': deepcopy(candidate['document']), 'description': description,
            'retainDimensionValues': retain_dimension_values}
        require(VALIDATOR.is_valid(command), 'INVALID_REQUEST')
        no_change = prepared.baseline is not None and semantic_equal(candidate['document'], prepared.baseline.document)
        proposed = {'candidateRef': candidate_ref, 'rootBinding': deepcopy(dict(binding)),
                    'operationId': command['context']['operationId'], 'command': command,
                    'programToken': None, 'status': 'unchanged' if no_change else 'selected', 'result': None}
        if no_change: proposed['result'] = self._result(proposed, 'unchanged')
        key = tuple(binding[k] for k in ('actorId', 'workspaceId', 'runId', 'turnId', 'pageId'))
        record, created = await self.records.claim(key, deepcopy(proposed))
        record = deepcopy(record)
        require(type(created) is bool and (not created or record == proposed))
        candidate = await validate_submission_record(record, prepared, self.candidates)
        await self._current(prepared, identity)
        if record['status'] in {'saved', 'rejected', 'not-applied', 'unchanged'}:
            require(isinstance(record['result'], dict) and record['result'].get('status') == record['status'])
            return deepcopy(record['result'])
        if not created and (record['status'] in {'selected', 'sending'} or not record['programToken']):
            return self._result(record, 'pending' if record['status'] == 'sending' else 'unknown')
        try:
            if created:
                token = await self.lifecycle.programs.store(deepcopy(record['command']), identity)
                require(isinstance(token, str) and bool(token), 'PROGRAM_TOKEN_INVALID')
                record['programToken'] = token
                await self._update(key, record, 'selected')
                await self._current(prepared, identity)
                await self._update(key, record, 'sending')
                await self._current(prepared, identity)
            await self._current(prepared, identity)
            loaded = await self.lifecycle.programs.load(record['programToken'], identity)
            require(canonical_json(loaded) == canonical_json(record['command']), 'PROGRAM_TOKEN_INVALID')
            await self._current(prepared, identity)
            async def persisted_send_permission():
                get = getattr(self.records, 'get', None)
                if callable(get):
                    snapshot = await get(key)
                    require(snapshot is not None and not snapshot['control']['cancelRequested'], 'EXECUTION_CANCELLED')
                    require(snapshot['record']['operationId'] == record['operationId'] and
                            canonical_json(snapshot['record']['command']) == canonical_json(record['command']))
                    await self._current(prepared, identity)
            scoped = Lifecycle(_TurnScopedService(self.lifecycle.service, lambda: self._current(prepared, identity), persisted_send_permission),
                               self.lifecycle.programs, self.lifecycle.identities, allow_single_submit=created)
            # Duplicates can only query the frozen operation. No automatic resubmission.
            response = await scoped.call('save_draft' if created else 'get_save_result', record['programToken'])
            return await self._outcome(response, key, record, candidate, prepared, identity)
        except asyncio.CancelledError:
            result = self._result(record, 'unknown')
            await asyncio.shield(self._update(key, record, 'unknown', result))
            raise
        except Exception:
            result = self._result(record, 'unknown')
            try:
                await self._update(key, record, 'unknown', result)
            except Exception:
                # Failure to record an outcome must never create another save command.
                pass
            return result
