from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError


BUNDLE_ROOT = Path(__file__).resolve().parents[3]
PRODUCT_CONTRACT_ROOT = BUNDLE_ROOT / "contract-snapshot"


@dataclass(frozen=True, slots=True)
class PageContractIssue:
    type: str
    path: str
    message: str

    def as_dict(self) -> dict[str, str]:
        return asdict(self)


def validate_page_schema(value: Any) -> list[PageContractIssue]:
    """Run the structural Page contract exported from the TS/Zod truth."""
    schema = json.loads(
        (PRODUCT_CONTRACT_ROOT / "page" / "schema.json").read_text(encoding="utf-8")
    )
    validator = Draft202012Validator(schema)
    issues: list[PageContractIssue] = []
    for error in validator.iter_errors(value):
        for path in _error_paths(error):
            issues.append(PageContractIssue("SCHEMA_ERROR", path, error.message))
    return sorted(issues, key=lambda issue: (issue.path, issue.message))


def _error_paths(error: ValidationError) -> list[str]:
    base = _pointer(error.absolute_path)
    if error.validator == "required" and isinstance(error.instance, dict):
        missing = [name for name in error.validator_value if name not in error.instance]
        return [_join_pointer(base, name) for name in missing]
    return [base]


def _join_pointer(base: str, part: object) -> str:
    encoded = str(part).replace("~", "~0").replace("/", "~1")
    return f"{base}/{encoded}" if base else f"/{encoded}"


def _pointer(parts: Any) -> str:
    result = ""
    for part in parts:
        result = _join_pointer(result, part)
    return result
