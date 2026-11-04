"""Four-artifact process adapter: integrity, envelopes and offline dispatch only."""
from __future__ import annotations

import importlib
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import sys

from release import (RECEIPT_FORMAT, ReleaseError, canonical, finite_float, read_json,
                     reject_constant, require, unique_object, verify)


def offline_audit(event, arguments):
    if event in {"socket.connect", "socket.connect_ex", "socket.getaddrinfo", "socket.bind"}:
        raise RuntimeError("PRODUCT_NETWORK_FORBIDDEN")


def initialize(root):
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="strict")
    sys.addaudithook(offline_audit)
    os.environ["METRICCANVAS_PRODUCT_ROOT"] = str(root)
    os.environ.pop("METRICCANVAS_BUNDLE_ROOT", None)
    os.environ["NODE_PATH"] = ""
    os.environ["NODE_OPTIONS"] = "--import=" + (root / "mc-tool/_impl/network_guard.mjs").as_uri()
    sys.path.insert(0, str(root / "mc-tool" / "python"))


def runtime_check(manifest):
    require(sys.version_info >= (3, 12), "PRODUCT_RUNTIME_UNAVAILABLE", "Python >=3.12 is required")
    for name, constraint in manifest["runtime"]["dependencies"].items():
        installed = importlib.metadata.version(name)
        require(constraint == "==" + installed, "PRODUCT_DEPENDENCY_UNAVAILABLE",
                f"Expected {name}{constraint}; found {installed}")
    node = subprocess.run(["node", "--version"], capture_output=True, text=True, timeout=5, check=True)
    require(int(node.stdout.strip().lstrip("v").split(".")[0]) >= 22,
            "PRODUCT_RUNTIME_UNAVAILABLE", "Node.js >=22 is required")


def parse_request(text):
    value = json.loads(text, object_pairs_hook=unique_object, parse_float=finite_float,
                       parse_constant=reject_constant)
    require(isinstance(value, dict) and set(value) == {"format", "requestId", "input"},
            "PRODUCT_REQUEST_INVALID", "Expected format, requestId and input")
    require(value["format"] == "metriccanvas-mc-request/1", "PRODUCT_REQUEST_INVALID", "Unknown request format")
    require(isinstance(value["requestId"], str) and bool(value["requestId"].strip()),
            "PRODUCT_REQUEST_INVALID", "requestId must be a nonempty string")
    require(isinstance(value["input"], dict), "PRODUCT_REQUEST_INVALID", "input must be an object")
    return value


def node_operation(root, handler, operation, value):
    guard = root / "mc-tool" / "_impl" / "network_guard.mjs"
    script = root / "mc-tool" / handler["path"]
    env = {**os.environ, "NODE_PATH": "", "NODE_OPTIONS": ""}
    result = subprocess.run(["node", "--import", guard.as_uri(), str(script)],
                            input=canonical({"operation": operation, "input": value}),
                            capture_output=True, timeout=60, env=env)
    require(result.returncode in {0, 2}, "PRODUCT_PROGRAM_FAILED", result.stderr.decode("utf-8"))
    return json.loads(result.stdout, object_pairs_hook=unique_object,
                      parse_float=finite_float, parse_constant=reject_constant)


def dispatch(root, handlers, operation, value):
    handler = handlers[operation]
    if handler["kind"] == "node":
        return node_operation(root, handler, operation, value)
    module = importlib.import_module(handler["module"])
    result = module.invoke(operation, value, **resource_arguments(root, handler.get("resources", [])))
    return postprocess(root, handlers, handler, module, operation, value, result)


def postprocess(root, handlers, handler, module, operation, value, result):
    plan = handler.get("postprocess", {}).get(operation)
    if plan is None or not isinstance(result, dict) or not isinstance(result.get("data"), dict):
        return result
    document = result.get("data", {}).get("document")
    if result.get("status") not in {"ok", "partial"} or not isinstance(document, dict):
        return result
    target = plan["operation"]
    require(target in handlers and handlers[target]["kind"] == "node",
            "PRODUCT_POSTPROCESS_TARGET_MISSING", "Postprocess target must be a registered Node operation")
    payload = {"document": document}
    for key in ("evaluation", "presentationIntent"):
        if key in value:
            payload[key] = value[key]
    if plan["baseline"]:
        payload["baseline"] = value["baseline"]
    audit = node_operation(root, handlers[target], target, payload)
    return module.apply_postprocess(operation, value, result, audit)


def resource_arguments(root, names):
    if not names:
        return {}
    require(names == ["page-validation"], "PRODUCT_RESOURCE_UNKNOWN", str(names))
    from metriccanvas_authoring.pages.validation.node_validator import NodeValidationResources
    manifest = read_json(root / "mc-tool/release.json")
    program = "mc-tool/scripts/authoring-page-program.mjs"
    schema = read_json(root / "mc-tool/resources/contract-snapshot/page/schema.json")
    resources = NodeValidationResources(root / program, manifest["files"][program], manifest["defaultPageSchema"])
    return {"page_schema": schema, "node_resources": resources}


def validate_result(result, descriptor):
    from jsonschema import Draft202012Validator
    require(isinstance(result, dict) and set(result) == {"status", "data", "diagnostics"},
            "PRODUCT_OUTPUT_INVALID", "Operation returned an invalid result")
    require(result["status"] in {"ok", "partial", "error"} and isinstance(result["diagnostics"], list),
            "PRODUCT_OUTPUT_INVALID", "Operation status/diagnostics are invalid")
    if result["status"] != "error":
        require(not list(Draft202012Validator(descriptor["outputSchema"]).iter_errors(result["data"])),
                "PRODUCT_OUTPUT_INVALID", "Operation output does not match its schema")
    return result


def invoke(root, interface, handlers, operation, value):
    if operation not in interface["operations"]:
        return receipt("PRODUCT_OPERATION_UNKNOWN", "Unknown operation: " + operation)
    descriptor = interface["operations"][operation]
    context_issue = evaluation_issue(root, descriptor, handlers[operation], value)
    if context_issue:
        return context_issue
    # Providers own validation and its complete ordered product diagnostics.
    # Revalidating here would reorder JSON Schema rules after canonical export.
    before = canonical(value)
    result = validate_result(dispatch(root, handlers, operation, value), descriptor)
    require(before == canonical(value), "PRODUCT_INPUT_MUTATED", "Product operation mutated its input")
    return result


def evaluation_issue(root, descriptor, handler, value):
    """The same A product checker owns structure and ISO/IANA diagnostics."""
    properties = descriptor["inputSchema"].get("properties", {})
    if handler["kind"] == "node" or "evaluation" not in properties or "evaluation" not in value:
        return None
    result = node_operation(root, {"path": "scripts/authoring-page-program.mjs"},
                            "internal.evaluation.validate", {"evaluation": value["evaluation"]})
    require(result["status"] in {"ok", "error"}, "PRODUCT_OUTPUT_INVALID", "Invalid evaluation checker status")
    if result["status"] == "error":
        require(bool(result["diagnostics"]) and all(issue.get("code") == "INVALID_EVALUATION_CONTEXT"
                for issue in result["diagnostics"]), "PRODUCT_OUTPUT_INVALID", "Invalid evaluation checker diagnostics")
        return result
    require(result["data"] == {"ok": True} and result["diagnostics"] == [],
            "PRODUCT_OUTPUT_INVALID", "Invalid evaluation checker success")
    return None


def self_test(root, interface, handlers):
    reports = []
    vectors = read_json(root / "mc-tool" / "_impl" / "self-tests.json")
    require(bool(vectors), "PRODUCT_SELF_TEST_MISSING", "No product self-test vectors")
    for vector in vectors:
        result = invoke(root, interface, handlers, vector["operation"], vector["input"])
        expected = vector.get("expectedDiagnostic")
        observed = [issue.get("code", issue.get("type")) for issue in result["diagnostics"]]
        passed = result["status"] == vector["expectedStatus"] and (expected is None or expected in observed)
        reports.append({"operation": vector["operation"], "passed": passed, "status": result["status"]})
    require(all(item["passed"] for item in reports), "PRODUCT_SELF_TEST_FAILED", str(reports))
    return {"format": "metriccanvas-mc-self-test/1", "status": "ok", "checks": reports,
            "scope": "offline product samples; Relay, authorization, save and deployment not tested"}


def receipt(code, message):
    return {"status": "error", "data": {}, "diagnostics": [{"code": code, "path": "/", "message": message}]}


def run(root, args):
    state = verify(root)
    command = args[0] if args else ""
    if args == ["check-release"]:
        return {"format": RECEIPT_FORMAT, "status": "ok", "code": "RELEASE_VERIFIED", "details": [],
                "releaseId": state["manifest"]["releaseId"], "eligibleForSmoke": False, "automaticPromotion": False}, 0
    runtime_check(state["manifest"])
    if args == ["describe"]:
        return state["interface"], 0
    handlers = read_json(root / "mc-tool" / "_impl" / "handlers.json")
    if args == ["self-test"]:
        return self_test(root, state["interface"], handlers), 0
    require(command == "invoke" and len(args) == 2, "PRODUCT_COMMAND_INVALID",
            "Usage: cli.py describe|check-release|self-test|invoke <operation>")
    return run_request(root, state["interface"], handlers, args[1])


def run_request(root, interface, handlers, operation):
    request_id = ""
    try:
        request = parse_request(sys.stdin.read())
        request_id = request["requestId"]
    except (ValueError, TypeError, KeyError) as error:
        result = receipt(getattr(error, "code", "PRODUCT_REQUEST_INVALID"), str(error))
    else:
        result = invoke(root, interface, handlers, operation, request["input"])
    return {"format": "metriccanvas-mc-result/1", "requestId": request_id,
            "operation": operation, **result}, 2 if result["status"] == "error" else 0


def main(root: Path, args):
    initialize(root)
    try:
        result, code = run(root, args)
    except Exception as error:
        failure = getattr(error, "code", "PRODUCT_ENVIRONMENT_INVALID")
        result = {"format": "metriccanvas-mc-result/1", "requestId": "", "operation": "",
                  **receipt(failure, str(error))}
        code = 3
    sys.stdout.buffer.write(canonical(result) + b"\n")
    return code
