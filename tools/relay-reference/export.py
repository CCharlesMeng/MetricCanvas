"""Build a sealed four-artifact candidate. Runs on the MC build side only."""
from __future__ import annotations
import argparse
from copy import deepcopy
import importlib
import importlib.metadata
from pathlib import Path
import os
import re
import shutil
import sys
import tomllib

sys.dont_write_bytecode = True

from python_closure import closure
from relay_content import annotate, content_error_codes
from interface_resources import publish_interface
from release import canonical, digest, read_json, require, seal, verify, PUBLIC_PATHS

HERE = Path(__file__).resolve().parent


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(canonical(value) + b"\n")


def copy_tree(source, target):
    require(source.is_dir(), "PRODUCT_RESOURCE_MISSING", str(source))
    for file in sorted(source.rglob("*")):
        require(not file.is_symlink(), "PRODUCT_PATH_INVALID", str(file))
        if file.is_file() and "__pycache__" not in file.parts and file.suffix != ".pyc":
            destination = target / file.relative_to(source)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(file, destination)


def copy_resources(bundle, target):
    for folder in ("contracts", "contract-snapshot"):
        copy_tree(bundle / folder, target / folder)
    for name in ("bundle.json", "bundle.lock.json", "contract-lock.json"):
        shutil.copyfile(bundle / name, target / name)
    (target / "scripts").mkdir(exist_ok=True)
    for name in ("page-validation-bridge.mjs", "PAGE-VALIDATOR-LICENSES.md"):
        shutil.copyfile(bundle / "scripts" / name, target / "scripts" / name)


def install_private(target):
    implementation = target / "mc-tool" / "_impl"
    implementation.mkdir(parents=True)
    for name in ("release.py", "product_runtime.py", "network_guard.mjs", "content_operation.py"):
        shutil.copyfile(HERE / name, implementation / name)
    shutil.copyfile(HERE / "product_cli.py", target / "mc-tool" / "cli.py")
    for name in ("mc-content.md", "mc-tool.md"):
        shutil.copyfile(HERE / "guides" / name, target / name)


def add_operations(operations, handlers, descriptions, handler):
    require(not set(operations).intersection(descriptions), "PRODUCT_OPERATION_DUPLICATE", str(descriptions.keys()))
    require(bool(descriptions), "PRODUCT_OPERATIONS_MISSING", "An empty provider is not a product capability")
    for name, descriptor in descriptions.items():
        operations[name] = descriptor
        handlers[name] = handler


def add_python(root, target, modules, operations, handlers, samples):
    source = root / "metriccanvas-authoring" / "tool"
    files, dependencies = closure(source, modules)
    for file in files.values():
        destination = target / "mc-tool" / "python" / file.relative_to(source)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(file, destination)
    sys.path.insert(0, str(source))
    os.environ.pop("METRICCANVAS_PRODUCT_ROOT", None)
    os.environ["METRICCANVAS_BUNDLE_ROOT"] = str(root / "metriccanvas-authoring")
    for name in modules:
        module = importlib.import_module(name)
        required = getattr(module, "RESOURCES", [])
        require(set(required) <= {"page-validation"}, "PRODUCT_RESOURCE_UNKNOWN", str(required))
        require(not required or (target / "mc-tool/scripts/authoring-page-program.mjs").is_file(),
                "PRODUCT_PROGRAM_MISSING", "Python page validation requires the prebuilt page program")
        descriptions = resolved_descriptions(target, module)
        hooks = postprocess_metadata(module, operations, handlers)
        add_operations(operations, handlers, descriptions,
                       {"kind": "python", "module": name, "resources": required, "postprocess": hooks})
        samples.extend(module.SELF_TESTS)
    return dependencies


def postprocess_metadata(module, operations, handlers):
    hooks = deepcopy(getattr(module, "POSTPROCESS", {}))
    require(isinstance(hooks, dict), "PRODUCT_POSTPROCESS_INVALID", "Expected operation metadata")
    if not hooks:
        return hooks
    legacy = read_json(HERE / "fixtures/consumer-0.1.0.json")["interface"]["operations"]
    require(callable(getattr(module, "apply_postprocess", None)),
            "PRODUCT_POSTPROCESS_INVALID", "Missing product result merger")
    for operation, plan in hooks.items():
        require(operation in module.OPERATIONS and operation not in legacy,
                "PRODUCT_POSTPROCESS_INVALID", "Hooks are limited to new operations: " + operation)
        require(isinstance(plan, dict) and set(plan) == {"operation", "baseline"} and type(plan["baseline"]) is bool,
                "PRODUCT_POSTPROCESS_INVALID", operation)
        target = plan["operation"]
        require(isinstance(target, str) and target in operations and handlers[target]["kind"] == "node",
                "PRODUCT_POSTPROCESS_TARGET_MISSING", "Expected an actual registered Node operation")
    return hooks


def resolved_descriptions(target, module):
    descriptions = deepcopy(module.OPERATIONS)
    bindings = getattr(module, "SCHEMA_BINDINGS", {})
    for property_name, binding in bindings.items():
        require(binding == "authoring.evaluation", "PRODUCT_SCHEMA_BINDING_UNKNOWN", str(binding))
        relative = "mc-tool/resources/contracts/exported/temporal-evaluation.schema.json"
        shared = read_json(target / relative)
        require(isinstance(shared, dict) and bool(shared), "PRODUCT_SCHEMA_BINDING_UNRESOLVED", binding)
        resolved = []
        for operation, descriptor in descriptions.items():
            properties = descriptor["inputSchema"].get("properties", {})
            if property_name in properties:
                properties[property_name] = deepcopy(shared)
                resolved.append(operation)
        require(bool(resolved), "PRODUCT_SCHEMA_BINDING_UNRESOLVED", property_name)
        record_schema_binding(target, module.__name__, property_name, relative, resolved)
    return descriptions


def record_schema_binding(target, module, property_name, relative, resolved):
    report = target / "mc-tool/_impl/schema-bindings.json"
    records = read_json(report) if report.exists() else []
    records.append({"provider": module, "property": property_name, "source": relative,
                    "authorSource": "metriccanvas-authoring/core/page/product-contract.ts#EVALUATION_SCHEMA",
                    "buildOutput": "evaluation-schema.json",
                    "sha256": digest((target / relative).read_bytes()), "operations": sorted(resolved)})
    write_json(report, records)


def add_node(source, target, operations, handlers, samples):
    descriptions = read_json(source / "operations.json")
    program_info = read_json(source / "program-info.json")
    shared = read_json(source / "evaluation-schema.json")
    write_json(target / "mc-tool/resources/contracts/exported/temporal-evaluation.schema.json", shared)
    policy = read_json(target / "mc-content/protocols/version-policy.json")
    require(program_info["schemaVersion"] == policy["current"], "PRODUCT_SCHEMA_MISMATCH",
            "Node program and content default page Schema must match")
    copy_tree(source / "scripts", target / "mc-tool" / "scripts")
    program = "scripts/authoring-page-program.mjs"
    require((target / "mc-tool" / program).is_file(), "PRODUCT_PROGRAM_MISSING", program)
    add_operations(operations, handlers, descriptions, {"kind": "node", "path": program})
    samples.extend(read_json(source / "self-tests.json"))


def dependency_constraints(root, names):
    from packaging.requirements import Requirement
    project = tomllib.loads((root / "metriccanvas-authoring/tool/pyproject.toml").read_text(encoding="utf-8"))["project"]
    pins = dict(item.split("==", 1) for item in project["dependencies"])
    lock = (root / "metriccanvas-authoring/tool/requirements.lock").read_text(encoding="utf-8")
    locked = dict(re.findall(r"^([a-zA-Z0-9_.-]+)==([^\s\\]+)", lock, re.MULTILINE))
    pending, constraints = list(names), {}
    while pending:
        name = pending.pop()
        if name in constraints:
            continue
        version = importlib.metadata.version(name)
        require(locked.get(name) == version, "PRODUCT_DEPENDENCY_DRIFT", name + " differs from the locked build environment")
        require(name not in pins or pins[name] == version, "PRODUCT_DEPENDENCY_DRIFT", name + " differs from pyproject")
        constraints[name] = "==" + version
        for dependency in importlib.metadata.requires(name) or []:
            item = Requirement(dependency)
            if item.marker is None or item.marker.evaluate():
                pending.append(item.name)
    return dict(sorted(constraints.items()))


def build(root, target, release_version, node_bundle=None, modules=(), interface_version="1.0.0"):
    require(not target.exists(), "PRODUCT_OUTPUT_EXISTS", "Use a new candidate directory: " + str(target))
    bundle = root / "metriccanvas-authoring"
    copy_tree(bundle / "mc-content", target / "mc-content")
    annotate(target / "mc-content")
    install_private(target)
    resources = target / "mc-tool" / "resources"
    resources.mkdir()
    copy_resources(bundle, resources)
    import content_operation
    operations, handlers, samples = {}, {}, []
    content_descriptions = deepcopy(content_operation.OPERATIONS)
    content_descriptions["content.read"]["errorCodes"] = content_error_codes(target / "mc-content")
    add_operations(operations, handlers, content_descriptions,
                   {"kind": "python", "module": "content_operation"})
    samples.extend(content_operation.SELF_TESTS)
    dependencies = {"jsonschema"}
    if node_bundle:
        add_node(node_bundle, target, operations, handlers, samples)
    if modules:
        dependencies.update(add_python(root, target, modules, operations, handlers, samples))
    return finish(root, target, release_version, operations, handlers, samples, dependencies, interface_version)


def finish(root, target, release_version, operations, handlers, samples, dependencies, interface_version):
    require(set(operations) <= {sample["operation"] for sample in samples},
            "PRODUCT_SELF_TEST_MISSING", "Every advertised operation needs a fixed product sample")
    write_json(target / "mc-tool/_impl/handlers.json", handlers)
    write_json(target / "mc-tool/_impl/self-tests.json", samples)
    interface = {"format": "metriccanvas-mc-tool-interface/1",
        "version": interface_version, "entrypoint": "mc-tool/cli.py", "publicPaths": sorted(PUBLIC_PATHS),
        "operations": operations}
    write_json(target / "mc-tool/interface.json", interface)
    publish_interface(target / "mc-content", interface)
    policy = read_json(target / "mc-content/protocols/version-policy.json")
    constraints = dependency_constraints(root, dependencies)
    (target / "mc-tool/requirements.txt").write_bytes("".join(name + pin + "\n" for name, pin in constraints.items()).encode("utf-8"))
    manifest = seal(target, {"releaseVersion": release_version, "resourceIndexVersion": "1.0.0",
        "runtime": {"python": ">=3.12", "node": ">=22", "dependencies": constraints},
        "pageSchemaVersions": policy["readableVersions"], "defaultPageSchema": policy["current"]})
    verify(target)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=HERE.parents[1])
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--release-version", default="0.1.0")
    parser.add_argument("--interface-version", default="1.0.0")
    parser.add_argument("--node-bundle", type=Path)
    parser.add_argument("--python-operations", action="append", default=[])
    args = parser.parse_args()
    manifest = build(args.root.resolve(), args.output.resolve(), args.release_version,
                     args.node_bundle, args.python_operations, args.interface_version)
    print(canonical({"status": "ok", "releaseId": manifest["releaseId"],
                     "scope": "candidate export; product and Relay acceptance are separate"}).decode())


if __name__ == "__main__":
    main()
