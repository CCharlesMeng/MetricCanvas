---
status: accepted
---

# Agent 返回页面构建产物，Relay 会话与 Java 页面资产分别持久化

ADR-0060、0061 与 0063 让 Python `build_page` 在装配完成后直接调用 Java 保存页面修订，
这与 ADR-0030 的两速生命周期冲突：问数与探索应先产生临时页面态，只有用户显式沉淀才进入
资产态。目标改为 Agent/Python 只产出已校验的页面构建产物，Relay 保存分析会话与最新检查点，
Svelte 在用户显式沉淀时调用 Java 页面资产 Interface。该决策部分取代前三份 ADR 中
“Python 直接保存 Java 修订”、Tool 派生保存幂等键和取消后仍可能自动落修订的目标结论。

## Decision

**Python Authoring Core 以 `compose(PageBuildSpec) -> PageBuildArtifact` 为外部 Interface。**
`PageBuildArtifact` 包含已通过当前 Page Schema 与跨引用不变式校验的页面文档、
`dataContextVersion`、Bundle 版本与完整性摘要。Core 仍负责数据上下文约束、DQE 真实执行、
结果字段契约、组件硬闸与页面装配，但不拥有临时页面、会话检查点或页面修订的持久化。
目标 Bundle 删除 `PageAssetPort`、Java Page Assets Adapter、保存来源与保存幂等键派生；
迁移期间现有 `build_page` 可作为兼容包装保留，最终模型可见工具只有
`discover_data_context` 与 `compose_page`。

**完整页面构建产物与模型摘要必须走双通道。** Relay 当前会把 MCP 完整返回值重新放进模型
上下文，并把 `tool-execution.result_summary` 写入会话事件；因此不得直接把含初始数据行的
完整页面文档作为普通 tool result 暴露。Relay 在 MCPToolProxy/observer seam 增加
Page Artifact Adapter：从 `compose_page` 信封中取出完整产物，保存为该 session 的最新
MetricCanvas 检查点，并只把不含页面文档和数据行的 `modelSummary` 送回模型。前端事件只携带
`artifactId`、摘要、完整性 hash 与 checkpoint version；Svelte 再通过按用户鉴权的 Relay
Session Interface 读取完整产物。在这个 Adapter 完成前，`compose_page` 不得对真实模型开放。

**Relay 是分析会话、步骤事件与最新检查点的持久化所有者。** MetricCanvas 不在 Java 或浏览器
复制第二份会话库。Relay 需要补齐应用级最新检查点 Interface、90 天保留、本人/平台管理员
可见性、乐观并发和按 `session_id + version_id` 的恢复；步骤事件解释过程，最新检查点恢复
工作状态，完整页面文档不在追加事件流中逐轮复制。Relay 没有 Run 一级实体仍是事实，
`session_id` 是跨系统关联标识。

**页面修订仍只由 Java 页面资产 Module 保存。** 用户在 Svelte 明确执行“沉淀为 Report/Data App”
后，平台以当前用户身份把选定的页面构建产物提交给 Java `savePageRevision`。平台根据
`pageId + baseRevisionId + canonical(document)` 派生保存幂等键；Java 继续执行完整页面复验、
不可变修订、基线冲突、指纹幂等与操作者审计。Agent、Skill 与 Python Tool 均不能自行触发保存。

**纯 Skill ReAct 只作为接线过渡。** 当前没有现成的 Relay 固定工作流能力，M3A 可以先依赖
`SKILL.md` 接通发现与装配；但最终切换前必须由 Relay 可执行扩展或等价强制约束兑现固定编排、
调用预算、确认等待和多轮状态。Skill 文案不能单独作为行为等价证据。

## Consequences

- ADR-0030 与 ADR-0058 的临时页面态、显式沉淀和最新检查点语义保持不变；部署所有权从旧
  Platform Node 实现迁到 Relay Session。
- Relay 需要新增一个同时保护数据最小化和前端 artifact 交付的 Adapter；普通 MCP tool result
  不是安全的页面产物通道。
- Python `compose` 可以先作为无保存副作用的深 Module 落地并由内存 Adapter 验收；旧
  `build_page` 兼容包装在 Relay Artifact Adapter 与平台保存链完成前保留。
- 取消后的迟到页面产物不得自动创建页面修订；Relay 可将其标为已取消或丢弃，但不能覆盖更新的
  检查点。
- Java 保存入口不再依赖 Page Build Spec 或模型重试语义，只依赖平台提交的页面文档与保存命令。

## Considered Options

- **Python 装配完成即保存 Java 修订。** 会把每次问数变成资产写入并绕过用户显式沉淀，不采用。
- **把完整页面文档直接作为 MCP 返回值交给 Relay。** 当前实现会把全文送回模型，扩大数据可见面，
  且在追加事件里重复页面文档，不采用。
- **Java 同时保存分析会话。** 可以复用平台后端，但用户已选择 Relay 作为会话持久化所有者；
  复制一份会话库还会引入双写与恢复冲突，不采用。
- **浏览器持有临时页面且不保存检查点。** 刷新后无法恢复、续跑或沉淀，违反 ADR-0058，不采用。
