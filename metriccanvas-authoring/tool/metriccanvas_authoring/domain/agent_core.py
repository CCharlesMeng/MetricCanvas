"""Pure deterministic rules for the Ask/Explore Agent workflow seam."""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, Mapping, Sequence


__all__ = [
    "AgentCoreError",
    "DomainOverrideResult",
    "MetricGapConfirmationResult",
    "MetricGapResolutionPlan",
    "MetricSelectionResult",
    "PendingMetricGapRegistration",
    "PresentationRequestResult",
    "StructuralGuardResult",
    "UnitDecisionPartition",
    "UnitIntentResolution",
    "UnitOperationResult",
    "ZeroMatchRerouteResult",
    "ad_hoc_gap_key",
    "apply_presentation_request",
    "apply_unit_operations",
    "confirm_metric_gaps",
    "guard_structural_response",
    "normalize_display_only_decision",
    "normalize_unit_operations",
    "partition_unit_decision",
    "plan_metric_gap_resolution",
    "prepare_ad_hoc_metric_gap",
    "reroute_zero_match",
    "resolve_domain_override",
    "resolve_target_data_source_id",
    "resolve_unit_intent",
    "scope_gap_key",
    "validate_metric_selection",
    "validate_route_decision",
]


JsonObject = Mapping[str, Any]
MAX_DATA_REQUEST_UNITS = 6
STRUCTURAL_INTENT_TERMS = (
    ("合并", "合并"),
    ("合成一", "合并"),
    ("合到", "合并"),
    ("放到一", "合并"),
    ("放在一", "合并"),
    ("放一张", "合并"),
    ("拆分", "拆分"),
    ("拆成", "拆分"),
    ("分成", "拆分"),
    ("分开展示", "拆分"),
    ("分别展示", "拆分"),
    ("删除", "删除"),
    ("移除", "删除"),
    ("去掉", "删除"),
    ("增加一个", "增加"),
    ("添加一个", "增加"),
    ("再加一个", "增加"),
    ("加一个", "增加"),
)
GENERIC_VISUALIZATION_TERMS = ("图表", "图形", "可视化")
ANALYSIS_INTENTS = frozenset(
    {"comparison", "trend", "composition", "ranking", "detail", "single_value"}
)


def ad_hoc_gap_key(business_domain: str, expression: str) -> str:
    """Identify an Ad-hoc Metric gap by domain and expression shape."""

    normalized = re.sub(
        r"\s+",
        "",
        re.sub(r"[0-9]+(?:\.[0-9]+)?", "#", expression.lower()),
    )
    return f"adhoc:{business_domain}:{normalized}"


def scope_gap_key(business_domain: str, sought: str) -> str:
    """Identify an out-of-scope gap by domain and normalized sought concept."""

    normalized = re.sub(r'''[\s?。.!,、;:"'()]+''', "", sought.lower())
    return f"scope:{business_domain}:{normalized}"


class AgentCoreError(ValueError):
    def __init__(
        self, code: str, message: str, *, data_source_id: str | None = None
    ) -> None:
        super().__init__(message)
        self.code = code
        self.data_source_id = data_source_id


@dataclass(frozen=True, slots=True)
class UnitOperationResult:
    entries: tuple[JsonObject, ...]
    touched_data_source_ids: tuple[str, ...]
    added_data_source_ids: tuple[str, ...]
    next_ordinal: int
    dropped_adds: int


@dataclass(frozen=True, slots=True)
class UnitDecisionPartition:
    executable_decision: JsonObject | None
    gaps: tuple[JsonObject, ...]
    out_of_scope_reason: str | None


def partition_unit_decision(decision: JsonObject) -> UnitDecisionPartition:
    """Keep answerable Data Request Units separate from missing aspects."""

    if decision.get("outcome") == "out_of_scope":
        reason = decision.get("reason")
        return UnitDecisionPartition(
            executable_decision=None,
            gaps=(),
            out_of_scope_reason=reason if isinstance(reason, str) else None,
        )
    return UnitDecisionPartition(
        executable_decision={
            key: value for key, value in decision.items() if key != "gaps"
        },
        gaps=tuple(
            _mapping(gap) for gap in _sequence(decision.get("gaps"))
        ),
        out_of_scope_reason=None,
    )


@dataclass(frozen=True, slots=True)
class PendingMetricGapRegistration:
    occurrences: tuple[JsonObject, ...]


@dataclass(frozen=True, slots=True)
class MetricGapResolutionPlan:
    outcome: str
    executable_decision: JsonObject | None
    executable_entries: tuple[JsonObject, ...]
    gap_aspects: tuple[JsonObject, ...]
    out_of_scope_reason: str | None
    can_deliver_answer: bool
    interaction_required: bool
    interaction: JsonObject | None
    pending: PendingMetricGapRegistration | None


@dataclass(frozen=True, slots=True)
class MetricGapConfirmationResult:
    status: str
    events: tuple[JsonObject, ...]


def plan_metric_gap_resolution(
    *,
    question: str,
    decision: JsonObject,
    executable_entries: Sequence[JsonObject],
    candidates: Sequence[JsonObject],
    routed_domains: Sequence[str],
    interaction_id: str,
    anchor_data_source_id: str | None = None,
) -> MetricGapResolutionPlan:
    """Plan non-blocking partial answers and confirmed Metric Gap recording."""

    partition = partition_unit_decision(decision)
    entries = (
        ()
        if partition.executable_decision is None
        else tuple(executable_entries)
    )
    closest_candidates = _closest_candidate_payloads(candidates)
    occurrences: list[JsonObject] = []
    if partition.executable_decision is None:
        business_domain = _first_string(routed_domains)
        if business_domain is None:
            raise AgentCoreError(
                "METRIC_GAP_DOMAIN_REQUIRED",
                "面外缺口缺少已路由业务域",
            )
        search_terms = _dedupe_strings(
            candidate.get("matchedTerm") for candidate in candidates
        )
        occurrences.append(
            {
                "idempotencyKey": scope_gap_key(business_domain, question),
                "question": question,
                "searchTerms": list(search_terms),
                "closestCandidates": list(closest_candidates),
                "adHocDefinition": None,
                "expectedDimensions": [],
                "expectedGranularity": None,
                "businessDomain": business_domain,
            }
        )
    elif partition.gaps:
        anchor = _gap_anchor(entries, anchor_data_source_id)
        anchor_unit = (
            _mapping(anchor.get("unit")) if anchor is not None else None
        )
        business_domain = (
            anchor_unit.get("businessDomain")
            if anchor_unit is not None
            else _first_string(routed_domains)
        )
        if not isinstance(business_domain, str):
            raise AgentCoreError(
                "METRIC_GAP_DOMAIN_REQUIRED",
                "部分可答缺口缺少业务域",
            )
        expected_dimensions = (
            _dedupe_strings(_sequence(anchor_unit.get("groupBy")))
            if anchor_unit is not None
            else ()
        )
        time = anchor_unit.get("time") if anchor_unit is not None else None
        expected_granularity = (
            time.get("granularity") if isinstance(time, Mapping) else None
        )
        if not isinstance(expected_granularity, str):
            expected_granularity = None
        for gap in partition.gaps:
            aspect = gap.get("aspect")
            if not isinstance(aspect, str) or not aspect:
                raise AgentCoreError(
                    "MODEL_UNIT_DECISION_INVALID",
                    "缺口 aspect 必须是非空字符串",
                )
            occurrences.append(
                {
                    "idempotencyKey": scope_gap_key(
                        business_domain, aspect
                    ),
                    "question": question,
                    "searchTerms": [aspect],
                    "closestCandidates": list(closest_candidates),
                    "adHocDefinition": None,
                    "expectedDimensions": list(expected_dimensions),
                    "expectedGranularity": expected_granularity,
                    "businessDomain": business_domain,
                }
            )

    pending = (
        PendingMetricGapRegistration(occurrences=tuple(occurrences))
        if occurrences
        else None
    )
    interaction = (
        _gap_interaction(interaction_id, question, pending.occurrences)
        if pending is not None
        else None
    )
    return MetricGapResolutionPlan(
        outcome=(
            "partial_answer"
            if pending is not None and entries
            else "interaction_required"
            if pending is not None
            else "ready"
        ),
        executable_decision=partition.executable_decision,
        executable_entries=entries,
        gap_aspects=partition.gaps,
        out_of_scope_reason=partition.out_of_scope_reason,
        can_deliver_answer=bool(entries),
        interaction_required=pending is not None,
        interaction=interaction,
        pending=pending,
    )


def prepare_ad_hoc_metric_gap(
    *,
    question: str,
    unit: JsonObject,
    candidates: Sequence[JsonObject],
) -> PendingMetricGapRegistration | None:
    """Prepare an Ad-hoc Definition occurrence for later confirmation."""

    formula = next(
        (
            _mapping(metric)
            for metric in _sequence(unit.get("metrics"))
            if isinstance(metric, Mapping) and metric.get("kind") == "formula"
        ),
        None,
    )
    if formula is None:
        return None
    expression = formula.get("expression")
    if not isinstance(expression, str) or not expression:
        raise AgentCoreError(
            "AD_HOC_DEFINITION_INVALID",
            "临时指标缺少非空计算表达式",
        )
    business_domain = unit.get("businessDomain")
    if not isinstance(business_domain, str) or not business_domain:
        raise AgentCoreError(
            "METRIC_GAP_DOMAIN_REQUIRED",
            "临时指标缺口缺少业务域",
        )
    description = formula.get("description")
    if description is None:
        description = formula.get("label")
    if not isinstance(description, str):
        description = None
    time = unit.get("time")
    granularity = time.get("granularity") if isinstance(time, Mapping) else None
    if not isinstance(granularity, str):
        granularity = None
    occurrence = {
        "idempotencyKey": ad_hoc_gap_key(business_domain, expression),
        "question": question,
        "searchTerms": list(
            _dedupe_strings(
                candidate.get("matchedTerm") for candidate in candidates
            )
        ),
        "closestCandidates": list(_closest_candidate_payloads(candidates)),
        "adHocDefinition": {
            "formula": expression,
            "description": description,
        },
        "expectedDimensions": list(
            _dedupe_strings(_sequence(unit.get("groupBy")))
        ),
        "expectedGranularity": granularity,
        "businessDomain": business_domain,
    }
    return PendingMetricGapRegistration(occurrences=(occurrence,))


def confirm_metric_gaps(
    *,
    pending: PendingMetricGapRegistration | None,
    confirmed: bool,
) -> MetricGapConfirmationResult:
    """Create persisted step events only after explicit user confirmation."""

    if pending is None:
        return MetricGapConfirmationResult(status="no_pending", events=())
    if confirmed is not True:
        return MetricGapConfirmationResult(status="not_recorded", events=())
    return MetricGapConfirmationResult(
        status="recorded",
        events=tuple(
            {"type": "metric_gap_recorded", "gap": occurrence}
            for occurrence in pending.occurrences
        ),
    )


@dataclass(frozen=True, slots=True)
class StructuralGuardResult:
    status: str
    structural_intent: str | None
    feedback: str | None = None
    code: str | None = None


@dataclass(frozen=True, slots=True)
class PresentationRequestResult:
    entries: tuple[JsonObject, ...]
    request_kind: str
    requested_component: str | None
    affected_data_source_ids: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class UnitIntentResolution:
    question: str
    intent: str
    used_fallback: bool


@dataclass(frozen=True, slots=True)
class MetricSelectionResult:
    status: str
    selected_metric: JsonObject | None


@dataclass(frozen=True, slots=True)
class DomainOverrideResult:
    domains: tuple[str, ...]
    overridden_by_user: bool


@dataclass(frozen=True, slots=True)
class ZeroMatchRerouteResult:
    domains: tuple[str, ...]
    candidates: tuple[JsonObject, ...]
    overridden_by_user: bool
    rerouted: bool


def resolve_target_data_source_id(
    *,
    draft: JsonObject | None,
    target: JsonObject | None,
    entries: Sequence[JsonObject],
) -> str | None:
    """Map the selected page component to its bound Data Request Unit."""

    if draft is None or target is None:
        return None
    section = next(
        (
            candidate
            for candidate in _sequence(draft.get("sections"))
            if isinstance(candidate, Mapping)
            and candidate.get("id") == target.get("sectionId")
        ),
        None,
    )
    if section is None:
        return None
    component = next(
        (
            candidate
            for candidate in _sequence(section.get("components"))
            if isinstance(candidate, Mapping)
            and candidate.get("id") == target.get("componentId")
        ),
        None,
    )
    data = component.get("data") if component is not None else None
    main = data.get("main") if isinstance(data, Mapping) else None
    if not isinstance(main, str):
        return None
    return (
        main
        if any(entry.get("dataSourceId") == main for entry in entries)
        else None
    )


def normalize_unit_operations(
    *,
    decision: JsonObject,
    entries: Sequence[JsonObject],
    target_data_source_id: str | None,
) -> tuple[JsonObject, ...]:
    """Normalize the model's unit/patch shorthand to the four operations."""

    outcome = decision.get("outcome")
    if outcome == "operations":
        return tuple(
            _mapping(operation)
            for operation in _sequence(decision.get("operations"))
        )
    first_id = entries[0].get("dataSourceId") if entries else None
    target_id = target_data_source_id or (
        first_id if isinstance(first_id, str) else None
    )
    if outcome == "unit":
        complete_unit = _mapping(decision.get("unit"))
        if target_id is None:
            return ({"op": "add", "unit": complete_unit},)
        return (
            {
                "op": "replace",
                "dataSourceId": target_id,
                "unit": complete_unit,
            },
        )
    if outcome == "patch":
        if target_id is None:
            return ()
        return (
            {
                "op": "modify",
                "dataSourceId": target_id,
                "patch": _mapping(decision.get("patch")),
            },
        )
    raise AgentCoreError(
        "MODEL_UNIT_DECISION_INVALID",
        f"无法归一化取数单元决策:{outcome}",
    )


def resolve_domain_override(
    *,
    requested_domains: Sequence[str],
    inventory_domains: Sequence[str],
) -> DomainOverrideResult:
    """Apply the visible user domain override before model routing."""

    if not requested_domains:
        return DomainOverrideResult(domains=(), overridden_by_user=False)
    inventory = set(inventory_domains)
    domains = tuple(
        domain for domain in requested_domains if domain in inventory
    )[:2]
    if not domains:
        raise AgentCoreError(
            "DOMAIN_OVERRIDE_INVALID",
            "用户指定的业务域不在域清单内:"
            + "、".join(requested_domains),
        )
    return DomainOverrideResult(domains=domains, overridden_by_user=True)


def validate_route_decision(
    *,
    routed_domains: Sequence[str],
    inventory_domains: Sequence[str],
) -> tuple[str, ...]:
    """Reject model-routed domains that are outside the discovery inventory."""

    normalized = tuple(dict.fromkeys(routed_domains))
    inventory = set(inventory_domains)
    invalid = tuple(domain for domain in normalized if domain not in inventory)
    if not normalized or len(normalized) > 2 or invalid:
        detail = "、".join(invalid or normalized)
        raise AgentCoreError(
            "MODEL_ROUTE_DECISION_INVALID",
            f"业务域模型决策不在发现闭集内:{detail}",
        )
    return normalized


def reroute_zero_match(
    *,
    current_domains: Sequence[str],
    all_domain_candidates: Sequence[JsonObject],
    user_override_present: bool,
    domains_overridden_by_user: bool,
) -> ZeroMatchRerouteResult:
    """Reroute a follow-up only when its retained domains have zero matches."""

    if user_override_present or not all_domain_candidates:
        return ZeroMatchRerouteResult(
            domains=tuple(current_domains),
            candidates=(),
            overridden_by_user=domains_overridden_by_user,
            rerouted=False,
        )
    routed_domains: list[str] = []
    for candidate in all_domain_candidates:
        domain = candidate.get("businessDomain")
        if not isinstance(domain, str) or domain in routed_domains:
            continue
        routed_domains.append(domain)
        if len(routed_domains) == 2:
            break
    if not routed_domains:
        return ZeroMatchRerouteResult(
            domains=tuple(current_domains),
            candidates=(),
            overridden_by_user=domains_overridden_by_user,
            rerouted=False,
        )
    routed = set(routed_domains)
    return ZeroMatchRerouteResult(
        domains=tuple(routed_domains),
        candidates=tuple(
            candidate for candidate in all_domain_candidates
            if candidate.get("businessDomain") in routed
        ),
        overridden_by_user=False,
        rerouted=True,
    )


def validate_metric_selection(
    *,
    ambiguous_terms: Sequence[str],
    candidates: Sequence[JsonObject],
    selection: JsonObject | None,
) -> MetricSelectionResult:
    """Keep ambiguous Scope Card confirmation explicit and candidate-bound."""

    if not ambiguous_terms:
        return MetricSelectionResult(status="not_required", selected_metric=None)
    if selection is None:
        return MetricSelectionResult(
            status="selection_required", selected_metric=None
        )
    business_domain = selection.get("businessDomain")
    metric_name = _candidate_metric_name(selection)
    selected = next(
        (
            candidate
            for candidate in candidates
            if candidate.get("businessDomain") == business_domain
            and _candidate_metric_name(candidate) == metric_name
        ),
        None,
    )
    if selected is None:
        raise AgentCoreError(
            "SCOPE_SELECTION_INVALID",
            f"确认的指标「{business_domain}·{metric_name}」不在候选卡内",
        )
    return MetricSelectionResult(status="selected", selected_metric=selected)


def resolve_unit_intent(
    *,
    question: str,
    unit: JsonObject,
    unit_count: int,
    model_decision: JsonObject | None,
) -> UnitIntentResolution:
    """Scope intent input per unit and close invalid model output deterministically."""

    title = unit.get("title")
    intent_question = (
        title
        if unit_count > 1 and isinstance(title, str) and title
        else question
    )
    model_intent = (
        model_decision.get("intent")
        if isinstance(model_decision, Mapping)
        else None
    )
    if isinstance(model_intent, str) and model_intent in ANALYSIS_INTENTS:
        return UnitIntentResolution(
            question=intent_question,
            intent=model_intent,
            used_fallback=False,
        )
    return UnitIntentResolution(
        question=intent_question,
        intent=_default_intent(unit),
        used_fallback=True,
    )


def apply_presentation_request(
    *,
    entries: Sequence[JsonObject],
    question: str,
    component_catalog: Sequence[JsonObject],
    touched_data_source_ids: Sequence[str] = (),
    target_data_source_id: str | None = None,
) -> PresentationRequestResult:
    """Apply deterministic component wording to touched, target, or all units."""

    requested_component = _explicit_component_request(
        question, component_catalog
    )
    if requested_component is not None:
        request_kind = "explicit"
        next_component: str | None = requested_component
    elif any(term in question for term in GENERIC_VISUALIZATION_TERMS):
        request_kind = "generic"
        next_component = None
    else:
        return PresentationRequestResult(
            entries=tuple(entries),
            request_kind="none",
            requested_component=None,
            affected_data_source_ids=(),
        )

    known_ids = {
        str(entry.get("dataSourceId")) for entry in entries
        if isinstance(entry.get("dataSourceId"), str)
    }
    if touched_data_source_ids:
        scope_ids = tuple(
            data_source_id for data_source_id in touched_data_source_ids
            if data_source_id in known_ids
        )
    elif target_data_source_id in known_ids:
        scope_ids = (target_data_source_id,)
    else:
        scope_ids = tuple(
            str(entry["dataSourceId"])
            for entry in entries
            if entry.get("dataSourceId") in known_ids
        )
    scope = set(scope_ids)
    return PresentationRequestResult(
        entries=tuple(
            {**entry, "requestedComponent": next_component}
            if entry.get("dataSourceId") in scope
            else entry
            for entry in entries
        ),
        request_kind=request_kind,
        requested_component=requested_component,
        affected_data_source_ids=scope_ids,
    )


def normalize_display_only_decision(
    *,
    question: str,
    unit_count: int,
    decision: JsonObject,
    component_catalog: Sequence[JsonObject],
) -> JsonObject:
    """Keep a display-only follow-up out of the semantic-surface exit path."""

    display_request = (
        _explicit_component_request(question, component_catalog) is not None
        or any(term in question for term in GENERIC_VISUALIZATION_TERMS)
    )
    if (
        decision.get("outcome") != "out_of_scope"
        or unit_count == 0
        or not display_request
    ):
        return decision
    decision_type = decision.get("decisionType")
    return {
        **(
            {"decisionType": decision_type}
            if isinstance(decision_type, str)
            else {}
        ),
        "outcome": "operations",
        "operations": [],
    }


def guard_structural_response(
    *,
    question: str,
    unit_count: int,
    decision: JsonObject,
    attempt: int,
    structure_operation: str | None = None,
) -> StructuralGuardResult:
    """Reject a model response that silently ignores a structural request."""

    if attempt < 1:
        raise ValueError("attempt must be at least 1")
    structural_intent = _structural_intent_from_operation(
        structure_operation, unit_count
    ) or _structural_intent(question, unit_count)
    if (
        unit_count == 0
        or structural_intent is None
        or not _is_empty_structural_response(decision)
    ):
        return StructuralGuardResult(
            status="accepted", structural_intent=structural_intent
        )
    if attempt == 1:
        return StructuralGuardResult(
            status="correction_required",
            structural_intent=structural_intent,
            feedback=(
                f"用户的这条追问要求对单元集合做结构调整({structural_intent}),"
                "但你回传了空结果。请输出定向单元操作(operations):"
                "合并 = remove 被并入的单元 + modify 保留单元把指标并齐;"
                "拆分 = modify 原单元只保留部分指标 + add 新单元承载其余;"
                "增加 = add;删除 = remove。"
            ),
        )
    return StructuralGuardResult(
        status="rejected",
        structural_intent=structural_intent,
        code="STRUCTURAL_INTENT_NOT_APPLIED",
    )


def apply_unit_operations(
    *,
    entries: Sequence[JsonObject],
    operations: Sequence[JsonObject],
    next_ordinal: int,
    routed_domains: Sequence[str],
    fallback_domain: str,
    question: str,
) -> UnitOperationResult:
    """Apply one model decision to the stable Data Request Unit collection."""

    current = list(entries)
    touched: list[str] = []
    added: list[str] = []
    ordinal = next_ordinal
    dropped_adds = 0
    produces_many_units = sum(
        operation.get("op") in {"add", "replace"} for operation in operations
    ) > 1

    for operation in operations:
        operation_name = operation.get("op")
        if operation_name == "modify":
            data_source_id = str(operation.get("dataSourceId", ""))
            index = _entry_index(current, data_source_id)
            patch = _mapping(operation.get("patch"))
            if not patch:
                continue
            entry = current[index]
            current[index] = {
                **entry,
                "unit": {**_mapping(entry.get("unit")), **patch},
            }
            if data_source_id not in touched:
                touched.append(data_source_id)
            continue
        if operation_name == "replace":
            data_source_id = str(operation.get("dataSourceId", ""))
            index = _entry_index(current, data_source_id)
            raw_unit = _mapping(operation.get("unit"))
            coerced = _coerce_domain(raw_unit, routed_domains, fallback_domain)
            current[index] = {
                **current[index],
                "unit": {
                    **coerced,
                    "title": _unit_title(
                        coerced, question, produces_many_units
                    ),
                },
            }
            if data_source_id not in touched:
                touched.append(data_source_id)
            continue
        if operation_name == "remove":
            data_source_id = str(operation.get("dataSourceId", ""))
            index = _entry_index(current, data_source_id)
            current = [
                entry for entry_index, entry in enumerate(current)
                if entry_index != index
            ]
            continue
        if operation_name != "add":
            continue
        if len(current) >= MAX_DATA_REQUEST_UNITS:
            dropped_adds += 1
            continue
        raw_unit = _mapping(operation["unit"])
        coerced = _coerce_domain(raw_unit, routed_domains, fallback_domain)
        materialized = {
            **coerced,
            "title": _unit_title(coerced, question, produces_many_units),
        }
        data_source_id = _data_source_id(ordinal)
        ordinal += 1
        current.append(
            {
                "dataSourceId": data_source_id,
                "unit": materialized,
                "intent": None,
                "requestedComponent": None,
            }
        )
        touched.append(data_source_id)
        added.append(data_source_id)

    live_ids = {str(entry.get("dataSourceId")) for entry in current}
    return UnitOperationResult(
        entries=tuple(current),
        touched_data_source_ids=tuple(
            data_source_id for data_source_id in touched
            if data_source_id in live_ids
        ),
        added_data_source_ids=tuple(
            data_source_id for data_source_id in added
            if data_source_id in live_ids
        ),
        next_ordinal=ordinal,
        dropped_adds=dropped_adds,
    )


def _data_source_id(ordinal: int) -> str:
    return "result" if ordinal <= 1 else f"result-{ordinal}"


def _first_string(values: Sequence[object]) -> str | None:
    return next(
        (value for value in values if isinstance(value, str) and value),
        None,
    )


def _dedupe_strings(values: Iterable[object]) -> tuple[str, ...]:
    unique: list[str] = []
    for value in values:
        if isinstance(value, str) and value not in unique:
            unique.append(value)
    return tuple(unique)


def _closest_candidate_payloads(
    candidates: Sequence[JsonObject],
) -> tuple[JsonObject, ...]:
    payloads: list[JsonObject] = []
    for candidate in candidates:
        if candidate.get("kind") not in {None, "metric"}:
            continue
        metric_name = _candidate_metric_name(candidate)
        business_domain = candidate.get("businessDomain")
        if not isinstance(metric_name, str) or not metric_name:
            raise AgentCoreError(
                "METRIC_GAP_CANDIDATE_INVALID",
                "缺口候选缺少指标名称",
            )
        if not isinstance(business_domain, str) or not business_domain:
            raise AgentCoreError(
                "METRIC_GAP_CANDIDATE_INVALID",
                "缺口候选缺少业务域",
            )
        difference = (
            candidate.get("definitionDifference")
            if "definitionDifference" in candidate
            else candidate.get("definition")
        )
        payloads.append(
            {
                "metricName": metric_name,
                "businessDomain": business_domain,
                "definitionDifference": (
                    difference if isinstance(difference, str) else None
                ),
            }
        )
    return tuple(payloads)


def _candidate_metric_name(candidate: JsonObject) -> object:
    """Accept the discovery contract and the persisted Scope Card projection."""

    return (
        candidate.get("canonicalName")
        if "canonicalName" in candidate
        else candidate.get("metricName")
    )


def _gap_anchor(
    entries: Sequence[JsonObject], data_source_id: str | None
) -> JsonObject | None:
    if data_source_id is not None:
        return next(
            (
                entry
                for entry in entries
                if entry.get("dataSourceId") == data_source_id
            ),
            None,
        )
    return entries[0] if entries else None


def _gap_interaction(
    interaction_id: str,
    question: str,
    occurrences: Sequence[JsonObject],
) -> JsonObject:
    return {
        "id": interaction_id,
        "kind": "confirm_gap_entry",
        "payload": {
            "question": question,
            "entries": [
                {
                    "businessDomain": occurrence["businessDomain"],
                    "sought": "、".join(
                        _dedupe_strings(
                            _sequence(occurrence.get("searchTerms"))
                        )
                    )
                    or occurrence["question"],
                    "adHocFormula": (
                        definition.get("formula")
                        if isinstance(
                            definition := occurrence.get("adHocDefinition"),
                            Mapping,
                        )
                        else None
                    ),
                }
                for occurrence in occurrences
            ],
        },
    }


def _explicit_component_request(
    question: str, component_catalog: Sequence[JsonObject]
) -> str | None:
    best_type: str | None = None
    best_index = -1
    for entry in component_catalog:
        component_type = entry.get("type")
        label = entry.get("label")
        if not isinstance(component_type, str) or not isinstance(label, str):
            continue
        aliases = [
            alias for alias in _sequence(entry.get("aliases"))
            if isinstance(alias, str)
        ]
        for term in (label, *aliases):
            index = question.rfind(term)
            if index >= 0 and index > best_index:
                best_type = component_type
                best_index = index
    return best_type


def _default_intent(unit: JsonObject) -> str:
    group_by = _sequence(unit.get("groupBy"))
    if not group_by:
        return "single_value"
    return "trend" if unit.get("time") is not None and len(group_by) == 1 else "comparison"


def _structural_intent(question: str, unit_count: int) -> str | None:
    for term, intent in STRUCTURAL_INTENT_TERMS:
        if term not in question:
            continue
        if intent == "合并" and unit_count <= 1:
            continue
        if intent == "拆分" and unit_count > 1:
            continue
        return intent
    return None


def _structural_intent_from_operation(
    operation: str | None, unit_count: int
) -> str | None:
    labels = {
        "add": "增加",
        "remove": "删除",
        "replace": "替换",
        "split": "拆分",
        "merge": "合并",
    }
    label = labels.get(operation or "")
    if label == "合并" and unit_count <= 1:
        return None
    if label == "拆分" and unit_count > 1:
        return None
    return label


def _is_empty_structural_response(decision: JsonObject) -> bool:
    outcome = decision.get("outcome")
    if outcome == "out_of_scope":
        return True
    if outcome == "patch":
        return not _mapping(decision.get("patch"))
    if outcome != "operations":
        return False
    operations = _sequence(decision.get("operations"))
    if not operations:
        return True
    return all(
        isinstance(operation, Mapping)
        and operation.get("op") == "modify"
        and not _mapping(operation.get("patch"))
        for operation in operations
    )


def _entry_index(entries: Sequence[JsonObject], data_source_id: str) -> int:
    for index, entry in enumerate(entries):
        if entry.get("dataSourceId") == data_source_id:
            return index
    raise AgentCoreError(
        "UNKNOWN_DATA_REQUEST_UNIT",
        f"单元操作引用了不存在的取数单元:{data_source_id}",
        data_source_id=data_source_id,
    )


def _coerce_domain(
    unit: JsonObject, routed_domains: Sequence[str], fallback_domain: str
) -> JsonObject:
    if unit.get("businessDomain") in routed_domains:
        return unit
    return {**unit, "businessDomain": fallback_domain}


def _unit_title(unit: JsonObject, question: str, produces_many_units: bool) -> str:
    title = unit.get("title")
    if isinstance(title, str):
        return title
    if not produces_many_units:
        return question
    labels = [
        metric.get("name") if metric.get("kind") == "metric" else metric.get("label")
        for metric in _sequence(unit.get("metrics"))
        if isinstance(metric, Mapping)
    ]
    present = [label for label in labels if isinstance(label, str)]
    return "、".join(present) if present else question


def _mapping(value: object) -> JsonObject:
    if not isinstance(value, Mapping):
        raise TypeError("expected object")
    return value


def _sequence(value: object) -> Sequence[Any]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
        return ()
    return value
