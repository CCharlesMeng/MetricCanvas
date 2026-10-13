"""Schema 6.16/6.17 presentation invariants shared with the product validator."""

from .filter_text_values import references


def signed_number_paths(page, formats=None):
    if formats is None:
        formats = {"number-signed", "number-1-signed", "number-2-signed", "number-grouped-signed"}
    result = []

    def visit(node, path, name):
        if isinstance(node, list):
            for index, child in enumerate(node):
                visit(child, f"{path}/{index}", name)
        elif isinstance(node, dict):
            for key, child in node.items():
                pointer = f"{path}/{key.replace('~', '~0').replace('/', '~1')}"
                if key == name and isinstance(child, str) and child in formats:
                    result.append(pointer)
                else:
                    visit(child, pointer, name)

    for source_id, source in page.get("dataSources", {}).items():
        pointer = source_id.replace("~", "~0").replace("/", "~1")
        visit(source.get("fields", {}), f"/dataSources/{pointer}/fields", "defaultFormat")
    for si, section in enumerate(page.get("sections", [])):
        for ci, component in enumerate(section.get("components", [])):
            visit(component.get("props", {}), f"/sections/{si}/components/{ci}/props", "format")
    visit(page.get("detailViews", []), "/detailViews", "format")
    for kind in ("param", "filter"):
        result.extend(f"{path}/format" for path, ref in references(page, kind) if ref.get("format") in formats)
    return list(dict.fromkeys(result))


def capability_paths(page, minor=None):
    if minor is not None and minor >= 16:
        return []
    result = []

    def has_color(node):
        if isinstance(node, list):
            return any(has_color(child) for child in node)
        return isinstance(node, dict) and ("colorRule" in node or any(has_color(child) for child in node.values()))

    def visit(node, path):
        if isinstance(node, list):
            for index, child in enumerate(node):
                visit(child, f"{path}/{index}")
        elif isinstance(node, dict):
            props = node.get("props", {})
            if node.get("type") in ("table", "metricCard") and has_color(props):
                result.append(path)
            if node.get("type") in ("barChart", "lineChart") and any(key in props for key in ("categoryLabels", "showValueLabels")):
                result.append(path)
            for key, child in node.items():
                child_path = f"{path}/{key}"
                visit(child, child_path)

    visit(page.get("sections", []), "/sections")
    visit(page.get("detailViews", []), "/detailViews")
    return result


def component_issues(component, path, sources, resolve_binding):
    issues = []
    props = component.get("props", {})
    slots = component.get("data", {})

    def fail(pointer, message):
        issues.append(("SCHEMA_ERROR", pointer, message))

    def visit(node, pointer):
        if isinstance(node, list):
            for index, child in enumerate(node):
                visit(child, f"{pointer}/{index}")
        elif isinstance(node, dict):
            if "colorRule" in node and "field" in node:
                if node.get("visual") == "signed" or "tone" in node or "dangerValues" in node:
                    fail(f"{pointer}/colorRule", "colorRule 不得与旧染色声明同时使用")
                binding = node["field"]
                slot, field_id = ("main", binding) if isinstance(binding, str) else (binding.get("data"), binding.get("field"))
                definition = resolve_binding(slot, field_id, slots, sources)
                if definition and definition.get("type") not in ("number", "money"):
                    fail(f"{pointer}/colorRule", "colorRule 只支持 number 或 money 字段")
            for key, child in node.items():
                visit(child, f"{pointer}/{key}")

    if component.get("type") in ("table", "metricCard"):
        visit(props, f"{path}/props")
    if props.get("showValueLabels"):
        if component.get("type") == "barChart" and (props.get("showSegmentLabels") or props.get("showStackTotalLabels")):
            fail(f"{path}/props/showValueLabels", "showValueLabels 不得与旧柱状图标签同时启用")
        if component.get("type") == "lineChart" and props.get("showPointLabels"):
            fail(f"{path}/props/showValueLabels", "showValueLabels 不得与 showPointLabels 同时启用")
    return issues
