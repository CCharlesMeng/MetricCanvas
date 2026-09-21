"""Freeze and send once. Recovery reads the frozen attempt; it never replays it."""
from copy import deepcopy
from uuid import uuid4
import asyncio
from metriccanvas_authoring.application.lifecycle import Lifecycle, VALIDATOR
from metriccanvas_authoring.work.state import require, digest


class DraftSaver:
    def __init__(self, store, service, identities):
        self.store, self.service, self.identities = store, service, identities

    async def save(self, prepared, document, base, description, operation_id, current):
        require(self.service is not None and self.identities is not None and self.service.capabilities.single_save, 'SAVE_CAPABILITY_UNAVAILABLE')
        lifecycle = Lifecycle(self.service, None, self.identities)
        identity = lifecycle.identity()
        binding = prepared.binding
        require((identity.actor_id, identity.workspace_id) == (binding['actorId'], binding['workspaceId']), 'SAVE_IDENTITY_MISMATCH')
        command = {'kind': 'save', 'context': {'operationId': operation_id,
            'actorId': binding['actorId'], 'workspaceId': binding['workspaceId'],
            'origin': {'kind': 'relay', 'skillVersion': 'metriccanvas-platform-authoring/2.0', 'runId': binding['runId']}},
            'pageId': binding['pageId'], 'base': deepcopy(base), 'document': deepcopy(document),
            'description': description, 'retainDimensionValues': True}
        require(VALIDATOR.is_valid(command), 'SAVE_COMMAND_INVALID')
        key = digest([dict(binding), operation_id])
        frozen = {'binding': deepcopy(dict(binding)), 'command': command, 'commandSha256': digest(command), 'status': 'sending', 'receipt': None}
        created = await self.store.compare_and_swap('submission', key, 0, frozen)
        if not created:
            _, record = await self.store.read('submission', key)
            require(record['binding'] == dict(binding) and record['command'] == command, 'SUBMISSION_IMMUTABLE')
            return deepcopy(record['receipt']) if record['receipt'] else {'status': 'unknown', 'operationId': operation_id}
        result = {'status': 'unknown', 'operationId': operation_id}
        try:
            await current()
            lifecycle.still_current(identity)
            response = await self.service.save(identity, deepcopy(command))
            lifecycle.still_current(identity)
            # A valid remote receipt is retained even if the turn becomes stale;
            # callers recheck the turn before publishing any result or preview.
            result = lifecycle.saved(response, command)
        except asyncio.CancelledError:
            frozen.update(status='unknown', receipt=result)
            await asyncio.shield(self.store.compare_and_swap('submission', key, 1, frozen))
            raise
        except Exception:
            pass
        frozen.update(status=result['status'], receipt=deepcopy(result))
        await self.store.compare_and_swap('submission', key, 1, frozen)
        return result

    async def load_submission(self, binding, operation_id):
        _, record = await self.store.read('submission', digest([dict(binding), operation_id]))
        require(record is not None and record['binding'] == dict(binding), 'SUBMISSION_NOT_FOUND')
        require(record['commandSha256'] == digest(record['command']) and VALIDATOR.is_valid(record['command']), 'SUBMISSION_IMMUTABLE')
        require(record['command']['context']['operationId'] == operation_id, 'SUBMISSION_IMMUTABLE')
        return record

    async def recover(self, prepared, operation_id):
        record = await self.load_submission(prepared.binding, operation_id)
        lifecycle = Lifecycle(self.service, None, self.identities)
        identity = lifecycle.identity()
        require((identity.actor_id, identity.workspace_id) == (prepared.binding['actorId'], prepared.binding['workspaceId']), 'SAVE_IDENTITY_MISMATCH')
        return lifecycle.saved(record['receipt'], record['command']) if record['receipt'] else {'status': 'unknown', 'operationId': operation_id}

    async def recover_authorized(self, binding, operation_id, authority):
        """Inspect an old/cancelled turn using the existing recovery authority port."""
        require(authority is not None, 'RECOVERY_AUTHORITY_UNAVAILABLE')
        record = await self.load_submission(binding, operation_id)
        lifecycle = Lifecycle(self.service, None, self.identities)
        identity = lifecycle.identity()
        require((identity.actor_id, identity.workspace_id) == (binding['actorId'], binding['workspaceId']), 'SAVE_IDENTITY_MISMATCH')
        await authority.authorize(deepcopy(binding), deepcopy(record['command']))
        lifecycle.still_current(identity)
        result = lifecycle.saved(record['receipt'], record['command']) if record['receipt'] else {'status': 'unknown', 'operationId': operation_id}
        return {key: deepcopy(value) for key, value in result.items() if key != 'document'}
