# 实际读取审计

本次没有读取原仓库、仓库页面 JSON、源码、Git 历史、其他 Skill、AGENTS、记忆、网页或网络来源。实际读取如下。

## 指令与业务输入

- `parent/agent-prompt.txt`：测试边界、输入与写入白名单、交付要求。
- `input/requirements.md`：F01-F10、U01-U04、数据口径与来源限制。
- `input/screenshots/design-content.png`：可见布局、标题、筛选、三卡、Tab、表格、地图与图例关系。
- `input/data/aggregates.csv`：2026-03 汇总及 2026-02 对照基础数值。
- `input/data/projects.csv`：TOP 与丢单代表性项目样例。
- 对 `input/` 执行文件清单读取，仅用于确认允许输入文件；没有打开 `design-full.png`。

## Skill 入口与流程知识

- `skill/metriccanvas-local-authoring/SKILL.md`：入口、知识路由、生成、快照、校验与交付要求。
- `references/page-metadata/README.md`：协议模块索引。
- `references/local-workflow.md`：设计源、数据、口径、交互、快照与验收分层。
- `references/overview-layouts.md`：地图主导概览布局。
- `references/component-recipes.md`：指标、分类、Tab、工具栏短写法。
- `references/knowledge.json`：schemaVersion 6.18 与知识版本。

## Skill 协议模块

- `references/page-metadata/page.md`：页面顶层与版本。
- `references/page-metadata/sections-and-layout.md`：分区、12 轨与组件布局。
- `references/page-metadata/data-sources.md`：inline 数据源。
- `references/page-metadata/fields.md`：字段类型、角色与 nullable。
- `references/page-metadata/field-bindings-and-formats.md`：字段绑定与格式。
- `references/page-metadata/params-and-text-values.md`：文本与参数结构。
- `references/page-metadata/filters.md`：dimension、boolean、timePoint 筛选。
- `references/page-metadata/queries-and-bindings.md`：确认无可信 query 时不补造绑定。
- `references/page-metadata/compute.md`：delta、ratio 与零分母规则。
- `references/page-metadata/actions-and-navigation.md`：导航绑定。
- `references/map-bindings.md`：世界底图地名与地图验收边界。
- `references/page-metadata/validation.md`：错误类型与修复规则。
- `references/map-regions.json`：世界底图合法国家名称。
- `references/page-metadata/components/metricCard.md`、`pieChart.md`、`categoryBreakdown.md`、`compositeCard.md`、`mapChart.md`、`table.md`、`tabContainer.md`、`text.md`：本页所用组件契约。

## Skill 完整示例

- `assets/layouts/overview-map-led.json`：通用地图主导完整布局。
- `references/page-metadata/examples/component-compositeCard-metricGrid.json`：组合卡结构。
- `references/page-metadata/examples/component-tabContainer.json`：Tab 内嵌表格。
- `references/page-metadata/examples/component-mapChart-regionalOverview.json`：地图图例、提示与层级声明。
- `references/page-metadata/examples/url-navigation-page.json`：行字段、参数与筛选导航。
- `references/page-metadata/examples/component-table.json`：表格基本结构。
- 对 `references/page-metadata/examples/` 执行 `rg`，仅定位包含 `delta`/`ratio` 的示例文件名和已使用格式枚举；没有打开额外示例。

## 执行脚本

- `skill/metriccanvas-local-authoring/scripts/snapshot-attempt.mjs`：由 Node 执行生成 attempt-1/2 快照与哈希检查。
- `skill/metriccanvas-local-authoring/scripts/validate-page.mjs`：由 Node 执行两轮校验。

