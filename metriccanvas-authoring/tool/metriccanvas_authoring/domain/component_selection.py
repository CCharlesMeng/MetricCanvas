from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping, Sequence


BUNDLE_ROOT = Path(__file__).resolve().parents[3]
COMPONENT_CATALOG = (
    BUNDLE_ROOT / "contract-snapshot" / "page" / "component-catalog.json"
)
ANALYSIS_INTENTS_CONTRACT = (
    BUNDLE_ROOT / "contracts" / "exported" / "analysis-intents.json"
)
INTENT_KEYWORDS: Mapping[str, tuple[str, ...]] = {
    "trend": ("趋势",),
    "comparison": ("对比",),
    "proportion": ("占比",),
    "ranking": ("排行",),
    "detail": ("明细",),
    "summary": ("核心指标", "KPI"),
}


@dataclass(frozen=True, slots=True)
class ResultShape:
    dimension_count: int
    measure_count: int
    row_count: int | None
    has_time_dimension: bool


@dataclass(frozen=True, slots=True)
class ComponentCandidate:
    component_type: str
    default_span: int
    ok: bool
    pinned: bool
    recommended: bool
    reasons: tuple[str, ...]


def recommend_components(
    fields: Mapping[str, Mapping[str, Any]],
    *,
    row_count: int | None,
    intent: str | None,
    pinned: str | None,
) -> tuple[ComponentCandidate, ...]:
    """Apply the machine-readable product catalog gate, then intent ordering."""
    shape = _result_shape(fields, row_count)
    catalog = _component_catalog()
    evaluated = [
        ComponentCandidate(
            component_type=str(entry["type"]),
            default_span=int(entry["defaultSpan"]),
            ok=not (reasons := tuple(_hard_gate_reasons(entry, shape))),
            pinned=entry["type"] == pinned,
            recommended=False,
            reasons=reasons,
        )
        for entry in catalog
    ]
    allowed = [candidate for candidate in evaluated if candidate.ok]
    rejected = [candidate for candidate in evaluated if not candidate.ok]
    catalog_order = {
        str(entry["type"]): index for index, entry in enumerate(catalog)
    }
    entry_by_type = {str(entry["type"]): entry for entry in catalog}
    allowed.sort(
        key=lambda candidate: (
            -_candidate_score(
                entry_by_type[candidate.component_type], candidate, shape, intent
            ),
            catalog_order[candidate.component_type],
        )
    )
    pinned_blocked = pinned is not None and not any(
        candidate.pinned for candidate in allowed
    )
    recommended_type = (
        None if pinned_blocked or not allowed else allowed[0].component_type
    )
    return tuple(
        ComponentCandidate(
            component_type=candidate.component_type,
            default_span=candidate.default_span,
            ok=candidate.ok,
            pinned=candidate.pinned,
            recommended=candidate.component_type == recommended_type,
            reasons=candidate.reasons,
        )
        for candidate in [*allowed, *rejected]
    )


def component_default_span(component_type: str) -> int:
    entry = next(
        (
            entry
            for entry in _component_catalog()
            if entry["type"] == component_type
        ),
        None,
    )
    if entry is None:
        raise ValueError(f"unknown component type: {component_type}")
    return int(entry["defaultSpan"])


def _result_shape(
    fields: Mapping[str, Mapping[str, Any]], row_count: int | None
) -> ResultShape:
    scalar_fields = [field for field in fields.values() if field["role"] != "detail"]
    dimensions = [field for field in scalar_fields if field["role"] == "dimension"]
    measures = [field for field in scalar_fields if field["role"] == "measure"]
    return ResultShape(
        dimension_count=len(dimensions),
        measure_count=len(measures),
        row_count=row_count,
        has_time_dimension=any(
            field["type"] in {"date", "datetime"} for field in dimensions
        ),
    )


def _hard_gate_reasons(
    entry: Mapping[str, Any], shape: ResultShape
) -> list[str]:
    reading = _mapping(entry["authoringShape"])
    data_shape = str(entry["dataShape"])
    if not reading["bindsData"]:
        return [f"数据形状「{data_shape}」不消费页面数据源，不能承载取数单元结果"]

    reasons: list[str] = []
    for semantic in _sequence(reading.get("requiresFieldSemantics", [])):
        reasons.append(
            f"数据形状「{data_shape}」要求「{semantic}」语义，"
            "结果形状不携带字段语义，且不得从样例值推断"
        )
    _check_count(
        reasons,
        data_shape,
        "维度",
        shape.dimension_count,
        reading.get("dimensions"),
    )
    _check_count(
        reasons,
        data_shape,
        "度量",
        shape.measure_count,
        reading.get("measures"),
    )
    min_scalar_fields = reading.get("minScalarFields")
    if (
        isinstance(min_scalar_fields, int)
        and shape.dimension_count + shape.measure_count < min_scalar_fields
    ):
        reasons.append(
            f"数据形状「{data_shape}」不满足：结果形状不含任何 dimension/measure 标量字段"
        )
    max_rows = reading.get("maxRows")
    if isinstance(max_rows, int):
        if shape.row_count is None:
            reasons.append(
                f"行数未经真实执行证明，无法满足数据形状「{data_shape}」的行数约束"
            )
        elif shape.row_count > max_rows:
            reasons.append(
                f"数据形状「{data_shape}」不满足：结果有 {shape.row_count} 行，"
                f"机器判读上限为 {max_rows} 行"
            )
    for prop in _sequence(entry["requiredProps"]):
        leaf = str(prop).split(".")[-1]
        if not leaf.lower().endswith("field") and leaf not in {"label", "title"}:
            reasons.append(f"必填 props「{prop}」无法由结果字段契约自动补齐")
    return reasons


def _check_count(
    reasons: list[str],
    data_shape: str,
    label: str,
    actual: int,
    raw_constraint: object,
) -> None:
    if raw_constraint is None:
        return
    constraint = _mapping(raw_constraint)
    minimum = int(constraint["min"])
    maximum = constraint.get("max")
    if actual < minimum or (isinstance(maximum, int) and actual > maximum):
        reasons.append(
            f"数据形状「{data_shape}」不满足：结果形状含 {actual} 个{label}字段"
        )


def _candidate_score(
    entry: Mapping[str, Any],
    candidate: ComponentCandidate,
    shape: ResultShape,
    intent: str | None,
) -> int:
    score = 100 if candidate.pinned else 0
    if intent is not None:
        visualization_intent = _visualization_intent(intent)
        catalog_text = "；".join(
            [str(entry["purpose"]), *[str(value) for value in entry["chooseWhen"]]]
        )
        if any(
            keyword in catalog_text
            for keyword in INTENT_KEYWORDS.get(visualization_intent, ())
        ):
            score += 10
    if shape.has_time_dimension and "date" in str(entry["dataShape"]).lower():
        score += 1
    return score


@lru_cache(maxsize=1)
def _component_catalog() -> tuple[Mapping[str, Any], ...]:
    raw = json.loads(COMPONENT_CATALOG.read_text(encoding="utf-8"))
    return tuple(_mapping(entry) for entry in _sequence(raw))


@lru_cache(maxsize=1)
def _analysis_intent_mapping() -> Mapping[str, str]:
    raw = json.loads(ANALYSIS_INTENTS_CONTRACT.read_text(encoding="utf-8"))
    mapping = _mapping(raw["visualizationIntentByAnalysisIntent"])
    return {str(key): str(value) for key, value in mapping.items()}


def _visualization_intent(analysis_intent: str) -> str:
    return _analysis_intent_mapping().get(analysis_intent, analysis_intent)


def _mapping(value: object) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise TypeError("expected object")
    return value


def _sequence(value: object) -> Sequence[object]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
        raise TypeError("expected array")
    return value
