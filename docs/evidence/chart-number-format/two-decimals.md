# 柱线图默认两位小数

日期：2026-10-30。本记录是当前规则；同目录早期的原值回退记录保留为历史批次。

## 实施位置与范围

完整实现与分发位于 `/Users/moon/.codex/worktrees/chart-number-defaults/DataDashboard`，基于已刷新的 `origin/main` 提交 `e6a7cc8d59563848cb1a5909963e1896ca5ace0f`。隔离检出承接本聊天此前已确认的柱线图、饼图修复，并实现本轮默认两位小数。本记录对应交付前的实施验收；提交、远端与 CI 结果以本批 Git 交付记录为准。

原工作区 `/Users/moon/Documents/Code/公司项目/DataDashboard` 保留并行工作；图表实现和示例有同源预览改动，原工作区已有分发目录没有用混合真源重新生成。独立检出仅带入图表实现、相关说明、示例与测试，并从自身真源生成分发，不复制主工作区的计算协议、数据源或表格改动。当前 main 已有的 6.77 协议内容保留，包括百分点差值说明；产品 Schema 源文件及 Schema JSON 无改动。

Skill 安装目录内容已更新修订号 `1.14.2 → 1.14.3`；Schema 仍为隔离基线的 `6.77`，原有示例 `6.74` 可读，不为呈现默认值增加版本或属性。

## 当前规则

柱状图、折线图与混合图的数值展示统一为：绑定 `format` → 字段 `defaultFormat` → `number-2`；常量有自己的显式格式，没有格式时同样默认两位。共享 `formatChartNumber` 只用于这些图表的数值入口，不修改全局 `formatValue` 或其他组件默认值。

标签、悬浮提示和数值轴使用同一入口。相同格式的同轴系列沿用该格式，混合格式的同轴刻度使用不带单位的两位小数。旧节点、分段和合计标签也覆盖在内。横向柱、双轴与常量沿原结构处理。

| 声明 | 示例展示 |
|---|---|
| 不声明格式，原值 `12345.6789` | `12345.68` |
| 不声明格式，原值 `0` | `0.00` |
| 不声明格式，原值 `-2345.6789` | `-2345.68` |
| 字段 `defaultFormat: compact-wan-1` | `1.2万` |
| 绑定显式 `format: number`，覆盖上述字段格式 | `12345.6789` |

只改变显示，原始数值、图形比例、计算、排序、类别文字和图例名称保持。缺失不补零，悬浮提示沿用 `missingText` 或“—”。不自动追加百分号、分组或缩放单位。饼图外围占比继续使用 `percent-1`。

## 场景和已完成验证

正式页面：[chart-number-format.json](../../../pages/capabilities/chart/chart-number-format.json)。独立检出预览：`http://127.0.0.1:5184/pages/chart-number-format`。全部为内联合成数据，无需 URL 参数或 DQE。来源文件、浏览器和分发来自同一独立检出。

- 修复前新增/调整的默认两位数值测试、常量测试和混合格式轴测试共 3 项失败，捕获旧原值回退。
- 修改后组件测试：33 文件、340 项通过；覆盖默认数值、显式继承/覆盖、常量、缺失、横向柱及原始数据精度。后续相同代码未重复扩大测试。
- 根测试与 Playground 测试类型检查通过。
- Playwright：2 项通过，实际访问独立检出的 5184 页面，依次 hover 对照默认两位和显式原值，检查 `0.00` 与负数；同时保留饼图一位小数、零合计和窄屏文字边界回归。
- [宽屏截图](two-decimals-wide.png)、[窄屏截图](two-decimals-narrow.png)保留实际输出；合成页面不代表真实服务验收。
- 从独立检出生成 local-authoring 和 MC，更新产品参考、知识、校验器与摘要。生成命令使用已有仓库虚拟环境的 Python 依赖，产品来源由独立检出自己的源图决定。
- `pnpm mc:content:check` 完整通过：1317 项产品输出的一致性、MC 来源覆盖、33 项内容测试及诊断夹具。
- 完整复制 local-authoring 至仓外，目录内 0 符号链接；Skill 版本 1.14.3，独立校验器报告 Schema 6.77；复制页面校验通过，`fields.format` 可读取默认 `number-2` 规则。
- `pnpm authoring:check`：6 文件、227 项，首轮 225 项通过，2 项隔离导出兼容性检查的子进程超过 90 秒期限（退出状态为 null），总耗时 1653.21 秒；保持测试代码和期限不变，仅定向重跑这 2 项，均通过（109.63 秒）。[完整回归日志](two-decimals-authoring-check.log)、[定向重跑日志](two-decimals-authoring-retry.log)。中间一次重跑漏设虚拟环境，因系统 Python 缺少 fastmcp 退出；恢复与首轮相同的仓库虚拟环境后得到上述通过结果，不计为产品行为失败。
- 页面元数据对应：`PAGE-METADATA.md`、`docs/page-metadata/field-bindings-and-formats.md#chart-number-format`、柱图和折线图模块、页面目录 README。由产品参考生成安装内容，不手改派生知识。
- 未执行真实 DQE/Relay/DS 模型或远端 CI。当前任务不改变查询或服务协议。

## 复杂度

工具 `metriccanvas-ts-ast/1`、TypeScript 5.9.3，每函数独立 selfCC，包含嵌套回调。编码前职责：把柱/线数值的默认精度收敛在共享入口，字段解析仍负责显式与默认格式优先级；不改变分类文本、数据取值或全局格式器。基线取本聊天前一批已确认的图表实现，迁移后复测同一批函数；完整清单：[two-decimals-complexity.json](two-decimals-complexity.json)。

| 修改函数 | 前 | 后 |
|---|---:|---:|
| `formatChartNumber`（新增） | 无 | 2 |
| `formattedValueAxis` | 3 | 3 |
| 数值轴 formatter | 1 | 1 |
| `pointValueLabel` / 返回 formatter | 1 / 2 | 1 / 2 |
| `barOption` / 系列映射回调 | 17 / 26 | 17 / 26 |
| `valueLabelFormatter` / 返回回调 | 1 / 2 | 1 / 2 |
| `mixedOption` / tooltip 回调 | 3 / 1 | 3 / 1 |
| `lineOption` / 系列映射回调 | 7 / 9 | 7 / 9 |
| 折线旧标签 formatter / tooltip 回调 | 1 / 1 | 1 / 1 |

修改的一致性测试回调 4→4、继承覆盖回调 3→3、同轴格式测试 1→1、浏览器悬浮测试 2→2。新增常量回调 3、横向柱回调 1，新增函数均 ≤15。

未关闭项：柱图 `barOption` 17 与系列映射回调 26 属于此前已有超限，本次通过共享入口改默认值，均未增长；不在这次精度调整中重构预测、堆叠与标签布局，后续拆分入口仍为该组件的 options.ts。扫描另发现未修改的 `cartesianFrame` 16，数值保持，不纳入本轮重构。

## 交付基线复核

2026-10-30 提交前接入 `origin/main` 的 `6ae89456a9731faf245aec3a75ad60e355995bd9`。相对实施基线，仅新增三个 MC 诊断摘要和 partner-health 验收记录；图表源码、测试、产品说明、生成器及锁文件输入未改变。三个摘要冲突由 `pnpm mc:content:fixtures` 重建，结果与本批已验收产物逐字一致。复核 `pnpm exec tsc --noEmit -p tests/tsconfig.json`、`pnpm mc:content:check` 均通过（1317 产品文件一致性、来源覆盖、33 项内容测试与诊断夹具）；原组件、浏览器和分发兼容性结果适用于相同输入，无重复扩大回归。
