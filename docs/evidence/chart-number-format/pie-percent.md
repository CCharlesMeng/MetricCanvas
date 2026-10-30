> 历史批次记录：原执行目录 `/Users/moon/Documents/Code/公司项目/DataDashboard`。当前默认两位小数及隔离检出验收以 `two-decimals.md` 为准。

# 饼图外围百分比统一

日期：2026-10-30。承接柱线图数值格式修复，当前工作区实施，未提交或推送。

## 行为

外围标签使用通用 `percent-1`，按当前有效原始数值合计计算 0–100 刻度占比；与表格式图例共用 `pieValueTotal` 和 `piePercentage`，不消费 ECharts 预舍入的百分比，不分配凑齐 100% 的舍入差额。

- `1.2499 / 100` 对应 `1.2%`，不会因先舍入成 1.25 再舍入一位而显示 `1.3%`。
- 有效合计下真实零显示 `0.0%`；零合计为“—”；缺失不生成扇区。
- 三个相同值各显示 `33.3%`。原始数据、扇区数值、类别、排序及点击行身份保持。
- 外围占比固定采用 `percent-1`；数值字段格式负责原数值，图例列显式格式仍只作用于该列。紧凑环图、标签隐藏规则和高级标签覆盖路径保持。

入口：[页面 JSON](../../../pages/capabilities/chart/chart-number-format.json)，`http://127.0.0.1:5183/pages/chart-number-format` 下方四张内联合成饼图；无需 URL 参数或 DQE。

文档对应 `PAGE-METADATA.md`、`docs/page-metadata/components/pieChart.md#percentage-labels` 以及页面目录 README。新增语义章节从产品生成到 local-authoring 和 MC，而非手写分发副本。

## 已执行验证

- 修改前两条新增回归失败：外围标签仍为 `{b}: {d}%` 字符串模板，未调用通用格式化。
- 修改后组件测试：32 文件、336 项通过，包括外围舍入边界、零合计、表格式图例、常量、颜色及点击对应回归。
- Playwright：正式 JSON 场景共 12 张图，2 项通过。新增测试只在浏览器测试环境记录实际 Canvas `fillText`，在 1440px 和 390px 分别确认 `1.2%`、`98.8%`、`0.0%`、零合计“—”及 `33.3%`；同时核对实际 DOM 图例、实际字形变换后的左右边界均位于画布内，以及无横向页面溢出。无产品调试代码。
- [宽屏截图](pie-wide.png)与[窄屏截图](pie-narrow.png)已人工检查；零合计外围文字在普通饼图验证，表格式图例零合计语义同时由已有行为测试覆盖。零合计场景另修复了窄屏文字裁剪：标签靠画布边缘保留 8px 且不省略缺失文案；普通非零饼图布局保持。见[零合计窄屏局部](pie-zero-narrow.png)。
- 根测试与 Playground 测试类型检查、页面独立校验通过。
- `pnpm skills:check`：完整通过，repair/release 16 项与 local-authoring/参考/导出隔离 224 项，共 240 项。
- `pnpm mc:content:check` 完整通过：生成一致性、知识覆盖、33 项 MC 内容测试与诊断夹具检查；新增章节使知识主题数 202→203，已通过官方生成器同步。
- local-authoring 实体复制至仓外：无符号链接，复制后的完整页面校验通过，完整饼图参考包含新规则。
- 不依赖真实 DQE/Relay/DS 模型，未进行外部服务验收；未执行远端 CI。

## 复杂度

口径 `metriccanvas-ts-ast/1`、TypeScript 5.9.3，每函数独立 selfCC，闭包单独统计。基线与完整结果：[pie-complexity.json](pie-complexity.json)。

编码前职责：外围标签只组合已格式化类别和派生占比；有效合计与占比计算由饼图呈现模块统一负责；图例继续投影字段。

| 修改或新增函数 | 前 | 后 |
|---|---:|---:|
| `pieOption` | 9 | 10 |
| 外围 `formatter` | 无 | 1 |
| `projectColumn` | 3 | 3 |
| 自动占比列 `read` | 2 | 1 |
| `pieLegendData` | 3 | 3 |
| 图例原合计 reduce 回调 | 1 | 删除 |
| `pieValueTotal` | 无 | 1 |
| `pieValueTotal` reduce 回调 | 无 | 2 |
| `piePercentage` | 无 | 4 |

新增 describe 与两条回归回调均为 1；新增浏览器测试自身为 4，其初始化、fillText 包装、画布读取与断言回调为 1，边界轮询回调为 3。未改动的原浏览器测试自身仍为 2。全部修改/新增函数 ≤15，本次未关闭项 0。
