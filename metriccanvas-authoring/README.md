# MetricCanvas Authoring Bundle

这是一个可整体复制和锁步发布的创作期 Bundle，但内部不是一个混合模块：

- `skill/`：Relay/Agent 读取的流程与交互说明；不导入 Python。
- `tool/`：Python 3.12+ 的确定性创作 Tool；不读取 Skill。
- `contracts/`：Skill 与 Tool 之间的 Authoring Interface 契约。
- `contract-snapshot/`：仓根产品契约的只读生成快照，不是第二份真源。
- `test-harness/`：从外部调用 Tool 的测试宿主、fixture 与 Fake Adapter；不进入生产运行时。

Skill 与 Tool 只通过 MCP Tool Interface 协作。FastMCP 是入站 Adapter；Python 内部的
查询派生、验真、组件选择、装配和页面校验不会逐步暴露成模型工具。S2 已完成
Page Build Spec 经 application seam 调用三个语义 Port 的完整 Harness 路径；S3 已迁移
Data Context 校验/语义投影、取数单元闭集验真、DQE/结果字段契约派生、执行错误
归因与柱状图/折线图硬闸切片。Python 直接消费产品组件目录中生成的
`authoringShape`，不另存一份组件规则表。后续按
[`docs/plan/metriccanvas-authoring-bundle.md`](../docs/plan/metriccanvas-authoring-bundle.md)
继续迁移确定性算法。

## 独立验收

```bash
python3 -m pip install --require-hashes -r tool/requirements.lock
python3 scripts/check_bundle.py
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s test-harness/tests -p 'test_*.py'
```

根仓另提供 `pnpm authoring:contracts:check`，检查产品契约、Bundle 快照、Authoring
契约 manifest 与锁文件是否漂移。复制后的 Bundle 自身运行不依赖 Node、pnpm
workspace 包或真实 Relay/Java/DQE。
