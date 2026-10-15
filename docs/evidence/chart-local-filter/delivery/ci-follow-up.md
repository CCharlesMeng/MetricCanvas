# 安装消费者呈现矩阵修正

首笔功能提交 ec3e46254bf6598306111ab655c9d114af83bdb9 已核对远端 main。CI [38751915636](https://github.com/CCharlesMeng/MetricCanvas/actions/runs/38751915636) 的 types、build、tests、authoring 均通过；compatibility 为 239 通过、17 失败。

失败中的 16 项来自通用呈现矩阵：参考生成器按最小合法页面选中带 Dashboard 独立筛选的地图示例，矩阵强制将其 layout 改为 Report，触发正确的“图表筛选只用于 Dashboard 正文图表”拒绝。功能专用 chart-local-filter 用例在真实安装包的 Chrome、Edge 共 6 项全部通过，未改变协议限制。

矩阵的 53 个组件分支现统一使用去除 Dashboard 专属控件的呈现投影：仅删除控件及其对应筛选声明、查询绑定，再完整 normalize/validate。功能专用用例仍原样消费正式页面并保留筛选配置。其余属性和布局覆盖保持原值。

另 1 项失败属于 PDF 的浏览器启动标签断言，已由并行提交 fce08986 修复；本批基于该提交继续，不重复修改。

本地重跑当前 embed 构建的 Report 8 项、Dashboard 8 项（1440/390，default/plain/panel/card，Chrome）全部通过。`pnpm --filter @metriccanvas/embed check` 通过，Svelte 0 错误/0 警告。最终完整安装消费者结果以本次修正提交的 CI 为准。
