# components.md — 拼界面时有哪些现成构件可用?

**先读这条,否则下面的表会被误读:本仓「拼界面」不发生在源码里。** 页面由 `pages/*.json` 的组件声明拼成,源码侧只有一个分发点(`COMP-3`)。所以分层判据按 `structure.md` 记的第二种消费单元——页面文档——来数;按源码引用数会把全部 17 个组件类型判成「只被一处引用」,得出「本仓没有通用构件」这个错误结论。

## 通用构件

<!-- 覆盖:packages/widgets/src/、packages/runtime-ui/src/(含 filters/、ai-summary/)、pages/*.json 共 10 份页面文档(2026-08-24)。apps/platform/src/lib/ 的创作工作台构件未纳入首扫 -->

| ID | 指路 | 是什么、何时用 | 被引用 |
| --- | --- | --- | --- |
| `COMP-1` | `@metriccanvas/widgets` 的导出面(`packages/widgets/src/index.ts`) | 全部 16 个纯渲染构件的唯一出口。**要知道有哪些构件、各自何时选,查 `COMP-2`,不要读这个文件的导出列表来猜** ——出口是按真实消费面收敛的,内核(字段解析、格式化、ECharts 宿主)刻意不导出 | `packages/runtime-ui` 内 5 个文件 |
| `COMP-2` | `componentCatalog` / `componentCatalogEntry`(`packages/page/src/component-catalog.ts`),条目数据在 `schema/components/<type>.ts` 的 `registry.add(...)` | **组件能力目录:选构件时唯一该查的地方。** 每个类型带 label、别名、用途、何时选、需要什么数据形状、必填 props、是否必须有标题、默认栅格跨度。写页面文档或让 Agent 组页面前查它;它不是运行时注册表,不能据此发明新类型 | 17 个组件类型;`packages/mcp` 的组页面工具 |
| `COMP-3` | `ComponentRenderer.svelte`(`packages/runtime-ui/src/`) | 组件类型 → 构件的**唯一**分发点,含 `tabContainer` 的自递归。新增组件类型只改这一个文件加一个构件实现 | `RuntimeView.svelte`、自身递归 |
| `COMP-4` | `WidgetHost.svelte`(`packages/runtime-ui/src/`) | 加载态(骨架)、错误态(按错误分类选标题)、空态(投影为空行让构件保留标题与容器)的**统一呈现宿主**。构件自己不写这三态 | `COMP-3`;`data.md` 的 `PATTERN-DATA-1` |
| `COMP-5` | `RuntimeSection.svelte`(`packages/runtime-ui/src/`) | 内容分区容器:持有 12 列 Grid(统一运行时不变量)、组件单元格、`connectPrevious` 与行对齐安装点。外观只由 `section.container` 决定,**不要让它去读子组件类型或 `props.variant` 反推布局** | `RuntimeView.svelte`;10 份页面文档的全部分区 |
| `COMP-6` | `FilterBar.svelte` + `packages/runtime-ui/src/filters/` 下 7 个控件 | 筛选栏与各类型筛选控件(维度、层级、时间范围、时间点、布尔、数值区间、搜索)。控件按 `FilterDeclaration.type` 选,不要在页面里手搭输入框 | `RuntimeView.svelte`;6 份页面文档声明了 filters |
| `COMP-7` | `AiSummaryHost.svelte` + `packages/runtime-ui/src/ai-summary/` | AI 总结组件的宿主与流式呈现。它是**唯一**不经 `COMP-4` 又要处理自身加载态的构件——它的数据来自 SSE 而不是数据槽 | `COMP-3` |
| `COMP-8` | `apps/canvas/src/routes/(viewer)/preview/+page.svelte` 内的编辑器区块 | 页面文档即时预览:粘贴 JSON → 严格校验 → 渲染。改 Schema 或组件后自测最快的入口 | 1 处(路由页面,见 `ROUTE-2`) |

## 渲染辅助

<!-- 覆盖:packages/widgets/src/shared/、packages/widgets/src/components/table/、packages/runtime-ui/src/(2026-08-24) -->

判据是「导出纯函数、被构件文件引用」,与文件名无关。

| ID | 指路 | 是什么、何时用 | 被引用 |
| --- | --- | --- | --- |
| `COMP-9` | `formatValue`(`packages/widgets/src/shared/value-format.ts`,经 `COMP-1` 导出) | 展示格式化预设的**唯一**实现。页面参数替换进文本取值时也用它,所以它必须共享而不是各写一遍。新增消费方前先确认没有第二种格式化语义 | 构件内部 + `packages/runtime-ui` 的参数替换 |
| `COMP-10` | `resolveField` / `fieldValue` / `fieldLabel` / `semanticHtmlFieldPresentation`(`packages/widgets/src/shared/component-data.ts`) | 字段绑定 → 实际取值与标签的解析。构件从数据槽取值一律经它,不要直接索引 `snapshot.rows` | 多数构件 |
| `COMP-11` | `buildTableColumnLayout`(`table/columns.ts`)、`mergeSpans` / `tableRowTier`(`table/presentation.ts`)、`initialTableSort` / `shouldApplyTableHeaderFilter`(`table/view-state.ts`) | 表格列布局(含分组表头与叶子列展开)、行层级与合并、排序与表头筛选的判定。表格相关的任何计算都在这三个文件里,`Table.svelte` 只渲染 | `Table.svelte`、`RuntimeView.svelte` |
| `COMP-12` | `renderableDataSnapshot` / `hostRenderSnapshot` / `queryErrorView`(`packages/runtime-ui/src/widget-host-state.ts`) | 多数据槽快照 → 单一宿主态的投影,以及错误分类 → 可读标题的映射。**错误标题按分类的处理语义选,不解析错误字符串** | `COMP-3`、`COMP-4`、`RuntimeView.svelte` |
| `COMP-13` | `publishRowAlignment` / `subscribeRowAlignment` / `rowAlignmentParticipants`(`packages/widgets/src/shared/row-alignment.ts`,安装点在 `packages/runtime-ui/src/row-alignment.ts`) | 并排构件按同一行同步行高。跨构件的视觉对齐走它,不要在构件里量 DOM | `COMP-5` 的安装点、排行卡类构件 |
| `COMP-14` | `SemanticHtml.svelte` + `semantic-html.ts`(`packages/widgets/src/shared/`,**不经 `COMP-1` 导出**) | 上游返回的语义 HTML 的安全渲染。包内共享内核,新构件要用它得在包内引用,不要把它提到导出面 | 排行卡类构件 |

## 规范

#### `PATTERN-COMP-1` · 新增组件类型的落点集合

| 项 | 内容 |
| --- | --- |
| 规则 | 加一个页面组件类型要动且只动这几处:`schema/components/<type>.ts`(Zod 形状 + 目录元数据)、`schema/component.ts` 的判别联合数组、构件实现目录、`COMP-1` 的导出面、`COMP-3` 的分发分支。少一处会在校验或渲染其中一端静默失配 |
| 依据清单 | `COMP-1`、`COMP-2`、`COMP-3`、`STRUCT-2` |
| 依据样本 | `schema/component.ts` 注释说明三处枚举已归一为一个判别联合;`gauge` / `tabContainer` / `fieldText` / `keyValuePanel` 四个较新类型的落点完全一致 |
| 违例判定 | 新类型出现在判别联合里但 `COMP-3` 无分支(渲染落空),或有构件实现但未进 `COMP-1` 导出面 |

#### `PATTERN-COMP-2` · 构件不取数、不持交互状态

| 项 | 内容 |
| --- | --- |
| 规则 | `COMP-1` 下的构件只接收「已投影的数据槽 + props + 回调」。构件内部不得发请求、不得持有跨渲染的交互状态(排序、分页、选中一律由统一运行时持有并回传) |
| 依据清单 | `COMP-1`、`COMP-11`、`DATA-7` |
| 依据样本 | `component-render.ts` 的 `TableRenderBinding` 把表格视图状态与回调抽成显式契约,注释写明「组件分发只做转发」;`packages/widgets` 内全仓无 `fetch` 命中 |
| 违例判定 | `packages/widgets/src/**` 出现 `fetch(` / 导入 `@metriccanvas/data-gateway` / 导入 `@metriccanvas/runtime`,或在构件内 `$state` 里存排序、分页、筛选值 |

#### `PATTERN-COMP-3` · 声明数据槽的构件必须经统一宿主呈现三态

| 项 | 内容 |
| --- | --- |
| 规则 | 凡声明数据槽的组件类型都经 `COMP-4` 渲染;不经宿主的是一个**封闭集合**(`reportHeader` / `text` / `aiSummary` / `tabContainer` / `compositeCard`),判定函数是 `rendersWithoutWidgetHost`。想给新类型开例外,先证明它不声明数据槽 |
| 依据清单 | `COMP-3`、`COMP-4`、`COMP-12` |
| 依据样本 | `packages/runtime-ui/src/component-render.ts` 的 `rendersWithoutWidgetHost`;`COMP-3` 模板里 `{:else}` 分支统一包 `WidgetHost` |
| 违例判定 | 构件内部自己写 `{#if loading}` / 错误分支,或新增的绕过 `WidgetHost` 的分支不在那个封闭集合里 |

#### `PATTERN-COMP-4` · 无界面级权限判定辅助

| 项 | 内容 |
| --- | --- |
| 规则 | 仓内没有「当前用户能不能看这块」的判定入口。构件的可见性只由页面文档声明与数据能力(`derivePageCapabilities`)决定。计划期据此**不要**发明权限判定辅助,检视**不得**判「漏了权限判定」 |
| 依据清单 | `COMP-3`、`COMP-5` |
| 依据样本 | `COMP-3` 与 `COMP-5` 的渲染分支只读组件类型、数据槽与 `capabilities`;全仓无角色 / 权限符号(见 `data.md` 的 `PATTERN-DATA-6`) |
| 违例判定 | 出现权限判定辅助而本条未更新 |
