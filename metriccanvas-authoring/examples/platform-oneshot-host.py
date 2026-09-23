"""Package-outside entrypoint template for one MCP stdio invocation.

The host module named by METRICCANVAS_HOST_ADAPTER_MODULE supplies trusted
per-invocation adapters via create_host_adapters(). This file provides no
identity, confirmation or artifact receipt fallback.
"""
from __future__ import annotations

import importlib
import json
import os
import sys

from metriccanvas_authoring.adapters.firstparty.lifecycle_http import KnownLifecycleHttp
from metriccanvas_authoring.adapters.storage.platform_state import SqlitePlatformState
from metriccanvas_authoring.bootstrap.platform import create_platform_server
from metriccanvas_authoring.bootstrap.readiness import platform_readiness
from metriccanvas_authoring.pages.composition.compose_page import ComposePageDependencies


def main() -> int:
    module_name = os.environ.get('METRICCANVAS_HOST_ADAPTER_MODULE', '').strip()
    db_path = os.environ.get('METRICCANVAS_WORK_DB', '').strip()
    collection_url = os.environ.get('METRICCANVAS_LIFECYCLE_COLLECTION_URL', '').strip()
    if not module_name or not db_path or not collection_url:
        print('host module, shared work DB and lifecycle URL are required', file=sys.stderr)
        return 2
    host = importlib.import_module(module_name).create_host_adapters()
    deps = ComposePageDependencies(host.get('data_context'), host.get('dqe'),
                                   source_description=host.get('source_description'))
    store = SqlitePlatformState(db_path)
    lifecycle = KnownLifecycleHttp(collection_url)
    inputs = dict(current_turns=host.get('current_turns'), store=store,
                  analysis_authorization=host.get('analysis_authorization'),
                  lifecycle_service=lifecycle,
                  lifecycle_identities=host.get('lifecycle_identities'),
                  relay_preview=host.get('relay_preview'),
                  parameter_dependencies=host.get('parameter_dependencies'))
    report = platform_readiness(deps, **inputs)
    if not report['deploymentReady']:
        print(json.dumps(report, ensure_ascii=False), file=sys.stderr)
        return 2
    create_platform_server(deps, **inputs).run()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
