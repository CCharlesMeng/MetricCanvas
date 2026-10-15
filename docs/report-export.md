# 报告完整导出与浏览器 PDF 接入

本文是集成应用的报告导出与浏览器 PDF 接入专题，维护操作、公共方法、编码接线和运行边界。页面协议概览见[PAGE-METADATA.md](../PAGE-METADATA.md)，参数与期间筛选配置见[PAGE-PARAMETERS.md](../PAGE-PARAMETERS.md#时间参数与顶部筛选)。

## 配置内置 PDF 下载（6.28）

Report顶层reportHeader在props中声明以下对象：

```json
{
  "pdfExport": {
    "label": "下载经营报告",
    "filename": "经营分析报告.pdf"
  }
}
```

对象存在即启用；`pdfExport: {}`使用默认按钮“下载 PDF”，文件名取触发页头标题。省略则不显示。两项均遵循既有文本取值协议，可引用页面参数、已应用筛选或显式parts，点击时冻结。工具带与filterIds共用，无日期控件也可独立显示。按钮下载整页，生成期间禁用重复点击并提供取消；错误在工具带显示。日期和下载控件不进入PDF，期间正文保留。

从仓库根目录运行`pnpm dev:playground`，打开[内置PDF页面](http://localhost:5173/pages/report-pdf-export)。页面使用45行inline合成数据，无外部查询；包括自定义按钮及动态文件名、无日期的默认按钮和未启用对照。HTML集成应用示例见[内置下载](../packages/embed/examples/report-pdf-download.html)。本批次按用户要求未执行验证，示例存在不代表验收通过。

PDF编码与下载均在浏览器内完成。html2canvas 1.4.1和jsPDF 4.2.1由引擎拥有依赖，集成应用无需另行安装或提供编码器。npm运行时在需要时加载编码依赖；HTML单文件产物捆绑全部依赖，不需要CDN、编码接口、服务端Chromium或Poppler。集成应用需要采用包含6.28能力的新引擎产物。

标准编码使用A4，普通内容竖向，存在引擎标记的宽内容时整份横向。正文以图片写入，不能选中或搜索文字。所有页编码完成后通过Blob下载链接发起下载，无新窗口和打印预览；保存位置由浏览器下载设置决定。运行时只能报告已生成并发起下载，不能判断文件是否已写入磁盘。

原[报告日期演示](http://localhost:5173/preview?prototype=report-date)仍保留静态视图预览及高级调用示例，共用同一引擎内部编码实现。

## 与时间筛选配合

参数初值、筛选声明、查询绑定、页头位置和显式期间文字统一按[时间参数与顶部筛选](../PAGE-PARAMETERS.md#时间参数与顶部筛选)配置。导出开始时捕获已应用筛选与已经解析的页头、副标题和正文文字；未提交的输入草稿不参与，之后的页内筛选变化不改变本次导出。

## 公共方法

HTML 集成应用的 `RuntimeHandle` 和 Svelte `RuntimeView` 实例均暴露同一方法：

```ts
await handle.withExportView(async ({ target, paper, wideElements, signal }) => {
  // target 已连接到 DOM，图表已转为静态图片，字体和图片已准备好。
  // 接入集成应用的 PDF 编码器，并等待编码和发起下载结束。
  await pdfEncoder.encodeAndSave(target, {
    paper,              // 固定 A4
    wideElements,       // 标记为横向的内容分区
    signal              // 取消、页面更新或销毁时中止
  });
}, { signal: controller.signal });
```

`pdfEncoder` 是集成应用自有实现，上例展示接线方式。标准下载由引擎内置实现；只有选择本节自定义消费回调时，编码与下载由回调负责。Svelte 使用 `bind:this` 取得实例；HTML 使用 `MetricCanvas.mount(...)` 返回的 handle。返回值透传回调结果。

模块关系：页面实例先捕获已应用筛选、查询排序、表头筛选和局部表格状态；数据准备器通过同一数据网关重新取得完整结果；导出渲染器复用正式组件并展开全部正文；资源准备器固定图表、等待字体图片；最后交给集成应用回调。全部状态属于当前实例，正常浏览继续独立运行。

静态视图沿用当前页面内容宽度、容器查询上下文、主题、内边距和分区间距，在图表挂载前确定几何。`paper: 'A4'` 表示输出纸张，不要求 DOM 固定为 A4 像素宽度；集成应用按目标纸张等比例缩放与分页。页面在窄容器中采用单列时，导出保留该排布；在宽容器中并排的组件也保持并排。

`target` 在回调成功、失败或取消前有效。集成应用必须 await 全部消费工作；收到 signal 后停止读取。方法结束后引擎卸载临时视图。页面更新和销毁也会取消；即使网关不响应 AbortSignal，准备阶段仍按时拒绝并清理。一个实例同时只允许一个导出；不同实例分别拥有生命周期。

## 导出范围与完整性

- 全部内容分区、内容分区组和 Tabs 均展开，表格包含当前已应用筛选范围内的全部匹配行。
- 声明为Top5等有限选择的主查询保留其集合范围；级联明细完整性按[查询结果绑定规则](cascading-queries.md#4-主集合与完整明细的边界)核验。
- 日期输入、分页、选择、链接和详情浮层不进入导出；期间文字保留捕获值。详情专用查询不执行。
- 使用同一已认证数据网关，正常重新取得全部匹配行而非直接下载初始快照或当前分页；重新取数失败时按下述可用内容规则保留页面数据。排序与表头筛选也保留。
- 整页下载按可用内容继续：单个数据源取数或计算失败不阻断其余内容；后续分页取数失败时保留此前成功取得的行，普通查询与组合查询源均适用。重新取数完全失败但点击下载时已有就绪数据时，保留捕获的页面数据；没有可用数据的组件按空数据呈现，自定义组件保留标题与无数据提示。全部动态查询失败时，静态标题和正文仍可下载。不自动补零，不把查询失败当成真实零值。
- 不完整数据的诊断保留在控制台；保留部分分页或页面数据时打印 `EXPORT_PARTIAL_DATA`，标记 `completeness: 'unverified'`，不输出查询体、筛选值或业务行。捕获数据保留原总数，普通组件可沿用部分数据提示；下载成功不代表数据完整。
- 每个导出结果上限 10,000 行，整次准备上限 60 秒；PDF 编码和保存时间不计入。超限、提前结束、分页总数缺失或变化明确失败；无分页查询需 totalCount 或显式 resultScope: complete 完整结果契约，无截断或当前页降级。
- 普通查询完整取数时，若累计行数超过接口声明的总数，控制台打印 `EXPORT_TOTAL_COUNT_MISMATCH` 警告并继续导出已收到的全部行；停止后续分页，不按错误总数截断，也不自动去重。此时数据完整性未确认，PDF 中保留收到的数据，警告仅输出到控制台。警告包含页面与修订 ID、数据源 ID、请求 offset/limit、本次与累计行数、接口总数及 `completeness: 'unverified'`，不输出查询体、筛选值或业务数据。其他完整性错误仍明确失败，组合查询源仍按其完整性规则校验。
- 该警告正文直接显示异常数据源 ID 和关联组件的标题、ID；详情中的 `dataSourcePath` 指向数据源声明，`components` 列出组件类型、标题、所属内容分区、组件路径 `componentPath` 和数据绑定路径 `bindingPath`。共享数据源列出全部引用（包含 Tab 和组合卡内的组件）；`boundSourceId` 是组件直接绑定的源，`relation: 'dependency'` 表示异常源是它的上游依赖，`direct` 表示直接绑定。标题来自已解析的页面声明，不输出结果行或查询条件。
- 标准下载由引擎编码器完成A4多页；自定义回调取得的`wideElements`对应 `data-export-orientation="landscape"` 和自然宽度提示，内置编码器对宽内容使用整份横向A4，自定义编码器可自行决定横向分页或缩放。引擎不注入全局打印样式。
- 冻结的是查询作用域；重新取数不会承诺数据库快照隔离。AI 总结使用点击下载时已有的文字（含已流出的部分文字）；尚无文字或生成失败时呈现空态，不阻断其他内容。

错误码：`EXPORT_NOT_READY`、`EXPORT_BUSY`、`EXPORT_CANCELLED`、`EXPORT_TIMEOUT`、`EXPORT_ROW_LIMIT`、`EXPORT_INCOMPLETE_DATA`、`EXPORT_RENDER_FAILED`。集成应用编码错误原样抛出；两类错误均清理临时 DOM。

可运行的接入示例：[HTML 示例](../packages/embed/examples/report-export.html)验证静态视图和实例生命周期；[本地报告示例](http://localhost:5173/preview?prototype=report-date)提供“准备完整导出视图”和“导出 PDF”两个入口。前者查看静态 DOM，后者直接下载 A4 多页 PDF。两者使用本地合成数据；验收不代表真实 Relay/Java/DQE 联通。

## 浏览器编码与下载示例

从仓根运行 `pnpm dev:playground`，打开上述5173地址，点击“导出 PDF”。示例中的“主要明细”和“补充明细”是内容分区组导航，分别显示经营明细及趋势、区域及项目分析；导出包含两个分组和全部 Tabs。

调用链：`RuntimeView.withExportView` → [浏览器 PDF 客户端](../packages/engine/runtime-ui/src/report-pdf-client.ts) 复制静态 DOM 和计算后的样式 → 独立 iframe 准备字体与图片 → [分页规划](../packages/engine/runtime-ui/src/report-pdf-pagination.ts) → html2canvas 按有界批次生成图片后连续切片 → jsPDF 合成全部页面 → Blob 下载链接 → 清理编码视图和引擎临时视图。

标准接入只需配置pdfExport，HTML挂载和Svelte RuntimeView消费相同页面，不需要新增挂载参数。`downloadReportPdf`是引擎内部实现，不是新增公共导出。现有页面试验场通过兼容转发模块继续使用它，自定义集成应用可继续用withExportView消费静态DOM。

编码器在所有页面成功后才发起下载，失败不下载部分文件。收到signal后停止后续编码和下载；html2canvas不支持中断当前截图，当前截图完成后释放独立编码iframe。字体、图片准备阶段支持取消。日期筛选变化不改变本轮捕获状态，页面文档更新或实例销毁会取消导出。

A4采用零外边距，内容从纸张左上角铺满宽度，按静态视图原有排布连续切片；页面自身的内边距与样式保留。内容分区、标题、卡片、图表和表格都不人为另起一页，不重复插入表头或添加页码；跨纸张的内容连续承接，不丢弃中间像素。冻结图表保留测量高度。正常尺寸使用2倍截图，超宽内容适当降低倍率以控制画布尺寸。

编码文档复制完整的计算样式及伪元素，保留多列、固定高度、同行对齐、封面铺满效果和原有间距，不再把分区强制改成纵向列表。渐变文字由浏览器先绘制为局部透明图片，保留原有字形和渐变，避免截图器把渐变铺成矩形或替换为单色。并排内容保持原有几何，纸张边界不改变块的位置或插入额外空间。完整图表使用全部结果范围，移除交互缩放窗口。

宽内容触发整份横向A4；高于纸张的内容按原样连续切片，不因块高超过页高而拒绝整份导出。截图和文字排版受浏览器、字体及 html2canvas CSS 支持范围影响，部署时应保证报告字体在客户端可用。无需配置 `MC_PDF_CHROMIUM` 或 `MC_PDF_RENDERER`。

截图按最长边8192像素、总面积约1600万像素限制合并批次，减少重复解析整份DOM；长报告分批处理。PNG使用快速无损压缩。

已有分页回归入口为[分页单元测试](../apps/playground/tests/report-pdf-pagination.test.ts)，实际下载、长表、图片失败及取消清理回归入口为[浏览器回归脚本](../apps/playground/tests/report-pdf-browser.mjs)；本批次未执行。从仓根可运行：

```sh
pnpm exec vitest run apps/playground/tests/report-pdf-pagination.test.ts
# 先在另一个终端运行 pnpm dev:playground，再执行浏览器回归；默认访问 5173。
node apps/playground/tests/report-pdf-continuous-browser.mjs
node apps/playground/tests/report-pdf-browser.mjs
node apps/playground/tests/report-pdf-appearance-browser.mjs
node apps/playground/tests/report-pdf-fidelity-browser.mjs
node apps/playground/tests/report-pdf-runtime-fidelity-browser.mjs
node apps/playground/tests/report-pdf-partial-browser.mjs
```

部分取数失败回归覆盖单源失败、后续分页失败、重新取数失败后保留已显示数据、全部动态源失败及失败数据驱动的自定义组件，并实际生成 PDF、发起浏览器下载和检查临时视图清理。它使用合成数据网关，不代表真实 DQE/Relay 联通。

浏览器测试期间不要同时构建或运行 `svelte-kit sync`，避免开发服务重载打断测试；可用 `REPORT_PDF_BASE_URL` 指定另一服务地址。

部署 Adapter 的日期身份证明提供方可以返回 `timeIdentities`（按数据源 ID）和 `timePointFields`（按数据源 ID/查询字段，含 granularity、valueFormat、identity），证明必须绑定精确页面摘要和 DQE 验证基线。未提供时算法保持独立日期身份；字符串月份分区不由模型猜测。真实部署接入由集成应用/Relay Adapter 配置，不改变 Java 页面资产接口。

## 查询结果绑定使用分页窗口时的导出范围

6.20允许查询分页窗口作为结果绑定输入。对此类级联链，导出捕获当前页码、每页条数和排序，重新请求该窗口，再从新窗口解析下游字段集合；不把当前页扩大为业务全量。窗口totalCount可大于行数。固定TopN仍保留其声明的选择范围；未参与级联的普通分页表继续按完整结果导出规则处理。
