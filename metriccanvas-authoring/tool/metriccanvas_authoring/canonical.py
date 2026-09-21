from __future__ import annotations

import hashlib
import json
from typing import Any


def canonical_json(value: Any) -> str:
    """Key-sorted, whitespace-free JSON used for hashing, storage and comparison.

    Rejecting NaN/Infinity keeps every encoded form parseable JSON, so a digest
    always stands for a value the receiving side can read back.
    """
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def canonical_sha256(value: Any) -> str:
    """Digest of the canonical encoding.

    This identifies a value inside this program. It is not the Java content
    hash and proves nothing about another system's canonicalization.
    """
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()
