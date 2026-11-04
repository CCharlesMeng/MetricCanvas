"""Configured product Python regressions, using the already prepared build env."""
from pathlib import Path
import os
import subprocess
import sys
import unittest

sys.dont_write_bytecode = True

from config import ROOT, load_config, python_executable
from release import require


def main():
    interpreter = python_executable()
    if Path(interpreter).resolve() != Path(sys.executable).resolve():
        return subprocess.call([interpreter, "-B", str(Path(__file__).resolve())], env={**os.environ, "METRICCANVAS_PYTHON": interpreter})
    sys.path.insert(0, str(ROOT / "metriccanvas-authoring/tool"))
    folder = ROOT / "metriccanvas-authoring/test-harness/tests"
    suite = unittest.TestSuite()
    for pattern in load_config()["coreTests"]:
        tests = unittest.defaultTestLoader.discover(str(folder), pattern=pattern)
        require(tests.countTestCases() > 0, "PRODUCT_CORE_TESTS_MISSING", pattern)
        suite.addTests(tests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
