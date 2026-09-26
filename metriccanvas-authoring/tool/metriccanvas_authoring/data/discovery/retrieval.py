"""Source-grounded lexical retrieval; rank is never permission or confidence."""
import re
import unicodedata
from copy import deepcopy
from metriccanvas_authoring.work.state import digest, require


def normalized(text):
    return unicodedata.normalize('NFKC', text).casefold().strip()


def terms(card):
    return [(card['name'], 'name'), *[(a, 'alias') for a in card.get('aliases', [])]]


def score(query, card):
    q = normalized(query)
    if not q: return 1, []
    hits = []
    for term, kind in terms(card):
        t = normalized(term)
        if not t: continue
        if t in q:
            hits.append({'kind': kind, 'term': term, 'score': (100 if kind == 'name' else 90) + len(t)})
        elif q in t:
            hits.append({'kind': 'partial', 'term': query, 'score': 40 + len(q)})
    if hits: return max(h['score'] for h in hits), hits
    definition = card.get('definition', {}).get('value') or ''
    fragments = set(re.findall(r'[a-z0-9_]+|[\u4e00-\u9fff]{2,}', q))
    grams = {s[i:i+2] for s in fragments for i in range(len(s)-1)}
    matching = sorted(g for g in grams if g in normalized(definition))
    if matching: return min(30, len(matching)*3), [{'kind': 'definition', 'term': t, 'score': 3} for t in matching[:10]]
    return 0, []


def rank(query, cards, limit=20):
    result = []
    for card in cards:
        weight, evidence = score(query, card)
        if weight:
            result.append({**deepcopy(card), 'rank': weight, 'matchEvidence': evidence})
    result.sort(key=lambda c: (-c['rank'], c.get('businessDomain', ''), c['name'], c.get('metricRef', '')))
    return result[:limit]


def coverage(value):
    source = value.get('coverage', {})
    # A search-specific/unknown scope is not proof of absence elsewhere.
    return {'sourceComplete': source.get('complete') is True and source.get('scope') == 'authorized',
            'retrievalComplete': source.get('complete') is True,
            'returnedTruncated': bool(source.get('truncated', False))}


def knowledge_evidence(query, cards, knowledge):
    matches, topics = [], []
    for item in knowledge:
        kind = item['kind']
        if kind == 'analysis_topic':
            if item['reviewStatus'] == 'approved' and any(normalized(t) in normalized(query) for t in [item['name'], *item.get('aliases', [])]):
                topics.append(item)
            continue
        phrases = ([item['canonicalTerm'], *item['aliases']] if kind == 'business_term' else item['terms'])
        found = [t for t in phrases if normalized(t) in normalized(query)]
        if not found: continue
        for card in cards:
            if card['businessDomain'] not in item['businessDomains']: continue
            names = {card['name'], *card.get('aliases', [])}
            hints = {h['metricName'] for h in item.get('metricHints', [])}
            canonical = item.get('canonicalTerm', '')
            if names & hints or canonical and any(canonical in n for n in names):
                # Name hints only recall; they do not certify equivalent definitions.
                matches.append({**deepcopy(card), 'rank': 60, 'matchEvidence': [
                    {'kind': 'knowledge', 'term': max(found, key=len), 'evidenceId': item['id'],
                     'reviewStatus': item['reviewStatus']}]})
    return matches, topics


def lexical_requirements(query, cards, knowledge, limit):
    candidates = rank(query, cards, max(len(cards), 1))
    additions, topics = knowledge_evidence(query, cards, knowledge)
    groups = {}
    if topics:
        topic = topics[0]
        for item in topic['items']:
            found = [c for c in cards if c['businessDomain'] in topic['businessDomains']]
            groups[item['concept']] = [c for c in rank(item['concept'], found, limit)
                                       if any(e['kind'] in {'name', 'alias'} for e in c['matchEvidence'])]
        if len(topics) > 1:
            return [{'id': 'scope', 'expression': query, 'candidates': [], 'unresolved': ['analysis_topic_ambiguous']}], []
    else:
        # Prefer longest explicit phrases; nested names do not create extra needs.
        explicit = [(e['term'], c) for c in candidates for e in c['matchEvidence'] if e['kind'] in {'name', 'alias'}]
        for term, card in explicit:
            if any(term != other and term in other for other, _ in explicit): continue
            groups.setdefault(term, []).append(card)
        for card in additions:
            groups.setdefault(card['matchEvidence'][0]['term'], []).append(card)
        if not groups: groups[query or '指标'] = candidates
    requirements = []
    for index, (expression, found) in enumerate(groups.items()):
        unique = {c['metricRef']: c for c in found}
        ordered = sorted(unique.values(), key=lambda c: (-c.get('rank', 0), c['metricRef']))
        requirements.append({'id': f'need-{index+1}', 'expression': expression,
                             'candidates': ordered[:limit], 'candidateTruncated': len(ordered)>limit,
                             'unresolved': ['analysis_scope_required'] if not topics and not ordered and any(t in query for t in ('经营情况', '经营概况', '分析一下', '整体情况')) else []})
    relation = 'calculation' if any(t in query for t in ('占比', '比率', '除以')) else 'comparison' if any(t in query for t in ('比较', '对比', '关系')) else 'independent'
    relationships = [{'kind': relation, 'requirementIds': [r['id'] for r in requirements]}]
    if relation == 'calculation':
        for r in requirements: r['unresolved'].append('calculation_definition_required')
    return requirements, relationships


def validate_retrieval(batch, known, version):
    require(isinstance(batch, dict) and batch.get('dataContextVersion') == version, 'DISCOVERY_RETRIEVAL_VERSION')
    require(isinstance(batch.get('candidateRefs'), list) and len(batch['candidateRefs']) <= 120,
            'DISCOVERY_RETRIEVAL_INVALID')
    require(all(isinstance(ref, str) and ref in known for ref in batch['candidateRefs']), 'DISCOVERY_SOURCE_INVALID')
    return [deepcopy(known[ref]) for ref in dict.fromkeys(batch['candidateRefs'])]


def proposition_conflicts(query, definition):
    """Explicit polarity first, so 不扣退款 is never parsed as 扣退款."""
    rules = [(['扣除退款', '扣退款', '不含退款'], ['不扣退款', '未扣退款', '未扣除退款'], 'refund'),
             (['不含税', '未税'], ['含税', '包含税'], 'tax')]
    missing, conflicts = [], []
    for positive, negative, name in rules:
        def polarity(value):
            # Longest phrases protect negations nested in their opposite phrase.
            hits = [(len(t), sign) for words, sign in ((positive, 1), (negative, -1)) for t in words if t in value]
            return max(hits)[1] if hits else None
        wanted, actual = polarity(query), polarity(definition)
        if wanted is not None:
            if actual is None: missing.append(name)
            elif wanted != actual: conflicts.append(name)
    return missing, conflicts


def classify(requirements, query, cov):
    for r in requirements:
        viable = []
        for card in r['candidates']:
            missing, conflict = proposition_conflicts(query, card.get('definition', {}).get('value') or '')
            card['constraintUnknown'] = missing
            card['constraintConflicts'] = conflict
            if not conflict: viable.append(card)
        r['selectedRef'] = None
        r['selectedBy'] = None
        if r.get('unresolved'):
            r['status'] = 'needs_scope'
        elif r['candidates'] and not viable or any(c.get('conflicts') for c in viable):
            r['status'] = 'conflicted'
        elif not viable:
            r['status'] = 'unsupported'
        elif len(viable) == 1 and cov['sourceComplete'] and not cov['returnedTruncated'] and not r.get('candidateTruncated'):
            card = viable[0]
            strong = any(e['kind'] in {'name', 'alias'} for e in card.get('matchEvidence', []))
            if strong and not card['constraintUnknown']:
                r.update(status='resolved', selectedRef=card['metricRef'], selectedBy='rule')
            else: r['status'] = 'needs_choice'
        else: r['status'] = 'needs_choice'
    return requirements
