---
status: accepted
---

# Relay 与 DQE 真实接口对创作期边界的修正

## Context

ADR-0060 与 ADR-0061 在真实 Relay、DQE 不可见时形成，其中若干前提是从《Data Agent
Skill 开发指南》推断的。2026-09-02 对 Relay 仓库 `CDIRelayAgentService` 与 DQE 代理层
`CDINL2DataBuilderService` 的调查带回了事实，其中四项与已接受决策直接冲突：

1. Relay 没有 Run 概念，`run_id` 不存在；Skill 版本不进入运行上下文。
2. Relay 的 MCP 调用路径只转发模型生成的参数，不传用户身份、token 或 session；
   而 DQE 执行接口必须以用户的 `X-Auth-Token` + `X-Operator-Id` 鉴权并注入行级过滤。
3. Relay 对 stdio MCP 采用每次调用一个一次性子进程、`uvx --from <tar.gz>` 拉起；
   ADR-0061 规定 Bundle 不发布 wheel。
4. 元数据由 Lab 以服务态 token 全量返回，不按用户过滤；ADR-0060 要求数据上下文按身份过滤。

此外：模型重试与 Planner 重试（最多 10 次）会重复调用工具而无平台幂等键；前端只有
WebSocket `/ws/{client_id}`，用 `role_name` 选 Skill，没有 `skillKey`；取消不会终止
MCP 子进程；工具调用默认超时 60s，Skill Hub 上架要求响应 ≤ 30s。

## Decision

**修订来源按可得性记录。** `source.relay` 改为 `{ sessionId?, runId?, skillVersion }`：
`skillVersion` 由 Tool 从 `bundle.json` 提供（Skill 与 Tool 同一 Bundle 版本，Relay 不需要
知道）；`sessionId` 与 `runId` 可得时记录。ADR-0060 "必须记录 sourceRunId" 修正为
"来源结构必填，Run 标识可选"。

**幂等键由 Tool 确定性派生。** `build_page` 的幂等键为
`hash(pageId, baseRevisionId, canonical(PageBuildSpec))`，不再由模型或命令外壳提供。
模型重试、Planner 重试或断线重放会命中 Java 的指纹幂等并原样返回；同一基线上的不同
Spec 是不同键，第二次保存按 `REVISION_CONFLICT` 处理。ADR-0061 "幂等键属于 command
envelope" 的归属不变，来源改为 Tool 内部。

**Tool 以 sdist 交付供 `uvx` 安装。** `tool/` 增加 `pyproject.toml`，Bundle 发布产物包含
sdist tar.gz；Relay MCP config 用 stdio `command: uvx, args: [--from, <tar.gz>, ...]`。
ADR-0061 "不发布 wheel" 修正为"不发布到公共索引，但产出可安装分发包"。Bundle 仍是原子
容器，Skill 与 Tool 仍只经 MCP 协作。每次调用一次性子进程的冷启动若使 `build_page`
超过 30s，切换到 streamable_http 常驻服务是已登记的备选，不改变 Tool 内部结构。

**身份先以服务态注入，按用户身份是生产门禁。** 第一阶段 Tool 从 MCP config 的 `env`
读取一组服务态 `X-Auth-Token` / `X-Operator-Id` 调用 NL2SQL 服务；这明确偏离 ADR-0060
"不以后台高权限身份替用户验真"，后果是创作期所有创作者以同一身份查数，可能看到本人
无权限的行。为此：Tool 内部把身份收敛为一个 `IdentityPort`，服务态 env 只是它的第一个
Adapter；生产上线前必须替换为按用户身份，首选路径是 Relay Plugin
`on_tool_execute_before` 在服务端向工具调用注入会话身份（模型不可见、不可改），次选为
向 Relay 团队提出 `MCPToolProxy` 注入改造。两条路径都不改变 Tool 的其他部分。
运行期查看者仍以本人身份经 platform 数据网关执行，不受此偏离影响。

**DQE 只经 `CDINL2DataBuilderService` 的 `POST /rest/cdi/cdinl2databuilderservice/v1/dsl/execute`。**
其 `dsl_list` 形状与本仓查询定义一致；行级权限由该服务注入过滤条件后再调 Lab，因此
永不直连 Lab。错误映射：`NO_PERMISSION` → 无权限、HTTP 401 → 需要登录、`NO_MATCH` /
`FILTER_NO_MATCH` → 查询被拒绝、`ERROR` 与超时 → 上游失败。`total_count` 仅在
`limit > 0` 时可得；`formula` 语法无文档，按 ADR-0032 留痕处理。

**元数据发现接受全量。** Lab 数据集列表与详情以服务态 token 返回工作空间全量指标与
维度，发现阶段暴露的是名称、口径与可组合性而非数据行；ADR-0060 "数据上下文按身份
过滤" 修正为"发现全量、执行按身份"，登记为有意放宽。映射规则：`isAgg` / `aggregator`
映射可加性，"是否比率"与"时间聚合方式"无源字段则记为缺失并按 `CONTEXT.md`
"可加性缺失时不得跨粒度派生"处理，不推断；`metric_code` 只用于鉴权，DQE 查询体用中文
名，本仓不假设二者映射规则；已验证查询首版为空（Lab 侧只有内部 ES 模板召回）；
`dataContextVersion` 为所用数据集 `updateDate` 的确定性摘要；无权限的可行动提示由
Tool 配置的静态文案承载，DQE 不回传申请信息。

**Skill 按 Relay 目录约定注册。** `SKILL.md` 增加 frontmatter：`name`、`description`、
`allowed-tools: [discover_data_context, build_page]`、`metadata.mcp_servers`；Relay 对
`allowed-tools` 强制执行。同名 Skill 只加载一个版本，多版本并存需不同 `name`。

**Chat 入口按 Relay 现状描述。** 前端经 WebSocket `/ws/{client_id}` 发 `user-message`，
以 `role_name` 唤起 Skill，业务参数放 `config.agent_context`；ADR-0060 中 `skillKey` 的
示例是概念示意，不是协议。事件流、结构化 tool 结果透出（`result_summary`）、按
`session_id + version_id` 的增量重放与 `interrupt` 取消均已确认存在；具体接线留 Chat
维度 grill。

## Consequences

- 取消是尽力而为：MCP 子进程不被 Relay 终止，取消后落库的修订仍是合法修订。
- `build_page` 内部须并发执行多取数单元的 DQE 调用，并以 30s 为响应验收线；Page Build
  Spec 的 inputSchema 会原样进入模型上下文，需在真实 LiteLLM/GLM 上验证嵌套深度可接受。
- 服务态身份阶段，取数核对与模型上下文中可能出现创作者无权限的数据行；ADR 与
  `SKILL.md` 都不得宣称创作期已按用户鉴权。
- ADR README "英文 `metric_code` 与 DQE 中文指标名的关系" 未决事项关闭。
- Authoring Bundle 新增接线切片：Skill frontmatter、`pyproject.toml` 与 sdist、
  `IdentityPort` 与服务态 Adapter、NL2SQL 服务的 Data Context 与 DQE Adapter、
  Relay 本地环境的真实对话验收；见实施计划。
- 测试环境地址、账号与 LiteLLM key 需线下获取，是接线切片的外部前置。

## Considered Options

- **让模型把用户 id 作为工具参数传入。** 模型可见、可伪造，只能算演示，不采用。
- **Tool 改为 streamable_http 常驻服务并用静态 headers 配身份。** 身份问题与 stdio env
  等价，传输改动不带来身份收益；保留为性能备选，不作为身份方案。
- **Tool 逐指标调权限中心裁剪元数据可见性。** 接口是否对外与调用次数均未知，且执行期
  已强制权限，不采用。
- **直连 Lab `reports/query-data`。** 会绕过 NL2SQL 服务注入的行级过滤，不采用。
- **要求 Relay 增加 Run 概念再接入。** Relay 无此计划，阻塞无期限，不采用。
- **保持脚本目录交付、要求 Relay 宿主预装依赖。** 与 Data Agent 现行 `uvx` 约定冲突，
  不采用。
