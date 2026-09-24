"""Check internal assembly without model/network/page writes; optionally verify a trusted turn."""
import argparse
import asyncio
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tool'))
from metriccanvas_authoring.bootstrap.adapter_contract import AdapterContractError
from metriccanvas_authoring.bootstrap.deployment import load_adapters, prepare
from metriccanvas_authoring.bootstrap.readiness import current_turn_readiness


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--context-ref', help='Optional real trusted turn reference; may access internal providers')
    args = parser.parse_args()
    try:
        adapters = load_adapters()
        _, _, report = prepare(adapters)
        if args.context_ref:
            report = asyncio.run(current_turn_readiness(report, adapters.current_turns, args.context_ref))
    except AdapterContractError as error:
        report = {'deploymentReady': False, 'code': error.code}
    except Exception:
        report = {'deploymentReady': False, 'code': 'ADAPTER_ASSEMBLY_FAILED'}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report['deploymentReady'] and (not args.context_ref or report['currentTurn']['status'] == 'valid') else 2


if __name__ == '__main__':
    raise SystemExit(main())
