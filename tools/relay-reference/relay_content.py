"""Build-side ownership annotations; preserve resource IDs and unrelated bytes."""
from pathlib import Path
import ast
import json
import subprocess
import sys

from release import digest, read_json, require

NOTICE = ("> 迁移参考：本文的旧 MCP 名称、context_ref/resultRef、工具内部查数、保存及交接描述属于迁移前的在线包装。"
          "当前离线操作以 mc-tool/interface.json 为准；真实 MCP、授权、DQE、状态/CAS、Java 保存与交接由 Relay 维护。"
          "共享页面协议、数据和呈现规则仍按正文使用。\n\n")
ONLINE_TERMS = ("context_ref", "query_data", "内部保存", "Java 保存", "Java 当前", "MCP", "expected_version", "artifact_ref", "workVersion")


def pretty(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


def content_error_codes(root):
    """Export reader diagnostics from its actual source, including Node failures."""
    codes = set()
    for name in ("mc_resources.py", "mc_runtime.py", "mc_schema_selection.py"):
        for node in ast.walk(ast.parse((root / "scripts" / name).read_text(encoding="utf-8"))):
            if not isinstance(node, ast.Call):
                continue
            values = [keyword.value for keyword in node.keywords if keyword.arg == "failure_code"]
            if isinstance(node.func, ast.Name) and node.func.id == "ContentError":
                values.extend(node.args[:1])
            codes.update(value.value for value in values if isinstance(value, ast.Constant) and isinstance(value.value, str))
    return sorted(codes)


def verify_content(root):
    bootstrap = ("import runpy,sys;sys.path.insert(0,sys.argv[1]);"
                 "sys.argv=[sys.argv[2],'verify'];runpy.run_path(sys.argv[0],run_name='__main__')")
    checked = subprocess.run([sys.executable, "-I", "-B", "-c", bootstrap,
                              str(root / "scripts"), str(root / "scripts/mc_content.py")],
                             capture_output=True, timeout=30)
    require(checked.returncode == 0, "PRODUCT_CONTENT_INVALID", checked.stdout.decode("utf-8"))


def annotate(root: Path):
    """Generate the Relay projection only after verifying the original Content."""
    verify_content(root)
    manifest = read_json(root / "mc-content.version.json")
    source_digest = manifest["contentSha256"]
    changed = []
    for item in manifest["files"]:
        file = root / item["file"]
        if file.parent == root / "tool-contracts" and file.suffix == ".json":
            value = read_json(file)
            value["referenceScope"] = {"kind": "legacy-online-mcp-migration", "executionOwner": "Relay",
                                       "offlineInterface": "mc-tool/interface.json"}
            file.write_bytes(pretty(value))
            changed.append(item["file"])
        elif file.suffix == ".md" and "scripts" not in file.relative_to(root).parts and any(term in file.read_text(encoding="utf-8") for term in ONLINE_TERMS):
            file.write_bytes((NOTICE + file.read_text(encoding="utf-8")).encode("utf-8"))
            changed.append(item["file"])
        item["sha256"] = digest(file.read_bytes())
    manifest["contentSha256"] = digest(pretty(manifest["files"]))
    manifest["contentVersion"] = "1-" + manifest["contentSha256"][:16]
    manifest["relayProjection"] = {"format": "metriccanvas-relay-content-projection/1",
                                   "sourceContentSha256": source_digest, "annotatedFiles": changed}
    (root / "mc-content.version.json").write_bytes(pretty(manifest))
    verify_content(root)
