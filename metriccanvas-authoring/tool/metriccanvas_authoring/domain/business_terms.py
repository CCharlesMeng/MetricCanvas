from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Sequence

from metriccanvas_authoring.domain.data_context import MetricEntry


NAME_HIT_SCORE = 100
ALIAS_HIT_SCORE = 50


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
