# 报告日期筛选与完整 PDF 接入

Schema 6.13 增加可选 `reportHeader.props.filterIds`。报告页头上方工具带消费已声明的月/日单选或范围筛选器，宽容器右对齐、窄容器换行。页面参数通过 `initialParam` 初始化筛选器；期间文字和关联查询随后使用已应用筛选值。未提交的半范围或非法范围不会改变查询和期间文字。

初次创作保持无日期参数状态。日期提取确认原子生成时间参数、筛选器、查询绑定和页头引用；多个查询只有可信时间身份一致才合并。已有身份复用，单点驱动多个窗口需明确 `window`，不能从不同的日期字面量推断关系。修改或删除日期筛选器会清理其失去消费者的初始化时间参数；其它消费者仍引用时保留。

## 公共方法

HTML 集成应用的 `RuntimeHandle` 和 Svelte `RuntimeView` 实例均暴露同一方法：

```ts
await handle.withExportView(async ({ target, paper, wideElements, signal }) => {
  // target 已连接到 DOM，图表已转为静态图片，字体和图片已准备好。
  // 将你的 PDF 编码器接到这里，并等待编码及保存完成。
  await pdfEncoder.encodeAndSave(target, {
    paper,              // 固定 A4
    wideElements,       // 标记为横向的内容分区
    signal              // 取消、页面更新或销毁时中止
  });
}, { signal: controller.signal });
```

`pdfEncoder` 是集成应用自有实现，上例展示接线方式。引擎不编码、下载或保存 PDF。Svelte 使用 `bind:this` 取得实例；HTML 使用 `MetricCanvas.mount(...)` 返回的 handle。返回值透传回调结果。

模块关系：页面实例先捕获已应用筛选、查询排序、表头筛选和局部表格状态；数据准备器通过同一数据网关重新取得完整结果；导出渲染器复用正式组件并展开全部正文；资源准备器固定图表、等待字体图片；最后交给集成应用回调。全部状态属于当前实例，正常浏览继续独立运行。

`target` 在回调成功、失败或取消前有效。集成应用必须 await 全部消费工作；收到 signal 后停止读取。方法结束后引擎卸载临时视图。页面更新和销毁也会取消；即使网关不响应 AbortSignal，准备阶段仍按时拒绝并清理。一个实例同时只允许一个导出；不同实例分别拥有生命周期。

## 导出范围与完整性

- 全部内容分区、内容分区组和 Tabs 均展开，表格包含当前已应用筛选范围内的全部匹配行。
- 日期输入、分页、选择、链接和详情浮层不进入导出；期间文字保留捕获值。详情专用查询不执行。
- 使用同一已认证数据网关；不复用初始快照或当前分页。排序与表头筛选也保留。
- 每个导出结果上限 10,000 行，整次准备上限 60 秒；PDF 编码和保存时间不计入。超限、提前结束、分页总数缺失或变化明确失败；无分页查询需 totalCount 或显式 resultScope: complete 完整结果契约，无截断或当前页降级。
- A4 多页由集成应用编码器完成；`wideElements` 对应 `data-export-orientation="landscape"` 和自然宽度提示，由编码器决定横向分页或缩放。引擎没有全局打印样式。
- 冻结的是查询作用域；重新取数不会承诺数据库快照隔离。AI 总结使用捕获的已完成静态结论，尚未完成则拒绝导出。

错误码：`EXPORT_NOT_READY`、`EXPORT_BUSY`、`EXPORT_CANCELLED`、`EXPORT_TIMEOUT`、`EXPORT_ROW_LIMIT`、`EXPORT_INCOMPLETE_DATA`、`EXPORT_RENDER_FAILED`。集成应用编码错误原样抛出；两类错误均清理临时 DOM。

可运行的接入示例：[HTML 示例](../packages/embed/examples/report-export.html)。本地报告示例位于 `/preview?prototype=report-date&variant=C`，提供“准备完整导出视图”和“导出 PDF”两个入口。前者查看静态 DOM；后者通过本地集成应用编码、下载和预览真实 A4 多页 PDF。两者使用本地合成数据；验收不代表真实 Relay/Java/DQE 联通或生产 PDF 编码器验收。

## 本地 PDF 端到端示例

从仓根运行 `pnpm --filter playground dev --port 5186`，打开上述地址，点击“导出 PDF”。示例中的“主要明细”和“补充明细”是内容分区组导航，分别显示经营明细及趋势、区域及项目分析；导出包含两个分组和全部 Tabs。

调用链：`RuntimeView.withExportView` → [示例编码客户端](../apps/playground/src/lib/report-pdf-client.ts) 将已准备 DOM 的外观和静态图表序列化 → [Vite 本地编码服务](../apps/playground/report-pdf-demo.ts) 用已安装 Chromium 编排 A4 多页 → Poppler 从实际 PDF 渲染第一页 → 浏览器下载完整文件并展示第一页预览。编码服务仅在页面试验场开发模式提供，限定本地同源请求、禁止文档脚本及远程资源，临时文件在结束时清理；不进入引擎或生产构建。

默认查找本机 Playwright 缓存中的 Chromium headless shell；也可用 `MC_PDF_CHROMIUM` 指定已安装的 Chromium 可执行文件。预览使用 PATH 中的 `pdftoppm`，也可用 `MC_PDF_RENDERER` 指定路径；缺失时明确报错。这个接入示例覆盖当前报告的竖向 A4 分页，宽分区明确拒绝；生产编码器对任意宽分区的横向编排仍需消费 `wideElements` 并独立验收。示例用文字色替代封面的渐变文字，并按纵向内容流分页，避免 PDF 合成器的渐变描边及 Grid 分页重叠。

部署 Adapter 的日期身份证明提供方可以返回 `timeIdentities`（按数据源 ID）和 `timePointFields`（按数据源 ID/查询字段，含 granularity、valueFormat、identity），证明必须绑定精确页面摘要和 DQE 验证基线。未提供时算法保持独立日期身份；字符串月份分区不由模型猜测。真实部署接入由集成应用/Relay Adapter 配置，不改变 Java 页面资产接口。
