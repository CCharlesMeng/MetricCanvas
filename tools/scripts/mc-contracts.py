"""Export active MC contracts using only Python stdlib; no Agent or service startup."""
import ast
from dataclasses import asdict
import json
from pathlib import Path
import re
import sys


def tool_contracts(root):
    source = root / 'tool/metriccanvas_authoring/entrypoints/mcp/platform_mcp.py'
    functions = ast.walk(ast.parse(source.read_text()))
    return {node.name: {'name': node.name, 'signature': ast.unparse(node.args),
        'description': ast.get_docstring(node), 'parameters': [arg.arg for arg in node.args.args]}
        for node in functions if isinstance(node, ast.AsyncFunctionDef)
        and any(ast.unparse(decorator) == 'mcp.tool' for decorator in node.decorator_list)}


def error_guidance(root):
    tree = ast.parse((root / 'tool/metriccanvas_authoring/work/diagnostics.py').read_text())
    values = next(ast.literal_eval(node.value) for node in tree.body
        if isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id == '_GUIDANCE' for target in node.targets))
    guidance = {}
    text = (root.parent / 'tools/mc-content/runtime/error-repair.md').read_text()
    for line in text.splitlines():
        if not line.startswith('- ') or '：' not in line:
            continue
        names, message = line.split('：', 1)
        for code in re.findall(r'\b[A-Z][A-Z0-9_]{3,}\b', names):
            guidance[code] = {'message': message, 'action': None, 'owner': 'caller'}
    guidance.update({code: {'message': value[0], 'action': value[1], 'owner': value[2]} for code, value in values.items()})
    return guidance


def call_error_codes(node):
    name = node.func.id if isinstance(node.func, ast.Name) else getattr(node.func, 'attr', '')
    if name not in {'require', 'issue'} and not name.endswith(('Error', 'Issue', 'Failure')):
        return []
    return [arg.value for arg in node.args if isinstance(arg, ast.Constant)
        and isinstance(arg.value, str) and re.fullmatch('[A-Z][A-Z0-9_]{3,}', arg.value)]


def dictionary_error_codes(node):
    return [value.value for key, value in zip(node.keys, node.values)
        if isinstance(key, ast.Constant) and key.value == 'code' and isinstance(value, ast.Constant)
        and isinstance(value.value, str) and re.fullmatch('[A-Z][A-Z0-9_]{3,}', value.value)]


def literal_errors(root):
    codes = set()
    files = [*(root / 'tool/metriccanvas_authoring').rglob('*.py'), *(root.parent / 'tools/mc-content/scripts').glob('*.py')]
    for file in files:
        if '_bundle' in file.parts:
            continue
        for node in ast.walk(ast.parse(file.read_text())):
            if isinstance(node, ast.Call):
                codes.update(call_error_codes(node))
            elif isinstance(node, ast.Dict):
                codes.update(dictionary_error_codes(node))
    return sorted(codes)


def export(root):
    sys.path.insert(0, str(root / 'tool'))
    from metriccanvas_authoring.pages.compose_contract import COMPOSE_SCHEMA, PATTERNS
    from metriccanvas_authoring.pages.components.capabilities import AUTHORING_CAPABILITIES, product_catalog
    return {'composeSchema': COMPOSE_SCHEMA, 'patterns': PATTERNS,
        'componentCatalog': product_catalog(),
        'authoringCapabilities': {key: asdict(value) for key, value in AUTHORING_CAPABILITIES.items()},
        'queryErrorCodes': json.loads((root / 'contract-snapshot/query/error-codes.json').read_text())['codes'],
        'pageErrorTypes': json.loads((root / 'contract-snapshot/page/error-types.json').read_text())['types'],
        'tools': tool_contracts(root), 'literalErrorCodes': literal_errors(root), 'guidance': error_guidance(root)}


if __name__ == '__main__':
    print(json.dumps(export(Path(sys.argv[1]).resolve()), ensure_ascii=False))
