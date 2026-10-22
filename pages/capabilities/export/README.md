# pages/capabilities/export

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 报告 PDF 下载、按钮与动态文件名

入口：`/pages/report-pdf-export`；[页面 JSON](report-pdf-export.json)。

启动：`pnpm dev:playground`。

提交月份后下载整页 PDF，正文与文件名使用已应用月份；对照默认按钮及未启用状态。

合成演示

可直接体验

1. 提交报告月份，点击下载经营报告，检查 PDF 包含全部 45 行。
2. 比较默认下载按钮和未启用下载的页头；任意按钮均下载整页。

日期工具带不进入 PDF；浏览器需支持 Worker、ImageBitmap、OffscreenCanvas 及 Blob Worker。

关键声明：`sections[].components[].props.pdfExport`, `filters`。

关联：[report-png-export](report-png-export.json)。

关联：[report-png-long-export](report-png-long-export.json)。

关联：[report-export-scale-fallback](report-export-scale-fallback.json)。

## 报告 PDF／PNG 导出与清晰度

入口：`/pages/report-png-export`；[页面 JSON](report-png-export.json)。

启动：`pnpm dev:playground`。

同一页头配置 PDF 和 PNG 按钮，点击直接下载；文件名与正文期间同步。

合成演示

可直接体验

1. 提交月份，分别点击导出 PDF 和导出图片。
2. 比较默认与 4 倍按钮；PNG 应保存为一张完整图片。

倍率由元数据固定；长图和无效倍率通过关联场景单独体验，合成数据不证明真实门户接入。

关键声明：`sections[].components[].props.exportButtons`, `filters`。

关联：[report-pdf-export](report-pdf-export.json)。

关联：[report-png-long-export](report-png-long-export.json)。

关联：[report-export-scale-fallback](report-export-scale-fallback.json)。

## 报告导出变体｜完整单张长图

入口：`/pages/report-png-long-export`；[页面 JSON](report-png-long-export.json)。

启动：`pnpm dev:playground`。

将 140 行明细导出为一张完整长 PNG，下载范围包含当前分页外的数据。

合成演示

可直接体验

1. 查看表格当前显示行数，再点击导出图片。
2. 打开下载文件，检查 140 行均在同一张长图中。

内部可能分块处理，但最终文件是一张 PNG；不是对当前可见分页截图。

关键声明：`sections[].components[].props.exportButtons`, `sections[].components[].props.pagination`。

关联：[report-png-export](report-png-export.json)。

关联：[report-pdf-export](report-pdf-export.json)。

## 报告导出边界｜无效清晰度回退

入口：`/pages/report-export-scale-fallback`；[页面 JSON](report-export-scale-fallback.json)。

启动：`pnpm dev:playground`。

给导出配置无效倍率，观察仍可下载，并使用 PDF 2 倍、PNG 3 倍默认值。

合成演示

可直接体验

1. 查看关键配置中的 PDF 99、PNG 2 和旧 PNG 字符串倍率。
2. 分别点击按钮，核对默认回退；像素尺寸由自动浏览器测试检查。

这是边界场景；首次接入应参考主导出示例中的有效配置。

关键声明：`sections[].components[].props.exportButtons`, `sections[].components[].props.pngExport`。

关联：[report-png-export](report-png-export.json)。

关联：[report-pdf-export](report-pdf-export.json)。
