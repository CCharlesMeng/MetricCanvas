"""Parameter workflow: trusted sources in, bounded summaries and program artifacts out.

No page execution, asset writes or human-confirmation authority live here.
Stores must be immutable and durable; references expire and remain scoped to a turn.
"""
from metriccanvas_authoring.pages.validation.grouped_params import declarations as _param_declarations, clear_values
from copy import deepcopy
from dataclasses import dataclass
import time
from typing import Protocol, Callable
from uuid import uuid4

from metriccanvas_authoring.work.authoring_turns import AuthoringTurnGate
from metriccanvas_authoring.work.state import TurnState, require
from metriccanvas_authoring.work.content_ports import ContentBaselineError
from metriccanvas_authoring.pages.editing.edit_page import document_sha256
from .parameter_preparation import ParameterProgram, prepare_page_parameters
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document


class VerifiedParameterContext(Protocol):
    async def verify(self, prepared, document: dict, artifact_ref: str | None) -> dict:
        """Prove exact DQE-verified source; return sourceSha256, baseline, dimensionIdentities.

        Hash alone is not evidence. Implementations must consult their verification
        records, enforce current authorization and bind the exact supplied document.
        """
        ...


class ParameterRecordStore(Protocol):
    async def put(self, record: dict) -> None:
        """Atomically insert by ref; reject replacement, preserve expiry and binding."""
        ...

    async def get(self, ref: str) -> dict | None: ...


@dataclass(frozen=True)
class ParameterDependencies:
    program: ParameterProgram
    store: ParameterRecordStore
    verified_context: VerifiedParameterContext | None = None
    clock: Callable[[], float] = time.time
    ttl_seconds: int = 1800


def parameter_summary(document):
    """Declaration-only projection. Values and defaults never leak via context reads."""
    return [{**{k: p[k] for k in ('id', 'type', 'label', 'multiple', 'granularity') if k in p},
             'required': p.get('required', True), 'hasValue': 'value' in p or 'default' in p}
            for p in _param_declarations(document)]


class PageParameters:
    def __init__(self, gate: AuthoringTurnGate, state: TurnState,
                 dependencies: ParameterDependencies | None):
        self.gate, self.state, self.deps = gate, state, dependencies

    def available(self):
        if self.deps is None:
            raise ContentBaselineError('PARAMETER_CAPABILITY_UNAVAILABLE')
        if not 1 <= self.deps.ttl_seconds <= 86400:
            raise ContentBaselineError('PARAMETER_CONFIGURATION_INVALID')

    async def prepare(self, context_ref, write=False):
        self.available()
        prepared = await self.gate.require(context_ref, write=write)
        await self.state.consume(prepared)
        return prepared

    async def source(self, prepared, artifact_ref):
        require(self.state.store is not None, 'WORK_STORE_UNAVAILABLE')
        _, work = await self.state.read(prepared)
        require(work['active'] is None, 'WORK_BUSY')
        if artifact_ref is not None:
            if artifact_ref.startswith('template-'):
                record = await self.require(artifact_ref, 'template', prepared)
                return deepcopy(record['payload']['document'])
            value = work['artifact']
            require(value is not None and value['artifactRef'] == artifact_ref, 'PARAMETER_REFERENCE_INVALID')
            return deepcopy(value['previewJson'])
        require(work['document'] is not None, 'CURRENT_TURN_BASELINE_REQUIRED')
        return deepcopy(work['document'])

    async def program(self, request):
        try:
            result = await self.deps.program.prepare(deepcopy(request))
            if not isinstance(result, dict) or type(result.get('ok')) is not bool:
                raise ValueError()
            return result
        except ContentBaselineError:
            raise
        except Exception:
            raise ContentBaselineError('PARAMETER_PROGRAM_UNAVAILABLE') from None

    async def put(self, kind, prepared, payload):
        await self.state.remaining(prepared)
        record = {'ref': kind + '-' + uuid4().hex, 'kind': kind,
                  'binding': deepcopy(dict(prepared.binding)),
                  'expiresAt': self.deps.clock() + self.deps.ttl_seconds,
                  'payload': deepcopy(payload)}
        record['sha256'] = document_sha256(record)
        await self.gate.unchanged(prepared)
        try:
            await self.deps.store.put(deepcopy(record))
            stored = await self.deps.store.get(record['ref'])
            if stored != record: raise ValueError()
        except Exception:
            raise ContentBaselineError('PARAMETER_STORE_UNAVAILABLE') from None
        await self.gate.unchanged(prepared)
        await self.state.remaining(prepared)
        return record

    async def require(self, ref, kind, prepared):
        try:
            record = deepcopy(await self.deps.store.get(ref))
            if not record or record['ref'] != ref or record['kind'] != kind:
                raise ValueError()
            unsigned = {k: v for k, v in record.items() if k != 'sha256'}
            if document_sha256(unsigned) != record['sha256']:
                raise ValueError()
            if record['binding'] != dict(prepared.binding) or record['expiresAt'] <= self.deps.clock():
                raise ValueError()
            return record
        except Exception:
            raise ContentBaselineError('PARAMETER_REFERENCE_INVALID') from None

    @staticmethod
    def failure(result):
        # Never echo raw exception strings, queries, text, or values from programs.
        allowed = {'INVALID_PAGE', 'UNKNOWN_INPUT', 'MISSING_INPUT', 'INVALID_VALUE',
                   'INVALID_TIME_RULE', 'INVALID_MATERIALIZATION'}
        issues = [{'code': i.get('code') if i.get('code') in allowed else 'PARAMETER_INVALID',
                   **({'param': i['param']} if isinstance(i.get('param'), str) and len(i['param']) <= 128 else {})}
                  for i in result.get('issues', [])[:50] if isinstance(i, dict)]
        return {'ok': False, 'artifactEnvelope': None,
                'modelSummary': {'status': 'rejected', 'issues': issues or [{'code': 'PARAMETER_INVALID'}]}}

    async def extract(self, context_ref, artifact_ref=None):
        self.available()
        prepared = await self.prepare(context_ref)
        document = await self.source(prepared, artifact_ref)
        if self.deps.verified_context is None:
            raise ContentBaselineError('PARAMETER_VERIFICATION_UNAVAILABLE')
        try:
            context = await self.deps.verified_context.verify(prepared, deepcopy(document), artifact_ref)
            if context.get('sourceSha256') != document_sha256(document) or not context.get('baseline'):
                raise ValueError()
        except Exception:
            raise ContentBaselineError('PARAMETER_VERIFICATION_UNAVAILABLE') from None
        context = {k: deepcopy(context[k]) for k in ('baseline', 'dimensionIdentities') if k in context}
        result = await self.program({'action': 'extract', 'document': document, 'context': context})
        await self.state.remaining(prepared)
        await self.gate.unchanged(prepared)
        if not result['ok']: return self.failure(result)
        if result.get('source') != document or result.get('baseline') != context['baseline']:
            raise ContentBaselineError('PARAMETER_PROGRAM_MISMATCH')
        if len(result['candidates']) > 100 or len(result['textSlots']) > 200:
            raise ContentBaselineError('PARAMETER_SIZE_LIMIT')
        # Distinct opaque candidate IDs vs page parameter IDs, even when spelling could coincide.
        ids = {c['id']: f'choice-{i+1}' for i, c in enumerate(result['candidates'])}
        state_version, work = await self.state.read(prepared)
        require(work['active'] is None and await self.source(prepared, artifact_ref) == document, 'PARAMETER_SOURCE_CHANGED')
        record = await self.put('extraction', prepared, {'document': document, 'context': context,
            'stateVersion': state_version, 'workVersion': work['workVersion'],
            'artifactRef': artifact_ref, 'extraction': result, 'candidateIds': ids})
        summary = {'status': 'extracted', 'extraction_ref': record['ref'], 'expiresAt': record['expiresAt'],
            'candidates': [{'candidate_id': ids[c['id']], 'param_id': c['id'],
                **{k: c['declaration'][k] for k in ('type', 'label', 'multiple', 'granularity') if k in c['declaration']},
                'coveredQueries': c['coveredQueries'], 'uncoveredQueries': c['uncoveredQueries'],
                'defaultSelected': c['defaultSelected']} for c in result['candidates']],
            'text_slots': [{'slot_id': s['id'], 'location': s['path'], 'candidate_ids': [ids[c] for c in s['candidates']]}
                           for s in result['textSlots']],
            'skipped': result['skipped'][:100], 'skippedCount': len(result['skipped']), 'valuesOmitted': True}
        return {'ok': True, 'artifactEnvelope': None, 'modelSummary': summary}

    async def apply(self, context_ref, extraction_ref, selected_ids, text_choices):
        self.available()
        prepared = await self.prepare(context_ref, write=True)
        record = await self.require(extraction_ref, 'extraction', prepared)
        data = record['payload']
        source = await self.source(prepared, data['artifactRef'])
        if source != data['document']:
            raise ContentBaselineError('PARAMETER_SOURCE_CHANGED')
        try:
            evidence = await self.deps.verified_context.verify(prepared, deepcopy(source), data['artifactRef'])
            if (evidence.get('sourceSha256') != document_sha256(source) or
                any(evidence.get(k) != data['context'].get(k) for k in ('baseline', 'dimensionIdentities'))):
                raise ValueError()
        except Exception:
            raise ContentBaselineError('PARAMETER_VERIFICATION_UNAVAILABLE') from None
        ids = {v: k for k, v in data['candidateIds'].items()}
        if len(set(selected_ids)) != len(selected_ids) or any(i not in ids for i in selected_ids):
            raise ContentBaselineError('PARAMETER_SELECTION_INVALID')
        selected = [ids[i] for i in selected_ids]
        slots = {s['id']: s for s in data['extraction']['textSlots']}
        replacements, used = {}, set()
        for choice in text_choices:
            slot_id = choice['slot_id']
            slot = slots.get(slot_id)
            if not slot or slot_id in used or not set(slot['candidates']).intersection(selected):
                raise ContentBaselineError('PARAMETER_TEXT_CHOICE_INVALID')
            used.add(slot_id)
            if choice['kind'] == 'parameter':
                param = ids.get(choice['candidate_id'])
                if param not in selected or param not in slot['candidates']:
                    raise ContentBaselineError('PARAMETER_TEXT_CHOICE_INVALID')
                replacements[slot['path']] = {'param': param}
            else:
                replacements[slot['path']] = choice['text']
        try:
            result = await prepare_page_parameters(source, data['context'], self.deps.program,
                                                   selected, replacements)
        except Exception:
            raise ContentBaselineError('PARAMETER_PROGRAM_MISMATCH') from None
        await self.gate.unchanged(prepared, write=True)
        await self.state.remaining(prepared)
        if not result['ok']: return self.failure(result)
        version, work = await self.state.read(prepared)
        require(version == data['stateVersion'] and work['workVersion'] == data['workVersion'] and
                work['active'] is None, 'PARAMETER_SOURCE_CHANGED')
        require(await self.state.store.compare_and_swap('work', self.state.key(prepared), version, work),
                'WORK_VERSION_CONFLICT')
        template = await self.put('template', prepared, {'document': result['artifact']['document'],
            'sourceArtifactRef': data['artifactRef'], 'sourceWorkVersion': work['workVersion'],
            'extractionRef': extraction_ref, 'selectedIds': selected})
        await self.gate.unchanged(prepared, write=True)
        # A prepared template is a program artifact, not an automatic draft save.
        return {'ok': True, 'artifactEnvelope': {'kind': 'metriccanvas.parameter-template',
                'formatVersion': '1.0', 'artifact': template},
                'modelSummary': {'status': 'template_prepared', 'artifact_ref': template['ref'],
                    'selected_ids': selected_ids, 'requiresHumanConfirmation': True, 'saved': False}}

    async def resolve(self, context_ref, values, artifact_ref=None):
        self.available()
        prepared = await self.prepare(context_ref)
        document = await self.source(prepared, artifact_ref)
        result = await self.program({'action': 'resolve', 'document': document, 'suppliedValues': values})
        await self.state.remaining(prepared)
        await self.gate.unchanged(prepared)
        require(await self.source(prepared, artifact_ref) == document, 'PARAMETER_SOURCE_CHANGED')
        if not result['ok']: return self.failure(result)
        filled = result.get('document')
        if not isinstance(filled, dict) or validate_page_document(filled):
            raise ContentBaselineError('PARAMETER_PROGRAM_MISMATCH')
        # Only values may change in the reference document, never queries or layout.
        before, after = deepcopy(document), deepcopy(filled)
        for d in (before, after):
            clear_values(d)
        if before != after or not isinstance(result.get('resolvedPage'), dict):
            raise ContentBaselineError('PARAMETER_PROGRAM_MISMATCH')
        instance = await self.put('instance', prepared, {'document': filled,
            'resolvedPage': result['resolvedPage'], 'effectiveInputs': result['effectiveInputs'],
            'artifactRef': artifact_ref})
        return {'ok': True, 'artifactEnvelope': {'kind': 'metriccanvas.parameter-instance',
            'formatVersion': '1.0', 'artifact': instance},
            'modelSummary': {'status': 'resolved', 'instance_ref': instance['ref'],
                'parameters': parameter_summary(filled), 'valuesOmitted': True,
                'expiresAt': instance['expiresAt'], 'executed': False, 'saved': False}}

    async def read_instance(self, context_ref, instance_ref):
        """Trusted host-only consumption. Recheck live identity/turn/expiry before rendering."""
        self.available()
        prepared = await self.prepare(context_ref)
        record = await self.require(instance_ref, 'instance', prepared)
        await self.gate.unchanged(prepared)
        return deepcopy(record)

    async def read_template(self, context_ref, artifact_ref):
        """Trusted host-only read; publication still requires explicit human confirmation."""
        prepared = await self.prepare(context_ref)
        record = await self.require(artifact_ref, 'template', prepared)
        await self.gate.unchanged(prepared)
        await self.state.remaining(prepared)
        return deepcopy(record)
