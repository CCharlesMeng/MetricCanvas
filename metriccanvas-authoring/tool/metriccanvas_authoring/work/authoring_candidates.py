"""Immutable program-channel candidates, always bound to the original trusted turn."""
from copy import deepcopy
import json
from typing import Protocol
from uuid import uuid4

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from metriccanvas_authoring.work.authoring_turns import PreparedAuthoringTurn
from metriccanvas_authoring.work.content_ports import ContentBaselineError
from metriccanvas_authoring.pages.editing.edit_page import document_sha256
from metriccanvas_authoring.domain.page_validation import validate_page_document
from metriccanvas_authoring.runtime_assets import bundle_root

_CONTRACTS = bundle_root() / 'contracts/authored'
_TURN_SCHEMA = json.loads((_CONTRACTS / 'authoring-turn.schema.json').read_text())
_CANDIDATE_SCHEMA = json.loads((_CONTRACTS / 'authoring-candidate.schema.json').read_text())
_VALIDATOR = Draft202012Validator(_CANDIDATE_SCHEMA, registry=Registry().with_resource(
    _TURN_SCHEMA['$id'], Resource.from_contents(_TURN_SCHEMA)))


class CandidateStorePort(Protocol):
    """put must atomically reject replacement; get must return an isolated copy.

    Implementations own durability. Missing provider is unavailable; an in-memory
    test adapter does not establish restart recovery or authorize production use.
    """
    async def put(self, record: dict) -> None: ...
    async def get(self, candidate_ref: str) -> dict: ...


class AuthoringCandidates:
    def __init__(self, store: CandidateStorePort | None):
        self.store = store

    def ensure_available(self):
        if self.store is None:
            raise ContentBaselineError('CANDIDATE_STORE_UNAVAILABLE')

    async def _store_call(self, method, value):
        self.ensure_available()
        try:
            return deepcopy(await getattr(self.store, method)(deepcopy(value)))
        except ContentBaselineError as error:
            if error.code in {'CANDIDATE_NOT_FOUND', 'CANDIDATE_IMMUTABLE', 'CANDIDATE_STORE_UNAVAILABLE'}:
                raise
            raise ContentBaselineError('CANDIDATE_STORE_UNAVAILABLE') from None
        except Exception:
            # Provider details may include URLs/credentials/full documents. Never
            # allow those exception messages onto the MCP model channel.
            raise ContentBaselineError('CANDIDATE_STORE_UNAVAILABLE') from None

    def _validate(self, record, candidate_ref, prepared):
        try:
            self._validate_record(record, candidate_ref, prepared)
        except ContentBaselineError:
            raise
        except Exception:
            raise ContentBaselineError('CANDIDATE_RECORD_INVALID') from None

    def _validate_record(self, record, candidate_ref, prepared):
        if not _VALIDATOR.is_valid(record):
            raise ContentBaselineError('CANDIDATE_RECORD_INVALID')
        if record['candidateRef'] != candidate_ref or record['rootBinding'] != dict(prepared.binding):
            raise ContentBaselineError('CANDIDATE_BINDING_MISMATCH')
        if record['document'].get('id') != prepared.binding['pageId']:
            raise ContentBaselineError('CANDIDATE_PAGE_MISMATCH')
        if document_sha256(record['document']) != record['documentSha256']:
            raise ContentBaselineError('CANDIDATE_HASH_MISMATCH')
        if validate_page_document(record['document']):
            raise ContentBaselineError('CANDIDATE_DOCUMENT_INVALID')
        if (record['parentRef'] is None) != (record['candidateVersion'] == 1):
            raise ContentBaselineError('CANDIDATE_VERSION_INVALID')

    async def require(self, candidate_ref: str, prepared: PreparedAuthoringTurn) -> dict:
        self.ensure_available()
        record = await self._store_call('get', candidate_ref)
        self._validate(record, candidate_ref, prepared)
        # Verify the immediate immutable predecessor and its version/root. The store
        # contract prevents rewriting previously admitted ancestors.
        if record['parentRef'] is not None:
            parent = await self._store_call('get', record['parentRef'])
            self._validate(parent, record['parentRef'], prepared)
            if parent['candidateVersion'] + 1 != record['candidateVersion']:
                raise ContentBaselineError('CANDIDATE_VERSION_INVALID')
        return record

    async def put(self, prepared: PreparedAuthoringTurn, document: dict, operations: list,
                  parent_ref: str | None = None) -> dict:
        self.ensure_available()
        parent = await self.require(parent_ref, prepared) if parent_ref is not None else None
        try:
            digest = document_sha256(document)
        except Exception:
            raise ContentBaselineError('CANDIDATE_DOCUMENT_INVALID') from None
        record = {'version': '1.0', 'candidateRef': 'candidate-' + uuid4().hex,
                  'candidateVersion': parent['candidateVersion'] + 1 if parent else 1,
                  'parentRef': parent_ref, 'rootBinding': deepcopy(dict(prepared.binding)),
                  'document': deepcopy(document), 'documentSha256': digest,
                  'operations': deepcopy(operations)}
        self._validate(record, record['candidateRef'], prepared)
        await self._store_call('put', record)
        # A broken adapter must not silently acknowledge an altered/dropped write.
        stored = await self.require(record['candidateRef'], prepared)
        if stored != record:
            raise ContentBaselineError('CANDIDATE_STORE_MISMATCH')
        return stored
