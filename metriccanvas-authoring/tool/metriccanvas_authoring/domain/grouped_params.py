"""Layered page inputs and controlled DQE references (Page 6.6)."""
from typing import Any, Mapping

QUERY_PARAM_PATH_PREFIX = "/params/query/"


def declarations(page: Mapping[str, Any]) -> list[dict[str, Any]]:
    params = page.get("params", [])
    if isinstance(params, list):
        return params
    result = []
    query = params.get("query") or {}
    for group, entries in (("dimensions", query.get("dimensions")), ("times", query.get("times")), ("display", params.get("display"))):
        prefix = f"/params/query/{group}" if group != "display" else "/params/display"
        for i, p in enumerate(entries or []):
            item = {"id": p["id"], "required": p.get("required", True), "path": f"{prefix}/{i}"}
            if group == "dimensions":
                item.update(type="dimension", multiple=True, dimName=p["dim_name"])
                if "dim_value_list" in p: item["value"] = p["dim_value_list"]
            elif group == "times":
                item.update(type="timeRange", granularity=p["granularity"])
                if "start" in p or "end" in p: item["value"] = {"start": p.get("start"), "end": p.get("end")}
            else:
                item["type"] = p["type"]
                if "value" in p: item["value"] = p["value"]
            result.append(item)
    return result


def is_query_input(declaration: Mapping[str, Any]) -> bool:
    return str(declaration.get("path", "")).startswith(QUERY_PARAM_PATH_PREFIX)


def query_reference_issues(page: Mapping[str, Any]) -> list[tuple[str, str]]:
    params = {p["id"]: p for p in declarations(page)}
    layered = isinstance(page.get("params"), Mapping)
    issues = []
    def fail(path, message): issues.append((path, message))
    def outside_query_layer(p): return layered and bool(p) and not is_query_input(p)
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
            if outside_query_layer(p): fail(path, "reference points outside params.query")
            elif p.get("type") != "dimension" or not p.get("required") or not p.get("dimName"): fail(path, "reference requires a required grouped dimension")
            if p.get("dimName") != dim.get("dim_name"): fail(path, "dimension target mismatch")
            if any(b.get("target") == "dimension" and b.get("queryField") == dim.get("dim_name") for b in bindings): fail(path, "multiple owners for dimension")
            if any(j != i and isinstance(d, Mapping) and d.get("dim_name") == dim.get("dim_name") for j, d in enumerate(dims)): fail(path, "duplicate dimension condition")
        time = f.get("time", {})
        if not isinstance(time, Mapping): time = {}
        if isinstance(time.get("param"), str):
            path = f"{root}/dsl_list/0/filter/time"
            allowed.add(path)
            p = params.get(time["param"], {})
            if any(key not in ("period", "is_aggregate", "param", "window") for key in time): fail(path, "time reference cannot coexist with literal range")
            if outside_query_layer(p): fail(path, "reference points outside params.query")
            elif p.get("type") != "timeRange" or not p.get("required"): fail(path, "time reference requires required times input")
            if time.get("period") != ("month" if p.get("granularity") == "month" else "day"): fail(path, "incompatible time precision")
            if "window" in time:
                window = time["window"]
                value = p.get("value")
                if not _valid_window(window): fail(f"{path}/window", "invalid named time window")
                elif p.get("granularity") and not _window_compatible(p["granularity"], window): fail(f"{path}/window", "incompatible window unit")
                elif isinstance(value, Mapping) and value.get("start") != value.get("end"): fail(f"{path}/window", "window derivation requires a single-point anchor")
            if any(b.get("target") == "time" for b in bindings): fail(path, "multiple owners for time")
        def visit(node, path):
            if isinstance(node, list):
                for i, child in enumerate(node): visit(child, f"{path}/{i}")
            elif isinstance(node, Mapping):
                if "param" in node and path not in allowed: fail(path, "parameter reference in uncontrolled query position")
                for key, child in node.items(): visit(child, f"{path}/{key.replace('~', '~0').replace('/', '~1')}")
        visit(query["body"], root)
        if allowed and not layered: fail(root, "inline references require grouped inputs")
    return issues


def _valid_window(window: Any) -> bool:
    if not isinstance(window, Mapping): return False
    kind = window.get("kind")
    if kind == "period": return set(window) <= {"kind", "unit", "offset"} and window.get("unit") in ("day", "month", "year") and isinstance(window.get("offset", 0), int)
    if kind == "lastN": return set(window) == {"kind", "unit", "n"} and window.get("unit") in ("day", "month") and isinstance(window.get("n"), int)
    if kind in ("yearToDate", "monthToDate"): return set(window) == {"kind"}
    if kind == "toDate": return set(window) == {"kind", "unit"} and window.get("unit") in ("month", "year")
    return False


def _window_compatible(granularity: str, window: Mapping[str, Any]) -> bool:
    if window["kind"] == "lastN":
        return window["unit"] == ("month" if granularity == "month" else "day")
    return window["kind"] != "period" or granularity != "month" or window["unit"] != "day"
