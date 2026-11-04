"""Generate offline routes from the actual Interface; never re-author schemas."""
import ast
from pathlib import Path
import re

from relay_content import pretty, verify_content
from release import canonical, digest, read_json, require, validate_operation

FORMAT = "metriccanvas-offline-interface-index/1"


def pointer(value):
    return value.replace("~", "~0").replace("/", "~1")


def call_codes(node):
    name = node.func.id if isinstance(node.func, ast.Name) else ""
    positions = {"require": 1, "receipt": 0, "ReleaseError": 0}
    if name in positions:
        index = positions[name]
        return node.args[index:index + 1]
    if name == "getattr" and len(node.args) > 1 and isinstance(node.args[1], ast.Constant) and node.args[1].value == "code":
        return node.args[2:3]
    return []


def runtime_codes(tool):
    codes = set()
    files = [tool / "cli.py", tool / "_impl/release.py", tool / "_impl/product_runtime.py"]
    for file in files:
        for node in ast.walk(ast.parse(file.read_text(encoding="utf-8"))):
            values = call_codes(node) if isinstance(node, ast.Call) else []
            if isinstance(node, ast.Dict):
                values.extend(value for key, value in zip(node.keys, node.values)
                              if isinstance(key, ast.Constant) and key.value == "code")
            codes.update(value.value for value in values if isinstance(value, ast.Constant)
                         and isinstance(value.value, str) and re.fullmatch(r"[A-Z][A-Z0-9_]+", value.value))
    return sorted(codes)


def declared_errors(interface):
    result = {}
    for operation, descriptor in sorted(interface["operations"].items()):
        validate_operation(descriptor, operation)
        for code in descriptor["errorCodes"]:
            result.setdefault(code, []).append(operation)
    return result


def interface_summary(interface, global_codes):
    operations = {}
    for name, descriptor in sorted(interface["operations"].items()):
        base = "#/operations/" + pointer(name)
        operations[name] = {"schemas": {"input": base + "/inputSchema", "output": base + "/outputSchema"},
                            "errorCodes": descriptor["errorCodes"], "sideEffects": descriptor["sideEffects"]}
    return {"format": FORMAT, "interfaceVersion": interface["version"], "interfacePath": "mc-tool/interface.json",
            "entrypoint": interface["entrypoint"], "operations": operations, "globalDiagnostics": global_codes,
            "scope": "registered offline declarations; actual behavior, authorization and deployment require separate evidence",
            "legacyCoverage": {"resourceId": "runtime:coverage", "scope": "legacy MC/source graph"}}


def write_generated(path, value):
    payload = pretty(value)
    require(not path.exists() or path.read_bytes() == payload, "PRODUCT_RESOURCE_COLLISION", str(path.name))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


def add_error_resources(root, index, interface, global_codes):
    errors = declared_errors(interface)
    for code in global_codes:
        errors.setdefault(code, [])
    entries = index.setdefault("error", {})
    for code, operations in sorted(errors.items()):
        if code in entries:
            continue
        relative = "errors/offline-" + digest(code.encode("utf-8"))[:24] + ".json"
        value = {"format": "metriccanvas-offline-error-index/1", "code": code, "operations": operations,
                 "globalDiagnostic": code in global_codes, "interfacePath": "mc-tool/interface.json",
                 "operationGuide": "mc-tool.md", "scope": "declared offline diagnostics",
                 "guidance": "Read the complete ordered code/type, path and message from the actual receipt; this index grants no authorization or retry."}
        write_generated(root / relative, value)
        entries[code] = relative


def refresh_manifest(root, manifest):
    names = [item["file"] for item in manifest["files"]]
    actual = {file.relative_to(root).as_posix() for file in root.rglob("*")
              if file.is_file() and file.name != "mc-content.version.json"}
    require(set(names) <= actual, "PRODUCT_RESOURCE_MISSING", "Existing content was removed")
    names.extend(sorted(actual - set(names)))
    manifest["files"] = [{"file": name, "sha256": digest((root / name).read_bytes())} for name in names]
    manifest["contentSha256"] = digest(pretty(manifest["files"]))
    manifest["contentVersion"] = "1-" + manifest["contentSha256"][:16]
    (root / "mc-content.version.json").write_bytes(pretty(manifest))


def publish_interface(root, interface):
    verify_content(root)
    manifest, index = read_json(root / "mc-content.version.json"), read_json(root / "index.json")
    codes = runtime_codes(root.parent / "mc-tool")
    relative = "runtime/offline-interface.json"
    entries = index.setdefault("runtime", {})
    require(entries.get("offline-interface", relative) == relative, "PRODUCT_RESOURCE_COLLISION", "runtime:offline-interface")
    write_generated(root / relative, interface_summary(interface, codes))
    entries["offline-interface"] = relative
    add_error_resources(root, index, interface, codes)
    (root / "index.json").write_bytes(pretty(index))
    manifest["relayProjection"]["offlineInterface"] = {"resourceId": "runtime:offline-interface",
        "interfaceSha256": digest(canonical(interface) + b"\n")}
    refresh_manifest(root, manifest)
    verify_content(root)
