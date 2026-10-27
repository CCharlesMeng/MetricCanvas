"""Rebuild the observable dashboard from actual parser and composition outputs."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'metriccanvas-authoring/tool'))
from metriccanvas_authoring.data.time_range import normalize_time, TimeRangeError
from metriccanvas_authoring.pages.composition.page_structure import block_component
from metriccanvas_authoring.bundle_info import load_bundle_info


def time_rows():
    rows = []
    for case in json.loads((ROOT / 'tools/fixtures/query-time-contract.json').read_text()):
        value = case['input']
        try:
            result = normalize_time({'granularity': value['period'], 'start': value['start'], 'end': value['end']})
            actual = f"{result['start']} → {result['end']}"
        except TimeRangeError as error:
            actual = error.code
        rows.append({'period': value['period'], 'input': f"{value['start']} → {value['end']}", 'actual': actual})
    return rows


def document():
    rows = [{'region': 'a', 'amount': 1}, {'region': 'b', 'amount': 2}]
    source = {'fields': {'region': {'type': 'string', 'role': 'dimension'}, 'amount': {'type': 'number', 'role': 'measure'}},
              'source': {'type': 'query', 'initial': {'rows': rows[:1], 'totalCount': 2}}}
    block = {'id': 'plain', 'type': 'data', 'source': 'trusted', 'component': 'metricCard',
             'title': '普通指标卡', 'fields': ['amount'], 'match': {'field': 'region', 'equals': 'b'}}
    plain = block_component(block, {'trusted': source}, evidence={'rows': rows, 'totalCount': 2})
    rich = block_component({**block, 'id': 'rich', 'title': '汇总呈现', 'presentation': {'kind': 'metric-summary', 'metrics': [{'field': 'amount'}]}},
                           {'trusted': source}, evidence={'rows': rows, 'totalCount': 2})
    source['source'] = {'type': 'inline', 'rows': rows}
    return {'id': 'authoring-contract-reliability', 'schemaVersion': load_bundle_info()['pageSchemaVersion'], 'layout': 'dashboard',
        'dataSources': {
            'trusted': source,
            'cases': {'fields': {key: {'type': 'string', 'role': 'dimension'} for key in ('period', 'input', 'actual')},
                      'source': {'type': 'inline', 'rows': time_rows()}},
            'invalid-time': {'fields': {'amount': {'type': 'number', 'role': 'measure', 'queryField': 'amount'}},
                'source': {'type': 'query', 'query': {'language': 'dqe', 'body': {'dsl_list': [{
                    'output_metrics': ['amount'], 'output_dims': [],
                    'filter': {'time': {'period': 'month', 'start': '20260401', 'end': '20260930'}}}]}}}}},
        'sections': [
            {'id': 'header', 'components': [{'id': 'page-header', 'type': 'reportHeader', 'layout': {'span': 12},
                'props': {'title': '创作契约可靠性验收', 'subtitle': '合成证据 · 时间精度、完整行证据与执行前拒绝'}}]},
            {'id': 'evidence', 'title': '相同可信行证据：两种呈现都应显示 2', 'components': [plain, rich]},
            {'id': 'time-cases', 'components': [{'id': 'matrix', 'type': 'table', 'data': {'main': 'cases'}, 'layout': {'span': 12},
                'props': {'title': '实际解析结果', 'columns': [{'field': key, 'title': title} for key, title in (
                    ('period', '粒度'), ('input', '输入范围'), ('actual', '规范值或错误码'))]}}]},
            {'id': 'execution-rejection', 'components': [{'id': 'bad-time', 'type': 'table', 'layout': {'span': 12}, 'data': {'main': 'invalid-time'},
                'props': {'title': '非法 month + 日精度：执行前拒绝（诊断见控制台）', 'columns': [{'field': 'amount', 'title': '不会请求服务'}]}}]}]}


if __name__ == '__main__':
    output = ROOT / 'pages/capabilities/query/authoring-contract-reliability.json'
    output.write_text(json.dumps(document(), ensure_ascii=False, indent=2) + '\n')
