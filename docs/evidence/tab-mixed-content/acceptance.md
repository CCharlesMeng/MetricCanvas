# Tab 混合内容本地验收

日期：2026-10-22。checkout：`codex/tab-mixed-content`，基线 `952b3a27`。方案：[实施规则](../../plan/2026-10-22-tab-mixed-content.md)，决策：[ADR-0115](../../adr/0115-tab-mixed-content-and-activation.md)。未提交推送，未执行远端CI。

## 能力对应

| 能力 | 输入与操作 | 证据 |
|---|---|---|
| 15种内容与有界嵌套 | 全部普通内容/组合卡契约夹具；拒绝页头、嵌套Tab、铺底、低版本与畸形输入 | page/tests/tab-mixed-content；分发反例tab-content-* |
| 显式栅格/旧布局兼容 | Dashboard页宽1440/390；旧compact/analysisStack不声明grid、span6的表仍占满内容宽度 | [宽屏](overview-wide.png)、[窄屏](overview-narrow.png)、浏览器用例 |
| 按需读取与失效 | 概览1次请求，首次明细累计3次；切回不重查；公共条件变化只刷新活动源；迟到响应拒绝 | runtime/tests/tab-activation、浏览器请求计数 |
| 条件交集 | CN与OVERSEAS为空且不访问网关；时间/数值边界取交集；冲突初值不显示旧行 | data-execution/tests/filter-intersection、runtime/tests/tab-activation |
| URL与隔离 | 活动页签/生效筛选恢复，无关revision保留，history.length不增加，组件独立筛选保留 | 浏览器用例；Playground 5197手工切换与刷新 |
| 保活与AI | 首次进入生成，切走后隐藏文本继续完成，回来不再请求；表格搜索保留 | [保留总结](retained-summary.png) |
| Report导出 | 读取注册Report页面；展开全部Tab及30行表格；未访问总结为空且不触发生成 | [实际PNG](report.png) |
| local-authoring | 真源生成；仓外复制并验证结构、哈希、样例及反例 | local-authoring-skill与page-reference测试 |

## 实际检查

- `pnpm test packages/page/tests packages/engine/runtime/tests packages/engine/runtime-ui/tests packages/data-execution/tests`：145文件、1095项通过，包含畸形输入及组合卡诊断同步。
- `pnpm test tests/local-authoring-skill.test.ts tests/page-reference.test.ts`：最终26项通过，包含仓外安装。混合内容18项已计入上述核心回归。
- `tests/authoring-export-isolation.test.ts`：20项通过；原型和执行扩展未改生成隔离逻辑。最终重新执行生成漂移与Bundle检查。
- `MC_EMBED_EXAMPLE_PORT=4197 pnpm --filter @metriccanvas/embed exec playwright test tab-mixed-content.spec.ts table-toolbar.spec.ts --reporter=line`：11项通过。
- `pnpm check`、`pnpm validate`（31页）、`pnpm build:packages`、`pnpm --filter @metriccanvas/embed build`、`pnpm build:playground`：通过。
- `pnpm authoring:contracts:check`、`python3 metriccanvas-authoring/scripts/check_bundle.py`（2838次摘要检查）、`git diff --check`：通过。

浏览器消费页面实际JSON并保留相应交互配置；Report示例按产品限制移除Dashboard专属图表筛选并隐藏页面筛选，其余混合内容相同。更早的失败来自测试DOM选择器仍计算隐藏保活内容、对compact内边距的宽度断言以及夹具缺少必填search.fields，均已修正并重跑；analysisStack覆盖隐藏规则的问题修复为统一hidden优先级。

这些证据只证明当前本地运行时、仿真网关和合成SSE，不证明真实模型、DQE/Relay、内网、部署或生产数据验收。

## 白底指标卡边框补充

用户指定复用5173中带文字连接的指标卡外框；实际参考为 `ioc-header-main-delivery` 检出的 `MetricConnectionRow.svelte`：1px `rgba(0,0,0,0.1)` 实线、16px圆角。当前实现由已声明的白底Tab与card/panel分区下发样式，未增加页面字段或计算背景色的脚本。普通指标卡整体带框，紧凑型的指标面板分别带框；组合卡只保留外框，灰底画布和Report沿用既有外观。

- [宽屏](overview-wide.png)、[窄屏](overview-narrow.png) 已更新；Playground 5197实际页面已刷新检查。
- Embed与表格浏览器回归12项通过；覆盖白底Tab、card/panel分区、plain灰底、普通与紧凑型指标卡、组合卡内部无重复边框及原有切换/导出交互。
- `pnpm check`、`pnpm build:packages`、Embed构建、Playground生产构建通过。
- 页面元数据文档及local-authoring真源同步；26项Skill/页面参考验证（含仓外复制）、契约生成漂移检查、Bundle的2838次摘要检查通过。

## 高度与柱宽补充

原示例误用默认组合卡，280px最小高度经同一栅格行撑高普通指标卡；Dashboard与Report示例均改为已有的 `variant: "metricGrid"`，按内容定高。运行时默认组合卡及专用变体的高度约束未改变。原浏览器高度回归先失败（实测280px），修正后1440/390宽度下所有指标卡均低于180px。

当前检出的普通柱图未提供barWidth，由ECharts按类别数自动分配。普通横/纵柱图及组合图柱系列统一默认16px，报表预测专用变体保留40px；折线系列不设置柱宽。新增3项默认宽度回归先失败、修正后通过。图表与组合卡表面测试共29项、Embed浏览器12项通过。类型检查、Embed/Playground生产构建、页面校验、Skill/页面参考26项（含仓外安装）、契约生成漂移与Bundle摘要检查通过。上述宽窄屏截图已更新。
