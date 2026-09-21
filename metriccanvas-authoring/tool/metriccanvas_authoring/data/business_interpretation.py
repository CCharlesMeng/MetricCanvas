"""Bounded, provenance-carrying business suggestions; core discovery stays authoritative."""
from copy import deepcopy
from datetime import date, datetime
from typing import Protocol
import re
from jsonschema import Draft202012Validator

_STRING = {'type': 'string', 'minLength': 1, 'maxLength': 256}
_ALIAS = {'type': 'object', 'additionalProperties': False,
          'required': ['matchedTerm', 'kind', 'businessDomain', 'canonicalName'],
          'properties': {'matchedTerm': _STRING, 'kind': {'enum': ['metric', 'dimension']}, 'businessDomain': _STRING, 'canonicalName': _STRING}}
_TIME = {'type': 'object', 'additionalProperties': False,
         'required': ['matchedTerm', 'kind', 'granularity', 'start', 'end'],
         'properties': {'matchedTerm': _STRING, 'kind': {'const': 'time'}, 'granularity': _STRING, 'start': _STRING, 'end': _STRING}}
PROPOSAL_SCHEMA = {'type': 'object', 'additionalProperties': False,
    'required': ['formatVersion', 'providerNamespace', 'sourceRef', 'sourceVersion', 'dataContextVersion', 'candidates'],
    'properties': {'formatVersion': {'const': '1.0'}, 'providerNamespace': _STRING, 'sourceRef': _STRING,
        'sourceVersion': _STRING, 'dataContextVersion': _STRING,
        'candidates': {'type': 'array', 'maxItems': 100, 'items': {'oneOf': [_ALIAS, _TIME]}}}}
_VALIDATOR = Draft202012Validator(PROPOSAL_SCHEMA)


class BusinessInterpretationPort(Protocol):
    async def propose(self, query: str, data_context, now: datetime) -> dict: ...


class BusinessInterpretationError(Exception):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


def _require(condition, code='BUSINESS_INTERPRETATION_INVALID'):
    if not condition: raise BusinessInterpretationError(code)


def _time(candidate, context):
    granularity = candidate['granularity']
    _require(any(entry.is_time and granularity in entry.granularities for entry in context.dimension_entries), 'BUSINESS_TIME_UNSUPPORTED')
    pattern = {'day': r'\d{4}-\d{2}-\d{2}', 'month': r'\d{4}-\d{2}', 'year': r'\d{4}'}.get(granularity)
    _require(pattern is not None, 'BUSINESS_TIME_UNSUPPORTED')
    for field in ('start', 'end'):
        value = candidate[field]
        _require(re.fullmatch(pattern, value) is not None, 'BUSINESS_TIME_INVALID')
        try:
            date.fromisoformat(value + ('-01-01' if granularity == 'year' else '-01' if granularity == 'month' else ''))
        except ValueError:
            raise BusinessInterpretationError('BUSINESS_TIME_INVALID') from None
    _require(candidate['start'] <= candidate['end'], 'BUSINESS_TIME_INVALID')
    return {key: candidate[key] for key in ('granularity', 'start', 'end')} | {'providedBy': 'user'}


def _identity(candidate):
    return candidate.get('kind'), candidate.get('canonicalName'), candidate.get('businessDomain')


async def extend_interpretation(extension, query, context, now, resolution, core_time):
    try:
        proposed = await extension.propose(query, deepcopy(context), now)
    except Exception:
        raise BusinessInterpretationError('BUSINESS_INTERPRETATION_UNAVAILABLE') from None
    _require(_VALIDATOR.is_valid(proposed))
    _require(proposed['dataContextVersion'] == context.version, 'BUSINESS_CONTEXT_MISMATCH')
    provenance = {key: proposed[key] for key in ('providerNamespace', 'sourceRef', 'sourceVersion', 'dataContextVersion')}
    result = deepcopy(resolution)
    result['extensionSources'] = [provenance]
    additions, times, terms = [], [], []
    for candidate in proposed['candidates']:
        term, kind = candidate['matchedTerm'], candidate['kind']
        _require(term in query, 'BUSINESS_TERM_NOT_PRESENT')
        if kind == 'time':
            time = _time(candidate, context)
            times.append((candidate, time))
            match = {'kind': 'relative_time', 'matchedTerm': term, 'canonicalName': f"{time['granularity']}:{time['start']}:{time['end']}",
                     'businessDomain': None, 'time': time}
        else:
            entries = context.metric_entries if kind == 'metric' else context.dimension_entries
            _require(any(entry.business_domain == candidate['businessDomain'] and entry.name == candidate['canonicalName'] for entry in entries), 'BUSINESS_TARGET_NOT_GOVERNED')
            match = deepcopy(candidate)
            terms.append((candidate['canonicalName'], kind))
        match.update(source='business_extension', provenance=deepcopy(provenance), score=0,
                     start=query.find(term), end=query.find(term) + len(term))
        additions.append(match)
    # Validate every proposal before admitting any contribution.
    core_candidates = deepcopy(result['candidates'])
    result['candidates'].extend(additions)
    groups = {}
    for candidate in additions:
        if candidate['kind'] != 'relative_time': groups.setdefault(candidate['matchedTerm'], []).append(candidate)
    for term, group in groups.items():
        existing = [c for c in core_candidates if c.get('matchedTerm') == term]
        combined = existing + group
        identities = {_identity(c) for c in combined}
        already_ambiguous = any(a.get('matchedTerm') == term for a in result['ambiguities'])
        if len(identities) > 1:
            result['ambiguities'].append({'matchedTerm': term, 'reason': 'business_extension_conflict', 'candidates': deepcopy(combined)})
        elif not existing and not already_ambiguous:
            result['selected'].append(deepcopy(group[0]))
    effective_time = deepcopy(core_time)
    if times:
        distinct = {(t['granularity'], t['start'], t['end']) for _, t in times}
        if core_time is not None: distinct.add((core_time['granularity'], core_time['start'], core_time['end']))
        if len(distinct) > 1:
            candidates = [c for c in core_candidates + additions if c.get('kind') == 'relative_time']
            result['ambiguities'].append({'matchedTerm': times[0][0]['matchedTerm'], 'reason': 'business_extension_time_conflict', 'candidates': deepcopy(candidates)})
        elif core_time is None:
            effective_time = deepcopy(times[0][1])
            result['selected'].extend(deepcopy(c) for c in additions if c['kind'] == 'relative_time')
    return result, effective_time, terms
