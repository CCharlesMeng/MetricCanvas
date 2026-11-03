# 代表处指标卡业务页

- 行权效率：`/pages/rep-office-execution-efficiency`，[JSON](rep-office-execution-efficiency.json)。
- 业务结果指标：`/pages/rep-business-result`，[JSON](rep-business-result.json)。

启动：仓库根目录运行 `pnpm dev:dqe`，同时启动 Playground 与本地 DQE 仿真；无必填 URL 参数。文件来自用户提供的两份完整业务页面（业务结果由两段粘贴内容拼合），包含查询数据源及内联合成明细。查询尚未取得真实服务回执，本地查询指标可能显示缺失占位；内联行不代表真实业务结果。

沿用已确认的 Dashboard、Schema 6.80 与根级 `iocHeader`，当前 6.81 引擎按旧页兼容规则读取。页头保留标题、重点国代、客户分类、统计期间及原默认行为。原查询、筛选绑定、分页、表格与指标形态保持。业务结果原稿中两处不受协议支持的 `secondaryUnderline:false` 已在初次预览时移除，次级指标使用既有下划线。

观察方式：

1. 业务结果页在 1440px 下展示两张 `compactStack` 和两张 `primaryDetail`。四卡同排等高，短卡底部留白；字体、颜色、间距、同比和次级指标位置保持各自形态。
2. 390px 下逐卡堆叠，各卡按内容自然定高，不跨视觉行统一高度。
3. 行权效率页保留四张单面板 `compactStack`，同排复用相同拉伸规则。

完整数值合成演示位于 `/pages/metric-card-primary-detail` 的 `mixed-variants` 分区。前后几何/样式比对和数据边界见[验收记录](../../../../../docs/evidence/2026-11-03-metric-card-height/acceptance.md)。本批未验收真实 DQE、Relay 或线上部署。
