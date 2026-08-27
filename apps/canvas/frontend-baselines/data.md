# data.md — 拿到的数据在前端怎么持有、怎么流到界面?

## 持有与流动

<!-- 覆盖:packages/runtime/src/、packages/runtime-ui/src/、packages/page/src/snapshot.ts、apps/canvas/src/lib/、apps/canvas/src/routes/(2026-08-24)。apps/platform 的创作会话状态未纳入首扫 -->

| ID | 指路 | 是什么、何时用 | 被引用 |
| --- | --- | --- | --- |
| `DATA-1` | `orchestrate` → `PageSnapshotStream`(`packages/runtime/src/orchestrator.ts`) | **页面取数编排的唯一入口**,也是数据流的起点:只执行被组件数据槽或 AI 总结引用到的数据源,按生效查询去重、缓存、限并发,产出「数据源 id → 快照」的订阅流。要改「什么时候发查询」改这里 | `RuntimeView.svelte`;`packages/runtime/tests/` 内 9 个文件 |
| `DATA-2` | `DataSnapshot`(`packages/page/src/snapshot.ts`,经 `STRUCT-1` 导出) | **三态(实为四态)的类型级定义**:加载 / 就绪 / 空 / 错误。这是全仓状态语义的锚点——空态与「就绪但零行」是两回事,错误态携带结构化查询错误。任何自定义状态枚举都是重复定义 | 编排器、`COMP-4`、`COMP-12`、全部构件 |
| `DATA-3` | `createFilterState` / `initialFilterValues`(`packages/runtime/src/filter-state.ts`) | **全仓唯一的可写共享状态容器**(筛选状态)。值自带类型与维度信息,所以生效查询合成与 URL 序列化只依赖值本身;它同时是跨页传参的编解码器(`fromURL` / `toURL`) | `DATA-1`、`RuntimeView.svelte`、`drillThroughSearch`;`packages/runtime/tests/` 内 8 个文件 |
| `DATA-4` | `resolvePageParams` / `pageParamSearch` / `PAGE_PARAM_PREFIX`(`packages/runtime/src/page-params.ts`) | 页面参数:**不可变**,一次打开解析一次,因此不进筛选状态、没有写入口。必需参数缺失时页面进 `params-incomplete` 态而不是查询错误态 | `RuntimeView.svelte`、`drillThroughSearch` |
| `DATA-5` | `createDimensionValuesLoader` / `dimensionValuesSnapshot`(`packages/runtime/src/dimension-values.ts`) | 筛选候选值的加载与显式状态发布(含级联约束、在途取消、过期结果丢弃)。筛选控件与表格表头筛选共用一份候选值快照 | `RuntimeView.svelte`、`COMP-6` |
| `DATA-6` | `applyComputation`(`packages/runtime/src/compute/`) | 受控计算:页面声明的具名算子在编排后作用于数据行。**新的派生值优先声明成算子,不要在构件里算** | `DATA-1`;`packages/runtime/tests/compute*.test.ts` |
| `DATA-7` | `RuntimeView.svelte` 内的 `tableViews` / `tablePageSizes` / `appliedTableHeaderFilters`,状态形状在 `packages/widgets/src/components/table/view-state.ts` | 表格的**本地界面状态**(排序、页码、页大小、已应用的表头筛选),持在统一运行时而不是构件里。`pagination.mode` 决定它是本地裁剪还是回抛给 `DATA-1` 重查 | `COMP-3` 的表格绑定、`COMP-11` |
| `DATA-8` | `RuntimeView.svelte` 的 `pageState`(`loading` / `invalid` / `configuration-error` / `params-incomplete` / `ready`) | **页面级**状态机,与 `DATA-2` 的**数据源级**状态是两层,别混:页面文档没通过校验、接入配置不全、必需参数缺失,都在数据还没发出去之前就定了 | `RuntimeView.svelte`;`apps/canvas` 查看器路由另有自己的一层(`loading` / `missing` / `ready`) |
| `DATA-9` | `Subscribable<T>`(`packages/runtime/src/orchestrator.ts`) | 手写的最小订阅契约(兼容 Svelte store 形状:`subscribe` 返回取消函数、订阅时立即推当前值)。跨层传状态就用它,**不要引入 store 库** | `DATA-1`、`DATA-3`、`DATA-5` |

## 规范

#### `PATTERN-DATA-1` · 三态沿用统一宿主,构件不重写

| 项 | 内容 |
| --- | --- |
| 规则 | 加载 / 错误 / 空三态一律沿用 `COMP-4` 的呈现与 `COMP-12` 的投影。构件与页面**不得**自己写 loading 分支、骨架屏或错误块;空态被刻意投影成「零行的就绪快照」,好让构件保留标题与容器(表格因此还能渲染表头)。计划期一行引用这条就够,不必每个 Story 重新描述三态 |
| 依据清单 | `DATA-2`、`COMP-4`、`COMP-12` |
| 依据样本 | `widget-host-state.ts` 的 `renderableDataSnapshot` / `hostRenderSnapshot`(含「表格空结果仍渲染表头」的例外);`WidgetHost.svelte` 的三分支模板;`COMP-3` 的 `{:else}` 统一包宿主 |
| 违例判定 | `packages/widgets/**` 或页面级组件里出现 `status === 'loading'` / `'error'` 分支、自绘骨架屏,或自造状态枚举而不用 `DATA-2` |

#### `PATTERN-DATA-2` · 服务端数据与界面状态分开持有

| 项 | 内容 |
| --- | --- |
| 规则 | 服务端数据只以 `DATA-2` 的快照形态存在,由 `DATA-1` 单向推送,消费方**只读**;界面状态(`DATA-7`)另存一份,永不写回快照。需要「筛过 / 排过 / 裁过」的行时做投影,不改原快照 |
| 依据清单 | `DATA-1`、`DATA-2`、`DATA-7` |
| 依据样本 | `RuntimeView.svelte` 的 `snapshots` 只在流回调里整体替换;`tableSnapshot()` 每次从原快照现算投影;`PageDataSnapshots` 是 `ReadonlyMap` |
| 违例判定 | 出现对快照行的原地修改(`rows.push` / `rows[i] = `),或把排序、页码写进快照结构 |

#### `PATTERN-DATA-3` · 无取数缓存库、无状态管理库

| 项 | 内容 |
| --- | --- |
| 规则 | 仓内没有 TanStack Query 之类的取数缓存库,也没有 store 库(连 `svelte/store` 都不用)。去重与缓存是 `DATA-1` 自己按生效查询做的;订阅契约是 `DATA-9` 手写的。计划期据此**不要**引入缓存或 store 依赖,也不要发明一个「全局 store」 |
| 依据清单 | `DATA-1`、`DATA-3`、`DATA-9` |
| 依据样本 | 全仓源码搜 `svelte/store` / `writable(` / `readable(` / TanStack / Pinia / Zustand 零命中;`packages/runtime/package.json` 只依赖 `@metriccanvas/page`;`orchestrator.ts` 的注释说明去重与缓存在编排器内 |
| 违例判定 | 新增取数缓存或状态管理依赖;或在 `packages/runtime*` 里出现第二个可写共享容器(除 `DATA-3`) |

#### `PATTERN-DATA-4` · 筛选值唯一写入口,URL 是唯一跨页载体

| 项 | 内容 |
| --- | --- |
| 规则 | 筛选值只经 `DATA-3` 的 `write` / `writeMany` 改;组件交互(图表点击、表格单元格选择、地图下钻)都要落到这两个方法上,不得旁路改 `filterValues`。跨页传值的物理载体只有 URL,编解码只有 `DATA-3` 与 `DATA-4` 两处实现 |
| 依据清单 | `DATA-3`、`DATA-4`、`ROUTE-7` |
| 依据样本 | `RuntimeView.svelte` 的 `writeDimension` / `writeTimeRange` / `writeTimePoint` / `writeBoolean` / `writeNumberRange` / `writeSearch` / `handleChartClick` / `handleTableCellSelect` 全部收口到 `filterState.write*`;`navigate.ts` 的 `drillThroughSearch` 复用 `toURL` 编码 |
| 违例判定 | 直接给 `filterValues` 赋值;或出现第三处筛选值 URL 编解码实现 |

#### `PATTERN-DATA-5` · 无表单机制

| 项 | 内容 |
| --- | --- |
| 规则 | 查看器侧没有表单库,也**没有「校验时机」这条约定**(没有提交时 / 失焦时 / 输入时的统一做法)。仓内的输入只有筛选控件与预览器的 JSON 文本框:筛选控件按控件语义即时写入 `DATA-3`,预览器在文本变化后整份重新校验。计划期据此**不要**引用一个不存在的表单校验时机规范 |
| 依据清单 | `COMP-6`、`COMP-8`、`DATA-3` |
| 依据样本 | 全仓无表单库依赖;`apps/canvas/src/lib/preview-document.ts` 的 `parsePreviewDocument` 是「解析 + 整份校验」一次性函数;筛选控件的 write 调用无防抖或提交按钮语义 |
| 违例判定 | 引入表单库或新增带提交语义的表单而本条未更新 |

#### `PATTERN-DATA-6` · 无权限数据

| 项 | 内容 |
| --- | --- |
| 规则 | 前端不持有任何用户、角色或权限信息,也没有取它的地方。「能看什么」由后端按会话决定,前端只表达页面声明与数据能力(`derivePageCapabilities`)。检视**不得**判「权限数据来源不清」;计划期**不要**发明权限 store 或守卫 |
| 依据清单 | `DATA-8`、`PATTERN-API-4`、`PATTERN-ROUTE-3` |
| 依据样本 | `packages/runtime`、`packages/runtime-ui`、`packages/widgets`、`apps/canvas/src` 内无角色 / 权限符号(命中全部是 ARIA `role` 属性与字段元数据的 `role`);取数只靠同源 cookie |
| 违例判定 | 出现权限或角色数据的取用与持有而本条未更新 |
