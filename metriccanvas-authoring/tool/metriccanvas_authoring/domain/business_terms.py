from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Sequence

from metriccanvas_authoring.domain.data_context import DimensionEntry, MetricEntry


NAME_HIT_SCORE = 100
ALIAS_HIT_SCORE = 50
VALUE_HIT_SCORE = 80
LEXICON_HIT_SCORE = 30


@dataclass(frozen=True, slots=True)
class RankedMetricCandidate:
    metric_name: str
    business_domain: str
    definition: str
    matched_term: str
    score: int
    unit: str | None = None

    def to_payload(self) -> dict[str, Any]:
        return {
            "metricName": self.metric_name,
            "businessDomain": self.business_domain,
            "definition": self.definition,
            **({} if self.unit is None else {"unit": self.unit}),
            "matchedTerm": self.matched_term,
            "score": self.score,
        }

    def to_term_match_payload(self) -> dict[str, Any]:
        """Project the ranked metric into the shared term-resolution shape."""
        return _match_payload(self)


@dataclass(frozen=True, slots=True)
class MetricTermResolution:
    candidates: tuple[RankedMetricCandidate, ...]
    selected: tuple[RankedMetricCandidate, ...]
    ambiguous_terms: tuple[str, ...]

    def to_payload(self, question: str) -> dict[str, Any]:
        return {
            "formatVersion": "1.0",
            "question": question,
            "matches": [_match_payload(candidate) for candidate in self.selected],
            "ambiguities": [
                {
                    "matchedTerm": term,
                    "candidates": [
                        _ambiguity_candidate_payload(candidate)
                        for candidate in self.candidates
                        if candidate.matched_term == term
                    ],
                }
                for term in self.ambiguous_terms
            ],
        }


@dataclass(frozen=True, slots=True)
class ResolvedBusinessTerms:
    candidates: tuple[dict[str, Any], ...]
    resolution: dict[str, Any]
    time: dict[str, str] | None
    intent: str | None
    structure_operation: str | None

    def to_payload(self) -> dict[str, Any]:
        return {
            "resolution": self.resolution,
            "time": self.time,
            "intent": self.intent,
            "structureOperation": self.structure_operation,
        }


def resolve_metric_terms(
    *,
    question: str,
    business_domains: Sequence[str],
    metric_entries: Sequence[MetricEntry],
    limit: int = 5,
) -> MetricTermResolution:
    """Match and disambiguate governed metric names exactly like the TS baseline."""

    allowed_domains = set(business_domains)
    unfiltered: list[RankedMetricCandidate] = []
    for entry in metric_entries:
        if entry.business_domain not in allowed_domains:
            continue
        hit = _best_hit(question, entry.name, entry.aliases)
        if hit is None:
            continue
        matched_term, score = hit
        unfiltered.append(
            RankedMetricCandidate(
                metric_name=entry.name,
                business_domain=entry.business_domain,
                definition=entry.definition,
                unit=entry.unit,
                matched_term=matched_term,
                score=score,
            )
        )

    candidates = [
        candidate
        for candidate in unfiltered
        if all(
            other.matched_term == candidate.matched_term
            or candidate.matched_term not in other.matched_term
            for other in unfiltered
        )
    ]
    candidates.sort(
        key=lambda candidate: (
            -candidate.score,
            candidate.business_domain,
            candidate.metric_name,
        )
    )
    candidates = candidates[: max(0, limit)]

    by_term: dict[str, list[RankedMetricCandidate]] = {}
    for candidate in candidates:
        by_term.setdefault(candidate.matched_term, []).append(candidate)
    selected: list[RankedMetricCandidate] = []
    ambiguous_terms: list[str] = []
    for term, group in by_term.items():
        highest_score = max(candidate.score for candidate in group)
        tied = [candidate for candidate in group if candidate.score == highest_score]
        if len(tied) > 1:
            ambiguous_terms.append(term)
        else:
            selected.append(tied[0])

    return MetricTermResolution(
        candidates=tuple(candidates),
        selected=tuple(selected),
        ambiguous_terms=tuple(ambiguous_terms),
    )


def resolve_business_terms(
    *,
    question: str,
    business_domains: Sequence[str],
    dimension_entries: Sequence[DimensionEntry],
    now: datetime,
) -> ResolvedBusinessTerms:
    """Resolve governed dimensions/values and the fixed Ask lexical conventions."""

    allowed_domains = set(business_domains)
    entries = [
        entry
        for entry in dimension_entries
        if entry.business_domain in allowed_domains
    ]
    matches: list[dict[str, Any]] = []
    for entry in entries:
        hit = _best_named_hit(question, entry.name, entry.aliases)
        if hit is not None:
            term, source, score, start = hit
            matches.append(
                _term_match(
                    kind="dimension",
                    term=term,
                    canonical_name=entry.name,
                    business_domain=entry.business_domain,
                    source=source,
                    score=score,
                    start=start,
                    definition=entry.definition,
                )
            )
        for value in entry.values or ():
            start = question.find(value)
            if start < 0:
                continue
            matches.append(
                _term_match(
                    kind="dimension_value",
                    term=value,
                    canonical_name=value,
                    business_domain=entry.business_domain,
                    source="value_domain",
                    score=VALUE_HIT_SCORE + len(value),
                    start=start,
                    definition=entry.name,
                )
            )

    first_time_by_domain: dict[str, DimensionEntry] = {}
    for entry in entries:
        if entry.is_time:
            first_time_by_domain.setdefault(entry.business_domain, entry)
    relative_time = _resolve_relative_time(
        question,
        supports_month=any(
            "month" in entry.granularities
            for entry in first_time_by_domain.values()
        ),
        now=now,
    )
    if relative_time is not None:
        matches.append(relative_time[0])

    analysis_intent = _resolve_analysis_intent(question)
    if analysis_intent is not None:
        matches.append(analysis_intent[0])

    structure_operation = _resolve_structure_operation(question)
    if structure_operation is not None:
        matches.append(structure_operation[0])

    matches.sort(key=_term_sort_key)
    selected, ambiguities = _disambiguate_terms(matches)
    return ResolvedBusinessTerms(
        candidates=tuple(matches),
        resolution={
            "formatVersion": "1.0",
            "question": question,
            "matches": selected,
            "ambiguities": ambiguities,
        },
        time=None if relative_time is None else relative_time[1],
        intent=None if analysis_intent is None else analysis_intent[1],
        structure_operation=(
            None if structure_operation is None else structure_operation[1]
        ),
    )


def _best_hit(
    question: str, name: str, aliases: Sequence[str]
) -> tuple[str, int] | None:
    hits: list[tuple[str, int]] = []
    if name in question:
        hits.append((name, NAME_HIT_SCORE))
    hits.extend(
        (alias, ALIAS_HIT_SCORE) for alias in aliases if alias in question
    )
    if not hits:
        return None
    matched_term, base_score = min(
        hits,
        key=lambda hit: (-len(hit[0]), -hit[1]),
    )
    return matched_term, base_score + len(matched_term)


def _best_named_hit(
    question: str, name: str, aliases: Sequence[str]
) -> tuple[str, str, int, int] | None:
    hits: list[tuple[str, str, int]] = []
    if name in question:
        hits.append((name, "canonical_name", NAME_HIT_SCORE))
    hits.extend(
        (alias, "alias", ALIAS_HIT_SCORE)
        for alias in aliases
        if alias in question
    )
    if not hits:
        return None
    term, source, base = min(hits, key=lambda hit: (-len(hit[0]), -hit[2]))
    return term, source, base + len(term), question.find(term)


def _resolve_relative_time(
    question: str, *, supports_month: bool, now: datetime
) -> tuple[dict[str, Any], dict[str, str]] | None:
    if not supports_month:
        return None

    def month(offset: int) -> str:
        absolute = now.year * 12 + now.month - 1 + offset
        return f"{absolute // 12:04d}-{absolute % 12 + 1:02d}"

    def result(
        term: str, canonical_name: str, start: int, time: dict[str, str]
    ) -> tuple[dict[str, Any], dict[str, str]]:
        return (
            _term_match(
                kind="relative_time",
                term=term,
                canonical_name=canonical_name,
                business_domain=None,
                source="relative_time_lexicon",
                score=LEXICON_HIT_SCORE + len(term),
                start=start,
            ),
            time,
        )

    start = question.find("上个月")
    if start >= 0:
        return result(
            "上个月",
            "previous_month",
            start,
            {
                "granularity": "month",
                "start": month(-1),
                "end": month(-1),
                "providedBy": "user",
            },
        )

    half_year = re.search(r"(?:(\d{4})\s*年)?(上|下)半年", question)
    if half_year is not None:
        year = now.year if half_year.group(1) is None else int(half_year.group(1))
        first_half = half_year.group(2) == "上"
        return result(
            half_year.group(0),
            "first_half_year" if first_half else "second_half_year",
            half_year.start(),
            {
                "granularity": "month",
                "start": f"{year}-01" if first_half else f"{year}-07",
                "end": f"{year}-06" if first_half else f"{year}-12",
                "providedBy": "user",
            },
        )

    recent = re.search(r"最近\s*(\d+)\s*个月|近\s*(\d+)\s*个月", question)
    if recent is not None:
        count = int(recent.group(1) or recent.group(2))
        if count > 0:
            return result(
                recent.group(0),
                "recent_months",
                recent.start(),
                {
                    "granularity": "month",
                    "start": month(-(count - 1)),
                    "end": month(0),
                    "providedBy": "user",
                },
            )

    current_year = re.search(r"今年以来|今年", question)
    if current_year is not None:
        return result(
            current_year.group(0),
            "current_year",
            current_year.start(),
            {
                "granularity": "month",
                "start": f"{now.year}-01",
                "end": month(0),
                "providedBy": "user",
            },
        )
    return None


def _resolve_analysis_intent(
    question: str,
) -> tuple[dict[str, Any], str] | None:
    definitions = (
        (r"趋势|走势|变化", "trend"),
        (r"排名|排行|top|前十|前 ?\d+", "ranking"),
        (r"占比|构成|分布", "composition"),
        (r"明细|清单|列表", "detail"),
    )
    for expression, intent in definitions:
        hit = re.search(expression, question, re.IGNORECASE)
        if hit is None:
            continue
        return (
            _term_match(
                kind="analysis_intent",
                term=hit.group(0),
                canonical_name=intent,
                business_domain=None,
                source="analysis_intent_lexicon",
                score=LEXICON_HIT_SCORE + len(hit.group(0)),
                start=hit.start(),
            ),
            intent,
        )
    return None


def _resolve_structure_operation(
    question: str,
) -> tuple[dict[str, Any], str] | None:
    definitions = (
        (r"新增一个|增加|再加|添加|加一个", "add"),
        (r"删除|移除", "remove"),
        (r"替换|换成", "replace"),
        (r"拆成|分别展示", "split"),
        (r"合并|放到一张图", "merge"),
    )
    for expression, operation in definitions:
        hit = re.search(expression, question)
        if hit is None:
            continue
        return (
            _term_match(
                kind="structure_operation",
                term=hit.group(0),
                canonical_name=operation,
                business_domain=None,
                source="structure_operation_lexicon",
                score=LEXICON_HIT_SCORE + len(hit.group(0)),
                start=hit.start(),
            ),
            operation,
        )
    return None


def _term_match(
    *,
    kind: str,
    term: str,
    canonical_name: str,
    business_domain: str | None,
    source: str,
    score: int,
    start: int,
    definition: str | None = None,
) -> dict[str, Any]:
    return {
        "kind": kind,
        "matchedTerm": term,
        "canonicalName": canonical_name,
        "businessDomain": business_domain,
        "source": source,
        "score": score,
        **({} if definition is None else {"definition": definition}),
        "start": start,
        "end": start + len(term),
    }


def _term_sort_key(match: dict[str, Any]) -> tuple[object, ...]:
    return (
        match["start"],
        -len(match["matchedTerm"]),
        -match["score"],
        match["businessDomain"] or "",
        match["canonicalName"],
    )


def _disambiguate_terms(
    matches: Sequence[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    groups: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for match in matches:
        groups.setdefault((match["kind"], match["matchedTerm"]), []).append(match)
    selected: list[dict[str, Any]] = []
    ambiguities: list[dict[str, Any]] = []
    for group in groups.values():
        top_score = max(match["score"] for match in group)
        tied = [match for match in group if match["score"] == top_score]
        if len(tied) == 1:
            selected.append(tied[0])
            continue
        ambiguities.append(
            {
                "matchedTerm": tied[0]["matchedTerm"],
                "candidates": [
                    {
                        "kind": match["kind"],
                        "canonicalName": match["canonicalName"],
                        "businessDomain": match["businessDomain"],
                        "score": match["score"],
                        **(
                            {}
                            if "definition" not in match
                            else {"definition": match["definition"]}
                        ),
                    }
                    for match in tied
                ],
            }
        )
    selected.sort(key=_term_sort_key)
    return selected, ambiguities


def _match_payload(candidate: RankedMetricCandidate) -> dict[str, Any]:
    return {
        "kind": "metric",
        "matchedTerm": candidate.matched_term,
        "canonicalName": candidate.metric_name,
        "businessDomain": candidate.business_domain,
        "source": (
            "canonical_name"
            if candidate.matched_term == candidate.metric_name
            else "alias"
        ),
        "score": candidate.score,
        "definition": candidate.definition,
    }


def _ambiguity_candidate_payload(
    candidate: RankedMetricCandidate,
) -> dict[str, Any]:
    return {
        "kind": "metric",
        "canonicalName": candidate.metric_name,
        "businessDomain": candidate.business_domain,
        "score": candidate.score,
        "definition": candidate.definition,
    }
