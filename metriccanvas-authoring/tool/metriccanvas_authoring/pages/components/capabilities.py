"""三种组件能力各自的唯一维护点，以及它们之间的关系检查。

- **可渲染**：产品事实，真源是 `packages/page` 导出的 `component-catalog.json`，本仓不另写一份。
- **可自动构造**：创作期能不能从取数单元直接装配出这个组件。
- **允许编辑数据依赖**：创作期能不能改这个组件挂的数据源与字段。

三者不是同一件事，不能合成一个清单；但后两者都必须落在可渲染之内，且产品目录里的**每一个**
组件都要在 `AUTHORING_CAPABILITIES` 里显式表态。产品新增组件而创作侧没配套时，这里直接抛错，
不静默漏掉。
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Mapping

from metriccanvas_authoring.runtime_assets import bundle_root


COMPONENT_CATALOG = (
    bundle_root() / "contract-snapshot" / "page" / "component-catalog.json"
)


@dataclass(frozen=True, slots=True)
class AuthoringCapability:
    """创作侧对一个产品组件的表态。可渲染不在这里声明，由产品目录决定。"""

    assembled: bool
    data_editable: bool


# 显式覆盖产品目录的全部组件；新增产品组件必须在这里补一行，哪怕两项都是 False。
AUTHORING_CAPABILITIES: Mapping[str, AuthoringCapability] = {
    "reportHeader": AuthoringCapability(assembled=False, data_editable=False),
    "metricCard": AuthoringCapability(assembled=True, data_editable=True),
    "barChart": AuthoringCapability(assembled=True, data_editable=True),
    "lineChart": AuthoringCapability(assembled=True, data_editable=True),
    "pieChart": AuthoringCapability(assembled=True, data_editable=True),
    "table": AuthoringCapability(assembled=True, data_editable=True),
    "mapChart": AuthoringCapability(assembled=False, data_editable=False),
    "gauge": AuthoringCapability(assembled=True, data_editable=True),
    "tabContainer": AuthoringCapability(assembled=False, data_editable=False),
    "compositeCard": AuthoringCapability(assembled=False, data_editable=False),
    "rankingCard": AuthoringCapability(assembled=True, data_editable=True),
    "rankingDetailCard": AuthoringCapability(assembled=True, data_editable=True),
    "keyValuePanel": AuthoringCapability(assembled=True, data_editable=True),
    "categoryBreakdown": AuthoringCapability(assembled=True, data_editable=True),
    "fieldText": AuthoringCapability(assembled=False, data_editable=False),
    "text": AuthoringCapability(assembled=False, data_editable=False),
    "aiSummary": AuthoringCapability(assembled=False, data_editable=False),
}


@lru_cache(maxsize=1)
def product_catalog() -> tuple[Mapping[str, Any], ...]:
    """可渲染组件的产品目录条目，含 defaultSpan 与硬门控。唯一读取点。"""
    raw = json.loads(COMPONENT_CATALOG.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise TypeError("component catalog must be an array")
    entries = []
    for entry in raw:
        if not isinstance(entry, Mapping):
            raise TypeError("component catalog entry must be an object")
        entries.append(entry)
    return tuple(entries)


def renderable_component_types() -> frozenset[str]:
    return frozenset(str(entry["type"]) for entry in product_catalog())


def _check_capability_coverage() -> None:
    renderable = renderable_component_types()
    declared = frozenset(AUTHORING_CAPABILITIES)
    undeclared = sorted(renderable - declared)
    if undeclared:
        raise AssertionError(
            "产品目录新增组件但创作能力未表态，请在 AUTHORING_CAPABILITIES 补充："
            + "、".join(undeclared)
        )
    unknown = sorted(declared - renderable)
    if unknown:
        raise AssertionError(
            "创作能力声明了产品不可渲染的组件：" + "、".join(unknown)
        )


_check_capability_coverage()

# 可自动构造 ⊆ 可渲染、允许编辑 ⊆ 可渲染，由上面的覆盖检查保证。
ASSEMBLED_COMPONENT_TYPES = frozenset(
    name for name, capability in AUTHORING_CAPABILITIES.items() if capability.assembled
)
DATA_COMPONENTS = tuple(
    name
    for name, capability in AUTHORING_CAPABILITIES.items()
    if capability.data_editable
)
