# Report 日期选择器对齐 OpenTiny OS 主题：新会话 handoff

2026-10-11。本文件交接下一会话的样式实现；本会话只勘察并冻结参考证据，没有修改日期选择器实现。

## 1. 用户要求与工作区

用户原话：**“日期选择框，我要求和 https://opentiny.design/tiny-vue/zh-CN/os-theme/components/date-picker 的样式保持一模一样，给我一份 handoff，我在新会话中实现这个样式调整。”**

目标是指定 URL 的 **OS 主题、中文、PC DatePicker**，包括输入外框及展开面板，不能只把边框改得相似，也不能以浏览器原生日历作为最终交付。默认以该页“基本用法 / 范围选择”的默认规格为基线，不自行改成 SaaS 主题、过滤器模式、内置 label 或不同 size。确需新增样式分支时先展示具体差异，不重复确认已批准的日期业务方案。

工作区：`/Users/moon/Documents/Code/公司项目/DataDashboard`。交接时分支 `main`，HEAD `e95086c9`。**报告日期筛选与 PDF 示例尚在当前工作区的未提交修改中，另有大量无关在途修改。** 新会话先检查实际状态、保留所有已有改动；单纯从 HEAD 新建 worktree 不会自动带上这些修改，不得误以为功能未实现而重做。用户本次没有要求提交、推送或部署。

## 2. 先读这些材料

1. 根目录 [AGENTS.md](../../../AGENTS.md) 和 [CONTEXT.md](../../../CONTEXT.md)：术语使用“集成应用”“页面参数”“筛选器”。
2. 官方[目标页面](https://opentiny.design/tiny-vue/zh-CN/os-theme/components/date-picker)，再打开下面冻结的截图及 computed style 记录。官方[源码仓库](https://github.com/opentiny/tiny-vue)仅作为组件结构、样式、图标与行为的补充来源；不要把当前 dev 分支自动当作截图对应版本。
3. [报告日期与导出接入说明](../../report-export.md)、[原功能验收](../../evidence/report-date-filters/acceptance.md)、[PDF 端到端补验](../../evidence/report-date-filters/pdf-e2e-acceptance.md)。
4. 如涉及领域边界，按 [ADR 索引](../../adr/README.md) → 对应主题 → [ADR-0097](../../adr/0097-report-date-filter-and-instance-export-view.md) 阅读；这次主要是渲染控件调整。
5. 当前两种时间控件、FilterBar、ReportHeaderView，以及 RuntimeSurface 的变更写入函数。

这是对外部设计源做视觉还原，按仓库约定走 `sdd-dev-frontend`。先定位现有 Story 与 app baseline，冻结这次 DatePicker 的新增验收基线，按触发器选择验证组合，不把上一轮功能检视指纹当作本轮新控件已通过。仓内 `.agents/skills/sdd-dev-frontend` 当前未接入；本机上游入口是 `/Users/moon/Documents/Code/moon-skills/skills/sdd-dev-frontend/SKILL.md`，到新会话时再验证可用位置，不就地修改上游 skill。

## 3. 已冻结的官方参考

采集于 2026-10-11，视口 **1440 × 1000**，主题由上述 `os-theme` URL 指定。没有可靠确认该站部署的组件包语义版本；采集日期、URL、加载的 stylesheet URL 和本地文件摘要用于保留此刻的参考，不能拿导航里其他组件的版本号冒充 DatePicker 版本。

参考目录：`docs/evidence/report-date-picker-tiny-os-2026-10-11/`。

| 参考 | 证据 |
| --- | --- |
| 默认控件外观与实际样式 | [截图](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-picker-tiny-os-2026-10-11/reference-default.png)、[样式及资源 URL](../../evidence/report-date-picker-tiny-os-2026-10-11/default-style-facts.json) |
| 单日期展开 | [截图](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-picker-tiny-os-2026-10-11/reference-date-open.png)、[尺寸与样式](../../evidence/report-date-picker-tiny-os-2026-10-11/reference-date-open.json) |
| 单月份展开 | [截图](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-picker-tiny-os-2026-10-11/reference-month-open.png)、[尺寸与样式](../../evidence/report-date-picker-tiny-os-2026-10-11/reference-month-open.json) |
| 日期范围展开 | [截图](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-picker-tiny-os-2026-10-11/reference-date-range-open.png)、[尺寸与样式](../../evidence/report-date-picker-tiny-os-2026-10-11/reference-date-range-open.json) |
| 月份范围展开 | [截图](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-picker-tiny-os-2026-10-11/reference-month-range-open.png)、[尺寸与样式](../../evidence/report-date-picker-tiny-os-2026-10-11/reference-month-range-open.json) |
| 月份范围只选起点 / 完成 2026-01 至 2026-06 | [起点](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-picker-tiny-os-2026-10-11/reference-month-range-start.png)、[完成后重新展开](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-picker-tiny-os-2026-10-11/reference-month-range-selected.png)、[选中样式](../../evidence/report-date-picker-tiny-os-2026-10-11/selection-style-facts.json) |

已观察：

- 输入外框高 **32px**，圆角 **6px**，默认边框 `1px solid #c2c2c2`，文字 `#191919`、14px；已聚焦的月份范围边框为 `#191919`。
- 单值框内边距 `0 40px 0 12px`；范围外框 `3px 10px`，内含两个无独立边框的文本输入，以 `-` 分隔，右侧日历图标。现有“两个原生日期框 + 至”结构必须调整。
- 此页示例输入总宽 **360px**；这是该示例在采集环境中的几何值，尚未核实它是组件默认宽度还是 demo 显式设置，实施前查示例源码，不把它误写成所有容器不可变化的最小宽度。
- 单月份面板 **360 × 245px**，12 个月为 4 列 × 3 行；单日期面板 **360 × 307px**，星期栏从周日开始，显示相邻月份日期。
- 日期范围面板 **558 × 307px**，两个相邻月份日历；月份范围面板 **558 × 245px**，两个相邻年份的月份网格。
- 面板白底、6px 圆角，阴影 `0 4px 16px rgba(0,0,0,.08)`。箭头、图标、间距及选中区间以截图和样式文件为准，不用 Unicode 箭头或系统日历按钮替代。

**尚未完整冻结**：单值选中、日期范围选中、hover、清除图标出现条件、disabled/readOnly、非法文本、键盘导航、年份切换面板，以及窄屏状态。新会话应先补采这些必要状态。系统“今天”会移动，对比时固定日历视图年月、选择值、浏览器及字体环境；不要拿不同日期、主题或 size 的截图直接作结论。

## 4. 当前实现与修改落点

当前是 Svelte 5 渲染引擎，`@metriccanvas/engine` 没有 Vue 运行时依赖。两个正式日期控件均使用原生 `input[type=month/date]`，不是 TinyVue 组件；原生弹出面板由浏览器绘制，CSS 无法控制其完整视觉。

| 文件 | 当前责任 / 调整注意点 |
| --- | --- |
| [TimePointFilter.svelte](../../../packages/engine/runtime-ui/src/filters/TimePointFilter.svelte) | 单个月份/日期；`value: string \| null`、`onchange`、`required`。接入可控的统一选择器外观与面板。 |
| [TimeRangeFilter.svelte](../../../packages/engine/runtime-ui/src/filters/TimeRangeFilter.svelte) | 范围草稿、完整性及合法性校验；只提交完整合法范围。改整体外框与双面板，不改变已应用值的提交边界。还有既有 `datetime` 精度分支，必须保留兼容。 |
| [FilterBar.svelte](../../../packages/engine/runtime-ui/src/filters/FilterBar.svelte) | 唯一日期控件分发入口，当前 readOnly 分支另有原生日期 input 和占位按钮；实施时一起审查，防止只读态保留旧样式。 |
| [ReportHeaderView.svelte](../../../packages/engine/runtime-ui/src/ReportHeaderView.svelte) | 封面上方 C 工具带、期间文字、右对齐与换行。保留位置，仅必要时调整日期控件的容纳方式。 |
| [RuntimeSurface.svelte](../../../packages/engine/runtime-ui/src/RuntimeSurface.svelte) | `writeTimeRange` / `writeTimePoint` 更新筛选状态；多个位置复用 FilterBar；看板分支会下发 34px 等 `--mc-filter-*` 值。新日期控件不能被这些共享 token 意外覆盖成非 Tiny 规格，也不能为日期控件而改坏维度/搜索等其它筛选器。 |
| [report-date-header.ts](../../../packages/engine/runtime-ui/src/report-date-header.ts) | 从已应用筛选值生成期间文字。视觉修改不要复制这套语义逻辑。 |
| [HTML 挂载入口](../../../packages/embed/src/index.ts) | 挂载到 open ShadowRoot。面板样式、主题继承、定位、外部点击与销毁必须在该入口也成立。 |
| [报告示例](../../../apps/playground/src/lib/ReportDateExample.svelte) | 四形态、初创/提取/确认、分组、完整导出及真实 PDF 示例；用于验收，不能只给示例写一套专属控件冒充正式引擎改好。 |

建议在引擎 `runtime-ui/src/filters/` 内形成共享的可控日期选择器，再由 TimePointFilter / TimeRangeFilter 做值适配。优先保持 Svelte 实现，复用适合本仓的无框架日期逻辑、样式和图标；若采用上游资源，核实版本、许可证及必要归属说明。**用户批准的是样式目标，没有指定引入 Vue 或整套 TinyVue。** 如确需引入另一框架/桥接实例，先列明包体、生命周期、ShadowRoot 与样式隔离的具体影响，再完成架构决策。

面板挂载到哪一层由实现确定：需证明不被工具带/分区的 overflow 裁掉，靠近右边缘或底边时位置正确，多个页面实例互不影响。不要默认 portal 到 `document.body` 就能继承 ShadowRoot 内的样式；新增监听、挂载节点、定位观察器应在关闭/更新/销毁时清理。

## 5. 必须保留的已批准行为

| 形态 | 当前声明 | 值协议 |
| --- | --- | --- |
| 单个月份 | `timePoint` + `granularity: month` | `YYYY-MM` 或 `null` |
| 单个日期 | `timePoint` + `granularity: date` | `YYYY-MM-DD` 或 `null` |
| 月份范围 | `timeRange` + `precision: month` | `{from: YYYY-MM, to: YYYY-MM}` 或 `null` |
| 日期范围 | `timeRange` + `precision: date` | `{from: YYYY-MM-DD, to: YYYY-MM-DD}` 或 `null` |

- 页面创作时确定形态，阅读者不切换单选/范围或月/日形态；无需新增 Page Schema 字段或升级版本来表示纯视觉变化。
- 初次创作没有参数和日期框；提取候选阶段仍没有日期框；确认才原子生成页面参数、筛选器、查询绑定与 `reportHeader.filterIds`。不重写该流程。
- 页面参数只初始化筛选器；合法选择更新当前筛选值，联动已有查询和报告期间。不能另存一套日期选择状态绕过运行时。
- 范围只选起点、倒置区间、非法日期等保持旧的已应用值及期间；只有完整合法的选择才调用变更回调。可选项清除为 `null`，required 不允许清除已应用值。面板暂存状态与应用状态分开。
- 展示格式可以按 Tiny，但写回保持上述字符串协议，避免 `Date.toISOString()` 的时区偏移改变业务日期；月底、闰年、跨年回归要覆盖。
- C 工具带仍在封面上方，宽屏右对齐、窄屏换行；普通筛选栏与 HTML 嵌入入口复用同一正式组件。不要给报告单独复制一套视觉实现。
- 保留既有 `datetime` 路径及旧页面读取兼容；本轮不扩展周/季度/多日期/时间选择等新的页面业务能力。
- `withExportView` 继续完整展开内容，隐藏日期控件及其弹出面板、保留捕获期间。打开日期面板时导出也不能把面板画入 PDF；取消及销毁应清理所有临时状态。

## 6. 实施与验收顺序

1. 核对当前工作区，读取本 handoff 和参考图；按 SDD 补采缺失状态，冻结主题/尺寸/日期/字体与对比环境。窄屏先观察官方表现，再决定碰撞处理；不能悄悄改为另一主题或不同单元格规格来塞进容器。
2. 确定正式控件及面板实现，保持现有值/提交契约。涉及新增依赖或跨框架桥接时给出具体设计，不把推荐方案当作用户已批准的依赖选型。
3. 完成共享日期控件及四种形态接线，处理 required/clear/readOnly、键盘、外部点击、跨年翻页和 ShadowRoot；先在独立控件场景与官方同状态比较，再在报告布局验证。
4. 补足与新增状态模型相关的有意义测试，运行受影响类型检查和既有相关回归，不用静态测试替代截图验收。
5. 跑 Svelte/HTML 的真实浏览器验证以及本地实际 PDF 下载，记录文件/图像证据；按本轮 SDD 验证组合完成检视。明确没有验证的真实服务/生产编码器范围。

视觉验收：四种形态至少覆盖空值/有值、默认/hover/focus/disabled（适用时）、面板展开、导航箭头、月份/年份切换、选中及区间连续底色、清除。对齐输入高度、圆角、内边距、字号/字重/行高、图标、边框、面板尺寸、阴影、表头和网格。使用相同主题、值、视图年月和浏览器做截图叠加或差分；**不自行把“一模一样”放宽为“风格相似”**，仍存在的差异必须逐项展示。

布局验收：1440 桌面、390/320 窄屏；报告右上角、普通筛选栏和 HTML ShadowRoot；下拉靠近视口右侧/底部及滚动时无错误遮挡、封面覆盖或页面横向溢出。官方桌面双面板宽 558px 与窄屏的冲突必须显式处理和验收，不通过整体缩放掩盖。

行为验收：月/日单选和范围、跨年、月底/闰年、required/清除、非法/半范围不提交、选择后查询及期间同步；初创 → 提取 → 确认流程不退化；readOnly 不建立可变状态；两实例同时打开/销毁无串扰；有弹出面板时导出 PDF 仍不包含日期 UI。

## 7. 可运行入口和检查命令

当前报告入口：[本地示例](http://127.0.0.1:5186/preview?prototype=report-date&variant=C)。5186 可能在新会话失效；从仓根运行：

```bash
pnpm --filter playground dev --port 5186
```

人工创作验收入口（独立启动，正式属性面板和引擎）：

```bash
pnpm exec vite dev --config apps/platform/tests/browser/report-date.vite.config.ts
# http://127.0.0.1:5187/tests/browser/report-date-editor.html
```

HTML 示例：`packages/embed/examples/report-export.html`。构建后用仓内示例服务；端口按服务实际输出，避免覆盖其它已运行服务：

```bash
pnpm --filter @metriccanvas/embed build
pnpm --filter @metriccanvas/embed preview:examples
```

受影响检查（按改动实际范围选择）：

```bash
pnpm --filter @metriccanvas/engine check
pnpm --filter playground check
pnpm --filter @metriccanvas/embed check
pnpm exec vitest run packages/engine/runtime-ui/tests/filter-bar.test.ts packages/page/tests/report-date-filters.test.ts packages/page/tests/time-param-bindings.test.ts packages/engine/runtime/tests/time-param-initialization.test.ts packages/engine/runtime/tests/report-export.test.ts
git diff --check
```

若修改页面搭建接线，再检查 platform 与 `apps/platform/tests/workbench/report-date-edit.test.ts`。仅样式/控件修改不要无故生成全部契约；确实修改源契约时才按源驱动流程重新生成并检查，不能手改 lock 或生成产物。

本地“导出 PDF”使用开发模式的 Chromium 编码器和 Poppler：需已安装 Chromium，支持 `MC_PDF_CHROMIUM`；`pdftoppm` 可经 PATH 或 `MC_PDF_RENDERER` 提供。上一轮本地文件为 8 页 A4、三张表共 159 行，所有分组/Tabs 和静态图表完整、无日期框。它是既有回归基线，新控件实现后必须重新导出，不能直接复用旧 PDF 作为新验证。

## 8. 已有证据与本轮交接边界

原轮次记录：982 项 TS、522 项创作 Python/MCP 回归，类型/构建/契约/Bundle 和本地浏览器验收通过；随后补齐了真实本地 PDF 编码、下载及实际文件第一页预览。**这些证明现有业务功能，不证明 Tiny 样式已实现，也不是下一会话改动后的新验证。** 实际日志和边界见阅读顺序中的验收文档。本会话没有实施 Tiny 样式，也没有重新运行这些功能测试；只读取当前源代码、查看官方实际 DOM，并保存参考截图和样式事实。

收口返回：列出实现文件及选型；四形态同状态官方/本地对比图；视觉差分及剩余差异；行为/类型/浏览器/HTML/PDF 各层结果；哪些真实服务未验证；如涉及 Git 交付，另列提交/远程/CI/部署结论，不能把本地通过混为发布完成。

## 9. 可直接粘贴到新会话

> 请在 `/Users/moon/Documents/Code/公司项目/DataDashboard` 当前工作区接续，先完整读取 `docs/archive/report-date-ui-2026-10/report-date-picker-tiny-os-handoff.md` 并打开其中的官方参考截图。将正式引擎的四种日期选择器（月份单选、日期单选、月份范围、日期范围）及展开面板，按指定 OpenTiny TinyVue OS 主题日期选择器做到一模一样。按仓库要求走 SDD，先补齐并冻结必要状态基线；保留已实现的 C 布局、参数提取确认、查询与期间联动、required/草稿提交规则和完整 PDF 导出。保留工作区其它修改。完成正式 Svelte 及 HTML ShadowRoot 接线、截图对比、行为回归和实际本地 PDF 导出验收；不要只改示例或只验证输入框边框。本次先完成实现和验收，未要求提交、推送或部署。
