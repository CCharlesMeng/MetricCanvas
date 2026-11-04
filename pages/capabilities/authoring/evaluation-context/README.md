# 创作期时间校验

完整页面：[authoring-evaluation-context.json](authoring-evaluation-context.json)。页面 id 与文件名一致，显式使用 `layout:"dashboard"`；Schema 6.82，无新增页面字段。

## 页面与浏览器操作

在集成工作树根目录启动 `pnpm dev:playground`，打开 `/pages/authoring-evaluation-context`，无需 URL 参数或 DQE 服务。页面使用既有 Dashboard 统一筛选栏展示日期和月份，正文通过文本筛选引用显示已应用值；`filterGroup` 只支持固定维度单选，不用于这两个时间点。

1. 初始日期为 `2020-01-01`，月份为 `2020-01`；正文的日期、月份与筛选一致。
2. 将日期选为 `2020-01-02` 并应用，正文日期同步变化，月份不变；再将月份选为 `2020-02`，正文月份同步变化。
3. 两个筛选均声明 `disableFuture:true`。正常渲染仍按执行环境当前时间限制未来输入；省略工具评估上下文不会改变旧渲染行为。

该页只使用静态日期声明和文本，没有页面数据源或查询。浏览器只证明控件、统一筛选状态及文本引用正常；页面不会自动执行下面的 Node 工具时区对照，也不展示伪造的工具回执。实际浏览器验收由主控在集成工作树执行。

## 同一页面的工具边界复现

以下步骤读取此页，复制候选后仅把 `/filters/0/default` 改为 `2027-01-01`，保留月份 `2020-01`。`evaluation` 只放在工具 `input` 中，绝不加入页面 JSON。该上下文由程序在创作轮次开始时冻结供给，模型不能覆盖；下例是显式固定输入的验收程序。

在仓库根目录设置已导出的四项根目录，然后调用其中稳定 facade（需要首次准备好的 Python/Node 环境；此步骤不构建、不安装依赖）：

```sh
export MC_RELEASE_ROOT=/absolute/path/to/four-artifact-release
python3 - <<'PY'
from copy import deepcopy
import json
import os
from pathlib import Path
import subprocess
import sys

page = json.loads(Path('pages/capabilities/authoring/evaluation-context/authoring-evaluation-context.json').read_text())
candidate = deepcopy(page)
candidate['filters'][0]['default'] = '2027-01-01'
instant = '2026-12-31T16:30:00Z'
cases = [
    ('shanghai', {'instant': instant, 'timeZone': 'Asia/Shanghai'}, 'ok', 0),
    ('los-angeles', {'instant': instant, 'timeZone': 'America/Los_Angeles'}, 'error', 2),
    ('missing-context', None, 'error', 2),
    ('invalid-zone', {'instant': instant, 'timeZone': 'Not/AZone'}, 'error', 2),
]
for name, evaluation, status, exit_code in cases:
    value = {'document': candidate}
    if evaluation is not None:
        value['evaluation'] = evaluation
    request = {'format': 'metriccanvas-mc-request/1', 'requestId': name, 'input': value}
    result = subprocess.run(
        [sys.executable, '-B', str(Path(os.environ['MC_RELEASE_ROOT']) / 'mc-tool/cli.py'), 'invoke', 'page.validate'],
        input=json.dumps(request), capture_output=True, text=True, check=False)
    receipt = json.loads(result.stdout)
    assert result.returncode == exit_code, (name, result.stderr, receipt)
    assert receipt['status'] == status, (name, receipt)
    print(json.dumps({'case': name, 'status': receipt['status'], 'diagnostics': receipt['diagnostics']}, ensure_ascii=False))
assert page['filters'][0]['default'] == '2020-01-01'
PY
```

预期结果：

| 输入 | 可观察结果 |
|---|---|
| 同一 instant，`Asia/Shanghai` | 当地为 2027-01-01；候选通过，诊断为空 |
| 同一 instant，`America/Los_Angeles` | 当地为 2026-12-31；`SCHEMA_ERROR`，路径 `/filters/0/default`，消息“时间点不得晚于当前日期” |
| 缺少 evaluation | `EVALUATION_CONTEXT_REQUIRED`，路径 `/evaluation` |
| `timeZone:"Not/AZone"` | `INVALID_EVALUATION_CONTEXT`，路径 `/evaluation` |

可另将非法区替换为 `instant:"2026-12-31T16:30:00"`（无偏移）或非法日期，仍须返回 `INVALID_EVALUATION_CONTEXT`，不得用机器默认值补齐。将执行进程的 `TZ` 分别设为 UTC、Pacific/Honolulu 或 Asia/Tokyo，固定上述 instant＋业务 timeZone，输出诊断应保持完整同序；不得通过全局修改 Date/TZ 实现产品上下文。

## 证据边界

本页没有真实业务数据、查询、授权、保存或发布。产品静态校验、Node 仓外/跨时区检查与浏览器交互分开记录；这些结果不证明真实 Relay、Java、DQE、真实模型或部署完成。页面原文件始终保留 2020 初值。浏览器后的统一协议知识、local-authoring 和发行资源由主控从同一真源生成。
