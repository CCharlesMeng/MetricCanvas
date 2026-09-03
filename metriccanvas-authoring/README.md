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
`discover_data_context` 与 `build_page` 作为兼容面的两个模型可见工具，并用真实
FastMCP stdio 子进程 + Fake Ports 走通发现、构建与保存。0.2.0 已从保存用例中提取
无保存副作用的 `compose(PageBuildSpec) -> PageBuildArtifact` application Interface；
Core 对最多 6 个取数单元有序并发调用 DQE，并按单元序号稳定装配或报告首个失败；
`build_page` 目前只是调用该 Core 后继续保存到 Java 的迁移兼容包装。后续按
[`docs/plan/metriccanvas-authoring-bundle.md`](../docs/plan/metriccanvas-authoring-bundle.md)
和 [ADR-0064](../docs/adr/0064-agent-returns-page-artifact-relay-and-java-own-persistence.md)
推进 S5 迁移切换。

FastMCP 现在提供两个互斥的工具面，避免迁移期间出现三个模型可见工具：默认
`METRICCANVAS_TOOL_SURFACE=compatibility` 公开 `discover_data_context + build_page`；仅在 Relay
Page Artifact Adapter 已安装时设置 `METRICCANVAS_TOOL_SURFACE=relay`，公开
`discover_data_context + compose_page`。Relay 面成功返回带
`kind=metriccanvas.page-build-artifact` 判别符的信封；Adapter 必须保存完整 `artifact`，只把
不含页面文档和数据行的 `modelSummary` 放回模型上下文。

目标模型可见面保持两个深工具：`discover_data_context` 与 `compose_page`。
完整 `PageBuildArtifact` 含页面文档和 DQE 初始数据行，不能作为普通 MCP 返回值重新进入模型上下文；
Relay Page Artifact Adapter 完成“完整产物写会话检查点、仅脱敏摘要回模型”的双通道前，
生产配置不得启用 Relay 工具面。默认兼容面继续阻止误开放；目标 `SKILL.md` 已锁定
`allowed-tools: [discover_data_context, compose_page]`，只随 Relay 工具面部署。

M1 首个 Agent 契约切片已加入业务词解析、三类模型决策、持久化步骤事件和 conformance
四份 Agent Schema，并新增 Relay Artifact 信封 Schema。`exported/agent-conformance.json` 从生产
TypeScript 真源实时导出 5 条指标检索、10 条确定性业务词、5 条模型决策和 3 条步骤事件/Port
调用向量；Python 已逐字段对齐指标、维度、封闭取值域、相对时间、分析意图与结构操作的首批语法。

`tool/server.py` 是生产组合根：Java 页面资产 Adapter（J4，ADR-0062）由 MCP config `env` 配置，
Data Context 与 DQE Adapter 未接入时显式失败（A2 / A3）。`test-harness/stdio_server.py` 是仅测试
使用的组合根，不是生产 fallback；`test-harness/slice_server.py` 是本地纵切用的组合根（Relay / DQE
替身 + 真实 Java Adapter），由根仓 `pnpm slice:page-assets` 驱动。

```json
{
  "mcpServers": {
    "metriccanvas-authoring": {
      "command": "python",
      "args": ["tool/server.py"],
      "env": {
        "METRICCANVAS_TOOL_SURFACE": "compatibility",
        "METRICCANVAS_PAGE_ASSETS_BASE_URL": "http://host:8080/rest/cdi/pageassets/v1",
        "METRICCANVAS_OPERATOR_ID": "<服务态 X-Operator-Id>",
        "METRICCANVAS_AUTH_TOKEN": "<服务态 X-Auth-Token，可选>"
      }
    }
  }
}
```

Relay Adapter 就绪后的 MCP 配置把 `METRICCANVAS_TOOL_SURFACE` 改为 `relay`；该模式不调用 Java
页面资产 Adapter。用户显式沉淀时仍由 Svelte/平台以当前用户身份调用 Java。

当前兼容包装的身份走 `IdentityPort`，第一个 Adapter（`adapters/outbound/env_identity.py`）读上面两个 env：这是 ADR-0063
登记的服务态形态，所有创作者以同一 operator 保存，任何文案不得说"已按用户身份"。`build_page` 不再接受
`idempotency_key`：幂等键由 Tool 按 `hash(pageId, baseRevisionId, canonical(spec))` 派生，重试同一
Spec 命中 Java 指纹幂等原样返回；保存命令携带 `source.relay { sessionId?, skillVersion }` 与
`dataContextVersion`；`baseRevision.pageId` 与 `page_id` 不一致在发现前即以
`BASE_REVISION_PAGE_ID_MISMATCH` 拒绝。Java 错误码（`REVISION_CONFLICT`、`INVALID_PAGE`…）原样进入
`save` 阶段 issue，Java 不可达为 `PAGE_ASSETS_UNAVAILABLE`。

最终架构中 Agent/Python 不保存临时页面、会话检查点或正式页面修订。Relay Session 保存步骤事件和
最新临时页面检查点；用户显式沉淀时，Svelte/平台以当前用户身份调用 Java 页面资产 Interface。

## 独立验收

```bash
python3 -m pip install --require-hashes -r tool/requirements.lock
python3 scripts/check_bundle.py
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s test-harness/tests -p 'test_*.py'
```

根仓另提供 `pnpm authoring:contracts:check`，检查产品契约、Bundle 快照、Authoring
契约 manifest 与锁文件是否漂移。复制后的 Bundle 自身运行不依赖 Node、pnpm
workspace 包或真实 Relay/Java/DQE。
