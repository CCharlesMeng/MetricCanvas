from __future__ import annotations

import hashlib
import json
from typing import Any, Mapping


def canonical_json(value: Any) -> str:
    """Key-sorted, whitespace-free JSON; only ever compared with itself."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def derive_idempotency_key(
    page_id: str,
    base_revision_id: str | None,
    spec: Mapping[str, Any],
) -> str:
    """ADR-0063: ``hash(pageId, baseRevisionId, canonical(PageBuildSpec))``.

    The model never supplies this key. A retried or replayed call with the
    same intent hits the same key and is served by the Java fingerprint
    idempotency; a different Spec on the same base is a different key and the
    second save is judged as ``REVISION_CONFLICT``. Including ``pageId`` keeps
    keys apart across pages because Java scopes them per actor, not per page.
    """
    digest = hashlib.sha256()
    for part in (page_id, base_revision_id or "", canonical_json(spec)):
        digest.update(part.encode("utf-8"))
        digest.update(b"\x00")
    return digest.hexdigest()
