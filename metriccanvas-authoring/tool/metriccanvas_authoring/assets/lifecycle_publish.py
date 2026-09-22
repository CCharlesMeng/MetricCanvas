"""Publication orchestration over trusted service and human-event boundaries.

The shared contract is authored by S2. This module does not extract parameters,
issue human proofs, implement service transactions or choose a hash algorithm.
"""
from metriccanvas_authoring.pages.validation.grouped_params import declarations as _param_declarations, clear_values
from copy import deepcopy
from functools import lru_cache
import json
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from metriccanvas_authoring.runtime_assets import bundle_root

from .lifecycle import require
from .lifecycle_ports import LifecycleError
from .publish_ports import PublicationDependencies
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document

ERROR_CODES = {'INVALID_REQUEST', 'INVALID_PAGE', 'UNAUTHENTICATED', 'FORBIDDEN',
    'CAPABILITY_UNAVAILABLE', 'RESPONSE_MISMATCH', 'REVISION_CONFLICT',
    'IDEMPOTENCY_CONFLICT', 'CANDIDATE_EXPIRED', 'CANDIDATE_CHANGED',
    'CONFIRMATION_REQUIRED', 'CONFIRMATION_EXPIRED', 'LEASE_EXPIRED',
    'UNSUPPORTED_EXTRACTION', 'CANDIDATE_INVALID', 'PROGRAM_UNAVAILABLE',
    'PROGRAM_TOKEN_INVALID', 'PROGRAM_NOT_FOUND'}


class Publication:
    def __init__(self, dependencies: PublicationDependencies | None, programs, identities, sources=None):
        self.dependencies = dependencies
        self.programs, self.identities, self.sources = programs, identities, sources

    def identity(self):
        identity = self.identities.current()
        require(all(isinstance(v, str) and v.strip() for v in
                    (identity.actor_id, identity.workspace_id, identity.auth_token)), 'UNAUTHENTICATED')
        return identity

    def current(self, identity):
        require(self.identity() == identity, 'UNAUTHENTICATED')

    @property
    def service(self):
        return self.dependencies.service

    def control(self, command, status, **extra):
        return {'status': status, 'operationKind': command['kind'],
                'operationId': command['context']['operationId'], **extra}

    def validate(self, kind, value):
        return validate_publication_value(kind, value)

    async def request(self, token, operation, identity):
        command = deepcopy(await self.programs.load(token, identity))
        require(self.validate('request', command), 'INVALID_REQUEST')
        require(command['kind'] == operation if operation != 'lookup'
                else command['kind'] in {'prepare', 'revise', 'publish'}, 'INVALID_REQUEST')
        if command['kind'] != 'read':
            context = command['context']
            require(context['actorId'] == identity.actor_id and
                    context['workspaceId'] == identity.workspace_id, 'FORBIDDEN')
        self.current(identity)
        return command

    async def candidate(self, identity, ref):
        candidate = deepcopy(await self.service.read(identity, deepcopy(ref)))
        self.current(identity)
        await self.check_candidate(identity, candidate)
        require(candidate['ref'] == ref)
        return candidate

    async def check_candidate(self, identity, candidate):
        require(self.validate('candidate', candidate))
        require(self.service.verify_document(candidate['document'], candidate['contentHash'],
                                              candidate['canonicalization']) is True)
        require(self.service.verify_review(deepcopy(candidate)) is True)
        require(not validate_page_document(candidate['document']), 'INVALID_PAGE')
        require(self.sources is not None and self.sources.capabilities.exact_read, 'CAPABILITY_UNAVAILABLE')
        source = deepcopy(await self.sources.read(identity, deepcopy(candidate['ref']['source'])))
        self.current(identity)
        require(source.get('ref') == candidate['ref']['source'])
        require(self.sources.verify_document(source.get('document'), source.get('contentHash'), source.get('canonicalization')) is True)
        require(not validate_page_document(source.get('document')), 'INVALID_PAGE')
        require(source['document']['id'] == source['ref']['pageId'])
        validate_candidate_parameters(candidate, source)

    async def outcome(self, identity, command, result, *, lookup):
        require(self.validate('lookup' if lookup else 'outcome', result))
        validate_result_relations(command, result)
        require(self.service.verify_result(identity, deepcopy(command), deepcopy(result)) is True)
        if result['status'] == 'completed' and command['kind'] != 'publish':
            await self.check_candidate(identity, result['candidate'])

    async def human_confirmation(self, identity, command, candidate):
        require(self.dependencies.confirmations is not None, 'CAPABILITY_UNAVAILABLE')
        record = deepcopy(await self.dependencies.confirmations.read(command['confirmationToken'], identity))
        self.current(identity)
        require(self.validate('confirmation', record), 'CONFIRMATION_REQUIRED')
        validate_confirmation_relations(record, candidate, {
            'actorId': identity.actor_id, 'workspaceId': identity.workspace_id})
        # Authenticity belongs to HumanConfirmationPort; current time, proof
        # revocation and lease/head/version checks belong to the service transaction.
        return record

    async def perform(self, identity, command):
        kind = command['kind']
        if kind == 'prepare':
            require(self.sources is not None and self.sources.capabilities.exact_read, 'CAPABILITY_UNAVAILABLE')
            self.current(identity)
            return await self.service.prepare(identity, deepcopy(command))
        candidate = await self.candidate(identity, command['ref'])
        if kind == 'revise':
            validate_corrections_relations(command['corrections'], candidate)
            self.current(identity)
            return await self.service.revise(identity, deepcopy(command))
        require(candidate['validation']['valid'], 'CANDIDATE_INVALID')
        confirmation = await self.human_confirmation(identity, command, candidate)
        self.current(identity)
        return await self.service.publish(identity, deepcopy(command), deepcopy(candidate), confirmation)

    async def deliver(self, identity, command, result):
        status = result['status']
        if status != 'completed':
            extra = {}
            if status == 'rejected':
                extra = {'code': result['code'] if result['code'] in ERROR_CODES else 'SERVICE_REJECTED', 'retryable': False}
            elif status == 'not-applied':
                extra = {'retrySafe': result['retrySafe']}
            return self.control(command, status, **extra)
        try:
            token = await self.programs.store({'context': command['context'], 'result': deepcopy(result)}, identity)
            self.current(identity)
        except Exception:
            return self.control(command, 'unknown', code='PROGRAM_DELIVERY_FAILED')
        if command['kind'] == 'publish':
            return self.control(command, 'completed', template=deepcopy(result['template']), programToken=token)
        return self.control(command, 'completed', **candidate_summary(result['candidate']), programToken=token)

    async def mutate(self, identity, command, *, lookup):
        def rejected(error):
            if error.code in ERROR_CODES - {'RESPONSE_MISMATCH'}:
                return self.control(command, 'rejected', code=error.code, retryable=False)
            return self.control(command, 'unknown', code='RESPONSE_MISMATCH')
        def unverified(error):
            code = 'CAPABILITY_UNAVAILABLE' if isinstance(error, LifecycleError) and error.code == 'CAPABILITY_UNAVAILABLE' else 'RESPONSE_MISMATCH'
            return self.control(command, 'unknown', code=code)
        try:
            result = deepcopy(await self.service.lookup(identity, deepcopy(command)))
            self.current(identity)
        except LifecycleError as error:
            return rejected(error)
        except Exception:
            return self.control(command, 'unknown', code='SERVICE_UNAVAILABLE')
        try:
            await self.outcome(identity, command, result, lookup=True)
        except Exception as error:
            # An unverified completed receipt cannot establish that no write happened.
            return unverified(error)
        if not lookup and result['status'] == 'not-applied':
            if not result['retrySafe']:
                return self.control(command, 'unknown')
            try:
                result = deepcopy(await self.perform(identity, command))
                self.current(identity)
            except LifecycleError as error:
                return rejected(error)
            except Exception:
                return self.control(command, 'unknown', code='SERVICE_UNAVAILABLE')
            try:
                await self.outcome(identity, command, result, lookup=False)
            except Exception as error:
                return unverified(error)
        return await self.deliver(identity, command, result)

    async def call(self, operation, token):
        try:
            require(self.dependencies is not None and self.service.available, 'CAPABILITY_UNAVAILABLE')
            identity = self.identity()
            command = await self.request(token, operation, identity)
            if operation == 'read':
                candidate = await self.candidate(identity, command['ref'])
                token = await self.programs.store({'candidate': candidate}, identity)
                self.current(identity)
                return {'status': 'read', **candidate_summary(candidate), 'programToken': token}
            return await self.mutate(identity, command, lookup=operation == 'lookup')
        except LifecycleError as error:
            return {'status': 'rejected', 'code': error.code if error.code in ERROR_CODES else 'SERVICE_REJECTED'}
        except Exception:
            return {'status': 'unavailable', 'code': 'SERVICE_UNAVAILABLE'}


def candidate_summary(candidate):
    return {'ref': deepcopy(candidate['ref']), 'contentHash': candidate['contentHash'],
            'reviewHash': candidate['reviewHash'], 'publishable': candidate['validation']['valid'],
            'parameterCount': len(candidate['parameterSummary']),
            'affectedSourceCount': len(candidate['affectedDataSources'])}


@lru_cache(maxsize=1)
def publication_validators():
    root = bundle_root()
    shared = json.loads((root / 'contract-snapshot/authoring/publication.schema.json').read_text())
    request = json.loads((root / 'contracts/authored/publish-request.schema.json').read_text())
    registry = Registry().with_resource(shared['$id'], Resource.from_contents(shared))
    names = {'candidate': 'Candidate', 'confirmation': 'Confirmation',
             'outcome': 'MutationOutcome', 'lookup': 'LookupOutcome'}
    validators = {key: Draft202012Validator({'$ref': shared['$id'] + '#/$defs/' + name}, registry=registry)
                  for key, name in names.items()}
    validators['request'] = Draft202012Validator(request, registry=registry)
    return validators


def validate_publication_value(kind, value):
    return not any(publication_validators()[kind].iter_errors(value))


def parameter_targets(document, parameter_id):
    targets = {(source_id, query['paramBindings'][parameter_id].get('queryField', 'time'))
            for source_id, source in document['dataSources'].items()
            if source['source']['type'] == 'query'
            and (query := source['source']['query']).get('language') == 'dqe'
            and parameter_id in query.get('paramBindings', {})}
    for source_id, source in document['dataSources'].items():
        if source['source']['type'] != 'query': continue
        f = source['source']['query']['body']['dsl_list'][0].get('filter', {})
        if not isinstance(f, dict): continue
        for d in f.get('dims', []):
            if isinstance(d, dict) and isinstance(d.get('dim_value_list'), dict) and d['dim_value_list'].get('param') == parameter_id:
                targets.add((source_id, d['dim_name']))
        t = f.get('time', {})
        if isinstance(t, dict) and t.get('param') == parameter_id: targets.add((source_id, 'time'))
    return targets


def validate_candidate_parameters(candidate, source=None):
    """Relational checks over the shared DTO, never parameter extraction.

    S2 shared vectors cover parity with the TypeScript consumer. The caller must
    verify source.ref and original content integrity before supplying source.
    """
    document = candidate['document']
    def has_inline_reference(ds):
        query = ds.get('source', {}).get('query', {})
        for dsl in query.get('body', {}).get('dsl_list', []):
            f = dsl.get('filter', {})
            time = f.get('time', {})
            if isinstance(time, dict) and 'param' in time: return True
            if any(isinstance(d.get('dim_value_list'), dict) and 'param' in d['dim_value_list'] for d in f.get('dims', [])): return True
        return False
    inline = any(p.get('type') == 'timeRange' or 'value' in p for p in _param_declarations(document)) or any(
        has_inline_reference(ds) for ds in document.get('dataSources', {}).values())
    if inline:
        require(not candidate['retainDimensionValues'])
        require(not any('initial' in ds['source'] for ds in document['dataSources'].values() if ds['source']['type'] == 'query'))
    require(not validate_page_document(document), 'INVALID_PAGE')
    if source is not None:
        require(source['ref'] == candidate['ref']['source'] and source['document']['id'] == source['ref']['pageId'])
        require(not validate_page_document(source['document']), 'INVALID_PAGE')
        extracted_types = ('dimension', 'time', 'timeRange') if inline else ('dimension',)
        non_dimensions = lambda doc: {p['id']: p for p in _param_declarations(doc) if p['type'] not in extracted_types}
        require(non_dimensions(document) == non_dimensions(source['document']))
    require(document['id'] == candidate['ref']['source']['pageId'])
    parameters = {p['id']: p for p in _param_declarations(document)}
    dimensions = {key: p for key, p in parameters.items() if p['type'] == 'dimension' or inline and p['type'] in ('time', 'timeRange')}
    summaries = candidate['parameterSummary']
    ids = [p['parameterId'] for p in summaries]
    require(len(ids) == len(set(ids)))
    require({p['parameterId'] for p in summaries if p['selected']} == set(dimensions))
    require(not (set(ids) & (set(parameters) - set(dimensions))))
    query_sources = {key for key, value in document['dataSources'].items() if value['source']['type'] == 'query'}
    affected = candidate['affectedDataSources']
    require(len(affected) == len(set(affected)) and set(affected) <= query_sources)
    for summary in summaries:
        parameter_id = summary['parameterId']
        targets = [(target['dataSourceId'], target['queryField']) for target in summary['targets']]
        require(len(targets) == len(set(targets)))
        for source_id, field in targets:
            require(source_id in query_sources)
            data = document['dataSources'][source_id]
            require(data['source']['query']['language'] == 'dqe')
        if not summary['selected']:
            require(summary['valueState'] == 'not-selected' and parameter_id not in parameters and 'defaultValue' not in summary)
            require(summary['extractionKind'] is not None)
            continue
        if summary['extractionKind'] is None:
            require(source is not None and source['ref'] == candidate['ref']['source'])
            old = {p['id']: p for p in _param_declarations(source['document'])}.get(parameter_id)
            require(old is not None and dimensions.get(parameter_id) == old)
            require(parameter_targets(source['document'], parameter_id) == set(targets))
        else:
            require(summary['extractionKind'] in {'dimension-eq', 'dimension-in', 'time-range'} and bool(targets), 'UNSUPPORTED_EXTRACTION')
            require(candidate['retainDimensionValues'] or summary['valueState'] != 'retained')
            require(summary['extractionKind'] == ('time-range' if dimensions[parameter_id]['type'] == 'timeRange' else 'dimension-in' if dimensions[parameter_id].get('multiple', False) else 'dimension-eq'))
        require(len(targets) <= 1 or summary['sharing'] == 'identical-values')
        parameter = dimensions[parameter_id]
        require(summary['valueType'] == (parameter['type'] if parameter['type'] in ('time', 'timeRange') else 'string[]' if parameter.get('multiple', False) else 'string'))
        require(summary['required'] == parameter.get('required', True))
        if inline: require('value' not in parameter and 'default' not in parameter)
        require(set(targets) == parameter_targets(document, parameter_id))
        if 'default' in parameter:
            require(summary['valueState'] == 'retained' and summary.get('defaultValue') == parameter['default'])
        else:
            require(summary['valueState'] == 'missing' and 'defaultValue' not in summary)
    require(candidate['validation']['valid'] == (not any(i['severity'] == 'blocking' for i in candidate['validation']['issues'])))

    for entry in candidate['diff'] + candidate['validation']['issues']:
        require('parameterId' not in entry or entry['parameterId'] in ids)


def validate_confirmation_relations(record, candidate, identity):
    require(record['actorId'] == identity['actorId'] and record['workspaceId'] == identity['workspaceId'], 'FORBIDDEN')
    require(record['candidate'] == candidate['ref'] and record['source'] == candidate['ref']['source'], 'CANDIDATE_CHANGED')
    for key in ('retainDimensionValues', 'contentHash', 'canonicalization', 'reviewHash', 'reviewCanonicalization', 'leaseId'):
        require(record[key] == candidate[key], 'CONFIRMATION_REQUIRED')
    require(candidate['validation']['valid'], 'CANDIDATE_INVALID')


def validate_corrections_relations(corrections, candidate):
    ids = [p['parameterId'] for p in corrections.get('parameterSelections', [])]
    require(len(ids) == len(set(ids)) and set(ids) <= {p['parameterId'] for p in candidate['parameterSummary']}, 'INVALID_REQUEST')


def validate_result_relations(command, result):
    require(result['operationKind'] == command['kind'] and result['operationId'] == command['context']['operationId'])
    if result['status'] != 'completed':
        return
    if command['kind'] == 'publish':
        require('template' in result and result['template']['source'] == command['ref']['source'])
        return
    require('candidate' in result)
    candidate = result['candidate']
    ref = candidate['ref']
    if command['kind'] == 'prepare':
        require(ref['source'] == command['source'] and candidate['retainDimensionValues'] == command['retainDimensionValues'])
    else:
        require(ref['candidateId'] == command['ref']['candidateId'] and ref['source'] == command['ref']['source'] and ref['candidateVersion'] != command['ref']['candidateVersion'])
        corrections = command['corrections']
        if 'retainDimensionValues' in corrections:
            require(candidate['retainDimensionValues'] == corrections['retainDimensionValues'])
        selected = {p['parameterId']: p['selected'] for p in candidate['parameterSummary']}
        for choice in corrections.get('parameterSelections', []):
            require(selected.get(choice['parameterId']) == choice['selected'])
