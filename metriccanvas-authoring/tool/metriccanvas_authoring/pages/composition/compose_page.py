from __future__ import annotations

import hashlib
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, replace
from copy import deepcopy
from typing import Any, Mapping

from metriccanvas_authoring.bundle_info import load_bundle_info
from metriccanvas_authoring.data.execution import (
    FailureStage,
    FormulaTrace,
)
from metriccanvas_authoring.canonical import canonical_json
from metriccanvas_authoring.build_issues import PageBuildingIssue, PageBuildingIssues
from metriccanvas_authoring.pages.composition.page_building import (
    assemble_page_document,
)
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document
from metriccanvas_authoring.pages.components.component_policy import apply_component_policy

from metriccanvas_authoring.data.query import (
    QueryDataDependencies,
    QueryDataIssue as ComposePageIssue,
    create_query_data,
)

@dataclass(frozen=True, slots=True)
class ComposePageDependencies(QueryDataDependencies):
    business_interpretation: Any = None
    component_policy: Any = None
    metric_relations: Any = None


@dataclass(frozen=True, slots=True)
class ComposePageCommand:
    page_id: str
    spec: Mapping[str, Any]


@dataclass(frozen=True, slots=True)
class PageBuildArtifact:
    format_version: str
    document: Mapping[str, Any]
    document_sha256: str
    data_context_version: str
    bundle_version: str
    formula_traces: tuple[FormulaTrace, ...]
    source_descriptions: tuple[Mapping[str, Any], ...] = ()

    def to_payload(self) -> dict[str, Any]:
        return {
            "formatVersion": self.format_version,
            "document": self.document,
            "documentSha256": self.document_sha256,
            "dataContextVersion": self.data_context_version,
            "bundleVersion": self.bundle_version,
            "formulaTraces": [trace.to_payload() for trace in self.formula_traces],
            **({"sourceDescriptions": deepcopy(list(self.source_descriptions))} if self.source_descriptions else {}),
        }


@dataclass(frozen=True, slots=True)
class ComposePageResult:
    ok: bool
    artifact: PageBuildArtifact | None = None
    issues: tuple[ComposePageIssue, ...] = ()
    completed_stages: tuple[FailureStage, ...] = ()


ComposePage = Callable[[ComposePageCommand], Awaitable[ComposePageResult]]


def _base_revision_issue(command):
    base = command.spec.get("baseRevision") if isinstance(command.spec, Mapping) else None
    if isinstance(base, Mapping) and base.get("pageId") != command.page_id:
        return ComposePageResult(ok=False, issues=(ComposePageIssue(
            "BASE_REVISION_PAGE_ID_MISMATCH", "/baseRevision/pageId",
            f"baseRevision.pageId must equal the page being built ({command.page_id!r})"),))
    return None


def _presentation_failure(issues):
    return ComposePageResult(ok=False, issues=tuple(ComposePageIssue(
        issue.code, issue.path, issue.message, stage="presentation", candidates=issue.candidates)
        for issue in issues), completed_stages=("discovery", "generation", "execution"))


def compose_queried_page(command, queried, bundle_info, *, page_schema=None, node_resources=None):
    """Assemble supplied query facts; this entrypoint has no execution/policy callbacks."""
    invalid = _base_revision_issue(command)
    if invalid is not None:
        return invalid
    if not queried.ok:
        return ComposePageResult(ok=False, issues=queried.issues, completed_stages=queried.completed_stages)
    try:
        document = assemble_page_document(page_id=command.page_id,
            description=_optional_string(command.spec.get("description")),
            schema_version=str(bundle_info["pageSchemaVersion"]), units=queried.units, executions=queried.executions)
    except PageBuildingIssues as group:
        return _presentation_failure(group.issues)
    except PageBuildingIssue as issue:
        return _presentation_failure((issue,))
    validation = {}
    if page_schema is not None:
        validation['schema'] = page_schema
    if node_resources is not None:
        validation['node_resources'] = node_resources
    issues = validate_page_document(document, **validation)
    if issues:
        return ComposePageResult(ok=False, issues=tuple(ComposePageIssue(
            issue.type, issue.path, issue.message, stage="presentation") for issue in issues),
            completed_stages=("discovery", "generation", "execution"))
    return ComposePageResult(ok=True, artifact=PageBuildArtifact(format_version="1.0", document=document,
        document_sha256=hashlib.sha256(canonical_json(document).encode("utf-8")).hexdigest(),
        data_context_version=queried.data_context_version, bundle_version=str(bundle_info["bundleVersion"]),
        source_descriptions=tuple(deepcopy(queried.source_descriptions)),
        formula_traces=tuple(trace for unit in queried.units for trace in unit.formula_traces)),
        completed_stages=("discovery", "generation", "execution", "presentation"))


def create_compose_page(dependencies: ComposePageDependencies) -> ComposePage:
    """Compatibility coordinator: discovery/execution/policy precede the pure assembly."""
    async def compose_page(command: ComposePageCommand) -> ComposePageResult:
        invalid = _base_revision_issue(command)
        if invalid is not None:
            return invalid
        queried = await create_query_data(dependencies)(command.spec)
        if not queried.ok:
            return ComposePageResult(ok=False, issues=queried.issues, completed_stages=queried.completed_stages)
        bundle_info = load_bundle_info()
        try:
            units = await apply_component_policy(queried.units, queried.executions,
                                                dependencies.component_policy, dependencies.authoring_scope)
        except PageBuildingIssues as group:
            return _presentation_failure(group.issues)
        except PageBuildingIssue as issue:
            return _presentation_failure((issue,))
        return compose_queried_page(command, replace(queried, units=tuple(units)), bundle_info)
    return compose_page


def _optional_string(value: object) -> str | None:
    return value if isinstance(value, str) else None
