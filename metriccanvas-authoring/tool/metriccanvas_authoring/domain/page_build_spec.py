from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator


BUNDLE_ROOT = Path(__file__).resolve().parents[3]
AUTHORING_CONTRACT_ROOT = BUNDLE_ROOT / "contracts"
PRODUCT_CONTRACT_ROOT = BUNDLE_ROOT / "contract-snapshot"


@dataclass(frozen=True, slots=True)
class PageBuildSpecIssue:
    code: str
    path: str
    message: str

    def as_dict(self) -> dict[str, str]:
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
    for index, unit in enumerate(value["units"]):
        intent = unit["intent"]
        if intent not in intents:
            issues.append(
                PageBuildSpecIssue(
                    code="PAGE_BUILD_SPEC_CLOSED_SET_ERROR",
                    path=f"/units/{index}/intent",
                    message=f"unknown analysis intent: {intent}",
                )
            )
        pinned = unit.get("pinnedComponent")
        if pinned is not None and pinned not in component_types:
            issues.append(
                PageBuildSpecIssue(
                    code="PAGE_BUILD_SPEC_CLOSED_SET_ERROR",
                    path=f"/units/{index}/pinnedComponent",
                    message=f"unknown component type: {pinned}",
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
