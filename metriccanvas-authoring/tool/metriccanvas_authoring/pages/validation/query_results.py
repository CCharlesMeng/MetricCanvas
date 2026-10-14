"""6.14 raw query input and multi-measure pivot semantics; no execution."""
from dataclasses import dataclass, field


def query(source):
    return source.get("source", {}).get("query", {})


def item(source):
    return query(source).get("body", {}).get("dsl_list", [{}])[0]


def record(value):
    return value if isinstance(value, dict) else {}


def dependencies(source):
    return [binding["source"] for binding in query(source).get("resultBindings", [])]


def multi_pivot(op):
    return op.get("op") == "pivot" and any("valueField" in col for col in op["columns"])


def capability_paths(page):
    return [f"/dataSources/{name}" for name, source in page.get("dataSources", {}).items()
            if "resultBindings" in query(source) or any(multi_pivot(op) for op in source.get("compute", []))]


def window_capability_paths(page):
    paged = {component.get("data", {}).get("main")
             for section in [*page.get("sections", []), *page.get("detailViews", [])]
             for component in components(section.get("components", []))
             if component.get("type") == "table" and component.get("props", {}).get("pagination", {}).get("mode") == "query"}
    return [f"/dataSources/{name}" for name, source in page.get("dataSources", {}).items()
            if any(binding.get("source") in paged for binding in query(source).get("resultBindings", []))]


def where_capability_paths(page):
    return [f"/dataSources/{name}/source/query/resultBindings/{index}/where"
            for name, source in page.get("dataSources", {}).items()
            for index, binding in enumerate(query(source).get("resultBindings", [])) if "where" in binding]


def check_where(context, source, node, path, depth=0, leaves=None):
    from .page_validation import _scalar_violation
    if leaves is None:
        leaves = [0]
    if "all" in node or "any" in node:
        key = "all" if "all" in node else "any"
        if depth >= 4:
            context.fail(path, "查询输入过滤组合超过4层")
            return
        for index, child in enumerate(node[key]):
            check_where(context, source, child, f"{path}/{key}/{index}", depth + 1, leaves)
    else:
        leaves[0] += 1
        incoming = context.fields.get(source, {}).get(node["field"], {})
        if "queryField" not in incoming or incoming.get("type") in {"recordList", "semanticHtml"}:
            context.fail(path + "/field", "查询输入过滤必须引用同一上游查询的原始标量字段")
        elif node["op"] in {"gt", "gte", "lt", "lte"} and incoming.get("type") not in {"number", "money"}:
            context.fail(path + "/op", "查询输入有序比较只支持number或money字段")
        else:
            values = node.get("values", [node["value"]] if "value" in node else [])
            for index, value in enumerate(values):
                if _scalar_violation(value, incoming) is not None:
                    suffix = f"/values/{index}" if "values" in node else "/value"
                    context.fail(path + suffix, "查询输入过滤字面量与字段类型不符")
    if depth == 0 and leaves[0] > 64:
        context.fail(path, "查询输入过滤超过64个叶子条件")


def components(items):
    from metriccanvas_authoring.pages.components.component_editing import walk_components
    yield from walk_components({"sections": [{"components": items}]})


def bounded(sources, name):
    order = record(item(sources[name]).get("order"))
    limit = order.get("limit")
    return type(limit) is int and 0 < limit <= 9007199254740991 and "offset" not in order and any(
        name in dependencies(source) for source in sources.values())


@dataclass
class Context:
    sources: dict
    fields: dict
    paged: set
    issues: list = field(default_factory=list)

    def fail(self, path, message):
        self.issues.append(("SCHEMA_ERROR", path, message))


def dimension_targets(q):
    dims = record(q["body"]["dsl_list"][0].get("filter")).get("dims", [])
    targets = {dim["dim_name"] for dim in dims if isinstance(dim, dict) and "dim_name" in dim} if isinstance(dims, list) else set()
    for binding in q.get("filterBindings", {}).values():
        if binding["target"] == "dimension":
            targets.update(binding.get("levelQueryFields", {}).values())
            if "queryField" in binding:
                targets.add(binding["queryField"])
    targets.update(binding["queryField"] for binding in q.get("paramBindings", {}).values()
                   if binding["target"] == "dimension")
    return targets


def check_upstream(context, binding, path):
    upstream = context.sources.get(binding["source"])
    incoming = context.fields.get(binding["source"], {}).get(binding["field"], {})
    if (not upstream or upstream["source"]["type"] != "query" or "queryField" not in incoming
            or incoming.get("role") != "dimension" or incoming.get("type") not in {"string", "number"}):
        context.fail(path, "结果输入必须引用查询源的原始string或number维度字段")
        return
    order = record(item(upstream).get("order"))
    limited = bounded(context.sources, binding["source"])
    window = binding["source"] in context.paged
    window_limit = order.get("limit")
    valid_window = type(window_limit) is int and 0 < window_limit <= 9007199254740991 and order.get("offset") == 0
    if ((not window and "offset" in order) or (window and (not valid_window or upstream["source"].get("resultScope") == "complete"))
            or (not window and not limited and upstream["source"].get("resultScope") != "complete")):
        context.fail(path, "结果输入要求完整查询、显式有限选择或声明正整数limit的查询分页窗口；分页窗口不能声明complete")
    if (window or limited) and any(op["op"] in {"grandTotal", "groupSubtotal", "timeFill"} for op in upstream.get("compute", [])):
        context.fail(path, "有限选择源不能作为全量统计输入")


def check_bindings(context, name, source):
    q = query(source)
    if not q.get("resultBindings"):
        return
    targets = dimension_targets(q)
    for index, binding in enumerate(q["resultBindings"]):
        path = f"/dataSources/{name}/source/query/resultBindings/{index}"
        check_upstream(context, binding, path)
        if "where" in binding:
            check_where(context, binding["source"], binding["where"], path + "/where")
        if binding["queryField"] in targets:
            context.fail(path + "/queryField", "结果输入与已有维度条件重复")
        targets.add(binding["queryField"])


def check_pivot(context, name, op, path):
    for column in op["columns"]:
        incoming = context.fields[name].get(column.get("valueField", op["valueField"]), {})
        outgoing = context.fields[name].get(column["output"], {})
        if (incoming.get("type") not in {"number", "money"} or outgoing.get("nullable") is False
                or any(incoming.get(key) != outgoing.get(key) for key in ("type", "unit", "currency"))):
            context.fail(path, "透视产出与输入必须保持数值类型、单位、币种并允许为空")


def check_join_scope(context, name, op, path):
    for target, main in ((name, True), (op["source"], False)):
        candidate = context.sources[target]
        if candidate["source"]["type"] == "inline" or (main and bounded(context.sources, target)):
            continue
        order = record(item(candidate).get("order"))
        if candidate["source"].get("resultScope") != "complete" or target in context.paged or "limit" in order or "offset" in order:
            context.fail(path, "跨源计算要求完整行集")


def check_join(context, name, op, path):
    if op["source"] not in context.sources:
        context.fail(path, "未知数据依赖")
        return
    check_join_scope(context, name, op, path)
    for key in op["keys"]:
        a, b = context.fields[name].get(key["local"], {}), context.fields[op["source"]].get(key["foreign"], {})
        if a.get("role") != "dimension" or b.get("role") != "dimension" or a.get("type") != b.get("type"):
            context.fail(path, "组合键必须为相容维度字段")
    for value in op["values"]:
        a, b = context.fields[op["source"]].get(value["field"], {}), context.fields[name].get(value["output"], {})
        if (a.get("type") not in {"number", "money"} or a.get("role") != "measure" or b.get("nullable") is False
                or any(a.get(key) != b.get(key) for key in ("type", "role", "unit", "currency"))
                or (value["aggregate"] == "sum" and a.get("collapsible") is not True)):
            context.fail(path, "关联度量必须相容且满足聚合与缺失规则")


def check_graph(context):
    visiting, visited = set(), set()

    def visit(name, stage):
        key = (name, stage)
        if key in visiting:
            context.fail(f"/dataSources/{name}", "查询或计算阶段依赖成环")
            return
        if key in visited or name not in context.sources:
            return
        visiting.add(key)
        if stage == "compute":
            visit(name, "query")
            for op in context.sources[name].get("compute", []):
                if op["op"] == "joinAggregate":
                    visit(op["source"], "compute")
        else:
            for dependency in dependencies(context.sources[name]):
                visit(dependency, "query")
        visiting.remove(key)
        visited.add(key)

    for name in context.sources:
        visit(name, "compute")


def query_result_issues(page, resolve_fields):
    if not capability_paths(page):
        return []
    sources = page.get("dataSources", {})
    fields = {name: resolve_fields(source["fields"], f"/dataSources/{name}/fields")[0]
              for name, source in sources.items()}
    paged = {component.get("data", {}).get("main") for section in [*page.get("sections", []), *page.get("detailViews", [])]
             for component in components(section["components"])
             if component.get("props", {}).get("pagination", {}).get("mode") == "query"}
    context = Context(sources, fields, paged)
    for name, source in sources.items():
        check_bindings(context, name, source)
        for index, op in enumerate(source.get("compute", [])):
            path = f"/dataSources/{name}/compute/{index}"
            if multi_pivot(op):
                check_pivot(context, name, op, path)
            if op["op"] == "joinAggregate":
                check_join(context, name, op, path)
    check_graph(context)
    return context.issues
