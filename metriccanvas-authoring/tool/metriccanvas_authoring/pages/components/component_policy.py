"""Optional selection policy constrained by existing product gates and builders."""
from copy import deepcopy
from dataclasses import replace
from types import MappingProxyType

from metriccanvas_authoring.pages.components.component_selection import recommend_components
from metriccanvas_authoring.pages.composition.page_building import ASSEMBLED_COMPONENT_TYPES, PageBuildingIssue


async def apply_component_policy(units, executions, policy, scope):
    if policy is None:
        return units
    if scope is None:
        raise PageBuildingIssue('COMPONENT_POLICY_SCOPE_UNAVAILABLE', '', 'Trusted component policy scope unavailable')
    chosen = []
    for index, (unit, execution) in enumerate(zip(units, executions, strict=True)):
        # An explicit user choice is always checked by the original product gate.
        if unit.pinned_component is not None:
            chosen.append(unit)
            continue
        candidates = recommend_components(unit.fields,
            row_count=execution.total_count if execution.total_count is not None else len(execution.rows),
            intent=unit.intent, pinned=None)
        allowed = {candidate.component_type for candidate in candidates
                   if candidate.ok and candidate.component_type in ASSEMBLED_COMPONENT_TYPES}
        projection = tuple(MappingProxyType({'type': candidate.component_type,
            'allowed': candidate.component_type in allowed, 'defaultSpan': candidate.default_span})
            for candidate in candidates)
        try:
            selected = await policy.choose(MappingProxyType(deepcopy(dict(scope))), projection)
        except Exception:
            raise PageBuildingIssue('COMPONENT_POLICY_UNAVAILABLE', f'/units/{index}', 'Component policy unavailable') from None
        if not isinstance(selected, str) or selected not in allowed:
            raise PageBuildingIssue('COMPONENT_POLICY_REJECTED', f'/units/{index}', 'Component policy selected an unsupported capability')
        chosen.append(replace(unit, pinned_component=selected))
    return tuple(chosen)
