---
name: metriccanvas-page-builder
description: 根据业务问题创建或修改 MetricCanvas 临时页面态，通过受治理的数据能力发现、受控取数、DQE 执行和页面装配完成问数与探索。用于 Relay Page Artifact Adapter 已启用后的 MetricCanvas 问数、探索、页面构建和多轮调整。
allowed-tools:
  - discover_data_context
  - compose_page
metadata:
  max_tokens: 30000
  mcp_servers:
    - metriccanvas-authoring
---

# MetricCanvas 页面构建

生成通过页面校验的临时页面态。由确定性工具派生 DQE 查询、字段绑定、组件、布局和页面元数据。

## 状态

以当前业务问题和 `config.agent_context` 中的最新结构化会话检查点为输入。保留每个未触及取数单元的显式筛选、时间范围、组件钉住结果和目标绑定；每轮最多保留六个取数单元。

## 执行流程

1. 作出 `route_business_domains` 模型决策：优先采用用户明确指定的业务域；多轮调整沿用会话检查点中的业务域；否则从已提供的业务域中选择最多两个。选中的业务域全部受治理且已向用户展示后，本步完成。
2. 对每个尚未解析的指标、维度、筛选值或时间能力调用 `discover_data_context`。只使用工具返回的规范名和定义。每个业务概念均已解析或形成显式歧义后，本步完成。
3. 并列展示同分候选及其口径差异并等待用户选择。只使用用户选定的受治理候选继续执行，其余会话检查点状态保持不变。
4. 作出 `submit_data_request_units` 模型决策：首次创建取数单元集合，多轮调整则输出定向的 `add`、`modify`、`replace` 或 `remove` 变更。未提及字段保持结构不变；分别表达部分可回答与不可用概念，不把不可用指标混入可执行取数单元。
5. 展示取数核对。仅在存在歧义、临时指标、模型补出的时间或平台声明的成本阈值时等待确认。将确认结果作用于对应取数单元，其余单元保持不变。
6. 对每个被触及的取数单元分别作出 `submit_analysis_intent` 模型决策，只能使用 `comparison`、`trend`、`composition`、`ranking`、`detail` 或 `single_value`。未触及单元沿用原分析意图。
7. 使用完整 Page Build Spec 调用一次 `compose_page`。若封闭名称被拒绝，只能依据工具返回的候选修正一次；其他失败直接展示结构化问题并停止。
8. 仅当 Relay 返回 `status: page_composed`，且同时包含 `pageId`、`documentSha256`、`dataContextVersion` 和 `bundleVersion` 时接受完成，并告知用户临时页面态已就绪。

## 持久化与安全

- 仅通过 Relay Interface 使用 `compose_page`。Page Artifact Adapter 将完整页面构建产物保存为最新会话检查点，仅将 `modelSummary` 返回模型。
- 正式页面持久化只由平台响应用户显式发起的沉淀。禁止调用 Java 页面保存 Interface，也不得声称已经创建页面修订。
- 进入交互等待或收到取消后立即停止。迟到结果只能丢弃或标记为已取消，不能覆盖更新的会话检查点。
- 失败时展示结构化 `code`、`path`、`stage` 和 `message`。保留未解析的用户原文，只使用可追溯的受治理名称、执行结果和页面元数据。
