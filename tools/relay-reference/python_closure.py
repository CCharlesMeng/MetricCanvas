"""Build-side import closure; online adapters cannot enter an offline distribution."""
from __future__ import annotations
import ast
import importlib.util
from pathlib import Path
import sys

from release import require

DEPENDENCIES = {"jsonschema": "jsonschema", "pydantic": "pydantic", "typing_extensions": "typing-extensions"}


def module_file(root, name):
    base = root.joinpath(*name.split("."))
    for path in (base.with_suffix(".py"), base / "__init__.py"):
        if path.is_file():
            return path
    return None


def imports(path, module):
    package = module if path.name == "__init__.py" else module.rpartition(".")[0]
    names = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            names.update(item.name for item in node.names)
        elif isinstance(node, ast.ImportFrom):
            name = "." * node.level + (node.module or "")
            absolute = importlib.util.resolve_name(name, package) if node.level else name
            names.add(absolute)
            names.update(absolute + "." + item.name for item in node.names)
    return names


def local_dependencies(root, name):
    parts = name.split(".")
    return [".".join(parts[:index]) for index in range(1, len(parts) + 1)
            if module_file(root, ".".join(parts[:index]))]


def closure(root, entries):
    pending, found, dependencies = list(entries), {}, {"jsonschema"}
    while pending:
        name = pending.pop()
        if name in found:
            continue
        path = module_file(root, name)
        require(path is not None, "PRODUCT_IMPORT_MISSING", "Missing product module: " + name)
        found[name] = path
        for dependency in imports(path, name):
            top = dependency.split(".")[0]
            if top == "metriccanvas_authoring":
                pending.extend(local_dependencies(root, dependency))
            elif top in DEPENDENCIES:
                dependencies.add(DEPENDENCIES[top])
            else:
                require(top in sys.stdlib_module_names or top == "__future__",
                        "PRODUCT_IMPORT_FORBIDDEN", "Undeclared or online dependency: " + dependency)
    return found, dependencies
