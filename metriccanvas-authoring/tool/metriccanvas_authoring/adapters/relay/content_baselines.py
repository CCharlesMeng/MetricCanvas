"""Read-only spool populated by a trusted Relay adapter, never by the model.

Each process must receive an identity/workspace-scoped directory. This adapter
does not fetch latest pages, resolve Java IDs, authenticate users, or write files.
"""
import json
import os
import re
import stat
from pathlib import Path

from metriccanvas_authoring.work.content_ports import ContentBaseline, ContentBaselineError

TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]{16,128}$")
MAX_BASELINE_BYTES = 20 * 1024 * 1024


class FileContentBaselines:
    def __init__(self, directory: Path | None) -> None:
        self.directory = directory.resolve() if directory is not None else None

    async def read(self, token: str) -> ContentBaseline:
        if not isinstance(token, str) or not TOKEN_PATTERN.fullmatch(token):
            raise ContentBaselineError("BASELINE_TOKEN_INVALID")
        if self.directory is None:
            raise ContentBaselineError("BASELINE_CAPABILITY_UNAVAILABLE")
        try:
            fd = os.open(self.directory / f"{token}.json", os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
            with os.fdopen(fd, "rb") as source:
                if not stat.S_ISREG(os.fstat(source.fileno()).st_mode):
                    raise ContentBaselineError("BASELINE_INVALID")
                raw = source.read(MAX_BASELINE_BYTES + 1)
            if len(raw) > MAX_BASELINE_BYTES:
                raise ContentBaselineError("BASELINE_TOO_LARGE")
            value = json.loads(raw)
            if not isinstance(value, dict) or set(value) != {"ref", "document", "documentSha256"}:
                raise ContentBaselineError("BASELINE_INVALID")
            return ContentBaseline(value["ref"], value["document"], value["documentSha256"])
        except FileNotFoundError:
            raise ContentBaselineError("BASELINE_NOT_FOUND") from None
        except (OSError, ValueError, TypeError):
            raise ContentBaselineError("BASELINE_INVALID") from None
