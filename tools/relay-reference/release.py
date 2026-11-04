"""Deterministic four-artifact inventory and verification; never installs a release."""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path, PurePosixPath
import re

FORMAT = "metriccanvas-relay-reference-release/1"
INTERFACE_FORMAT = "metriccanvas-mc-tool-interface/1"
RECEIPT_FORMAT = "metriccanvas-relay-release-check/1"
MANIFEST = "mc-tool/release.json"
TOP_LEVEL = {"mc-content", "mc-content.md", "mc-tool", "mc-tool.md"}
PUBLIC_PATHS = {"mc-content/index.json", "mc-content.md", "mc-tool/cli.py",
                "mc-tool/interface.json", MANIFEST, "mc-tool.md"}
METADATA_FIELDS = {"releaseVersion", "resourceIndexVersion", "runtime",
                   "pageSchemaVersions", "defaultPageSchema"}


class ReleaseError(ValueError):
    def __init__(self, code, detail):
        super().__init__(detail)
        self.code = code


def require(condition, code, detail):
    if not condition:
        raise ReleaseError(code, detail)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=False, allow_nan=False).encode("utf-8")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def unique_object(pairs):
    value = {}
    for key, item in pairs:
        require(key not in value, "RELEASE_JSON_INVALID", "Duplicate JSON key: " + key)
        value[key] = item
    return value


def reject_constant(value):
    raise ReleaseError("RELEASE_JSON_INVALID", "Non-finite JSON number: " + value)


def finite_float(value):
    number = float(value)
    require(math.isfinite(number), "RELEASE_JSON_INVALID", "Non-finite JSON number: " + value)
    return number


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"), object_pairs_hook=unique_object,
                      parse_constant=reject_constant, parse_float=finite_float)


def shape(value, expected, location):
    require(isinstance(value, dict) and set(value) == expected,
            "RELEASE_CONTRACT_INVALID", "Unexpected fields at " + location)


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def strings(value, location, allow_empty=True):
    require(isinstance(value, list), "RELEASE_CONTRACT_INVALID", "Expected array: " + location)
    require(all(nonempty(item) for item in value), "RELEASE_CONTRACT_INVALID",
            "Expected nonempty strings: " + location)
    require(len(value) == len(set(value)) and (allow_empty or bool(value)),
            "RELEASE_CONTRACT_INVALID", "Empty or duplicate values: " + location)


def version(value):
    require(isinstance(value, str) and re.fullmatch(r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)", value),
            "RELEASE_CONTRACT_INVALID", "Expected three-part integer version")
    return tuple(int(part) for part in value.split("."))


def relative_path(value):
    require(nonempty(value), "RELEASE_PATH_INVALID", "Expected nonempty relative path")
    path = PurePosixPath(value)
    require(not path.is_absolute() and str(path) == value and ".." not in path.parts,
            "RELEASE_PATH_INVALID", "Non-canonical path: " + value)
    require("\\" not in value and ":" not in value and value != ".",
            "RELEASE_PATH_INVALID", "Non-portable path: " + value)
    return value


def inventory(root):
    root = Path(root)
    require(not root.is_symlink() and root.is_dir(), "RELEASE_LAYOUT_INVALID", "Expected release directory")
    require({p.name for p in root.iterdir()} == TOP_LEVEL,
            "RELEASE_LAYOUT_INVALID", "Candidate must contain exactly four artifacts")
    require(all((root / name).is_dir() for name in ("mc-content", "mc-tool")),
            "RELEASE_LAYOUT_INVALID", "Content and tool must be directories")
    require(all((root / name).is_file() for name in ("mc-content.md", "mc-tool.md")),
            "RELEASE_LAYOUT_INVALID", "Both guides must be files")
    return file_inventory(root)


def file_inventory(root):
    files, seen = {}, set()
    for path in sorted(root.rglob("*")):
        name = relative_path(path.relative_to(root).as_posix())
        require(not path.is_symlink(), "RELEASE_PATH_INVALID", "Symlink: " + name)
        require(name.casefold() not in seen, "RELEASE_PATH_INVALID", "Case collision: " + name)
        seen.add(name.casefold())
        require(path.name not in {"__pycache__", ".DS_Store"} and path.suffix != ".pyc",
                "RELEASE_PATH_INVALID", "Unshippable file: " + name)
        if path.is_dir():
            continue
        require(path.is_file(), "RELEASE_PATH_INVALID", "Special file: " + name)
        if name != MANIFEST:
            files[name] = digest(path.read_bytes())
    return files


def validate_runtime(runtime):
    shape(runtime, {"python", "node", "dependencies"}, "runtime")
    require(nonempty(runtime["python"]) and nonempty(runtime["node"]),
            "RELEASE_CONTRACT_INVALID", "Runtime constraints are required")
    dependencies = runtime["dependencies"]
    require(isinstance(dependencies, dict), "RELEASE_CONTRACT_INVALID", "Expected dependency map")
    require(all(nonempty(key) and nonempty(value) for key, value in dependencies.items()),
            "RELEASE_CONTRACT_INVALID", "Invalid dependency constraint")


def validate_metadata(metadata):
    shape(metadata, METADATA_FIELDS, "metadata")
    version(metadata["releaseVersion"])
    version(metadata["resourceIndexVersion"])
    validate_runtime(metadata["runtime"])
    strings(metadata["pageSchemaVersions"], "pageSchemaVersions", allow_empty=False)
    require(metadata["defaultPageSchema"] in metadata["pageSchemaVersions"],
            "RELEASE_CONTRACT_INVALID", "Default page Schema must be supported")


def validate_operation(operation, name):
    shape(operation, {"inputSchema", "outputSchema", "errorCodes", "sideEffects"}, name)
    require(isinstance(operation["inputSchema"], dict) and isinstance(operation["outputSchema"], dict),
            "RELEASE_CONTRACT_INVALID", "Operation schemas must be objects: " + name)
    strings(operation["errorCodes"], name + ".errorCodes")
    require(operation["sideEffects"] == "none", "RELEASE_CONTRACT_INVALID",
            "Product operation cannot own external side effects: " + name)


def read_interface(root, files):
    interface = read_json(root / "mc-tool/interface.json")
    shape(interface, {"format", "version", "entrypoint", "publicPaths", "operations"}, "interface")
    require(interface["format"] == INTERFACE_FORMAT and interface["entrypoint"] == "mc-tool/cli.py",
            "RELEASE_CONTRACT_INVALID", "Unsupported Interface or entrypoint")
    version(interface["version"])
    strings(interface["publicPaths"], "publicPaths", allow_empty=False)
    paths = {relative_path(path) for path in interface["publicPaths"]}
    require(PUBLIC_PATHS <= paths and paths <= set(files) | {MANIFEST},
            "RELEASE_RESOURCE_MISSING", "Public path missing from contract or inventory")
    operations = interface["operations"]
    require(isinstance(operations, dict), "RELEASE_CONTRACT_INVALID", "Expected operation map")
    for name, operation in operations.items():
        require(nonempty(name), "RELEASE_CONTRACT_INVALID", "Invalid operation ID")
        validate_operation(operation, name)
    return interface


def read_resources(root, files):
    index = read_json(root / "mc-content/index.json")
    require(isinstance(index, dict), "RELEASE_CONTRACT_INVALID", "Expected resource index")
    resources = {}
    for topic, entries in index.items():
        require(nonempty(topic) and ":" not in topic and isinstance(entries, dict),
                "RELEASE_CONTRACT_INVALID", "Invalid resource topic")
        for key, path in entries.items():
            require(nonempty(key), "RELEASE_CONTRACT_INVALID", "Invalid resource key")
            name = "mc-content/" + relative_path(path)
            require(name in files, "RELEASE_RESOURCE_MISSING", "Resource missing: " + name)
            resources[topic + ":" + key] = path
    return resources


def manifest_body(root, metadata):
    validate_metadata(metadata)
    files = inventory(root)
    interface = read_interface(Path(root), files)
    read_resources(Path(root), files)
    return {"format": FORMAT, **metadata, "interfaceVersion": interface["version"], "files": files}


def seal(root, metadata):
    body = manifest_body(root, metadata)
    manifest = {**body, "releaseId": digest(canonical(body))}
    payload = canonical(manifest) + b"\n"
    target = Path(root) / MANIFEST
    if target.exists():
        require(target.read_bytes() == payload, "RELEASE_IMMUTABLE", "Existing manifest differs; seal a new candidate")
    else:
        with target.open("xb") as output:
            output.write(payload)
    return manifest


def verify(root):
    root = Path(root)
    # Inspect paths before reading metadata, including the excluded manifest path.
    inventory(root)
    manifest = read_json(root / MANIFEST)
    shape(manifest, METADATA_FIELDS | {"format", "interfaceVersion", "files", "releaseId"}, "release")
    require(manifest["format"] == FORMAT, "RELEASE_MANIFEST_INVALID", "Unsupported release format")
    metadata = {key: manifest[key] for key in METADATA_FIELDS}
    body = manifest_body(root, metadata)
    expected = {**body, "releaseId": digest(canonical(body))}
    require(manifest == expected and (root / MANIFEST).read_bytes() == canonical(expected) + b"\n",
            "RELEASE_CONTENT_MISMATCH", "Release identity, canonical manifest or file inventory mismatch")
    return {"manifest": manifest, "interface": read_interface(root, body["files"]),
            "resources": read_resources(root, body["files"])}
