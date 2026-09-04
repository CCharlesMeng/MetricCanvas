from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Mapping

from metriccanvas_authoring.application.ports import DataContextError, DataContextPort
from metriccanvas_authoring.domain.business_terms import (
    MetricTermResolution,
    ResolvedBusinessTerms,
    resolve_business_terms,
    resolve_metric_terms,
)
from metriccanvas_authoring.domain.data_context import DataContext, parse_data_context


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True, slots=True)
class DiscoverDataContextCommand:
    query: str
    limit: int = 10


@dataclass(frozen=True, slots=True)
class DiscoverDataContextDependencies:
    data_context: DataContextPort
    now: Callable[[], datetime] = _utc_now


@dataclass(frozen=True, slots=True)
class DiscoverDataContextIssue:
    code: str
    path: str
    message: str
    stage: str = "discovery"


@dataclass(frozen=True, slots=True)
class DiscoverDataContextResult:
    ok: bool
    data_context_version: str | None = None
    business_domains: tuple[str, ...] = ()
    matches: tuple[Mapping[str, Any], ...] = ()
    resolution: Mapping[str, Any] | None = None
    time: Mapping[str, str] | None = None
    intent: str | None = None
    structure_operation: str | None = None
    issues: tuple[DiscoverDataContextIssue, ...] = ()


DiscoverDataContext = Callable[
    [DiscoverDataContextCommand], Awaitable[DiscoverDataContextResult]
]


def create_discover_data_context(
    dependencies: DiscoverDataContextDependencies,
) -> DiscoverDataContext:
    async def discover(
        command: DiscoverDataContextCommand,
    ) -> DiscoverDataContextResult:
        try:
            snapshot = await dependencies.data_context.current()
        except DataContextError as error:
            return DiscoverDataContextResult(
                ok=False,
                issues=(
                    DiscoverDataContextIssue(error.code, "", str(error)),
                ),
            )
        data_context, issues = parse_data_context(snapshot)
        if issues:
            return DiscoverDataContextResult(
                ok=False,
                issues=tuple(
                    DiscoverDataContextIssue(issue.code, issue.path, issue.message)
                    for issue in issues
                ),
            )
        assert data_context is not None
        business_domains = tuple(data_context.surfaces_by_domain)
        metric_resolution = resolve_metric_terms(
            question=command.query,
            business_domains=business_domains,
            metric_entries=data_context.metric_entries,
            limit=command.limit,
        )
        business_resolution = resolve_business_terms(
            question=command.query,
            business_domains=business_domains,
            dimension_entries=data_context.dimension_entries,
            now=dependencies.now(),
        )
        matches = data_context.search(command.query, command.limit)
        if not matches:
            matches = _fallback_sentence_search(
                data_context,
                command.limit,
                metric_resolution,
                business_resolution,
            )
        metric_payload = metric_resolution.to_payload(command.query)
        return DiscoverDataContextResult(
            ok=True,
            data_context_version=data_context.version,
            business_domains=business_domains,
            matches=matches,
            resolution={
                "formatVersion": "1.0",
                "question": command.query,
                "candidates": [
                    candidate.to_term_match_payload()
                    for candidate in metric_resolution.candidates
                ]
                + list(business_resolution.candidates),
                "selected": list(metric_payload["matches"])
                + list(business_resolution.resolution["matches"]),
                "ambiguities": list(metric_payload["ambiguities"])
                + list(business_resolution.resolution["ambiguities"]),
            },
            time=business_resolution.time,
            intent=business_resolution.intent,
            structure_operation=business_resolution.structure_operation,
        )

    return discover


def _fallback_sentence_search(
    data_context: DataContext,
    limit: int,
    metric_resolution: MetricTermResolution,
    business_resolution: ResolvedBusinessTerms,
) -> tuple[Mapping[str, Any], ...]:
    """Recover governed terms when a model sends a sentence instead of one term."""
    terms = [
        (candidate.metric_name, "metric")
        for candidate in metric_resolution.candidates
    ]
    terms.extend(
        (str(match["matchedTerm"]), "field")
        for match in business_resolution.resolution["matches"]
        if match["kind"] in {"dimension", "dimension_value"}
    )
    if business_resolution.time is not None:
        terms.extend(
            (entry.name, "field")
            for entry in data_context.dimension_entries
            if entry.is_time
        )

    matches: list[Mapping[str, Any]] = []
    seen: set[str] = set()
    for term, expected_kind in terms:
        for match in data_context.search(term, limit):
            if match.get("kind") != expected_kind:
                continue
            identity = json.dumps(
                match, ensure_ascii=False, sort_keys=True, separators=(",", ":")
            )
            if identity in seen:
                continue
            seen.add(identity)
            matches.append(match)
            if len(matches) >= limit:
                return tuple(matches)
    return tuple(matches)
