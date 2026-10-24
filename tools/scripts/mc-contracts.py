"""Export actual MCP registration against the in-memory product graph; no services."""
import asyncio
import ast
from dataclasses import asdict
import json
from pathlib import Path
import re
import sys
import os
import tempfile


def tool_contracts(root):
    source = root / 'tool/metriccanvas_authoring/entrypoints/mcp/platform_mcp.py'
    functions = ast.walk(ast.parse(source.read_text()))
    return {node.name: {'name': node.name, 'signature': ast.unparse(node.args),
        'description': ast.get_docstring(node), 'parameters': [arg.arg for arg in node.args.args]}
        for node in functions if isinstance(node, ast.AsyncFunctionDef)
        and any(ast.unparse(decorator) == 'mcp.tool' for decorator in node.decorator_list)}


async def registered_tools(root):
    from metriccanvas_authoring.entrypoints.mcp.platform_mcp import create_platform_mcp_server
    signatures = tool_contracts(root)
    tools = await create_platform_mcp_server(None).list_tools()
    return {tool.name: {**signatures[tool.name], 'inputSchema': tool.parameters,
        'source': 'FastMCP.list_tools; model input only'} for tool in tools}


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


def literal_error_sources(root):
    codes = {}
    for file in public_sources(root):
        for node in ast.walk(ast.parse(file.read_text())):
            found = call_error_codes(node) if isinstance(node, ast.Call) else dictionary_error_codes(node) if isinstance(node, ast.Dict) else []
            for code in found:
                codes.setdefault(code, []).append({'source': file.relative_to(root.parent).as_posix(), 'line': node.lineno})
    return {code: codes[code] for code in sorted(codes)}


def public_sources(root):
    package = root / 'tool/metriccanvas_authoring'
    # Deployment adapters and compatibility entrypoints are not public MC knowledge.
    return sorted([file for folder in ('data', 'pages', 'work', 'assets', 'delivery', 'entrypoints/mcp')
        for file in (package / folder).rglob('*.py') if '__pycache__' not in file.parts]
        + [package / name for name in ('build_issues.py', 'canonical.py', 'diagnostics.py', 'bundle_info.py', 'runtime_assets.py', 'schema_projection.py')]
        + list((root.parent / 'tools/mc-content/scripts').glob('*.py')))


def export(root, product):
    sys.path.insert(0, str(root / 'tool'))
    from metriccanvas_authoring.pages.compose_contract import COMPOSE_SCHEMA, PATTERNS
    from metriccanvas_authoring.pages.components.capabilities import AUTHORING_CAPABILITIES, product_catalog
    return {'composeSchema': COMPOSE_SCHEMA, 'patterns': PATTERNS,
        'componentCatalog': product_catalog(),
        'authoringCapabilities': {key: asdict(value) for key, value in AUTHORING_CAPABILITIES.items()},
        'queryErrorCodes': json.loads(product['query/error-codes.json'])['codes'],
        'pageErrorTypes': json.loads(product['page/error-types.json'])['types'],
        'tools': asyncio.run(registered_tools(root)), 'literalErrorCodes': list(literal_error_sources(root)),
        'literalErrorSources': literal_error_sources(root), 'guidance': error_guidance(root),
        'publicSources': [file.relative_to(root.parent).as_posix() for file in public_sources(root)]}


def staged_export(root, graph):
    with tempfile.TemporaryDirectory(prefix='mc-contract-graph-') as folder:
        staging = Path(folder)
        (staging / 'bundle.json').write_text((root / 'bundle.json').read_text())
        for namespace, files in [('contract-snapshot', graph['product']), ('contracts', graph['authoring'])]:
            for name, content in files.items():
                target = staging / namespace / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content)
        os.environ['METRICCANVAS_BUNDLE_ROOT'] = str(staging)
        return export(root, graph['product'])


if __name__ == '__main__':
    print(json.dumps(staged_export(Path(sys.argv[1]).resolve(), json.load(sys.stdin)), ensure_ascii=False))
