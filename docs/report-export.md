# 报告导出、单张 PNG 与浏览器 PDF 下载

页面通过 `reportHeader.props.exportButtons`（6.31）声明PDF/PNG整页下载，旧 `pdfExport`（6.28）与 `pngExport`（6.30）兼容读取；HTML挂载与Svelte统一运行时使用同一实现。集成应用不提供编码回调，也不安装PDF库。`withExportView`、`ExportViewOptions`、`PreparedExportView`、`ExportViewConsumer` 已移除，不提供兼容入口。页面配置见下文。

## 配置与操作

```json
{"exportButtons":[{"format":"pdf","label":"导出 PDF","scale":2},{"format":"png","label":"导出图片","scale":3}]}
```

数组按序显示按钮；省略不显示。label和filename复用文本取值协议，可引用参数、已应用筛选或parts，点击时冻结。与日期控件共用工具带，无日期也可显示。导出过程中禁用重复点击，没有取消按钮；依次显示准备报告、生成PDF及已完成页数。失败显示“导出失败，重试”，悬停显示原因。全部成功后发起下载并恢复按钮，日期与下载工具带不进入PDF。

运行 `pnpm dev:playground`，打开 `/pages/report-pdf-export` 或 `/preview?prototype=report-date`。前者读取45行inline合成数据，包含动态文件名、默认按钮及未启用对照；后者使用本地合成查询，包含非活动内容分区组、Tabs和完整图表。[HTML示例](../packages/embed/examples/report-pdf-download.html)直接消费同一页面声明。它们不证明真实DQE/Relay或部署联通。

## 执行与线程分工

内置下载任务属于页面实例，不新增全局导出状态。点击时固定已应用查询、表格视图、期间与已解析文字，之后的筛选草稿及交互不改变本次导出。内部静态视图复用正式组件，继承当前页面宽度、容器查询上下文、主题、内边距及分区间距；展开全部正文后等待字体、图片和图表就绪。

主线程必须处理DOM、计算样式和布局。样式复制及截图器的克隆、解析、绘制遍历使用6ms时间预算；到达预算后通过 `scheduler.yield()` 或定时任务让出执行权。内部截图Module基于锁定的html2canvas 1.4.1生成，保留上游CSS/伪元素/计数器行为，一次克隆解析、分块复用；不在每块重新解析整份DOM，不把iframe误当作后台线程。原生布局、单次DOM操作及组件挂载仍由浏览器执行，时间预算不等于所有设备的硬实时保证。

每个PDF任务创建一个Dedicated Web Worker。主线程通过transfer list发送ImageBitmap；Worker使用OffscreenCanvas裁切、原生无损PNG编码和jsPDF 4.2.1组装文件，最后传回ArrayBuffer。原生不透明RGB PNG直接复用IDAT压缩流（PDF FlateDecode、PNG Predictor 15），避免重建像素再由JavaScript压缩；支持原生压缩流时对已有过滤行重整压缩，控制文件体积。其他PNG格式走jsPDF无损路径。主线程不再执行整页toDataURL、PDF图片解码压缩或最终文件序列化。图表及渐变文字的小图使用异步Blob编码。

背压限制每个任务最多一块图片在Worker处理、一块在主线程准备，确认消费后才发送下一块；不把所有页面图片堆进队列。画布最长边8192像素、总面积约1600万像素，PDF按元数据使用2/3/4倍，默认2；单页超预算分成多个块写入同一页，不降低配置倍率，超宽明确失败。整体PDF仍保留在Worker内存中，内存并非与总页数无关。结束时关闭ImageBitmap、释放画布、Worker、临时DOM及Blob URL。

## 分发与失败

Worker代码由 `pnpm report-pdf:build` 内嵌生成，截图Adapter也由同一命令从锁定上游生成；`pnpm report-pdf:check` 校验漂移。npm和HTML ES/IIFE单文件分发均携带代码，不使用CDN、独立Worker路由、Service Worker、服务端Chromium或打印窗口。产品构建时不要求集成应用支持特殊Worker import语法。

运行环境需要Worker、ImageBitmap、OffscreenCanvas及PNG编码，宿主CSP须允许 `worker-src blob:`（Worker构造还受其回退规则约束）。启动失败明确显示错误，不静默回退到阻塞编码器。单实例只允许一个导出；不同实例独立执行。页面文档更新、实例销毁、准备超时和错误仍触发内部中止及清理，移除用户取消入口不等于删除生命周期管理。Worker每次消息处理60秒未响应、或生成阶段60秒没有分页进展时失败释放；数据与视图准备期限仍为60秒，和编码期限分别计算。关闭页面后不承诺继续执行。

## 版面与保存

A4默认竖向，宽内容整份横向。采用零额外外边距，保留页面自身样式和间距，按原有排布连续切片；不按章节另起页、不重复表头、不添加页码。超页高块连续承接，不移动内容或丢弃中间像素。背景、伪元素、渐变文字、并排组件和完整图表均保留；截图仍受浏览器字体及html2canvas支持范围限制。正文是图片，不能选中或搜索文字。

所有页成功才发起Blob下载，不下载部分文件，不打开打印预览或新窗口。保存位置由浏览器决定；运行时不能证明文件已写入磁盘。

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
- 标准下载由引擎生成A4多页，宽内容使用整份横向A4；引擎不注入全局打印样式。
- 冻结的是查询作用域；重新取数不会承诺数据库快照隔离。AI 总结使用点击下载时已有的文字（含已流出的部分文字）；尚无文字或生成失败时呈现空态，不阻断其他内容。

错误与异常均清理资源。准备阶段使用 `EXPORT_NOT_READY`、`EXPORT_BUSY`、`EXPORT_TIMEOUT`、`EXPORT_ROW_LIMIT`、`EXPORT_INCOMPLETE_DATA`、`EXPORT_RENDER_FAILED`；内部生命周期中止仍用 `EXPORT_CANCELLED`，不对应用户取消按钮。Worker启动、消息、图片及文件编码失败显示具体错误。

## 回归入口

- `packages/embed/tests/browser/report-pdf.spec.ts`：配置页面、ShadowRoot实际下载、失败重试、无取消入口及销毁清理。
- `apps/playground/tests/report-pdf-continuous-browser.mjs`：SDT六分区、50行合成数据、连续分页及3500行像素接缝。
- `apps/playground/tests/report-pdf-performance-browser.mjs`：SDT三次下载的主线程长任务和16ms心跳延迟，目标Chrome，可通过环境变量选择Edge。
- `apps/playground/tests/report-pdf-runtime-fidelity-browser.mjs`：页面与静态视图的几何、并排卡片及图表。
- `apps/playground/tests/report-pdf-partial-browser.mjs`：部分分页/取数失败后的可用内容与资源释放。
- `packages/engine/runtime-ui/tests/report-pdf-png.test.ts`：原生PNG压缩流与PDF解码像素一致性。

性能分别记录准备、主线程长任务、总耗时和文件体积；目标为固定测试环境下交互P95低于100ms、导出引发单次主线程阻塞低于100ms。不能以一个后台Worker存在证明性能通过。浏览器验收期间不要并行运行会触发Vite重载的构建或svelte-kit sync。

## 查询结果绑定使用分页窗口时的导出范围

6.20允许查询分页窗口作为结果绑定输入。对此类级联链，导出捕获当前页码、每页条数和排序，重新请求该窗口，再从新窗口解析下游字段集合；不把当前页扩大为业务全量。窗口totalCount可大于行数。固定TopN仍保留其声明的选择范围；未参与级联的普通分页表继续按完整结果导出规则处理。

## 统一导出按钮（6.31）

页面通过 `reportHeader.props.exportButtons` 数组配置PDF与PNG，每项复用 `format`、`label?`、`filename?`、`scale?`。一项一个按钮，按声明顺序显示；点击后直接按有效配置清晰度生成并下载；不支持的scale视为未配置，PDF回退2倍、PNG回退3倍，无菜单、清晰度弹窗或二次保存。旧字段继续读取；完整配置由[报告页头](page-metadata/components/reportHeader.md#导出按钮631)维护。

PNG始终输出一张 `image/png` 文件。超长内容内部按块处理，使用锁定fflate 0.8.3的持续Zlib流及RGB8/Sub行过滤，输出一个IHDR、连续IDAT与IEND；不将多个PNG拼文件，不分段下载，不引入其他图片格式。

PDF与PNG使用同一实例状态捕获、数据准备和独立文档。正式Svelte组件显式使用`css="injected"`，样式进入实际挂载根，包括新iframe和ShadowRoot；因此外部消费者提取应用CSS时也不会丢失导出样式，不复制父文档的style/link规则。主题属性名称从引擎/ui源码生成白名单，拒绝URL类背景值；字体资源由FontFaceSet传递。主页面不临时去除水印，正常父层浮层/背景/伪元素隔离；主动跨文档注入仍需真实门户接线验收。

PNG Worker只接收像素尺寸和ImageBitmap，不接收查询、凭据或DOM。每次用有界画布读取最多32行RGBA，增量过滤/压缩；已编码片段保留到最终Blob，因此文件内存仍随压缩后大小增长。浏览器和查看工具解码可能需要整图内存，流式编码不意味着任意长度都可导出。图表按3/4倍初始化，源画布仍独立检查8192最长边和16777216像素预算。单次只准备并处理一个截图块，消费后释放画布和bitmap。

新增验收`packages/embed/tests/browser/report-image.spec.ts`直接消费`pages/report-png-export.json`和`pages/report-png-long-export.json`，覆盖固定名称、原生解码、3倍图表、4倍跨块长图、父文档合成水印、Worker失败及销毁。`runtime-ui/tests/report-png.test.ts`由Node zlib独立校验CRC、解压行像素、跨块连续和拒绝未完成文件。真实DQE、Relay和门户水印仍需分别验收。

### IOC静态身份（6.32，B1）

静态呈现Adapter读取已捕获的iocHeader身份与全部已应用认领筛选，去掉返回和折叠控件，不遗漏收起的筛选。候选待确认/失败门禁阻止相关目标表导出和整页准备；无关表仍可导出。该Adapter不启用IOC actions；IOC整页下载入口、完整数据与门户ShadowRoot/CSP等仍属后续批次。

IOC业务筛选6.33的静态呈现显示封闭枚举label、hint及已应用值；稳定code保留在条件快照。候选待验证、空交集、denied/unconfigured均阻断相关导出；完整读取仍经SourceProgram核验，不因静态呈现而跳过候选合法性。

6.34金额与币种验收：XLSX与静态视图按点击时捕获的FilterValues选择静态字段、标签、单位和格式。保留数值基本单位及选中货币，不把人民币值换美元标题。新范围约束和隐式币种依赖同样约束完整取数/initial复用；候选或选择校验失败不得沿用旧初始结果。`ioc-header-currency-demo`证明本地双静态货币字段及XLSX/静态呈现；IOC新增整页PDF入口仍留后续批次。
