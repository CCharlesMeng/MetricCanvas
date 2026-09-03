from __future__ import annotations

import os
from collections.abc import Mapping

from metriccanvas_authoring.application.ports import ServiceIdentity


OPERATOR_ID_ENV = "METRICCANVAS_OPERATOR_ID"
AUTH_TOKEN_ENV = "METRICCANVAS_AUTH_TOKEN"


class EnvIdentityPort:
    """Service-state identity from the MCP config ``env`` (ADR-0063, first adapter).

    Every author acts as one operator; nothing here may be described as
    "acting on the user's behalf". Replacing this adapter with per-user
    injection is the production gate registered in ADR-0063.
    """

    def __init__(self, environ: Mapping[str, str] | None = None) -> None:
        self._environ = os.environ if environ is None else environ

    def current(self) -> ServiceIdentity:
        operator_id = (self._environ.get(OPERATOR_ID_ENV) or "").strip()
        if not operator_id:
            raise RuntimeError(
                f"{OPERATOR_ID_ENV} is not configured in the MCP server env"
            )
        auth_token = (self._environ.get(AUTH_TOKEN_ENV) or "").strip() or None
        return ServiceIdentity(operator_id=operator_id, auth_token=auth_token)
