---
name: metriccanvas-platform-create
description: 在 Platform 创作入口首次创建页面，或按用户明确要求另建页面。根据业务需求选择 report/dashboard，调用内容 MCP 形成合法页面产物。
allowed-tools:
  - discover_data_context
  - compose_page
  - create_content_page
metadata:
  mcp_servers:
    - metriccanvas-content
---

# Platform 创建页面

1. 读取[公共编排约定](references/platform-authoring.md)，确认入口为 Platform 创建且部署已注册本 Skill 与内容 MCP。已有页面新增组件或修改形态，交由 `metriccanvas-platform-edit` 路由；完成条件是明确新建意图及由可信程序分配的 page_id。
2. 用户明确形态时采用该选择；阅读分析报告选 [report 基线](references/layouts/report.md)，监控概览选 [dashboard 基线](references/layouts/dashboard.md)。场景模糊时询问用途，得到答案后再装配；先说明采用的形态。始终向创建工具显式传 layout，工具的默认值不替代意图判断。
3. 数据页面先 discover_data_context 核对受治理能力，按公共约定的 Page Build Spec 调用 compose_page。静态正文或已有可信数据源上的内容组合用 create_content_page；需要数据时使用可信 source_token。完成条件是必需字段、行证据和配置齐备；缺失项按工具失败原因澄清或交部署方处理。
4. 只将受控规格或 recipe 交给工具。查看[组件参考](references/page-metadata/components/README.md)选择类型，遇字段/联合分支疑问查[协议索引](references/page-metadata/README.md)；Schema 表达面不等于工具操作面。混合数据图表与内容需程序将前次产物登记为可信基线，再路由修改 Skill 追加，模型不搬运页面或伪造 token。
5. 根据 modelSummary 报告已生成、部分成功或失败；有合法产物时由可信程序移交后续生命周期流程。完成条件是产物 hash/引用交接成立、未完成项明确；内容工具成功仅表示产物生成，不表示页面修订已保存或已发布。
