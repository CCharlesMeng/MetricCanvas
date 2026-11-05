"""Replay pinned historical consumers; never records new expectations."""
from __future__ import annotations
import json
from pathlib import Path
import subprocess
import sys
import tempfile

from compatibility import compare, compare_states
from frozen_consumer import snapshot_bytes, snapshot_json
from release import canonical, digest, finite_float, read_json, reject_constant, require, tools_directory, unique_object, verify


def load_consumer(path, checksum):
    require(digest(snapshot_bytes(path)) == checksum, "CONSUMER_SNAPSHOT_CHANGED", str(path))
    value = snapshot_json(path)
    require(value["format"] == "metriccanvas-frozen-consumer/1" and bool(value["vectors"]),
            "CONSUMER_SNAPSHOT_INVALID", "Missing frozen consumer vectors")
    require(value["sourceReleaseId"] == value["manifest"]["releaseId"],
            "CONSUMER_SNAPSHOT_INVALID", "Consumer source release mismatch")
    return value


def contract_check(candidate, consumer, current=None):
    state = verify(candidate)
    before = {key: consumer[key] for key in ("manifest", "interface", "resources")}
    reports = [compare_states(before, state)]
    if current is not None:
        reports.append(compare(current, candidate))
    return reports


def envelope_errors(result, vector):
    expected = {"format", "requestId", "operation", "status", "data", "diagnostics"}
    if not isinstance(result, dict) or set(result) != expected:
        return ["result envelope changed"]
    checks = {"format": "metriccanvas-mc-result/1", "requestId": vector["request"]["requestId"],
              "operation": vector["operation"], "status": vector["expected"]["status"]}
    return [key + " changed" for key, value in checks.items() if result[key] != value]


def content_errors(result, expected):
    errors = []
    if canonical(result.get("diagnostics")) != canonical(expected["diagnostics"]):
        errors.append("ordered diagnostics changed")
    if "data" in expected and canonical(result.get("data")) != canonical(expected["data"]):
        errors.append("product data changed")
    for key, value in expected.get("dataProjection", {}).items():
        if not isinstance(result.get("data"), dict) or canonical(result["data"].get(key)) != canonical(value):
            errors.append("content projection changed: " + key)
    return errors


def run_vector(candidate, vector, python_prefix=None):
    command = list(python_prefix or [sys.executable, "-I", "-B"])
    command += [str(candidate / tools_directory(candidate) / "cli.py"), "invoke", vector["operation"]]
    with tempfile.TemporaryDirectory(prefix="mc-frozen-consumer-") as cwd:
        child = subprocess.run(command, input=canonical(vector["request"]), capture_output=True, cwd=cwd, timeout=60)
    try:
        result = json.loads(child.stdout, object_pairs_hook=unique_object, parse_constant=reject_constant, parse_float=finite_float)
        errors = envelope_errors(result, vector)
        if isinstance(result, dict):
            errors.extend(content_errors(result, vector["expected"]))
    except (ValueError, TypeError, KeyError) as error:
        errors = ["invalid result JSON: " + str(error)]
    if child.returncode != vector["expected"]["exitCode"]:
        errors.append("exit code changed")
    return {"operation": vector["operation"], "requestId": vector["request"]["requestId"],
            "passed": not errors, "details": errors}


def replay(candidate, consumer, current=None, python_prefix=None):
    reports = contract_check(candidate, consumer, current)
    checks = [run_vector(candidate, vector, python_prefix) for vector in consumer["vectors"]]
    passed = all(report["status"] == "ok" for report in reports) and all(check["passed"] for check in checks)
    return {"format": "metriccanvas-consumer-replay/1", "status": "ok" if passed else "needs_migration",
            "code": "FROZEN_CONSUMER_PASSED" if passed else "FROZEN_CONSUMER_CHANGED",
            "consumerVersion": consumer["consumerVersion"], "sourceReleaseId": consumer["sourceReleaseId"],
            "compatibility": reports, "checks": checks, "eligibleForSmoke": passed, "automaticPromotion": False}
