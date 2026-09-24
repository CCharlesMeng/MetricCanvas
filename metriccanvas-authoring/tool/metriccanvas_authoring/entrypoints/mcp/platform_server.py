"""Target entrypoint; assembly lives in ``metriccanvas_authoring.bootstrap``.

Standalone invocation advertises the current platform protocol but fails
closed without trusted providers. Historical candidate entrypoints are not
part of the production registration and are never a fallback.
"""
import json
import os
import sys

from metriccanvas_authoring.bootstrap.adapter_contract import AdapterContractError

from metriccanvas_authoring.bootstrap.platform import (
    create_platform_server,
    create_production_platform_server,
    DeploymentReadinessError,
)

__all__ = ["create_platform_server", "create_production_platform_server", "main"]


def main():
    try:
        server = create_production_platform_server(
            protocol_discovery=os.environ.get('METRICCANVAS_PROTOCOL_DISCOVERY') == '1')
    except AdapterContractError as error:
        print(json.dumps({'deploymentReady': False, 'code': error.code}), file=sys.stderr)
        raise SystemExit(2) from None
    except DeploymentReadinessError as error:
        print(json.dumps(error.report, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(2) from None
    except Exception:
        print(json.dumps({'deploymentReady': False, 'code': 'ADAPTER_ASSEMBLY_FAILED'}), file=sys.stderr)
        raise SystemExit(2) from None
    server.run()


if __name__ == '__main__':
    main()
