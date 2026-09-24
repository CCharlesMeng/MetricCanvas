"""Relay-owned stdio command; implementation changes stay outside the Bundle."""
import json
import os
import sys

from metriccanvas_authoring.bootstrap.platform import DeploymentReadinessError
from metriccanvas_relay_authoring.adapters import create_host_adapters
from metriccanvas_relay_authoring.host import AdapterContractError, create_relay_server


def main() -> None:
    try:
        adapters = create_host_adapters()
    except AdapterContractError as error:
        print(json.dumps({'deploymentReady': False, 'code': error.code}), file=sys.stderr)
        raise SystemExit(2) from None
    except Exception:
        print(json.dumps({'deploymentReady': False, 'code': 'RELAY_ADAPTER_LOAD_FAILED'}), file=sys.stderr)
        raise SystemExit(2) from None
    try:
        server = create_relay_server(
            adapters,
            work_db=os.environ.get('METRICCANVAS_WORK_DB', '').strip(),
            lifecycle_collection_url=os.environ.get('METRICCANVAS_LIFECYCLE_COLLECTION_URL', '').strip(),
        )
    except AdapterContractError as error:
        print(json.dumps({'deploymentReady': False, 'code': error.code}), file=sys.stderr)
        raise SystemExit(2) from None
    except DeploymentReadinessError as error:
        print(json.dumps(error.report, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(2) from None
    except Exception:
        print(json.dumps({'deploymentReady': False, 'code': 'RELAY_HOST_ASSEMBLY_FAILED'}), file=sys.stderr)
        raise SystemExit(2) from None
    server.run()
