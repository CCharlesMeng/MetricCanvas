"""Actual archived-product probes with only the declared installed dependencies."""
from __future__ import annotations
import importlib.metadata
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

from consumer import replay
from release import canonical, require, verify

BOOTSTRAP = ("import runpy,sys;sys.path.insert(0,sys.argv[1]);"
             "sys.argv=sys.argv[2:];runpy.run_path(sys.argv[0],run_name='__main__')")


def copy_dependencies(pins, target):
    for name, constraint in pins.items():
        distribution = importlib.metadata.distribution(name)
        require("==" + distribution.version == constraint, "PRODUCT_DEPENDENCY_UNAVAILABLE", name)
        base = Path(distribution.locate_file("")).resolve()
        for file in distribution.files:
            source = Path(distribution.locate_file(file)).resolve()
            if not source.is_relative_to(base) or not source.is_file() or source.suffix == ".pyc":
                continue
            destination = target / source.relative_to(base)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, destination)
    require(all(not (target / name).exists() for name in ("metriccanvas_authoring", "httpx", "fastmcp")),
            "PRODUCT_PROBE_NOT_ISOLATED", "Forbidden installed package in the runtime dependency set")


def prefix(dependencies):
    return [sys.executable, "-I", "-S", "-B", "-c", BOOTSTRAP, str(dependencies)]


def call(candidate, args, dependencies, cwd, value=None, environment=None):
    command = prefix(dependencies) + [str(candidate / "mc-tools/cli.py"), *args]
    env = {**os.environ, "PYTHONPATH": "", "NODE_PATH": "", "NODE_OPTIONS": ""}
    env.update(environment or {})
    result = subprocess.run(command, input=None if value is None else canonical(value),
                            capture_output=True, cwd=cwd, env=env, timeout=120)
    return result.returncode, json.loads(result.stdout)


def request(value):
    return {"format": "metriccanvas-mc-request/1", "requestId": "archive-probe", "input": value}


def check_call(candidate, args, dependencies, cwd, expected, value=None, environment=None):
    code, receipt = call(candidate, args, dependencies, cwd, value, environment)
    require(code == expected, "PRODUCT_ARCHIVE_PROBE_FAILED", str(args) + ": " + str(receipt))
    return receipt


def negative_probes(candidate, dependencies, cwd):
    checks = []
    cases = [("unknown-operation", ["invoke", "not.an.operation"], request({}), 2),
             ("bad-envelope", ["invoke", "page.validate"], {"format": "wrong"}, 2),
             ("invalid-page", ["invoke", "page.validate"], request({"document": None}), 2),
             ("invalid-evaluation", ["invoke", "page.validate"], request({"document": {}, "evaluation": None}), 2)]
    for name, args, value, expected in cases:
        receipt = check_call(candidate, args, dependencies, cwd, expected, value)
        require(bool(receipt["diagnostics"]), "PRODUCT_ARCHIVE_PROBE_FAILED", name)
        checks.append({"name": name, "passed": True})
    check_call(candidate, ["self-test"], dependencies, cwd, 3, environment={"PATH": str(cwd / "no-node")})
    checks.append({"name": "missing-node", "passed": True})
    empty = cwd / "no-dependencies"
    empty.mkdir()
    check_call(candidate, ["self-test"], empty, cwd, 3)
    check_call(candidate, ["check-release"], empty, cwd, 0)
    checks.append({"name": "missing-python-dependencies", "passed": True})
    return checks


def missing_file_probe(candidate, dependencies, cwd):
    changed = cwd / "missing-file"
    shutil.copytree(candidate, changed)
    (changed / "mc-content/index.json").unlink()
    check_call(changed, ["self-test"], dependencies, cwd, 3)
    return {"name": "missing-file", "passed": True}


def network_probes(candidate, cwd):
    program = ("import sys,socket;sys.path.insert(0,sys.argv[1]);"
               "from product_runtime import offline_audit;sys.addaudithook(offline_audit);"
               "socket.create_connection(('127.0.0.1',9))")
    python = subprocess.run([sys.executable, "-I", "-S", "-B", "-c", program,
                             str(candidate / "mc-tools/_impl")], capture_output=True, cwd=cwd, timeout=10)
    require(python.returncode != 0 and b"PRODUCT_NETWORK_FORBIDDEN" in python.stderr,
            "PRODUCT_ARCHIVE_PROBE_FAILED", "Python network guard did not reject the attempt")
    node = subprocess.run(["node", "--import", (candidate / "mc-tools/_impl/network_guard.mjs").as_uri(),
                           "--input-type=module", "-e", "import net from 'node:net';net.connect(9,'127.0.0.1')"],
                          capture_output=True, cwd=cwd, timeout=10)
    require(node.returncode != 0 and b"PRODUCT_NETWORK_FORBIDDEN" in node.stderr,
            "PRODUCT_ARCHIVE_PROBE_FAILED", "Node network guard did not reject the attempt")
    return [{"name": "python-network-rejected", "passed": True}, {"name": "node-network-rejected", "passed": True}]


def probe(candidate, consumers=(), historical=()):
    before = verify(candidate)
    with tempfile.TemporaryDirectory(prefix="mc-native-runtime-") as directory:
        cwd = Path(directory) / "仓外 probes"
        cwd.mkdir()
        dependencies = cwd / "dependencies"
        dependencies.mkdir()
        copy_dependencies(before["manifest"]["runtime"]["dependencies"], dependencies)
        self_test = check_call(candidate, ["self-test"], dependencies, cwd, 0)
        require(self_test["status"] == "ok" and all(check["passed"] for check in self_test["checks"]),
                "PRODUCT_ARCHIVE_PROBE_FAILED", "Product self-test failed")
        checks = negative_probes(candidate, dependencies, cwd)
        checks.append(missing_file_probe(candidate, dependencies, cwd))
        checks.extend(network_probes(candidate, cwd))
        replays = [replay(candidate, consumer, python_prefix=prefix(dependencies)) for consumer in consumers]
        require(all(report["status"] == "ok" for report in replays), "CONSUMER_REPLAY_FAILED", str(replays))
        observed = [replay(candidate, consumer, python_prefix=prefix(dependencies)) for consumer in historical]
    require(before["manifest"] == verify(candidate)["manifest"], "PRODUCT_ARCHIVE_PROBE_FAILED", "Probe changed the candidate")
    return {"format": "metriccanvas-portable-runtime/1", "status": "ok", "selfTest": self_test,
            "negativeChecks": checks, "consumers": replays, "historicalConsumers": observed,
            "scope": "actual offline product with declared dependencies; Relay/deployment not tested"}
