# MetricCanvas Authoring Bundle

这是一个可整体复制和锁步发布的创作期 Bundle，但内部不是一个混合模块：

- `skill/`：Relay/Agent 读取的流程与交互说明；不导入 Python。
- `tool/`：Python 3.12+ 的确定性创作 Tool；不读取 Skill。
- `contracts/`：Skill 与 Tool 之间的 Authoring Interface 契约。
- `contract-snapshot/`：仓根产品契约的只读生成快照，不是第二份真源。
- `test-harness/`：从外部调用 Tool 的测试宿主、fixture 与 Fake Adapter；不进入生产运行时。

Skill 与 Tool 只通过 MCP Tool Interface 协作。FastMCP 是入站 Adapter；Python 内部的
查询派生、验真、组件选择、装配和页面校验不会逐步暴露成模型工具。S2 已完成
Page Build Spec 经 application seam 调用三个语义 Port 的完整 Harness 路径；S3 已完成
Data Context 校验/语义投影/检索/敏感隐去、取数单元闭集验真、DQE/结果字段契约派生、
执行错误归因，以及当前 TS 装配支持的七类组件、口径组分区、报告页头和比例装箱。
Python 直接消费产品组件目录中生成的 `authoringShape` 与导出的分析意图映射，
不另存规则表。S3 已用 TS 生成、Python 消费的向量锁定完整 Page JSON、
实际 DQE 请求、稳定错误 `code/path` 和页面语义准入。S4 已将
`discover_data_context` 与 `build_page` 作为仅有的两个模型可见工具，并用真实
FastMCP stdio 子进程 + Fake Ports 走通发现、构建与保存。后续按
[`docs/plan/metriccanvas-authoring-bundle.md`](../docs/plan/metriccanvas-authoring-bundle.md)
在外部 Interface 可见后进入 S5 迁移切换。

`tool/server.py` 是生产组合根，当前对未接入的 Data Context、DQE 和 Java 页面资产
Adapter 显式失败。`test-harness/stdio_server.py` 是仅测试使用的组合根，不是生产
fallback。

## 独立验收

```bash
python3 -m pip install --require-hashes -r tool/requirements.lock
python3 scripts/check_bundle.py
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s test-harness/tests -p 'test_*.py'
```

根仓另提供 `pnpm authoring:contracts:check`，检查产品契约、Bundle 快照、Authoring
契约 manifest 与锁文件是否漂移。复制后的 Bundle 自身运行不依赖 Node、pnpm
workspace 包或真实 Relay/Java/DQE。
