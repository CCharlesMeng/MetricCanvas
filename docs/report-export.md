# 报告完整导出与浏览器 PDF 接入

本文是集成应用的报告导出与浏览器 PDF 接入专题，维护操作、公共方法、编码接线和运行边界。页面协议概览见[PAGE-METADATA.md](../PAGE-METADATA.md)，参数与期间筛选配置见[PAGE-PARAMETERS.md](../PAGE-PARAMETERS.md#时间参数与顶部筛选)。

## 直接下载 PDF

从仓库根目录运行 `pnpm dev:playground`，打开[浏览器 PDF 演示](http://localhost:5173/preview?prototype=report-date)。选择并提交期间后点击“导出 PDF”，浏览器生成并下载 `经营分析报告.pdf`，无需打开打印预览。是否询问保存位置由浏览器下载设置决定。点击“准备完整导出视图”可先检查静态 DOM。

演示使用本地合成数据，PDF 编码与下载均在用户浏览器内完成。`html2canvas` 1.4.1 和 `jsPDF` 4.2.1 随页面试验场打包并在导出时按需加载，运行时不依赖 CDN、PDF 编码接口、服务端 Chromium 或 Poppler。普通样例页面路由消费页面 JSON，按钮由集成应用接入；页面 JSON 无需新增下载配置字段。内网 IP、域名和 HTTPS 访问无需额外 PDF 路由；完整数据仍通过集成应用已有数据网关取得。

正文以图片写入 PDF，不能选中、复制或搜索。页面只报告已生成并发起下载，不能判断操作系统是否已把文件写入磁盘。

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

`pdfEncoder` 是集成应用自有实现，上例展示接线方式。引擎不编码、下载或保存 PDF。Svelte 使用 `bind:this` 取得实例；HTML 使用 `MetricCanvas.mount(...)` 返回的 handle。返回值透传回调结果。

模块关系：页面实例先捕获已应用筛选、查询排序、表头筛选和局部表格状态；数据准备器通过同一数据网关重新取得完整结果；导出渲染器复用正式组件并展开全部正文；资源准备器固定图表、等待字体图片；最后交给集成应用回调。全部状态属于当前实例，正常浏览继续独立运行。

静态视图沿用当前页面内容宽度、容器查询上下文、主题、内边距和分区间距，在图表挂载前确定几何。`paper: 'A4'` 表示输出纸张，不要求 DOM 固定为 A4 像素宽度；集成应用按目标纸张等比例缩放与分页。页面在窄容器中采用单列时，导出保留该排布；在宽容器中并排的组件也保持并排。

`target` 在回调成功、失败或取消前有效。集成应用必须 await 全部消费工作；收到 signal 后停止读取。方法结束后引擎卸载临时视图。页面更新和销毁也会取消；即使网关不响应 AbortSignal，准备阶段仍按时拒绝并清理。一个实例同时只允许一个导出；不同实例分别拥有生命周期。

## 导出范围与完整性

- 全部内容分区、内容分区组和 Tabs 均展开，表格包含当前已应用筛选范围内的全部匹配行。
- 声明为Top5等有限选择的主查询保留其集合范围；级联明细完整性按[查询结果绑定规则](cascading-queries.md#4-主集合与完整明细的边界)核验。
- 日期输入、分页、选择、链接和详情浮层不进入导出；期间文字保留捕获值。详情专用查询不执行。
- 使用同一已认证数据网关；不复用初始快照或当前分页。排序与表头筛选也保留。
- 每个导出结果上限 10,000 行，整次准备上限 60 秒；PDF 编码和保存时间不计入。超限、提前结束、分页总数缺失或变化明确失败；无分页查询需 totalCount 或显式 resultScope: complete 完整结果契约，无截断或当前页降级。
- A4 多页由集成应用编码器完成；`wideElements` 对应 `data-export-orientation="landscape"` 和自然宽度提示，由编码器决定横向分页或缩放。引擎没有全局打印样式。
- 冻结的是查询作用域；重新取数不会承诺数据库快照隔离。AI 总结使用捕获的已完成静态结论，尚未完成则拒绝导出。

错误码：`EXPORT_NOT_READY`、`EXPORT_BUSY`、`EXPORT_CANCELLED`、`EXPORT_TIMEOUT`、`EXPORT_ROW_LIMIT`、`EXPORT_INCOMPLETE_DATA`、`EXPORT_RENDER_FAILED`。集成应用编码错误原样抛出；两类错误均清理临时 DOM。

可运行的接入示例：[HTML 示例](../packages/embed/examples/report-export.html)验证静态视图和实例生命周期；[本地报告示例](http://localhost:5173/preview?prototype=report-date)提供“准备完整导出视图”和“导出 PDF”两个入口。前者查看静态 DOM，后者直接下载 A4 多页 PDF。两者使用本地合成数据；验收不代表真实 Relay/Java/DQE 联通。

## 浏览器编码与下载示例

从仓根运行 `pnpm dev:playground`，打开上述5173地址，点击“导出 PDF”。示例中的“主要明细”和“补充明细”是内容分区组导航，分别显示经营明细及趋势、区域及项目分析；导出包含两个分组和全部 Tabs。

调用链：`RuntimeView.withExportView` → [浏览器 PDF 客户端](../apps/playground/src/lib/report-pdf-client.ts) 复制静态 DOM 和计算后的样式 → 独立 iframe 准备字体与图片 → [分页规划](../apps/playground/src/lib/report-pdf-pagination.ts) → html2canvas 按页生成图片 → jsPDF 合成全部页面 → Blob 下载链接 → 清理编码视图和引擎临时视图。

调用方示例（Svelte 通过 `bind:this` 取得 `runtime`，HTML 挂载 handle 使用相同调用）：

```ts
import { downloadReportPdf } from './report-pdf-client';

await runtime.withExportView(async ({ target, signal, wideElements }) => {
  if (wideElements.length) throw new Error('当前 PDF 示例仅支持竖向 A4');
  const { pageCount } = await downloadReportPdf(target, signal, '经营分析报告.pdf');
  // 到这里已生成 PDF 并发起浏览器下载，可以显示 pageCount。
});
```

`downloadReportPdf` 是集成应用侧示例 helper，不是渲染引擎公共导出。它在所有页面编码成功后才发起下载，失败不下载部分结果。收到 `signal` 后停止下一页和下载；html2canvas 不支持中断正在进行的截图，因此当前页截图完成后再释放独立编码 iframe。字体、图片准备阶段支持及时取消。必须保留回调中的 `await`，确保引擎不会提前销毁正常消费中的导出视图。

示例采用 A4 竖向、10 mm 边距、2 倍截图和页码。每次只分配当前页的 Canvas，不把整份长报告变成一个超大位图；表格行和图表不跨页裁切，表格续页重复表头，章节标题尽量与后续内容保持在一起。冻结图表保持静态图片占用的高度，防止绝对定位图片在截图中被裁掉。

编码文档复制完整的计算样式及伪元素，保留多列、固定高度、同行对齐、封面铺满效果和原有间距，不再把分区强制改成纵向列表。渐变文字由浏览器先绘制为局部透明图片，保留原有字形和渐变，避免截图器把渐变铺成矩形或替换为单色。能容纳一页的短卡片整体分页；并排表格跨页时分别重复各自表头，按较高表头预留位置。完整图表使用全部结果范围，移除交互缩放窗口。

宽分区仍明确拒绝；单个不可拆分的表格行、图表或正文块超过 A4 页高时明确失败，不静默裁切。任意宽分区的横向编排需由集成应用消费 `wideElements` 并独立验收。截图和文字排版受浏览器、字体及 html2canvas CSS 支持范围影响，部署时应保证报告字体在客户端可用。无需配置 `MC_PDF_CHROMIUM` 或 `MC_PDF_RENDERER`。

分页边界由[分页单元测试](../apps/playground/tests/report-pdf-pagination.test.ts)核验，实际下载、长表、图片失败及取消清理由[浏览器回归脚本](../apps/playground/tests/report-pdf-browser.mjs)核验。从仓根运行：

```sh
pnpm exec vitest run apps/playground/tests/report-pdf-pagination.test.ts
# 先在另一个终端运行 pnpm dev:playground，再执行浏览器回归；默认访问 5173。
node apps/playground/tests/report-pdf-browser.mjs
node apps/playground/tests/report-pdf-appearance-browser.mjs
node apps/playground/tests/report-pdf-fidelity-browser.mjs
node apps/playground/tests/report-pdf-runtime-fidelity-browser.mjs
```

浏览器测试期间不要同时构建或运行 `svelte-kit sync`，避免开发服务重载打断测试；可用 `REPORT_PDF_BASE_URL` 指定另一服务地址。

部署 Adapter 的日期身份证明提供方可以返回 `timeIdentities`（按数据源 ID）和 `timePointFields`（按数据源 ID/查询字段，含 granularity、valueFormat、identity），证明必须绑定精确页面摘要和 DQE 验证基线。未提供时算法保持独立日期身份；字符串月份分区不由模型猜测。真实部署接入由集成应用/Relay Adapter 配置，不改变 Java 页面资产接口。

## 查询结果绑定使用分页窗口时的导出范围

6.20允许查询分页窗口作为结果绑定输入。对此类级联链，导出捕获当前页码、每页条数和排序，重新请求该窗口，再从新窗口解析下游字段集合；不把当前页扩大为业务全量。窗口totalCount可大于行数。固定TopN仍保留其声明的选择范围；未参与级联的普通分页表继续按完整结果导出规则处理。
