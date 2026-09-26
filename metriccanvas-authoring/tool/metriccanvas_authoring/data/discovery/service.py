"""Optional bounded discovery orchestration behind SemanticCatalog's existing seam."""
import asyncio
import time
import re
from copy import deepcopy
from datetime import datetime
from zoneinfo import ZoneInfo
from uuid import uuid4
from metriccanvas_authoring.work.state import digest, require
from metriccanvas_authoring.work.discovery_tasks import DiscoveryTasks
from metriccanvas_authoring.data.discovery.contracts import validate
from metriccanvas_authoring.data.discovery.retrieval import (
    coverage, lexical_requirements, classify, validate_retrieval, proposition_conflicts, rank,
)
from metriccanvas_authoring.data.business_terms import _resolve_relative_time


class DiscoveryService:
    def __init__(self, catalog, dependencies):
        self.catalog, self.dependencies = catalog, dependencies
        self.tasks = DiscoveryTasks(catalog.store, dependencies.limits)

    async def discover(self, binding, query, limit, detail_refs):
        deps = self.dependencies
        require(deps.trusted_context is not None, 'DISCOVERY_CONTEXT_UNAVAILABLE')
        invocation = validate('invocation', await deps.trusted_context.current(deepcopy(binding)))
        claim = await self.tasks.begin(binding, invocation)
        if claim.cached is not None:
            if detail_refs:
                # Additional read-only detail requests reuse this task, not its model budget.
                current = await self.catalog.provider.search(deepcopy(binding), '', 50)
                require(current['dataContextVersion'] == claim.record.get('dataContextVersion'), 'DATA_CONTEXT_VERSION_CHANGED')
                claim.cached['details'] = await self.catalog.details(binding, current['dataContextVersion'], detail_refs)
            return claim.cached
        try:
            async with asyncio.timeout(deps.limits.seconds):
                result = await self._run(binding, invocation, claim, limit, detail_refs, time.monotonic() + deps.limits.seconds)
            return await self.tasks.finish(claim, result)
        except BaseException:
            await asyncio.shield(self.tasks.abort(claim))
            raise

    async def _run(self, binding, invocation, claim, limit, detail_refs, deadline):
        record, deps = claim.record, self.dependencies
        if invocation['invocationKind'] == 'cancel':
            record.update(status='cancelled', pendingInteraction=None)
            return {'status': 'cancelled', 'matches': [], 'discovery': {'taskRef': claim.key, 'requirements': []}}
        source = record['requestRevisions'][-1] if record['requestRevisions'] else record['originalRequest']
        question = source['messageText']
        text_selection = None
        if invocation.get('answer', {}).get('kind') == 'free_text':
            text = invocation['answer']['text'].strip()
            pending_items = (record.get('pendingInteraction') or {}).get('items', [])
            matches = []
            for item in pending_items:
                for option in item['options']:
                    pattern = r'(?:请)?(?:选择|使用|选|用)?' + re.escape(option['label']) + r'(?:吧|即可)?[。！!]?'
                    if re.fullmatch(pattern, text):
                        matches.append({'requirementId': item['requirementId'], 'optionId': option['optionId']})
            if len(matches) == 1:
                text_selection = {'kind': 'choices', 'choices': matches}
            else:
                question += '\n用户补充：' + text
        value = await self.catalog.provider.search(deepcopy(binding), '', 50)
        cards, dimensions = self.catalog.source_cards(value)
        require(len(cards) <= 10000, 'DISCOVERY_SOURCE_SIZE_LIMIT')
        version = value['dataContextVersion']
        require(isinstance(version, str) and 0 < len(version) <= 256, 'DISCOVERY_SOURCE_VERSION')
        require(all(c['source'].get('workspaceId') == binding.get('workspaceId') for c in cards), 'DISCOVERY_SOURCE_SCOPE')
        cov = coverage(value)
        issues = deepcopy(value.get('issues', []))
        knowledge, knowledge_status = [], 'unconfigured'
        knowledge_version = None
        knowledge_coverage = None
        domains = source.get('businessDomains', [])
        if deps.knowledge:
            try:
                async with asyncio.timeout(max(0, min(deps.limits.seconds / 4, deadline - time.monotonic() - 0.05))):
                    data = validate('knowledge', await deps.knowledge.search(deepcopy(binding), question, domains, deps.limits.knowledge_items))
                require(len({i['id'] for i in data['items']}) == len(data['items']), 'DISCOVERY_KNOWLEDGE_INVALID')
                knowledge, knowledge_status = data['items'], data['status']
                knowledge_coverage = data['coverage']
                knowledge_version = {'source': data['source'], 'items': {i['id']: i['provenance']['revision'] for i in knowledge}}
            except Exception:
                knowledge_status = 'unavailable'
                issues.append({'code': 'DISCOVERY_KNOWLEDGE_UNAVAILABLE'})
        scoped = [c for c in cards if not domains or c['businessDomain'] in domains]
        requirements, relations = lexical_requirements(question, scoped, knowledge, deps.limits.candidates)
        if not any(r['candidates'] for r in requirements) and domains and record['analysisBudget']['expansions'] < 1:
            record['analysisBudget']['expansions'] += 1
            await self.tasks.checkpoint(claim)
            requirements, relations = lexical_requirements(question, cards, knowledge, deps.limits.candidates)
            if deps.knowledge:
                try:
                    async with asyncio.timeout(max(0, min(deps.limits.seconds / 4, deadline - time.monotonic() - 0.05))):
                        expanded = validate('knowledge', await deps.knowledge.search(deepcopy(binding), question, [], deps.limits.knowledge_items))
                    knowledge = expanded['items']
                    knowledge_status = expanded['status']
                    knowledge_coverage = expanded['coverage']
                    knowledge_version = {'source': expanded['source'], 'items': {i['id']: i['provenance']['revision'] for i in knowledge}}
                    requirements, relations = lexical_requirements(question, cards, knowledge, deps.limits.candidates)
                except Exception:
                    issues.append({'code': 'DISCOVERY_KNOWLEDGE_EXPANSION_UNAVAILABLE'})
        if deps.retrieval:
            try:
                async with asyncio.timeout(max(0, min(deps.limits.seconds / 4, deadline - time.monotonic() - 0.05))):
                    batch = await deps.retrieval.retrieve(deepcopy(binding), {'question': question, 'businessDomains': domains},
                                                          self.catalog.provider, {'candidateLimit': 120})
                found = validate_retrieval(batch, {c['metricRef']: c for c in cards}, version)
                target = requirements[0]
                existing = {c['metricRef'] for c in target['candidates']}
                target['candidates'].extend({**c, 'matchEvidence': [{'kind': 'external', 'term': question}]}
                                             for c in found if c['metricRef'] not in existing)
                target['candidateTruncated'] = len(target['candidates']) > deps.limits.candidates
                target['candidates'] = target['candidates'][:deps.limits.candidates]
            except Exception:
                issues.append({'code': 'DISCOVERY_RETRIEVAL_UNAVAILABLE'})
        rule_ready = all(r['status'] == 'resolved' for r in classify(deepcopy(requirements), question, cov))
        interpretation_status = 'not_needed' if rule_ready else 'unconfigured'
        if deps.interpreter and not rule_ready:
            if record['analysisBudget']['modelCalls'] >= deps.limits.model_calls:
                interpretation_status = 'budget_exhausted'
            else:
                record['analysisBudget']['modelCalls'] += 1
                await self.tasks.checkpoint(claim)
                try:
                    candidate_map = {c['metricRef']: c for r in requirements for c in r['candidates']}
                    payload = {'formatVersion': '1.0', 'question': question, 'dataContextVersion': version,
                               'candidates': list(candidate_map.values())[:120], 'knowledge': knowledge,
                               'requirements': [{k: r[k] for k in ('id', 'expression')} |
                                                {'candidateRefs': [c['metricRef'] for c in r['candidates']]} for r in requirements]}
                    async with asyncio.timeout(max(0, min(deps.limits.seconds / 2, deadline - time.monotonic() - 0.05))):
                        proposal = validate('proposal', await deps.interpreter.propose(deepcopy(payload)))
                    self.validate_proposal(proposal, payload)
                    if proposal['searchTerms'] and record['analysisBudget']['expansions'] < 1:
                        record['analysisBudget']['expansions'] += 1
                        await self.tasks.checkpoint(claim)
                        for term in proposal['searchTerms']:
                            supplemental = rank(term, cards, deps.limits.candidates)
                            target = next((r for r in requirements if term in r['expression'] or r['expression'] in term), requirements[0])
                            present = {c['metricRef'] for c in target['candidates']}
                            for c in supplemental:
                                if c['metricRef'] not in present and len(target['candidates']) < deps.limits.candidates:
                                    target['candidates'].append({**c, 'matchEvidence': [{'kind': 'model_search', 'term': term}]})
                    # Keep deterministic needs. A model cannot drop a named need or create authority.
                    for proposed in proposal['requirements']:
                        target = next((r for r in requirements if r['expression'] == proposed['expression']), None)
                        if target is None:
                            target = {'id': 'model-' + proposed['id'], 'expression': proposed['expression'],
                                      'candidates': [], 'candidateTruncated': False, 'unresolved': []}
                            requirements.append(target)
                        present = {c['metricRef'] for c in target['candidates']}
                        for ref in proposed['candidateRefs']:
                            if ref not in present:
                                target['candidates'].append({**deepcopy(candidate_map[ref]), 'matchEvidence': [
                                    {'kind': 'model', 'term': proposed['expression'], 'evidenceIds': proposed['evidenceIds']}]})
                        target['unresolved'] = list(dict.fromkeys(target['unresolved'] + proposed['unresolved']))
                    # Model relations only add dependencies, never remove existing ones.
                    mapped = {p['id']: next(r['id'] for r in requirements if r['expression'] == p['expression']) for p in proposal['requirements']}
                    for rel in proposal['relationships']:
                        relation = {'kind': rel['kind'], 'requirementIds': [mapped[i] for i in rel['requirementIds']]}
                        if not any(old['kind'] == relation['kind'] and set(old['requirementIds']) == set(relation['requirementIds']) for old in relations):
                            relations.append(relation)
                    interpretation_status = 'applied'
                except Exception:
                    interpretation_status = 'unavailable'
                    issues.append({'code': 'DISCOVERY_INTERPRETATION_UNAVAILABLE'})
        if len(requirements) > deps.limits.requirements:
            requirements = [{'id': 'scope', 'expression': question, 'candidates': [],
                             'unresolved': ['requirement_limit'], 'candidateTruncated': True}]
            relations = []
        # Compare explicit business facts; a conflicting knowledge definition is not an alias override.
        for r in requirements:
            for c in r['candidates']:
                for item in knowledge:
                    if item['kind'] != 'business_term' or item['reviewStatus'] != 'approved': continue
                    if c['businessDomain'] not in item['businessDomains']: continue
                    if not any(h['metricName'] == c['name'] for h in item.get('metricHints', [])): continue
                    _, conflicts = proposition_conflicts(item['definition'], c['definition'].get('value') or '')
                    if conflicts:
                        c['conflicts'].append({'code': 'KNOWLEDGE_DEFINITION_CONFLICT', 'evidenceId': item['id']})
        for r in requirements:
            if len(r['candidates']) > deps.limits.candidates:
                r['candidateTruncated'] = True
                r['candidates'] = r['candidates'][:deps.limits.candidates]
        classify(requirements, question, cov)
        old_versions = (record.get('dataContextVersion'), record.get('knowledgeVersion'))
        changed = old_versions[0] is not None and old_versions != (version, knowledge_version)
        if not changed:
            old = {r['expression']: r for r in record['requirements']}
            for r in requirements:
                previous = old.get(r['expression'])
                if previous and previous.get('selectedBy') in {'user', 'user_text'}:
                    selected = next((c for c in r['candidates'] if c['metricRef'] == previous['selectedRef']), None)
                    if selected and not selected.get('conflicts') and not selected['constraintConflicts'] and not selected['constraintUnknown'] and not r['unresolved']:
                        r.update(status='resolved', selectedRef=selected['metricRef'], selectedBy=previous['selectedBy'])
        answer = invocation.get('answer')
        pending = record.get('pendingInteraction')
        if answer and answer['kind'] == 'choices':
            if changed:
                issues.append({'code': 'DISCOVERY_EVIDENCE_CHANGED'})
            else:
                self.apply_choices(requirements, answer, pending)
        if text_selection and not changed:
            self.apply_choices(requirements, text_selection, pending)
            for r in requirements:
                if r['id'] == text_selection['choices'][0]['requirementId'] and r['selectedBy'] == 'user':
                    r['selectedBy'] = 'user_text'
        # A user event approving a prior card never approves changed evidence.
        if changed and answer:
            for r in requirements:
                if r['status'] == 'resolved':
                    r.update(status='needs_choice', selectedRef=None, selectedBy=None)
        if not record.get('constraints'):
            now = datetime.fromisoformat(source['receivedAt'].replace('Z', '+00:00')).astimezone(ZoneInfo(source['timezone']))
            resolved_time = _resolve_relative_time(question, supports_month=any('month' in d.get('granularities', []) for d in dimensions), now=now)
            record['constraints'] = {'originalText': source['messageText'], 'timezone': source['timezone'],
                                     'time': resolved_time[1] if resolved_time else None,
                                     'dimensions': [d['name'] for d in dimensions if d['name'] in question],
                                     'groupBy': [d['name'] for d in dimensions if any(t + d['name'] in question for t in ('按', '各'))]}
        record.update(requirements=requirements, relationships=relations,
                      candidateEvidence=list({c['metricRef']: c for r in requirements for c in r['candidates']}.values()),
                      dataContextVersion=version, knowledgeVersion=knowledge_version, lastBindingHash=digest(binding))
        unresolved = [r for r in requirements if r['status'] not in {'resolved', 'skipped'}]
        interaction = None
        if unresolved and record['clarifications'] == 0 and not answer:
            interaction = self.interaction(claim.key, requirements, record['constraints'])
            record['clarifications'] += 1
        record['pendingInteraction'] = interaction
        by_id = {r['id']: r for r in requirements}
        blocked = [rel for rel in relations if rel['kind'] != 'independent'
                   and any(by_id[i]['status'] != 'resolved' for i in rel['requirementIds'])]
        blocked_ids = {i for rel in blocked for i in rel['requirementIds']}
        executable = [r['id'] for r in requirements if r['status'] == 'resolved' and r['id'] not in blocked_ids]
        record['status'] = 'awaiting_choice' if interaction else 'paused' if unresolved or blocked else 'ready'
        if changed: issues.append({'code': 'DISCOVERY_REVALIDATION_REQUIRED'})
        # Only bounded cards are exposed, but all admitted current candidates can be detailed.
        for c in record['candidateEvidence']:
            await self.catalog.store.compare_and_swap('metric', digest([binding, version, c['metricRef']]), 0, {'card': c})
        details = await self.catalog.details(binding, version, detail_refs)
        summary = [{k: deepcopy(r[k]) for k in ('id', 'expression', 'status', 'selectedRef', 'selectedBy', 'unresolved')}
                   | {'candidateRefs': [c['metricRef'] for c in r['candidates'][:3]]} for r in requirements]
        return {'ok': True, 'status': 'partial' if unresolved or blocked or issues else 'ready', 'dataContextVersion': version,
                'discoveryProtocolVersion': '1.0', 'matches': record['candidateEvidence'][:limit],
                'details': details, 'businessDomains': sorted({c['businessDomain'] for c in cards}),
                'dimensions': dimensions[:50], 'coverage': cov, 'executionReadiness': 'not_checked',
                'knowledgeStatus': knowledge_status, 'knowledgeCoverage': knowledge_coverage, 'interpretationStatus': interpretation_status,
                'issues': issues, 'discovery': {'taskRef': claim.key, 'status': record['status'],
                    'requirements': summary, 'relationships': relations, 'readyRequirementIds': executable, 'pausedRelations': blocked}, 'interactionEnvelope': interaction}

    @staticmethod
    def validate_proposal(proposal, payload):
        require(proposal['dataContextVersion'] == payload['dataContextVersion'], 'DISCOVERY_PROPOSAL_VERSION')
        candidates = {c['metricRef'] for c in payload['candidates']}
        evidence = candidates | {k['id'] for k in payload['knowledge']}
        ids = [r['id'] for r in proposal['requirements']]
        require(len(ids) == len(set(ids)), 'DISCOVERY_PROPOSAL_INVALID')
        for r in proposal['requirements']:
            require(r['expression'] in payload['question'] and set(r['candidateRefs']) <= candidates
                    and set(r['evidenceIds']) <= evidence and (not r['candidateRefs'] or r['evidenceIds']),
                    'DISCOVERY_PROPOSAL_SOURCE')
        require(all(set(r['requirementIds']) <= set(ids) for r in proposal['relationships']), 'DISCOVERY_PROPOSAL_RELATION')
        require(all(term in payload['question'] or any(term in str(k) for k in payload['knowledge'])
                    for term in proposal['searchTerms']), 'DISCOVERY_PROPOSAL_TERM')

    @staticmethod
    def apply_choices(requirements, answer, pending):
        require(pending is not None, 'DISCOVERY_INTERACTION_STALE')
        options = {o['optionId']: o for item in pending['items'] for o in item['options']}
        choices = answer['choices']
        require(len({c['requirementId'] for c in choices}) == len(choices), 'DISCOVERY_CHOICE_INVALID')
        selected_ids = {c['requirementId'] for c in choices}
        skipped = answer.get('skipped', [])
        require(not selected_ids & set(skipped), 'DISCOVERY_CHOICE_INVALID')
        by_id = {r['id']: r for r in requirements}
        require(set(skipped) <= set(by_id), 'DISCOVERY_CHOICE_INVALID')
        for choice in choices:
            option = options.get(choice['optionId'])
            require(option is not None and option['requirementId'] == choice['requirementId'], 'DISCOVERY_CHOICE_INVALID')
            target = by_id.get(choice['requirementId'])
            require(target is not None and target['status'] != 'conflicted', 'DISCOVERY_CHOICE_INVALID')
            card = next((c for c in target['candidates'] if c['metricRef'] == option['metricRef']), None)
            require(card is not None and not card.get('conflicts') and not card['constraintConflicts'], 'DISCOVERY_CHOICE_INVALID')
            if card['constraintUnknown'] or target['unresolved']:
                target['status'] = 'needs_scope'
            else: target.update(status='resolved', selectedRef=card['metricRef'], selectedBy='user')
        for ident in skipped:
            by_id[ident].update(status='skipped', selectedRef=None, selectedBy='user')

    @staticmethod
    def interaction(task_ref, requirements, constraints):
        items = []
        for r in requirements:
            if r['status'] in {'resolved', 'skipped'}: continue
            options = [] if r['status'] == 'conflicted' else [
                {'optionId': 'option-' + digest([r['id'], c['metricRef']]), 'requirementId': r['id'],
                 'metricRef': c['metricRef'], 'label': c['name'], 'businessDomain': c['businessDomain'],
                 'definition': c['definition']} for c in r['candidates'][:3] if not c['constraintConflicts']]
            items.append({'requirementId': r['id'], 'expression': r['expression'], 'status': r['status'], 'options': options})
        return {'kind': 'metriccanvas.discovery-review', 'formatVersion': '1.0', 'taskRef': task_ref,
                'interactionId': 'review-' + uuid4().hex, 'items': items, 'constraints': deepcopy(constraints),
                'actions': ['confirm', 'modify', 'skip_independent', 'cancel']}

    async def require_query(self, binding, request, version):
        invocation = await self.dependencies.trusted_context.current(deepcopy(binding))
        await self.tasks.require_query(binding, invocation, request, version)
