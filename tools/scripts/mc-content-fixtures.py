"""Generate a visible page from actual MC diagnostics; no business service is mocked as real."""
from copy import deepcopy
import json
from pathlib import Path
import sys
import shutil
import tempfile
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]
CONTENT = ROOT / 'metriccanvas-authoring/mc-content'
sys.path.insert(0, str(CONTENT / 'scripts'))
from mc_content import compile_layout, diagnose_package, evaluate, inspect_schema, preflight, verify_package, query_content


def distribution_rows():
    installation = diagnose_package(CONTENT)
    environment = preflight('all', root=CONTENT)
    with tempfile.TemporaryDirectory(prefix='mc-fixture-crlf-') as directory:
        copy = Path(directory) / 'mc-content'
        shutil.copytree(CONTENT, copy, ignore=shutil.ignore_patterns('__pycache__'))
        file = copy / 'layouts/report.md'
        file.write_bytes(file.read_bytes().replace(b'\n', b'\r\n'))
        rejected = diagnose_package(copy)
    return [
        {'case': '安装文件完整性', 'result': installation['status'], 'detail': '原字节摘要匹配；不代表页面或服务验收'},
        {'case': '运行依赖预检', 'result': environment['status'], 'detail': '实际调用解释器及 Node；环境故障不能改页面版本放行'},
        {'case': '换行转换拒绝', 'result': rejected['status'], 'detail': rejected['issues'][0]['code'] + ' / ' + rejected['issues'][0]['changed'][0]['hint']}]


def report_example(scene):
    sys.path.insert(0, str(ROOT / 'metriccanvas-authoring/tool'))
    from metriccanvas_authoring.pages.referenced import compose
    from mc_content import inspect_assembly
    source = {'fields': {'month': {'type': 'string', 'role': 'dimension', 'label': '月份'},
        'amount': {'type': 'number', 'role': 'measure', 'label': '合成用量', 'unit': '次'}},
        'source': {'type': 'inline', 'rows': [{'month': '2026-01', 'amount': 20}, {'month': '2026-02', 'amount': 30}]}}
    total = {'fields': {'amount': source['fields']['amount']}, 'source': {'type': 'inline', 'rows': [{'amount': 50}]}}
    records = {key: {'source': item, 'rows': item['source']['rows'], 'totalCount': len(item['source']['rows'])}
        for key, item in [('summary', total), ('trend', source)]}
    value = {'templateRef': {'scene': scene, 'variant': 'standard', 'templateVersion': '1'},
        'plan': {'title': scene + '｜合成布局验收', 'sources': {key: 'synthetic-' + key for key in records}, 'sections': [
            {'id': 'summary', 'blocks': [
                {'id': 'primary', 'type': 'data', 'component': 'metricCard', 'title': '合成用量', 'source': 'summary', 'fields': ['amount']},
                {'id': 'trend', 'type': 'data', 'component': 'lineChart', 'title': '合成趋势', 'source': 'trend', 'fields': ['month', 'amount']}]},
            {'id': 'detail', 'blocks': [{'id': 'detail-table', 'type': 'data', 'component': 'table', 'title': '合成明细', 'source': 'trend', 'fields': ['month', 'amount']}]}]}}
    compiled = compile_layout(value)
    assert compiled['status'] == 'ok', compiled
    result = compose(SimpleNamespace(binding={'pageId': 'mc-layout-' + scene}), compiled['plan'], records)
    assert result['status'] == 'changed', result
    inspection = inspect_assembly(result['document'], compiled['inspectionSpec'])
    assert inspection['status'] == 'ok', inspection
    return result['document'], {'compile': compiled, 'assembly': result['operations'], 'inspection': inspection}


def results():
    matrix = json.loads((CONTENT / 'eval/fixtures/example-matrix.json').read_text())
    normal = matrix['checks'][0]['input']
    compiled = compile_layout(normal)
    required = deepcopy(normal)
    required['userRequirements'] = [{'id': 'note', 'mustBe': 'mapChart'}]
    required_result = compile_layout(required)
    planned = deepcopy(normal)
    planned['templateRef']['scene'] = 'ioc-overview'
    planned_result = compile_layout(planned)
    old = json.loads((ROOT / 'tools/fixtures/local-authoring-upgrade/schema-upgrade-demo.json').read_text())
    old_result = inspect_schema(old)
    future = deepcopy(old)
    future['schemaVersion'] = '999.0'
    future_result = inspect_schema(future)
    report = evaluate(matrix)
    knowledge = query_content('knowledge', 'table.width')
    coverage = query_content('runtime', 'coverage', {'maxBytes': 1048576})['content']
    tool = query_content('tool', 'query_data', {'includeSchema': True})['content']
    assert not knowledge['truncated']
    assert 'request' in tool['inputSchema']['properties']
    assert compiled['status'] == 'ok'
    assert required_result['status'] == 'gap'
    assert planned_result['status'] == 'invalid'
    assert old_result['status'] == 'upgrade_required'
    assert not future_result['upgrade']['possible']
    rows = distribution_rows() + [
        {'case': '同源知识有界读取', 'result': 'ok', 'detail': 'table.width 保留语义与父约束；未展开引用可继续定位'},
        {'case': '完整工具参数', 'result': 'ok', 'detail': 'query_data 外层与 request 来自实际 FastMCP 注册'},
        {'case': '来源覆盖对账', 'result': 'ok', 'detail': f"{coverage['counts']['topics']} 主题 / {coverage['counts']['tools']} 工具 / {coverage['counts']['components']} 组件；独立分母检查"},
        {'case': '正常编译', 'result': compiled['status'], 'detail': 'summary 保留；未提交的 detail 章节不会补回'},
        {'case': '用户要求地图', 'result': required_result['status'], 'detail': required_result['gaps'][0]['code']},
        {'case': 'IOC 计划场景', 'result': planned_result['status'], 'detail': planned_result['gaps'][0]['code']},
        {'case': '旧版 6.0 页面', 'result': old_result['status'], 'detail': '原 layoutForm 文件不能直接读取；产品迁移规则允许升级'},
        {'case': '未来 999.0 页面', 'result': future_result['status'], 'detail': '无升级规则，不改版本号放行'},
        {'case': '真实保存与 Relay', 'result': 'not_run', 'detail': 'MC 只给检查结论；此合成场景未连接真实部署'}]
    return rows, {'compile': compiled, 'required': required_result, 'planned': planned_result,
        'oldSchema': old_result, 'futureSchema': future_result, 'evaluation': report,
        'knowledge': {'key': knowledge['key'], 'requiredBytes': knowledge['requiredBytes'], 'truncated': knowledge['truncated']},
        'coverageCounts': coverage['counts']}


def demo(rows):
    _, manifest = verify_package()
    return {'id': 'mc-content-layout-demo', 'schemaVersion': manifest['alignedWith']['pageSchemaVersion'], 'layout': 'dashboard',
        'meta': {'title': 'MC 内容包：布局与版本检查', 'description': '由真实本地诊断生成的合成验收页；不代表真实部署。'},
        'dataSources': {'diagnostics': {'fields': {key: {'type': 'string', 'role': 'dimension', 'label': label}
            for key, label in [('case', '检查项'), ('result', '结果'), ('detail', '说明')]},
            'source': {'type': 'inline', 'rows': rows}}},
        'sections': [{'id': 'header', 'container': 'plain', 'components': [{'id': 'page-header', 'type': 'reportHeader',
            'layout': {'span': 12}, 'props': {'title': 'MC 内容包：布局与版本检查'}}]},
            {'id': 'checks', 'title': '本地确定性检查', 'components': [{'id': 'diagnostic-table', 'type': 'table',
                'layout': {'span': 12}, 'data': {'main': 'diagnostics'}, 'props': {'title': '检查结果与证据范围',
                    'columns': [{'field': 'case', 'title': '检查项', 'sortable': True}, {'field': 'result', 'title': '结果'}, {'field': 'detail', 'title': '说明'}]}}]},
            {'id': 'usage', 'components': [{'id': 'upgrade-flow', 'type': 'text', 'layout': {'span': 12},
                'props': {'body': '旧文件流程：整包校验 → 检查可读范围与能力下限 → 显式升级到新目录 → 核对原件与迁移报告 → Skill 决定采用。此页面不执行保存、发布或真实查询。'}}]}]}


def main():
    rows, report = results()
    outputs = {ROOT / 'pages/capabilities/layout/mc-content-layout-demo.json': demo(rows),
        ROOT / 'docs/evidence/mc-content-layout/diagnostics.json': report}
    for scene in ('business-report', 'usage-report'):
        document, inspection = report_example(scene)
        outputs[ROOT / f'pages/capabilities/layout/mc-layout-{scene}.json'] = document
        outputs[ROOT / f'docs/evidence/mc-content-layout/{scene}.json'] = inspection
    for file, value in outputs.items():
        text = json.dumps(value, ensure_ascii=False, indent=2) + '\n'
        if '--check' in sys.argv:
            if not file.is_file() or file.read_text(encoding='utf-8') != text:
                raise ValueError(f'Diagnostic fixture drift: {file}')
        else:
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text(text, encoding='utf-8', newline='\n')
    print('MC diagnostics and visible fixture current')


if __name__ == '__main__':
    main()
