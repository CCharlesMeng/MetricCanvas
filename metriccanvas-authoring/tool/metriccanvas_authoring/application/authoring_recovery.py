"""Recover frozen operations without reviving an old model turn's authority."""
from copy import deepcopy
from typing import Protocol

from .authoring_submission import validate_submission_record
from .authoring_turns import PreparedAuthoringTurn, TURN_VALIDATOR
from .edit_page import document_sha256
from .lifecycle import Lifecycle, require
from .lifecycle_ports import LifecycleError
from metriccanvas_authoring.domain.canonical import canonical_json, canonical_sha256


class RecoveryAuthorityPort(Protocol):
    async def authorize(self, root_binding: dict, command: dict) -> None:
        """Authenticate current access to this original page/operation, even after cancel."""
        ...


class _RecoveryService:
    def __init__(self, owner, key):
        self.owner, self.key = owner, key

    def __getattr__(self, name):
        return getattr(self.owner.lifecycle.service, name)

    async def lookup(self, identity, command):
        await self.owner._load(self.key)
        return await self.owner.lifecycle.service.lookup(identity, command)

    async def save(self, identity, command):
        snapshot = await self.owner._load(self.key)
        require(not snapshot['control']['cancelRequested'] and snapshot['record']['status'] == 'sending', 'EXECUTION_CANCELLED')
        require(not self.owner._expired(snapshot), 'EXECUTION_BUDGET_EXHAUSTED')
        require(canonical_json(command) == canonical_json(snapshot['record']['command']), 'RESPONSE_MISMATCH')
        return await self.owner.lifecycle.service.save(identity, command)

    async def read(self, identity, ref):
        await self.owner._load(self.key)
        return await self.owner.lifecycle.service.read(identity, ref)


class AuthoringRecoveryCoordinator:
    def __init__(self, candidates, records, lifecycle, authority: RecoveryAuthorityPort | None, *, clock_ms):
        self.candidates, self.records, self.lifecycle, self.authority = candidates, records, lifecycle, authority
        self.clock_ms = clock_ms

    def _expired(self, snapshot):
        deadline = snapshot['control']['deadlineEpochMs']
        return deadline is not None and self.clock_ms() >= deadline

    async def _authorize(self, snapshot):
        require(self.authority is not None, 'CAPABILITY_UNAVAILABLE')
        identity = self.lifecycle.identity()
        record = snapshot['record']
        require((identity.actor_id, identity.workspace_id) ==
                (record['rootBinding']['actorId'], record['rootBinding']['workspaceId']), 'FORBIDDEN')
        await self.authority.authorize(deepcopy(record['rootBinding']), deepcopy(record['command']))
        self.lifecycle.still_current(identity)
        return identity

    async def _load(self, key):
        require(self.records is not None and callable(getattr(self.records, 'get', None)) and
                callable(getattr(self.records, 'compare_and_swap', None)) and self.lifecycle is not None and self.authority is not None,
                'CAPABILITY_UNAVAILABLE')
        snapshot = deepcopy(await self.records.get(key))
        require(isinstance(snapshot, dict) and snapshot.get('formatVersion') == '1.0', 'EXECUTION_FORMAT_UNSUPPORTED')
        record = snapshot['record']; binding = record['rootBinding']
        require(TURN_VALIDATOR.is_valid(binding), 'INVALID_REQUEST')
        require(tuple(key) == tuple(binding[k] for k in ('actorId', 'workspaceId', 'runId', 'turnId', 'pageId')), 'FORBIDDEN')
        require(snapshot['commandSha256'] == canonical_sha256(record['command']))
        await self._authorize(snapshot)
        await validate_submission_record(record, PreparedAuthoringTurn(binding, None), self.candidates)
        await self._authorize(snapshot)
        return snapshot

    def _result(self, snapshot, status=None, **fields):
        record = snapshot['record']
        return {'status': status or record['status'], 'operationId': record['operationId'],
                'candidateRef': record['candidateRef'], **fields}

    async def _change(self, key, transform):
        for _ in range(8):
            snapshot = await self._load(key)
            replacement = deepcopy(snapshot)
            transform(replacement)
            await self._authorize(snapshot)
            try:
                return await self.records.compare_and_swap(key, snapshot['recordVersion'], replacement)
            except Exception as error:
                if getattr(error, 'code', str(error)) != 'EXECUTION_VERSION_CONFLICT': raise
        raise LifecycleError('EXECUTION_VERSION_CONFLICT')

    async def reserve_attempt(self, key, attempt_id):
        require(isinstance(attempt_id, str) and 0 < len(attempt_id) <= 256, 'INVALID_REQUEST')
        snapshot = await self._load(key)
        created = False
        def reserve(value):
            nonlocal created
            control = value['control']
            if self._expired(value) or (attempt_id not in control['attemptIds'] and len(control['attemptIds']) >= control['maxAttempts']):
                raise LifecycleError('EXECUTION_BUDGET_EXHAUSTED')
            created = attempt_id not in control['attemptIds']
            if created: control['attemptIds'].append(attempt_id)
        try:
            reserved = await self._change(key, reserve)
            return self._result(reserved, 'reserved', created=created)
        except LifecycleError as error:
            if error.code != 'EXECUTION_BUDGET_EXHAUSTED': raise
            return self._result(snapshot, 'budget-exhausted')

    def _known_result(self, snapshot):
        if snapshot['saveReceipt'] is not None:
            return self._result(snapshot, 'saved' if snapshot['verificationState'] == 'verified' else 'saved-unverified',
                                ref=deepcopy(snapshot['saveReceipt']['ref']), previewState=snapshot['previewState'])
        result = snapshot['record']['result'] or {}
        return self._result(snapshot, **({'ref': deepcopy(result['ref']), 'previewState': snapshot['previewState']}
            if snapshot['record']['status'] == 'saved' and 'ref' in result else {}))

    async def cancel(self, key):
        snapshot = await self._change(key, lambda value: value['control'].update(cancelRequested=True))
        return self._result(snapshot, 'cancelled', pending=snapshot['record']['status'] in {'sending', 'pending', 'unknown'})

    async def _token(self, key, snapshot):
        token = snapshot['record']['programToken']
        identity = await self._authorize(snapshot)
        if token is None and snapshot['record']['status'] == 'selected':
            # Recover the claim-before-store crash window, never replace an existing token.
            try:
                first = await self.lifecycle.programs.store(deepcopy(snapshot['record']['command']), identity)
                require(isinstance(first, str) and bool(first), 'PROGRAM_TOKEN_INVALID')
                loaded = await self.lifecycle.programs.load(first, identity)
                require(canonical_json(loaded) == canonical_json(snapshot['record']['command']), 'PROGRAM_TOKEN_INVALID')
            except Exception:
                raise LifecycleError('PROGRAM_UNAVAILABLE') from None
            def install(value):
                if value['record']['programToken'] is None:
                    require(value['record']['status'] == 'selected', 'PROGRAM_UNAVAILABLE')
                    value['record']['programToken'] = first
            snapshot = await self._change(key, install)
            token = snapshot['record']['programToken']
            identity = await self._authorize(snapshot)
        require(isinstance(token, str) and bool(token), 'PROGRAM_UNAVAILABLE')
        try: command = await self.lifecycle.programs.load(token, identity)
        except Exception: raise LifecycleError('PROGRAM_UNAVAILABLE') from None
        require(canonical_json(command) == canonical_json(snapshot['record']['command']), 'PROGRAM_TOKEN_INVALID')
        await self._load(key)
        return token

    def _lifecycle(self, key):
        return Lifecycle(_RecoveryService(self, key), self.lifecycle.programs, self.lifecycle.identities)

    async def _record_result(self, key, result, expected_version):
        applied = False
        def update(value):
            nonlocal applied
            applied = value['recordVersion'] == expected_version
            if not applied: return
            if value['saveReceipt'] is not None or value['record']['status'] in {'saved', 'rejected', 'unchanged'}: return
            value['record']['status'] = result['status']; value['record']['result'] = deepcopy(result)
        current = await self._change(key, update)
        return current, applied

    async def _verify(self, key):
        snapshot = await self._load(key)
        receipt = snapshot['saveReceipt']
        require(receipt is not None)
        try:
            identity = await self._authorize(snapshot)
            token = await self.lifecycle.programs.store({'kind': 'read', 'ref': deepcopy(receipt['ref'])}, identity)
            await self._load(key)
            read = await self._lifecycle(key).call('read_revision', token)
            await self._load(key)
            require(read.get('status') == 'read' and read.get('ref') == receipt['ref'])
            envelope = await self.lifecycle.programs.load(read['programToken'], identity)
            current = await self._load(key)
            command = current['record']['command']
            require(envelope.get('ref') == receipt['ref'] and
                    canonical_json(envelope.get('document')) == canonical_json(command['document']))
            candidate = await self.candidates.require(current['record']['candidateRef'], PreparedAuthoringTurn(current['record']['rootBinding'], None))
            require(document_sha256(envelope['document']) == candidate['documentSha256'])
            def verified(value):
                require(value['saveReceipt']['ref'] == receipt['ref'])
                value['verificationState'] = 'verified'
                value['record']['status'] = 'saved'
                value['record']['result'] = self._result(value, 'saved', ref=deepcopy(receipt['ref']))
            current = await self._change(key, verified)
            await self._authorize(current)
            return self._result(current, 'saved', ref=deepcopy(receipt['ref']), previewState=current['previewState'])
        except Exception:
            # Never expose a saved reference after current read permissions were lost.
            current = await self._load(key)
            return self._result(current, 'saved' if current['verificationState'] == 'verified' else 'saved-unverified',
                                ref=deepcopy(current['saveReceipt']['ref']), previewState=current['previewState'])

    async def _consume(self, key, response, expected_version):
        snapshot = await self._load(key)
        command = snapshot['record']['command']
        result = self.lifecycle.saved(response, command)
        if result['status'] == 'rejected':
            # Lifecycle transport/permission rejection is not proof an older write never happened.
            return self._result(snapshot, 'unknown', code=result.get('code', 'RECOVERY_UNAVAILABLE'))
        if result['status'] == 'saved':
            require(command['base'] is None or result['ref']['resourceId'] == command['base']['resourceId'])
            def receipt(value):
                if value['saveReceipt'] is not None: require(value['saveReceipt'] == result)
                value['saveReceipt'] = deepcopy(result)
                if value['record']['status'] != 'saved':
                    value['record']['status'] = 'unknown'
                    value['record']['result'] = self._result(value, 'unknown')
            await self._change(key, receipt)
            return await self._verify(key)
        summary = self._result(snapshot, result['status'])
        if result['status'] == 'not-applied': summary['retrySafe'] = result['retrySafe']
        if result['status'] == 'rejected': summary['code'] = result['code']
        current, applied = await self._record_result(key, summary, expected_version)
        if current['saveReceipt'] is not None: return await self._verify(key)
        if not applied: return self._known_result(current) if current['record']['status'] in {'saved', 'rejected', 'unchanged'} else self._result(current, 'unknown')
        return self._result(current, **({'retrySafe': current['record']['result']['retrySafe']}
            if current['record']['status'] == 'not-applied' and 'retrySafe' in (current['record']['result'] or {}) else {}))

    async def recover(self, key, attempt_id):
        if self.lifecycle.service.capabilities.single_save:
            snapshot = await self._load(key)
            await self._authorize(snapshot)
            if snapshot['record']['status'] in {'saved', 'rejected', 'unchanged'}:
                return deepcopy(snapshot['record']['result'])
            return self._result(snapshot, 'unknown', code='MANUAL_RECONCILIATION_REQUIRED')
        reservation = await self.reserve_attempt(key, attempt_id)
        if reservation['status'] == 'budget-exhausted': return reservation
        snapshot = await self._load(key)
        if not reservation['created']: return self._known_result(snapshot)
        if snapshot['saveReceipt'] is not None: return await self._verify(key)
        if snapshot['record']['status'] in {'unchanged', 'rejected'}: return self._result(snapshot)
        try:
            token = await self._token(key, snapshot)
            queried = await self._load(key)
            response = await self._lifecycle(key).call('get_save_result', token)
            return await self._consume(key, response, queried['recordVersion'])
        except Exception as error:
            current = await self._load(key)
            if current['saveReceipt'] is not None: return await self._verify(key)
            return self._result(current, 'unavailable' if getattr(error, 'code', '') in {'PROGRAM_UNAVAILABLE', 'PROGRAM_TOKEN_INVALID'} else 'unknown',
                                code=getattr(error, 'code', 'RECOVERY_UNAVAILABLE'))

    async def retry_original(self, key, attempt_id):
        reservation = await self.reserve_attempt(key, attempt_id)
        if reservation['status'] == 'budget-exhausted': return reservation
        snapshot = await self._load(key)
        if not reservation['created']: return self._known_result(snapshot)
        require(not snapshot['control']['cancelRequested'], 'EXECUTION_CANCELLED')
        caps = self.lifecycle.service.capabilities
        require(caps.stable_save and caps.operation_lookup and caps.exact_read, 'CAPABILITY_UNAVAILABLE')
        token = await self._token(key, snapshot)
        queried = await self._load(key)
        prior = await self._lifecycle(key).call('get_save_result', token)
        result = await self._consume(key, prior, queried['recordVersion'])
        if result['status'] != 'not-applied' or result.get('retrySafe') is not True: return result
        def sending(value):
            require(not value['control']['cancelRequested'], 'EXECUTION_CANCELLED')
            require(value['record']['status'] == 'not-applied' and value['record']['result'].get('retrySafe') is True)
            require(not self._expired(value), 'EXECUTION_BUDGET_EXHAUSTED')
            value['record']['status'] = 'sending'; value['record']['result'] = None
        sent = await self._change(key, sending)
        try:
            response = await self._lifecycle(key).call('save_draft', token)
            return await self._consume(key, response, sent['recordVersion'])
        except Exception:
            current = await self._load(key)
            return self._result(current, 'unknown')

    async def retry_preview(self, key, attempt_id, preview):
        reservation = await self.reserve_attempt(key, attempt_id)
        if reservation['status'] == 'budget-exhausted': return reservation
        snapshot = await self._load(key)
        if not reservation['created']: return self._known_result(snapshot)
        require(snapshot['saveReceipt'] is not None, 'SAVED_REVISION_REQUIRED')
        if snapshot['verificationState'] != 'verified':
            result = await self._verify(key)
            if result['status'] != 'saved': return result
        snapshot = await self._load(key)
        try:
            await self._authorize(snapshot)
            await preview(deepcopy(snapshot['saveReceipt']['ref']), deepcopy(snapshot['record']['command']['document']))
            state = 'ready'
        except Exception:
            state = 'failed'
        current = await self._change(key, lambda value: value.update(previewState=state))
        return self._result(current, 'saved', ref=deepcopy(current['saveReceipt']['ref']), previewState=state)
