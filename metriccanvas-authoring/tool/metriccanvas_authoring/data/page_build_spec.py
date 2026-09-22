from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from typing import Any

from jsonschema import Draft202012Validator

from metriccanvas_authoring.runtime_assets import bundle_root


BUNDLE_ROOT = bundle_root()
AUTHORING_CONTRACT_ROOT = BUNDLE_ROOT / "contracts"
PRODUCT_CONTRACT_ROOT = BUNDLE_ROOT / "contract-snapshot"


@dataclass(frozen=True, slots=True)
class PageBuildSpecIssue:
    code: str
    path: str
    message: str
    candidates: tuple[str, ...] = ()

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def validate_page_build_spec(value: Any) -> list[PageBuildSpecIssue]:
    """Validate structure plus closed sets exported from current TS rules."""
    schema = _read_authoring_json("authored/page-build-spec.schema.json")
    validator = Draft202012Validator(schema)
    issues = [
        PageBuildSpecIssue(
            code="PAGE_BUILD_SPEC_SCHEMA_ERROR",
            path=_pointer(error.absolute_path),
            message=error.message,
        )
        for error in sorted(validator.iter_errors(value), key=lambda item: list(item.absolute_path))
    ]
    if issues or not isinstance(value, dict):
        return issues

    intents = set(_read_authoring_json("exported/analysis-intents.json")["intents"])
    component_types = {
        entry["type"]
        for entry in _read_product_json("page/component-catalog.json")
    }
    data_source_ids: set[str] = set()
    for index, unit in enumerate(value["units"]):
        data_source_id = unit.get("dataSourceId")
        if data_source_id is not None:
            if data_source_id in data_source_ids:
                issues.append(
                    PageBuildSpecIssue(
                        code="PAGE_BUILD_SPEC_DUPLICATE_UNIT_ID",
                        path=f"/units/{index}/dataSourceId",
                        message=f"duplicate data request unit id: {data_source_id}",
                    )
                )
            data_source_ids.add(data_source_id)
        intent = unit["intent"]
        if intent not in intents:
            issues.append(
                PageBuildSpecIssue(
                    code="PAGE_BUILD_SPEC_CLOSED_SET_ERROR",
                    path=f"/units/{index}/intent",
                    message=f"unknown analysis intent: {intent}",
                    candidates=tuple(sorted(intents)),
                )
            )
        pinned = unit.get("pinnedComponent")
        if pinned is not None and pinned not in component_types:
            issues.append(
                PageBuildSpecIssue(
                    code="PAGE_BUILD_SPEC_CLOSED_SET_ERROR",
                    path=f"/units/{index}/pinnedComponent",
                    message=f"unknown component type: {pinned}",
                    candidates=tuple(sorted(component_types)),
                )
            )
    return issues


def _read_authoring_json(name: str) -> Any:
    return json.loads((AUTHORING_CONTRACT_ROOT / name).read_text(encoding="utf-8"))


def _read_product_json(name: str) -> Any:
    return json.loads((PRODUCT_CONTRACT_ROOT / name).read_text(encoding="utf-8"))


def _pointer(parts: Any) -> str:
    encoded = [str(part).replace("~", "~0").replace("/", "~1") for part in parts]
    return "" if not encoded else "/" + "/".join(encoded)
