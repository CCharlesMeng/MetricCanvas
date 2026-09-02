from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Mapping

from metriccanvas_authoring.application.ports import DataContextPort
from metriccanvas_authoring.domain.data_context import parse_data_context


@dataclass(frozen=True, slots=True)
class DiscoverDataContextCommand:
    query: str
    limit: int = 10


@dataclass(frozen=True, slots=True)
class DiscoverDataContextDependencies:
    data_context: DataContextPort


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
    matches: tuple[Mapping[str, Any], ...] = ()
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
        snapshot = await dependencies.data_context.current()
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
        return DiscoverDataContextResult(
            ok=True,
            data_context_version=data_context.version,
            matches=data_context.search(command.query, command.limit),
        )

    return discover
