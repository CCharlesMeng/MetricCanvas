"""Platform v2: one work document, internal single-save, referenced data only."""
from copy import deepcopy
from dataclasses import replace
from uuid import uuid4
import asyncio
from metriccanvas_authoring.work.authoring_turns import AuthoringTurnGate, PreparedAuthoringTurn, read_page_projection
from metriccanvas_authoring.work.content_ports import ContentBaseline, ContentBaselineError
from metriccanvas_authoring.pages.editing.edit_page import document_sha256
from metriccanvas_authoring.data.discover_data_context import create_discover_data_context, DiscoverDataContextDependencies, DiscoverDataContextCommand
from metriccanvas_authoring.application.summary_capability import summary_configured
from metriccanvas_authoring.work.state import TurnState, Limits, require, digest
from metriccanvas_authoring.data.results import QueryResults
from metriccanvas_authoring.assets.drafts import DraftSaver
from metriccanvas_authoring.delivery.preview import definition, artifact, prepare_preview
from metriccanvas_authoring.pages.referenced import compose, edit


class PlatformAuthoring:
    def __init__(self, dependencies, current_turns, store, *, analysis_authorization=None,
                 lifecycle_service=None, lifecycle_identities=None, relay_preview=None,
                 limits=Limits(), summary_config=None, semantic_catalog=None):
        self.dependencies, self.gate = dependencies, AuthoringTurnGate(current_turns)
        self.state = TurnState(store, limits)
        self.results = QueryResults(dependencies, self.state, analysis_authorization, semantic_catalog)
        self.saver = DraftSaver(store, lifecycle_service, lifecycle_identities)
        self.relay_preview, self.summary_config = relay_preview, summary_config
        self.semantic_catalog = semantic_catalog

    async def prepare(self, context_ref, write=False):
        prepared = await self.gate.require(context_ref, write=write)
        await self.state.consume(prepared)
        return prepared

    def current(self, prepared, write=False):
        async def check():
            await self.gate.unchanged(prepared, write=write)
            await self.state.remaining(prepared)
        return check

    async def discover(self, context_ref, query, limit=10, detail_refs=None):
        prepared = await self.prepare(context_ref)
        if self.semantic_catalog is not None:
            result = await self.semantic_catalog.discover(dict(prepared.binding), query, limit, detail_refs or [])
        else:
            require(not detail_refs, 'METRIC_DETAIL_UNAVAILABLE')
            found = await create_discover_data_context(DiscoverDataContextDependencies(self.dependencies.data_context,
                business_interpretation=self.dependencies.business_interpretation))(DiscoverDataContextCommand(query, limit))
            result = {'ok': found.ok, 'dataContextVersion': found.data_context_version,
                'businessDomains': list(found.business_domains), 'matches': list(found.matches),
                'issues': [{'code': i.code, 'path': i.path} for i in found.issues]}
        await self.current(prepared)()
        return result

    async def query(self, context_ref, request=None, result_ref=None):
        prepared = await self.prepare(context_ref)
        require((request is None) != (result_ref is None), 'QUERY_INPUT_INVALID')
        if result_ref is not None:
            return await self.results.read(prepared, result_ref, self.current(prepared))
        return await self.results.execute(prepared, request, self.current(prepared))

    async def read(self, context_ref, **options):
        prepared = await self.prepare(context_ref)
        _, work = await self.state.read(prepared)
        document = work['document']
        projected = prepared
        if document is not None:
            projected = PreparedAuthoringTurn({**prepared.binding, 'workVersion': work['workVersion'], 'baseRef': work['base']}, ContentBaseline(work['base'], document, document_sha256(document)))
        result = read_page_projection(projected, **options)
        # Projection cursors must also bind the evolving work revision.
        result.update(workVersion=work['workVersion'], saveStatus=(work['lastResult'] or {}).get('saveStatus', 'not_requested'),
                      busy=work['active'] is not None, ref=deepcopy(work['base']))
        result['documentSha256'] = document_sha256(document) if document else None
        await self.current(prepared)()
        return result

    async def mutate(self, kind, context_ref, request, expected_version=0):
        request = deepcopy(request)
        prepared = await self.prepare(context_ref, write=True)
        require(kind != 'compose' or prepared.binding['mode'] == 'new', 'CURRENT_TURN_MODE_MISMATCH')
        require(self.saver.service is not None and self.saver.identities is not None and self.saver.service.capabilities.single_save, 'SAVE_CAPABILITY_UNAVAILABLE')
        request_hash = digest([kind, request, expected_version])
        version, work, cached = await self.state.reserve(prepared, expected_version, request_hash)
        if cached is not None:
            await self.current(prepared, True)()
            return cached, deepcopy(work['artifact']) if work['artifact'] and cached.get('artifactRef') == work['artifact']['artifactRef'] else None
        try:
            await self.state.consume(prepared, 'mutations')
            if kind == 'compose':
                require(work['document'] is None, 'WORK_ALREADY_CREATED')
                from jsonschema import Draft202012Validator
                from metriccanvas_authoring.pages.referenced import COMPOSE_SCHEMA
                require(Draft202012Validator(COMPOSE_SCHEMA).is_valid(request), 'COMPOSE_REQUEST_INVALID')
                records = {}
                for source_id, ref in request['sources'].items():
                    record = await self.results.require(prepared, ref, self.current(prepared, True), usable=False)
                    records[source_id] = record if record['status'] in {'ready', 'empty'} else None
                edited = compose(prepared, request, records)
            else:
                require(work['document'] is not None, 'CURRENT_TURN_BASELINE_REQUIRED')
                edited = await edit(work['document'], request,
                    lambda ref: self.results.require(prepared, ref, self.current(prepared, True)),
                    self.current(prepared, True), summary_enabled=summary_configured(self.summary_config))
            await self.current(prepared, True)()
            summary = {k: edited[k] for k in ('status', 'operations', 'issues')}
            summary.update(saveStatus='not_requested', workVersion=work['workVersion'])
            preview = edited['document']
            if preview is None or work['document'] is not None and definition(preview) == definition(work['document']):
                if preview is not None: summary['status'] = 'unchanged'
                await self.state.finish(prepared, version, work, request_hash, summary)
                return summary, None
            operation = str(uuid4())
            work.update(document=deepcopy(preview), workVersion=work['workVersion'] + 1,
                        submission={'operationId': operation, 'requestHash': request_hash, 'summary': deepcopy(summary)})
            # Freeze the work before crossing the remote save seam.
            require(await self.state.store.compare_and_swap('work', self.state.key(prepared), version, work), 'WORK_VERSION_CONFLICT')
            version += 1
            receipt = await self.saver.save(prepared, definition(preview), work['base'],
                preview.get('meta', {}).get('description', ''), operation, self.current(prepared, True))
            summary.update(saveStatus=receipt['status'], operationId=operation, workVersion=work['workVersion'])
            if receipt['status'] == 'saved':
                work['base'] = deepcopy(receipt['ref'])
                work['artifact'] = artifact(prepared, preview, receipt, operation)
                summary.update(draftId=receipt['ref']['resourceId'], ref=deepcopy(receipt['ref']), artifactRef=work['artifact']['artifactRef'])
            else:
                work['artifact'] = None
                summary['saveCode'] = receipt.get('code', 'SAVE_' + receipt['status'].upper())
            await self.state.finish(prepared, version, work, request_hash, summary)
            await self.current(prepared, True)()
            return summary, deepcopy(work['artifact'])
        except BaseException:
            # If a frozen submission exists it remains the only possible attempt.
            # A crashed/in-flight call is never unlocked by starting another save.
            if work.get('submission') is None:
                failure = {'status': 'failed', 'saveStatus': 'not_requested', 'workVersion': work['workVersion'],
                           'issues': [{'code': 'WORK_OPERATION_FAILED', 'path': ''}]}
                await asyncio.shield(self.state.finish(prepared, version, work, request_hash, failure))
            raise

    async def recover(self, context_ref):
        """Program-only recovery: no candidate reads and no save/retry calls."""
        prepared = await self.prepare(context_ref, write=True)
        version, work = await self.state.read(prepared)
        if work['active'] is None:
            return deepcopy(work['lastResult'])
        submission = work.get('submission')
        require(submission is not None, 'WORK_INTERRUPTED_BEFORE_SUBMISSION')
        receipt = await self.saver.recover(prepared, submission['operationId'])
        summary = {**submission['summary'], 'saveStatus': receipt['status'], 'operationId': submission['operationId'], 'workVersion': work['workVersion']}
        if receipt['status'] == 'saved':
            work['base'] = deepcopy(receipt['ref'])
            work['artifact'] = artifact(prepared, work['document'], receipt, submission['operationId'])
            summary.update(draftId=receipt['ref']['resourceId'], ref=deepcopy(receipt['ref']), artifactRef=work['artifact']['artifactRef'])
            await self.state.finish(prepared, version, work, submission['requestHash'], summary)
        await self.current(prepared, True)()
        return summary

    async def preview(self, context_ref, artifact_ref):
        prepared = await self.prepare(context_ref)
        _, work = await self.state.read(prepared)
        require(work['active'] is None, 'WORK_BUSY')
        result = await prepare_preview(self.relay_preview, prepared, work['artifact'], artifact_ref)
        await self.current(prepared)()
        return result
