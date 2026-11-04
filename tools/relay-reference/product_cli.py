"""Stable process facade. Private implementation paths are not consumer APIs."""
from pathlib import Path
import json
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent / "_impl"))


def launch():
    try:
        from product_runtime import main
        return main(Path(__file__).resolve().parents[1], sys.argv[1:])
    except (ImportError, SyntaxError, OSError, ValueError) as error:
        result = {"format": "metriccanvas-mc-result/1", "requestId": "", "operation": "", "status": "error",
                  "data": {}, "diagnostics": [{"code": "PRODUCT_ENTRY_UNAVAILABLE", "path": "mc-tool",
                  "message": str(error)}]}
        sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode("utf-8") + b"\n")
        return 3

if __name__ == "__main__":
    raise SystemExit(launch())
