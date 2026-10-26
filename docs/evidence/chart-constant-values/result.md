# 图表常量取值实施与验收

日期：2026-10-26。状态：本仓实现及集成主干后的本地验收完成，按授权执行 main 交付；远端 SHA 与 CI 结论见交付回执。

隔离工作树：`/Users/moon/.codex/worktrees/chart-constant-values/DataDashboard`。基线提交：`ea40f6641e41e974dd3f1801c4613c5a1a7fcd45`。保留主工作区及其他工作树的并行改动。

## 实现范围

页面 Schema 6.59 支持 `series[].field` / `series[].value` 互斥；饼图、地图与仪表使用 `valueField` / `value`。常量为有限数字或 null，地图 tooltip 和固定摘要还支持标量展示值。保留 FieldBinding 和 FieldReference 的真实字段语义，共享模块读取常量，不增加数据源、结果字段或查询计算。

覆盖柱图（含横向、堆叠、混合、双轴和预测）、折线/面积、饼/环、地图/散点/地域概览以及仪表/mini。地图附加提示与固定摘要同步支持常量。标签、tooltip、堆叠合计、格式、单位、币种和点击上下文使用共同取值；预测常量也受边界约束，错误指向系列声明。

`emptyBehavior` 为图表级 default/showConstants。原始来源状态同时投影到实时及导出入参，查询失败不冒充成功空结果。无横轴时不补造点，无地域行时不扩充底图覆盖。输入自足的仪表可省略 data。

工作台复用现有 Select/Input/Textarea，提供来源切换、常量编辑、格式/单位/币种、空态开关和新增常量系列。字段分组先经产品解析展开；切换来源清除另一分支，支持现有单步撤销。兼容类型切换保留常量；不能保留多系列或轴分配时原子拒绝。未扩展多步撤销或新增样式系统。

## 关键源码

- [协议来源形状](../../../packages/page/src/schema/chart-value.ts)、[常量校验](../../../packages/page/src/chart-value-validation.ts)、[版本](../../../packages/page/src/version.ts)。原始非有限值在 JSON 复制前拒绝，避免被转换成 null。
- [共享取值](../../../packages/engine/widgets/src/shared/component-value.ts)、[来源状态](../../../packages/engine/widgets/src/shared/component-data.ts)、[静态导出数据](../../../packages/engine/runtime-ui/src/export-render-state.ts)。
- [工作台取值编辑](../../../apps/platform/src/lib/workbench/chart-value-edit.ts)、[类型转换保留](../../../apps/platform/src/lib/workbench/chart-value-conversion.ts)。
- [ADR-0119](../../adr/0119-component-values-can-use-constants.md)、[设计与架构影响](design.md)、[正式协议](../../page-metadata/field-bindings-and-formats.md#chart-constant-values)。

## 验收结果

| 层次 | 执行内容 | 结果 |
|---|---|---|
| 产品回归 | page、widgets、runtime-ui、属性编辑、取值编辑、类型转换、文档编辑及参考生成 | **155 文件，1446 项通过**；日志（本地产物 `product-tests.log`） |
| local-authoring | `pnpm authoring:check`：工具、仓外复制安装、知识/独立校验器、参考和导出隔离 | **4 文件，74 项通过**；日志（本地产物 `local-authoring-tests.log`） |
| 类型与 Svelte | `pnpm check` 全工作区，以及独立 page/engine/platform、tests/tsconfig 与 tools/package-build 检查 | 通过；Svelte 无 error/warning；全工作区日志（本地产物 `workspace-check.log`） |
| 产品构建 | `pnpm build:packages` | page、ui、data-execution、engine、metric-canvas 构建通过；日志（本地产物 `build.log`） |
| 派生一致性 | authoring:contracts 后执行 authoring:contracts:check | 1162 product / 4 authoring / 1 interface 文件一致；日志（本地产物 `contracts.log`） |
| ADR | `pnpm adr:index:check` | 通过；日志（本地产物 `adr-index.log`） |
| 图表浏览器 | Chrome，1440/1024/390；真实绘图与轴 tooltip，纯常量及空态对照 | 通过；回执（本地产物 `browser-result.json`），无页面异常、无 DQE 请求 |
| 工作台浏览器 | 来源切换、输入、独立撤销来源/数值修改、新增常量系列 | 通过；回执（本地产物 `editor-result.json`），合成本地资产，无远端写入 |
| PDF | 用现有运行时导出夹具实际下载，导出视图核对四类图表冻结图片和仪表空态读数 | 通过；PDF（本地产物 `constant-charts.pdf`）。测试夹具采用 versionPolicy.current |

最终只声明上述范围通过。期间一次独立 Skill 漂移反例触及既有 30 秒子进程上限；精简重复空值夹具后定向重跑通过，随后整套 74 项通过，未放宽时限。开发中修复的失败不作为当前通过证据。

## 可复现入口

```sh
pnpm --filter playground dev --host 127.0.0.1 --port 5175
CHART_VALUES_BASE_URL=http://127.0.0.1:5175 node apps/playground/tests/chart-constant-values-browser.mjs /tmp/metriccanvas-chart-values
node apps/platform/tests/workbench/chart-value-browser.mjs /tmp/metriccanvas-chart-value-editor
```

浏览器访问 `/pages/chart-constant-values-page`。本地验收时 5175 的监听进程 cwd 已核实为该工作树 `apps/playground`。演示页面是唯一日常场景真源，导出器和测试读取同一页面；空值分支的最小夹具仅用于契约见证，不被选作默认创作组件示例。

折线截图（本地产物 `baseline-line.png`）、宽屏全图（本地产物 `charts-1440.png`）、1024（本地产物 `charts-1024.png`）、390（本地产物 `charts-390.png`）、工作台截图（本地产物 `editor.png`）。截图和 PDF 均由真实浏览器原生保存，未通过图像编辑生成。

## 复杂度口径与结果

工具为 `metriccanvas-ts-ast/1` / TypeScript 5.9.3，比较函数自身 selfCC；嵌套函数和回调单独测量，不以 subtreeCC 代替自身结果。覆盖 **42 个变更源码文件**；Svelte 测脚本块，另提取唯一新增可执行模板分支（Gauge onclick）独立实测，未将 Svelte 模板冒充完整 TypeScript。

实施前（本地产物 `complexity-before.json`）、实施后（本地产物 `complexity-after.json`）、扫描中全部超限项（本地产物 `complexity-over-limit.json`）。新增函数和回调均 ≤15，未新增超限函数。

| 职责 | 前 → 后 selfCC |
|---|---|
| 编辑入口 editProperty | 15 → 2；原有逻辑独立为 editExistingProperty，15；新增 editChartProperty 为4 |
| 类型切换 changeComponentType | 9 → 11；取值迁移 helper 为13 |
| 目录 requiredPropsOf | 6 → 9 |
| 图表校验 checkBarChart | 13 → 14；其他来源校验辅助函数及回调均≤15 |
| 共享取值 resolveComponentValue | 新增7，读取回调单独低于15 |
| RuntimeSurface.componentData | 12 → 12 |
| Gauge onclick 模板回调 | 2 → 4 |
| barOption / 系列映射回调 | 19 → 19 / 28 → 27 |
| mapOption | 27 → 27 |
| exportComponentData | 23 → 23 |
| parsePage | 31 → 31 |

后三组及 barOption 为本次触及的存量超限：职责已抽到共享取值/校验模块，原函数自身不增长；进一步拆解会扩大到既有布局、地域、视图或错误顺序，不在本批重写。它们继续归[复杂度治理计划](../../plan/2026-10-22-code-complexity.md)。扫描里其余超限函数属于同文件未修改行为，均保留原值；未声称全量清零。

## 外部与呈现边界

- 浏览器、PDF和工作台输入均为本地合成/inline 夹具；错误态及查询投影边界由协议和运行时测试覆盖。未执行真实 DQE/Relay/CloudIOC、真实 DS 模型或生产部署；远端 CI 由交付阶段按完整提交 SHA 核对。
- showConstants 不提供新的横轴、类别或地域定义。零类别折线保持空图，不能据此宣称“完全无上下文时也能画一条横线”。
- 常量格式不自动借用其他字段。显式混合轴须给常量声明单位，货币格式须匹配显式币种。
- 现有单步撤销经过浏览器验证，多步历史不是本批能力。类型切换只能保留目标形态可表达的取值，拒绝静默丢失。
- 交付只包含本批实现、文档及重新生成的派生文件；主工作区的并行修改保持原状。交付后按范围清理本任务工作树。

## 主干集成

交付基线更新至 `7834fbc5bc2534209e9358c2252bc9bd50e1eec8`；保留其字段投影、AI 总结及创作工具行为。Schema 从实施期的 6.52 顺延到 6.59，ADR 从 0117 改为 0119；重新生成当前契约、local-authoring 和内容包投影。旧页升级演示同步输出当前版本，93 项升级测试通过。

重新实测相同 42 个源码文件及 Gauge 模板回调，`metriccanvas-ts-ast/1` / TS 5.9.3 口径不变；相对集成基线，表中函数前后值不变，未新增超限，bar 系列回调仍为 28→27。集成测量保存在本地 `complexity-integration-before.json` / `complexity-integration-after.json`。

按当前 `.gitignore` 的验收产物政策，仓库仅交付本结论和决策依据。原始日志、测量 JSON、截图及 PDF 保存在 `/Users/moon/.codex/artifacts/chart-constant-values-2026-10-26/`；这些本地产物不作为远端消费者的必需输入。

公共 API 快照只增加 internal 子路径的 `ComponentValueSource` 和 `valueSourceBinding`；主入口保持不变。全量回归（排除单独执行的五个创作测试文件）覆盖 334 文件、2880 项；一次主干已有的保护异步时序测试在并发负载下失败，独立重跑该文件 55 项通过，未修改其实现或等待预算。

主干自带的 MC 诊断及 business-report / usage-report 页面由 `tools/scripts/mc-content-fixtures.py` 重新生成，保持 6.59 和实际 162 个知识主题一致；三个已有机器回执仍是该 CI 检查的必需输入，同步更新而不手工改写。MC 内容包 30 项 Python 测试通过。
