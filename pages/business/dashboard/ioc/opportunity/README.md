# pages/business/dashboard/ioc/opportunity

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 主题分析与 Tab 多表｜IOC

入口：`/pages/ioc-opportunity-analysis`；[页面 JSON](ioc-opportunity-analysis.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

查看按组织组织的主题指标与多张表格，参考分析页的信息层次。

合成演示

初始行可预览；筛选未接查询

1. 切换组织 Tab，查看各主题指标与明细表的组合。
2. 对照筛选声明与查询配置，确认本页未演示筛选下推。

首版筛选尚未接入查询，不应据此判断筛选取数能力；数据为合成演示。

关键声明：`filters`, `sections[].components[].type`。

关联：[ioc-project-overview](../project/ioc-project-overview.json)。

关联：[dashboard-period-filter](../../../../capabilities/filters/dashboard-period-filter.json)。

## 筛选清单与详情导航｜IOC

入口：`/pages/ioc-opportunity-list`；[页面 JSON](ioc-opportunity-list.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

查看全宽机会点明细和条件筛选，点击项目进入详情页并携带页面参数。

合成演示

初始行可预览；动态交互需仿真

1. 查看顶部筛选与更多筛选中的条件。
2. 点击项目入口进入详情，再返回清单，核对上下文。
3. 表格导出读取宿主 `displayInputs` 的 `permissions.canExport`。只有 `{status:"ready",value:true}` 显示 Excel 导出按钮。宿主通过订阅推送新快照，可在同一页面切换权限。
4. 本地对照使用 Embed 示例。运行 `pnpm --filter @metriccanvas/embed build` 和 `pnpm --filter @metriccanvas/embed preview:examples`，打开 [机会点导出权限对照](http://127.0.0.1:4175/examples/navigation.html?page=ioc-opportunity-list&region.level=geo&region=全球&mtime=2026-04)。从「等待权限」切到「允许导出」后可下载当前月份的 10 条合成机会点；切到「禁止导出」后按钮消失。

数据是带合成内嵌初始行的查询源；真实查询分页、权限和业务数据需独立验收。

关键声明：`filters`, `sections[].components[].props.columns`, `sections[].components[].props.actions`。

关联：[ioc-project-detail](../project/ioc-project-detail.json)。

关联：[demo](../../../../capabilities/layout/demo.json)。
