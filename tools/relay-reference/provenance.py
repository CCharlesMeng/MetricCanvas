"""Build-side Git and input-byte receipt. No dates, absolute paths or credentials."""
from __future__ import annotations
import hashlib
from pathlib import Path
import subprocess
import re

from release import canonical, read_json, relative_path, require, shape


def file_digest(path):
    result = hashlib.sha256()
    with path.open("rb") as source:
        while block := source.read(1024 * 1024):
            result.update(block)
    return result.hexdigest()


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args]).decode("utf-8").strip()


def checked_source(root, name):
    relative_path(name)
    path = root / name
    require(path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(root),
            "ARCHIVE_SOURCE_INVALID", name)
    return path


def source_inputs(root, candidate):
    root = root.resolve()
    identity = read_json(candidate / "mc-content/runtime/source-identity.json")
    files = {}
    for item in identity["files"]:
        name = item["file"]
        actual = file_digest(checked_source(root, name))
        require(actual == item["sha256"], "ARCHIVE_SOURCE_DRIFT", name)
        files[name] = actual
    for path in sorted((candidate / "mc-tool/python").rglob("*.py")):
        name = "metriccanvas-authoring/tool/" + path.relative_to(candidate / "mc-tool/python").as_posix()
        actual = file_digest(checked_source(root, name))
        require(actual == file_digest(path), "ARCHIVE_SOURCE_DRIFT", name)
        files[name] = actual
    files.update(private_inputs(root, candidate))
    return files


def private_inputs(root, candidate):
    pairs = {"mc-tool/cli.py": "product_cli.py", "mc-content.md": "guides/mc-content.md", "mc-tool.md": "guides/mc-tool.md"}
    for name in ("release.py", "product_runtime.py", "network_guard.mjs", "content_operation.py"):
        pairs["mc-tool/_impl/" + name] = name
    files = {}
    for target, source in pairs.items():
        if not (candidate / target).is_file():
            continue
        name = "tools/relay-reference/" + source
        actual = file_digest(checked_source(root, name))
        require(actual == file_digest(candidate / target), "ARCHIVE_SOURCE_DRIFT", name)
        files[name] = actual
    return files


def source_receipt(root, candidate):
    root = root.resolve()
    files = source_inputs(root, candidate)
    for folder in ("tools/relay-reference",):
        for path in sorted((root / folder).rglob("*")):
            if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc":
                name = path.relative_to(root).as_posix()
                files[name] = file_digest(checked_source(root, name))
    changed = set(git(root, "diff", "--name-only", "HEAD", "-z").split("\0"))
    changed.update(git(root, "ls-files", "--others", "--exclude-standard", "-z").split("\0"))
    return {"format": "metriccanvas-relay-source/1", "gitCommit": git(root, "rev-parse", "HEAD"),
            "gitTree": git(root, "rev-parse", "HEAD^{tree}"), "dirty": bool(changed.intersection(files)),
            "inputSha256": hashlib.sha256(canonical(files)).hexdigest(), "inputs": files}


def validate_source(source):
    shape(source, {"format", "gitCommit", "gitTree", "dirty", "inputSha256", "inputs"}, "source")
    require(source["format"] == "metriccanvas-relay-source/1" and isinstance(source["dirty"], bool),
            "ARCHIVE_RECEIPT_INVALID", "Invalid source state")
    for name in ("gitCommit", "gitTree"):
        require(isinstance(source[name], str) and re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", source[name]),
                "ARCHIVE_RECEIPT_INVALID", "Invalid source Git identity")
    require(isinstance(source["inputs"], dict) and bool(source["inputs"]), "ARCHIVE_RECEIPT_INVALID", "Missing source inputs")
    for name, checksum in source["inputs"].items():
        relative_path(name)
        require(isinstance(checksum, str) and re.fullmatch(r"[0-9a-f]{64}", checksum),
                "ARCHIVE_RECEIPT_INVALID", "Invalid source digest")
    require(source["inputSha256"] == hashlib.sha256(canonical(source["inputs"])).hexdigest(),
            "ARCHIVE_SOURCE_DRIFT", "Source input digest mismatch")
