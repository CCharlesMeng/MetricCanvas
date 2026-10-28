# 表头筛选自适应宽度验收

2026-10-23，入口 `/pages/decision-opinion-details?business-type=all`。使用既有合成数据与正式表格。旧 URL 参数不参与本次筛选。

原因为 OS 主题弹层最小宽270px、候选容器最小宽220px。多选弹层改为内容宽度，保留160px可操作下限，最大360px，视口两侧各留8px。搜索框随容器伸缩，长候选换行。数值/日期区间维持原有样式。

实际浏览器读数（CSS px）：

| 场景 | 弹层宽度 | clientWidth / scrollWidth | 结果 |
| --- | ---: | --- | --- |
| 修改前合同/商务 | 270 | — | 复现过宽 |
| 修改后合同/商务 | 160 | 160 / 160 | 收紧，无横向溢出 |
| 长短候选混合 | 360 | 360 / 360 | 超长文字高度约42px，换为两行 |
| 搜索后仅15字候选 | 265.94 | 266 / 266 | 随内容收缩 |
| 数值区间 | 270 | 270 / 270 | 两个输入各约114px |

长候选通过 `/preview` 的“Page JSON 编辑器”加载 `width-fixture.json`，来源为现有列候选页，替换两条合成记录；临时页验后关闭。正式入口验证候选搜索、清除恢复256条、勾选合同后128条，截图为 [compact-filter.jpg](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/decision-opinion-preview/compact-filter.jpg)。

本次只修改样式、添加纯样式模式类。按 `metriccanvas-ts-ast/1` 口径，无新增或修改脚本函数，不存在函数前后CC变化，不伪造函数测量；无本次复杂度未关闭项。

检查：`pnpm --filter @metriccanvas/engine check` 通过，Svelte 0错误0警告；`pnpm authoring:contracts` 与 `:check` 通过；local-authoring Skill与页面参考回归2文件28项通过；仓外完整安装副本校验页面通过，无外部软链接（[width-installed-validation.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/decision-opinion-preview/width-installed-validation.json)）；`git diff --check` 通过。页面语义文档、Playground操作说明和派生Skill知识同步。未改变查询或筛选语义。
