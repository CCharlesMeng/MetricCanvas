> 历史批次记录：原执行目录 `/Users/moon/Documents/Code/公司项目/DataDashboard`。当前默认两位小数及隔离检出验收以 `two-decimals.md` 为准。

# 柱线图数值格式修复验收

日期：2026-10-30。当前工作区实施，未提交或推送。只修改本批涉及的图表实现、回归、页面、文档、知识映射与生成产物；工作区既有 compute 等并行改动保留，生成命令基于当前完整产品真源运行。

## 行为与入口

[页面 JSON](../../../pages/capabilities/chart/chart-number-format.json)，浏览器入口 `/pages/chart-number-format`。内联合成数据，无需 DQE；本次开发预览为 `http://127.0.0.1:5183/pages/chart-number-format`。

原值 `12345.6789` 在柱、线、预测柱、旧节点/分段/合计标签及混合图中统一格式化。无格式时不额外舍入、分组或转万；字段默认 `compact-wan-1` 显示 `1.2万`，绑定 `number-2` 覆盖后显示 `12345.68`。真实零保留，负值保留符号，缺失节点不补零，提示文案沿绑定解析。图例名称中的数字不改写。同轴格式不一致时轴显示原值，系列保留各自格式。

旧隐式万单位已移除；依赖该行为的外部页面需显式声明 `compact-wan-0`。已配置格式的页面保持行为。本次不新增 Schema 字段或版本；不修改查询、原始数值或排序。

## 验证

- 修复前 `pnpm exec vitest run packages/engine/widgets/tests/chart-format-consistency.test.ts`：3 项中 2 项失败，捕获未配置格式的 tooltip 回调缺席及 `missingText` 未生效；格式继承/覆盖对照通过。
- 修复后 `pnpm exec vitest run packages/engine/widgets/tests`：32 文件、334 项通过，包含原始数据保持、常量、双轴及显式格式回归。
- `pnpm exec tsc --noEmit -p tests/tsconfig.json` 与 Playground `tsconfig.test.json` 类型检查通过。
- `pnpm --filter playground exec playwright test tests/chart-number-format.browser.ts`：通过。测试读取正式 JSON 的入口及组件数量，依次实际 hover 8 张图，检查原值/万/两位小数提示，另检查零与负值；无页面异常，390px 无横向页面溢出。
- 浏览器截图人工核对实际数值标签和轴刻度：[宽屏](wide.png)、[窄屏](narrow.png)、[实际悬浮框](tooltip.png)。旧合计标签保留既有位置策略，本次不改变布局算法。
- `pnpm authoring:contracts`：通过；通过产品真源同步协议参考、MC 知识、local-authoring 知识与校验器。维护命令使用仓库 `metriccanvas-authoring/tool/.venv/bin` 的 Python 依赖。
- `pnpm skills:check`：完整通过，repair/release 16 项及 local-authoring/参考/导出隔离 224 项，共 240 项；隔离批次耗时 1111.40 秒。
- `pnpm mc:content:check`：完整通过（生成一致性、覆盖、33 项 MC 内容测试及诊断夹具）；新增知识章节使主题数 199→202，已用官方生成器更新诊断页计数和证据摘要，再同步来源清单。
- 独立复制 local-authoring 实体至仓外目录：0 符号链接，版本 `6.74`；复制本场景到仓外后完整校验通过，`fields.format` 知识包含新规则。
- 静态页面校验通过。无真实 DQE/Relay/DS 模型调用，本次内联呈现不依赖这些服务；未执行远端 CI。

对应产品说明：`PAGE-METADATA.md`、`docs/page-metadata/field-bindings-and-formats.md#chart-number-format`、柱图/折线图组件模块。知识映射 `fields.format` 显式包含本语义章节，组件模块收录数值格式入口。

## 复杂度

工具 `metriccanvas-ts-ast/1`，TypeScript `5.9.3`，采用每函数独立 `selfCC`，包括嵌套回调；完整清单见 [complexity.json](complexity.json)。编码前确定职责：系列 tooltip 统一消费已解析格式；轴集中处理格式共识；旧柱图标签移除私有单位回退。

| 修改函数/回调 | 前 | 后 |
|---|---:|---:|
| `barOption` | 19 | 17 |
| 柱图系列映射回调 | 27 | 26 |
| `valueLabelFormatter` 工厂 | 1 | 1 |
| `valueLabelFormatter` 返回回调 | 3 | 2 |
| `reportValueAxis` | 3 | 删除 |
| `lineOption` | 7 | 7 |
| 折线系列映射回调 | 10 | 9 |
| 柱、线 tooltip 回调（各自） | 1 | 1 |
| `formattedValueAxis` | 5 | 3 |
| 轴格式共识回调及 formatter（各自） | 1 | 1 |
| 修改的同轴混合格式测试回调 | 1 | 1 |

新增一致性测试：`options` 1；describe 回调 1；三条 it 回调分别 4、3、4。新增浏览器测试回调 2；异常处理、poll 及 evaluate 回调各 1。无新增产品辅助函数或超限函数。

未关闭存量：`barOption` 17 和系列映射回调 26 仍超过 15，均已下降。它们同时负责堆叠、预测样式和标签布局；本次格式修复不扩大到这些职责的结构重构，后续入口为 `packages/engine/widgets/src/components/bar-chart/options.ts`，以现有柱图/排序/格式回归约束拆分。
