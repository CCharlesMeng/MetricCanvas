"""Explicit applied-filter text references and period format (Schema 6.15)."""
from typing import Any, Mapping


def composition_paths(page):
    found = []

    def visit(node, path):
        if isinstance(node, list):
            for index, child in enumerate(node):
                visit(child, f"{path}/{index}")
        elif isinstance(node, Mapping):
            if set(node) == {"parts"} and isinstance(node["parts"], list):
                found.append(path)
            else:
                for key, child in node.items():
                    visit(child, f"{path}/{key.replace('~', '~0').replace('/', '~1')}")

    visit({key: value for key, value in page.items() if key != "dataSources"}, "")
    return found


def references(page: Mapping[str, Any], source: str = "filter"):
    found = []

    def visit(node, path):
        if isinstance(node, list):
            for index, child in enumerate(node):
                visit(child, f"{path}/{index}")
        elif isinstance(node, Mapping):
            if isinstance(node.get(source), str) and set(node) <= {source, "format"}:
                found.append((path, node))
            else:
                for key, child in node.items():
                    visit(child, f"{path}/{key.replace('~', '~0').replace('/', '~1')}")

    visit({key: value for key, value in page.items() if key != "dataSources"}, "")
    return found


def capability_paths(page):
    paths = [path for path, _ in references(page)]
    paths += [f"{path}/format" for path, ref in references(page, "param") if ref.get("format") == "period"]

    def formats(node, path, name):
        if isinstance(node, list):
            for index, child in enumerate(node):
                formats(child, f"{path}/{index}", name)
        elif isinstance(node, Mapping):
            for key, child in node.items():
                child_path = f"{path}/{key.replace('~', '~0').replace('/', '~1')}"
                if key == name and child == "period":
                    paths.append(child_path)
                else:
                    formats(child, child_path, name)

    for index, section in enumerate(page.get("sections", [])):
        for ci, component in enumerate(section.get("components", [])):
            formats(component.get("props", {}), f"/sections/{index}/components/{ci}/props", "format")
    for source_id, source in page.get("dataSources", {}).items():
        formats(source.get("fields", {}), f"/dataSources/{source_id.replace('~', '~0').replace('/', '~1')}/fields", "defaultFormat")
    # detailViews is an existing textual declaration surface as well.
    formats(page.get("detailViews", []), "/detailViews", "format")
    return list(dict.fromkeys(paths))


def reference_issues(page, numeric_formats, date_formats):
    filters = {value["id"]: value for value in page.get("filters", [])}
    issues = []
    for path, reference in references(page):
        declaration = filters.get(reference["filter"])
        if declaration is None:
            issues.append(("SCHEMA_ERROR", f"{path}/filter", "text value references unknown filter"))
            continue
        display_format = reference.get("format")
        kind = declaration["type"]
        if ((display_format == "period" and kind not in ("timePoint", "timeRange"))
                or (display_format in numeric_formats and kind != "numberRange")
                or (display_format in date_formats and kind != "search")):
            issues.append(("SCHEMA_ERROR", f"{path}/format", "text format does not suit filter type"))
    return issues
