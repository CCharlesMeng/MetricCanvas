from __future__ import annotations

import json
from typing import Annotated, Any, Literal

from fastmcp import FastMCP
from pydantic import Field, WithJsonSchema
from typing_extensions import TypedDict

from metriccanvas_authoring.bundle_info import load_bundle_info
from metriccanvas_authoring.pages.composition.compose_page import (
    ComposePageCommand,
    ComposePageDependencies,
    create_compose_page,
)
from metriccanvas_authoring.data.discover_data_context import (
    DiscoverDataContextCommand,
    DiscoverDataContextDependencies,
    create_discover_data_context,
)
from metriccanvas_authoring.data.execution import retry_safe_for_code
from metriccanvas_authoring.runtime_assets import bundle_root


BUNDLE_ROOT = bundle_root()
PAGE_BUILD_SPEC_SCHEMA = json.loads(
    (
        BUNDLE_ROOT
        / "contracts"
        / "authored"
        / "page-build-spec.schema.json"
    ).read_text(encoding="utf-8")
)


def _inline_local_refs(value: Any, root: dict[str, Any]) -> Any:
    if isinstance(value, list):
        return [_inline_local_refs(entry, root) for entry in value]
    if not isinstance(value, dict):
        return value
    reference = value.get("$ref")
    if isinstance(reference, str) and reference.startswith("#/$defs/"):
        name = reference.removeprefix("#/$defs/")
        target = root["$defs"][name]
        siblings = {key: entry for key, entry in value.items() if key != "$ref"}
        return _inline_local_refs({**target, **siblings}, root)
    return {
        key: _inline_local_refs(entry, root)
        for key, entry in value.items()
        if key not in {"$defs", "$schema"}
    }


RUNTIME_PAGE_BUILD_SPEC_SCHEMA = _inline_local_refs(
    PAGE_BUILD_SPEC_SCHEMA, PAGE_BUILD_SPEC_SCHEMA
)
RUNTIME_PAGE_BUILD_SPEC_SCHEMA['properties']['units']['items']['properties']['intent']['enum'] = json.loads(
    (BUNDLE_ROOT / 'contracts/exported/analysis-intents.json').read_text())['intents']
# The Tool advertises the authored contract, while the application validator
# remains the enforcement point so failures keep stable MetricCanvas code/path.
PageBuildSpec = Annotated[
    dict[str, Any],
    WithJsonSchema(RUNTIME_PAGE_BUILD_SPEC_SCHEMA),
]


class _ToolIssueRequired(TypedDict):
    code: str
    path: str
    message: str
    stage: str
    retrySafe: bool


class ToolIssue(_ToolIssueRequired, total=False):
    candidates: list[str]


TermKind = Literal[
    "metric",
    "dimension",
    "dimension_value",
    "relative_time",
    "analysis_intent",
    "structure_operation",
]
TermSource = Literal[
    "canonical_name",
    "alias",
    "value_domain",
    "relative_time_lexicon",
    "analysis_intent_lexicon",
    "structure_operation_lexicon",
]


class _DiscoveryTermRequired(TypedDict):
    kind: TermKind
    matchedTerm: str
    canonicalName: str
    businessDomain: str | None
    source: TermSource
    score: int


class DiscoveryTerm(_DiscoveryTermRequired, total=False):
    definition: str
    start: int
    end: int


class _DiscoveryAmbiguityCandidateRequired(TypedDict):
    kind: TermKind
    canonicalName: str
    businessDomain: str | None
    score: int


class DiscoveryAmbiguityCandidate(
    _DiscoveryAmbiguityCandidateRequired, total=False
):
    definition: str


class DiscoveryAmbiguity(TypedDict):
    matchedTerm: str
    candidates: list[DiscoveryAmbiguityCandidate]


class DiscoveryResolution(TypedDict):
    formatVersion: Literal["1.0"]
    question: str
    candidates: list[DiscoveryTerm]
    selected: list[DiscoveryTerm]
    ambiguities: list[DiscoveryAmbiguity]


class DiscoveryTime(TypedDict):
    granularity: str
    start: str
    end: str
    providedBy: Literal["user"]


class DiscoverDataContextOutput(TypedDict):
    ok: bool
    dataContextVersion: str | None
    businessDomains: list[str]
    matches: list[dict[str, Any]]
    resolution: DiscoveryResolution | None
    time: DiscoveryTime | None
    intent: Literal[
        "comparison",
        "trend",
        "composition",
        "ranking",
        "detail",
        "single_value",
    ] | None
    structureOperation: (
        Literal["add", "remove", "replace", "split", "merge"] | None
    )
    issues: list[ToolIssue]


class FormulaTraceOutput(TypedDict):
    question: str
    expression: str
    referencedMetrics: list[str]


class PageBuildArtifactOutput(TypedDict):
    formatVersion: Literal["1.0"]
    document: dict[str, Any]
    documentSha256: str
    dataContextVersion: str
    bundleVersion: str
    formulaTraces: list[FormulaTraceOutput]


class RelayModelSummary(TypedDict):
    status: Literal["page_composed"]
    pageId: str
    unitCount: int
    topLevelComponentCount: int
    dataContextVersion: str
    bundleVersion: str
    documentSha256: str


class RelayArtifactEnvelope(TypedDict):
    kind: Literal["metriccanvas.page-build-artifact"]
    formatVersion: Literal["1.0"]
    artifact: PageBuildArtifactOutput
    modelSummary: RelayModelSummary


class ComposePageOutput(TypedDict):
    ok: bool
    completedStages: list[str]
    artifactEnvelope: RelayArtifactEnvelope | None
    issues: list[ToolIssue]


def create_mcp_server(dependencies: ComposePageDependencies) -> FastMCP:
    """Ordinary Ask/Explore: compose temporary artifacts, never save assets."""
    discover = create_discover_data_context(
        DiscoverDataContextDependencies(data_context=dependencies.data_context)
    )
    compose = create_compose_page(
        ComposePageDependencies(
            data_context=dependencies.data_context,
            dqe=dependencies.dqe,
        )
    )
    mcp = FastMCP(
        "metriccanvas-authoring",
        instructions=(
            "Use the MetricCanvas Page Builder Skill. Discover governed names, then "
            "submit one complete Page Build Spec; generated query and page JSON are "
            "not model-authored inputs. The Relay surface requires a Page Artifact "
            "Adapter that stores artifactEnvelope.artifact and returns only "
            "artifactEnvelope.modelSummary to the model."
        ),
    )

    @mcp.resource("metriccanvas://bundle-info")
    def bundle_info() -> str:
        """Return Bundle and contract identity outside the model tool surface."""
        return json.dumps(load_bundle_info(), ensure_ascii=False)

    @mcp.tool
    async def discover_data_context(
        query: str,
        limit: Annotated[int, Field(ge=1, le=50)] = 10,
    ) -> DiscoverDataContextOutput:
        """Return governed details and deterministic term disambiguation."""
        result = await discover(DiscoverDataContextCommand(query=query, limit=limit))
        return {
            "ok": result.ok,
            "dataContextVersion": result.data_context_version,
            "businessDomains": list(result.business_domains),
            "matches": list(result.matches),
            "resolution": result.resolution,
            "time": result.time,
            "intent": result.intent,
            "structureOperation": result.structure_operation,
            "issues": [
                {
                    "code": issue.code,
                    "path": issue.path,
                    "message": issue.message,
                    "stage": issue.stage,
                    "retrySafe": retry_safe_for_code(issue.code),
                }
                for issue in result.issues
            ],
        }


    @mcp.tool
    async def compose_page(
        page_id: str,
        spec: PageBuildSpec,
    ) -> ComposePageOutput:
        """Return a validated page artifact for Relay checkpoint handoff.

        Relay must store the full artifact envelope before exposing only its
        modelSummary. User-triggered persistence remains a platform-to-Java action.
        """
        result = await compose(ComposePageCommand(page_id=page_id, spec=spec))
        envelope: RelayArtifactEnvelope | None = None
        if result.artifact is not None:
            artifact_payload = result.artifact.to_payload()
            envelope = {
                "kind": "metriccanvas.page-build-artifact",
                "formatVersion": "1.0",
                "artifact": artifact_payload,
                "modelSummary": {
                    "status": "page_composed",
                    "pageId": page_id,
                    "unitCount": _unit_count(spec),
                    "topLevelComponentCount": _top_level_component_count(
                        artifact_payload["document"]
                    ),
                    "dataContextVersion": result.artifact.data_context_version,
                    "bundleVersion": result.artifact.bundle_version,
                    "documentSha256": result.artifact.document_sha256,
                },
            }
        return {
            "ok": result.ok,
            "completedStages": list(result.completed_stages),
            "artifactEnvelope": envelope,
            "issues": [
                {
                    "code": issue.code,
                    "path": issue.path,
                    "message": issue.message,
                    "stage": issue.stage,
                    "retrySafe": issue.retry_safe,
                    **(
                        {}
                        if not issue.candidates
                        else {"candidates": list(issue.candidates)}
                    ),
                }
                for issue in result.issues
            ],
        }

    return mcp


def _unit_count(spec: dict[str, Any]) -> int:
    units = spec.get("units")
    return len(units) if isinstance(units, list) else 0


def _top_level_component_count(document: dict[str, Any]) -> int:
    sections = document.get("sections")
    if not isinstance(sections, list):
        return 0
    return sum(
        len(components)
        for section in sections
        if isinstance(section, dict)
        and isinstance((components := section.get("components")), list)
    )
