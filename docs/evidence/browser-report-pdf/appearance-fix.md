# PDF 下载背景与完整图表复验

2026-10-14，本记录补充此前下载验收：原来的 DOM 行数和图表外框尺寸检查不足以证明背景、完整数据范围已进入 PDF。

## 原因与修复

- 静态导出视图固定白色画布，丢失当前页面的背景；现在捕获 `.page-content` 的主题、背景颜色与背景图像，静态视图继承该背景。A4 内容内边距由静态视图自身管理。
- 独立编码文档只复制普通元素的计算样式，遗漏组件伪元素的背景与装饰；现在将有内容的 `::before`、`::after` 计算样式作为局部规则保留。
- 静态 ECharts 沿用交互图表的 `dataZoom`，53 项数据只绘出 20 根柱子；现在静态模式移除缩放窗口，冻结全部数据范围。交互模式继续保留原来的窗口。
- 静态横轴首尾类别文字向绘图区内对齐，默认标签允许避让，显式全部标签的呈现策略继续保留。

## 证据

复现与回归命令：

```sh
node apps/playground/tests/report-pdf-appearance-browser.mjs /tmp/metriccanvas-pdf-appearance
node apps/playground/tests/report-pdf-browser.mjs /tmp/metriccanvas-pdf-fixed
pnpm exec vitest run apps/playground/tests/report-pdf-pagination.test.ts packages/engine/widgets/tests/axis-formats.test.ts packages/engine/widgets/tests/explicit-presentation.test.ts
pnpm --filter @metriccanvas/engine check
pnpm --filter playground check
pnpm --filter playground build
```

新增浏览器回归在图表冻结时分析真实 Canvas 像素：修复前 53 行只绘出 20 根柱子，修复后绘出 53 根；独立编码文档的画布背景由白色恢复为与页面一致的 `rgb(218, 234, 255)`。通过真实下载编码路径复验伪元素渐变背景，采样点由白色恢复为蓝色和绿色。

检查实际下载 PDF 的八页渲染，包含封面背景、画布颜色、159 行明细及完整趋势图。原有九项下载回归通过，包括 500 行长表、重复下载、编码失败、页面更新、图片加载失败与取消清理。22 项分页与图表呈现测试通过；引擎及页面试验场检查均为 0 errors、0 warnings，页面试验场生产构建通过。

浏览器使用 Chromium，数据为本地合成数据。本记录不证明其他浏览器或真实 Relay/Java/DQE 接入；没有执行提交、推送或部署。
