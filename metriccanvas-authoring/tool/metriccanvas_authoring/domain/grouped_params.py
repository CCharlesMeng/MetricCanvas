"""Grouped page inputs and controlled DQE references (Page 6.6)."""
from typing import Any, Mapping


def declarations(page: Mapping[str, Any]) -> list[dict[str, Any]]:
    params = page.get("params", [])
    if isinstance(params, list):
        return params
    result = []
    for group, entries in params.items():
        for i, p in enumerate(entries):
            item = {"id": p["id"], "required": p.get("required", True), "path": f"/params/{group}/{i}"}
            if group == "dimensions":
                item.update(type="dimension", multiple=True, dimName=p["dim_name"])
                if "dim_value_list" in p: item["value"] = p["dim_value_list"]
            elif group == "times":
                item.update(type="timeRange", granularity=p["granularity"])
                if "start" in p or "end" in p: item["value"] = {"start": p.get("start"), "end": p.get("end")}
            else:
                item["type"] = p["type"]
                if "value" in p: item["value"] = p["value"]
            if "label" in p: item["label"] = p["label"]
            result.append(item)
    return result


def query_reference_issues(page: Mapping[str, Any]) -> list[tuple[str, str]]:
    params = {p["id"]: p for p in declarations(page)}
    issues = []
    def fail(path, message): issues.append((path, message))
    for source_id, source in page.get("dataSources", {}).items():
        query = source.get("source", {}).get("query")
        if not query: continue
        root = f"/dataSources/{source_id.replace('~', '~0').replace('/', '~1')}/source/query/body"
        allowed = set()
        f = query["body"]["dsl_list"][0].get("filter", {})
        if not isinstance(f, Mapping): f = {}
        dims = f.get("dims", [])
        if not isinstance(dims, list): dims = []
        bindings = list(query.get("paramBindings", {}).values()) + list(query.get("filterBindings", {}).values())
        for i, dim in enumerate(dims):
            if not isinstance(dim, Mapping): continue
            ref = dim.get("dim_value_list")
            if not isinstance(ref, Mapping) or "param" not in ref: continue
            path = f"{root}/dsl_list/0/filter/dims/{i}/dim_value_list"
            allowed.add(path)
            p = params.get(str(ref.get("param")), {})
            if set(ref) != {"param"} or not isinstance(ref["param"], str): fail(path, "invalid dimension reference")
            if p.get("type") != "dimension" or not p.get("required") or not p.get("dimName"): fail(path, "reference requires a required grouped dimension")
            if p.get("dimName") != dim.get("dim_name"): fail(path, "dimension target mismatch")
            if any(b.get("target") == "dimension" and b.get("queryField") == dim.get("dim_name") for b in bindings): fail(path, "multiple owners for dimension")
            if any(j != i and isinstance(d, Mapping) and d.get("dim_name") == dim.get("dim_name") for j, d in enumerate(dims)): fail(path, "duplicate dimension condition")
        time = f.get("time", {})
        if not isinstance(time, Mapping): time = {}
        start, end = time.get("start"), time.get("end")
        if any(isinstance(r, Mapping) and "param" in r for r in (start, end)):
            path = f"{root}/dsl_list/0/filter/time"
            for part in ("start", "end"):
                allowed.add(f"{path}/{part}")
                r = time.get(part)
                if not isinstance(r, Mapping) or set(r) != {"param", "part"} or not isinstance(r.get("param"), str) or r.get("part") != part: fail(f"{path}/{part}", "invalid time endpoint reference")
            start = start if isinstance(start, Mapping) else {}
            end = end if isinstance(end, Mapping) else {}
            if start.get("param") != end.get("param"): fail(path, "time endpoints must share one input")
            p = params.get(str(start.get("param")), {})
            if p.get("type") != "timeRange" or not p.get("required"): fail(path, "time reference requires required times input")
            if time.get("period") != ("month" if p.get("granularity") == "month" else "day"): fail(path, "incompatible time precision")
            if any(b.get("target") == "time" for b in bindings): fail(path, "multiple owners for time")
        def visit(node, path):
            if isinstance(node, list):
                for i, child in enumerate(node): visit(child, f"{path}/{i}")
            elif isinstance(node, Mapping):
                if "param" in node and path not in allowed: fail(path, "parameter reference in uncontrolled query position")
                for key, child in node.items(): visit(child, f"{path}/{key.replace('~', '~0').replace('/', '~1')}")
        visit(query["body"], root)
        if allowed and not isinstance(page.get("params"), Mapping): fail(root, "inline references require grouped inputs")
    return issues


def clear_values(page: dict) -> None:
    params = page.get('params', [])
    if isinstance(params, list):
        for p in params:
            p.pop('value', None)
            p.pop('default', None)
    else:
        for p in params.get('dimensions', []): p.pop('dim_value_list', None)
        for p in params.get('times', []):
            p.pop('start', None)
            p.pop('end', None)
        for p in params.get('scalars', []): p.pop('value', None)
