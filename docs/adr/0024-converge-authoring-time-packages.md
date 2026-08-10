---
status: accepted
---

# 创作期包边界按领域收敛，agent-runner 与 data-context 不再是一级包

ADR-0006 确立「包按 DDD 分层围绕聚合根看板页面命名」，并在 Consequences 中约束「包名与词汇表绑定」。运行时一侧（`page`、`runtime`、`runtime-ui`、`widgets`、`data-gateway`、`embed`）完整兑现了该决策：依赖无环、单一汇点在 `page`、端口在 `runtime`、适配器在 `data-gateway`、组合在 apps。创作期一侧没有：`packages/` 下按技术而非领域命名的包恰好是 `agent-runner` 与 `mcp` 两个，也恰好是 `CONTEXT.md` 里查不到词条的那两个。

本决策把创作期包边界收敛到与运行时一侧同一标准，`packages/` 由 11 个降为 9 个。这不改变任何运行时行为，也不改变页面协议。

## 决策

**MCP 协议类型归 `packages/mcp`。** `McpClient`、`ToolDefinition`、`McpToolResult` 当前定义在 `agent-runner`，导致 `packages/mcp` 仅为一个类型反向依赖 Agent 宿主包——提供 MCP server 的一侧依赖消费 MCP 的一侧。ADR-0006 第 2 条要求「依赖倒置同时体现在 import 方向与命名上」，这条箭头两头都不满足。这三个类型是 MCP 协议概念，归 `mcp` 所有。

**`agent-runner` 解散进 `apps/platform`。** ADR-0009 已把 Agent Runner 判给平台应用（「承载页面搭建工作台、Agent Runner、MCP、发布确认和管理入口」）；独立成包是为兑现同一 ADR 的「Agent Runner 只依赖模型提供方与 MCP 客户端接口」，但真实消费者只有 `apps/platform` 一个，模块边界足以施加同一约束。解散时按 ADR-0006 第 2 条「端口按意图命名，适配器按系统命名」拆开当前 345 行单文件中混装的三件事：Agent 循环与 `ModelProvider` 端口、DeepSeek 适配器（硬编码 endpoint 与模型名）、脚本化测试替身（当前从生产入口导出）。

**`data-context` 并入 `packages/mcp`。** 「数据上下文快照」是 `CONTEXT.md` 一等术语，且按 solution.md「统一运行时不加载数据上下文」不得并入 `page`；但该包 229 行中约 145 行是类型声明，唯一行为 `search()` 是子串匹配，快照本身是 fixture 而非真实 provider，真实消费者只有 MCP 的 `search_data_context` 工具。创作期上下文只服务于创作期能力面，与 `mcp` 同域。

**`page-lifecycle` 的 `DataContextProvider` 更名。** 该名字现被定义两次且契约不同：`data-context` 的返回完整快照，`page-lifecycle` 的只返回 `{ version }`，组合根因此必须从同一份快照构造两个同名适配器。`page-lifecycle` 侧只用于给页面修订盖创作依据版本印章，按其真实意图更名，消除一名两义。

**`page-lifecycle` 与 `template-library` 保留一级包。** 两者概念均在 `CONTEXT.md` 并各有 ADR-0008、ADR-0010 背书。`page-lifecycle` 的 memory 与 postgres 双实现收敛在同一接口后并有共享契约测试，是真实的端口/适配器接缝；它独立于 `page` 还有部署理由——`page` 会被 `embed` 打进浏览器分发件，而 `page-lifecycle` 依赖 `postgres`。

## 待决：模板发布的治理强度

`template-library` 在结构上复制了 `page-lifecycle` 的整套机器（线性修订与 `baseRevisionId` 冲突检查、人工确认发布与 token hash、逐操作幂等表、advisory lock 串行化、memory 与 postgres 双实现、平行错误码、平行角色枚举），且复制后已经漂移：模板发布没有租约过期、没有审计事件、没有拒绝/取消/强制释放，`TemplatePublishStatus` 只有 `pending` 与 `published` 两态；页面发布有 7 态并写入 `publish_audit_events`。

`CONTEXT.md` 的「发布租约」定义只覆盖看板页面，未要求模板具备同等治理，因此现状不构成词汇表违规；但没有任何 ADR 说明模板发布为何可以弱于页面发布。这是产品治理裁决而非代码结构裁决，本 ADR 不代为决定，记为待决：要么模板获得同等的租约与审计（届时抽取共享的修订与发布内核），要么以 ADR 明确记录模板发布刻意采用弱治理及其理由。在该决策落定前不抽取共享内核——否则会把一处未经确认的漂移固化进抽象。

## Consequences

- `packages/` 保留 9 个包，除 `embed`（分发件）与 `mcp`（协议能力面）外，每个包都对应一个 `CONTEXT.md` 术语。
- `mcp` 不再依赖 Agent 宿主；Agent 侧依赖 `mcp` 获取协议类型，箭头方向恢复正常。
- DeepSeek endpoint 与模型名从包的公开入口退回平台应用的适配器模块，替换模型提供方不再触碰包边界。
- 脚本化测试替身不再从生产入口导出。
- `DataContextProvider` 在仓库内唯一。
- 模板发布与页面发布的治理差异从「隐式漂移」变为「显式待决」，后续任一方向的改动都必须先落 ADR。
- 与 ADR-0009 的表述对齐：Agent Runner 本就被该 ADR 归入平台应用，此前的包边界是对其隔离要求的过度实现。

## Considered Options

- 保留 `agent-runner` 以备未来复用：与 ADR-0023 已确立的先例矛盾——该 ADR 正是以「长期占位于 workspace 却不被任何构建目标引用」为由物理删除了六个目录；当前仅一个消费者，属推测性边界，不采用。
- 把 `data-context` 并入 `page`：违反 solution.md「统一运行时不加载数据上下文」，且会把创作期概念拖进 `embed` 的浏览器分发链路，不采用。
- 把 `page-lifecycle` 并入 `page` 以进一步减包：会让 `postgres` 进入被 `embed` 打包的领域层，不采用。
- 本次一并抽取 `page-lifecycle` 与 `template-library` 的共享修订/发布内核：在模板治理强度未裁决前抽取，等于把未确认的漂移固化为抽象契约，改为记为待决。
- 顺带把 `mcp` 按领域意图更名以贯彻 ADR-0006 命名规则：`mcp` 是对外协议能力面而非出向端口的适配器，命名规则适用性存疑，且更名波及面远大于本次收敛目标，不在本 ADR 处理。
