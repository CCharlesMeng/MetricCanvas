# 代表处指标卡业务页

行权规范情况入口：`/pages/region-authorization-norms`，[JSON](region-authorization-norms.json)。无必填 URL 参数；沿用页面默认统计期间，Region 空选时立即发起地区部、代表处和三张趋势图的查询，不必先选全球。全球不添加区域谓词，选择地区部或代表处后按对应字段筛选。Playground 使用合成组织候选，业务查询仍走 DQE 网关；可先运行 `pnpm dev:dqe` 和 `pnpm dev:playground`。打开 Region，展开长组织树并缩短窗口时，只滚动候选列表，搜索框固定。自动回归 `apps/playground/tests/authorization-norms.browser.ts` 拦截业务响应，覆盖首屏请求、区域切换、单层滚动及正常/空/失败状态，不代表真实 DQE 或线上部署验收。

- 行权效率：`/pages/rep-office-execution-efficiency`，[JSON](rep-office-execution-efficiency.json)。
- 业务结果指标：`/pages/rep-business-result`，[JSON](rep-business-result.json)。

启动：仓库根目录运行 `pnpm dev:dqe`，同时启动 Playground 与本地 DQE 仿真；无必填 URL 参数。文件来自用户提供的两份完整业务页面（业务结果由两段粘贴内容拼合），包含查询数据源及内联合成明细。查询尚未取得真实服务回执，本地查询指标可能显示缺失占位；内联行不代表真实业务结果。

沿用已确认的 Dashboard、Schema 6.80 与根级 `iocHeader`，当前 6.81 引擎按旧页兼容规则读取。页头保留标题、重点国代、客户分类、统计期间及原默认行为。原查询、筛选绑定、分页、表格与指标形态保持。业务结果原稿中两处不受协议支持的 `secondaryUnderline:false` 已在初次预览时移除，次级指标使用既有下划线。

观察方式：

1. 业务结果页在 1440px 下展示两张 `compactStack` 和两张 `primaryDetail`。四卡同排等高，短卡底部留白；字体、颜色、间距、同比和次级指标位置保持各自形态。
2. 390px 下逐卡堆叠，各卡按内容自然定高，不跨视觉行统一高度。
3. 行权效率页保留四张单面板 `compactStack`，同排复用相同拉伸规则。

完整数值合成演示位于 `/pages/metric-card-primary-detail` 的 `mixed-variants` 分区。前后几何/样式比对和数据边界见[验收记录](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/2026-11-03-metric-card-height/acceptance.md)。本批未验收真实 DQE、Relay 或线上部署。
