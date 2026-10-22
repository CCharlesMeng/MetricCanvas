# IOC Header 默认底部间距

2026-10-22，本地基于 `c370e791`，工作区同时保留已确认的指标卡和柱宽改动；本批尚未提交。

## 调整与归属

- 原因：IocHeader 只有内部 padding，缺少底部外间距；旧 Dashboard 将间距放在正文容器，新显式页头路径没有继承。
- IocHeader 自带 `margin-bottom:16px`，普通行内、上下排、紧凑及 staticView 共享，不新增页面字段。
- RuntimeSurface 去掉正文原有 16px margin 与旧紧凑容器的 16px 顶部 padding，防止重复。
- ExportView 将正文节间 gap 放入独立布局容器，页头与正文只使用组件提供的间距。
- 页面协议文档、PAGE-METADATA、示例说明及生成的 contract / local-authoring 知识均已同步。

## 本地证据

DOM 测量保存在 `measurements.json`。IAB 的截图视口与窗口缩放不等同，以下采用实际 `innerWidth`：

| 场景 | 实际宽度 | 页头底部到正文 | 其他 |
| --- | --- | --- | --- |
| ioc-header-demo 桌面 | 2304px | 16px | 组件 margin-bottom 16px |
| ioc-header-demo 窄屏 | 390px | 15.996px | 子像素舍入，无横向溢出 |
| ioc-opportunity-analysis 紧凑页头 | 1280px | 16px | 正文 padding-top 0px |
| ioc-project-detail 隐藏页头 | — | 无页头占位 | 页头数量 0，正文 margin-top 0px |

截图为 `ioc-header-desktop.jpg`、`ioc-header-390.jpg`。staticView 的布局由共享组件和 ExportView 源码、编译及导出回归覆盖，未声称完成真实 PDF 像素验收。

验证通过：6 个测试文件 / 55 项测试（页头、运行时构建、导出状态、页面引用、local-authoring 工具及独立 Skill）；engine 与 Playground 检查均为 0 errors / 0 warnings；Playground 生产构建通过；authoring contract 生成一致性通过（1020 product / 4 authoring / 1 interface）。

## 复杂度

按当前仓库 `docs/agents/code-complexity.md` 的纯样式豁免口径：本批修改 CSS 与一个静态布局容器，脚本函数和模板条件均未改动。新增可执行函数 0、修改可执行函数 0，函数 CC 前后不适用；未增加可执行分支，无本批复杂度未关闭项。此前柱宽改动的复杂度与验证见相邻 `chart-default-bar-width-2026-10-22/acceptance.md`。

## 合并最新 main 后交付

交付时 main 已推进至 `53eccb7f209147711692ae0427a543608b85ff5d`。保留其 Tab 混合内容、卡片呈现、导出 summarySnapshot 及默认柱宽实现；预测变体按用户本批明确要求从 40px 统一为 16px。冲突后的文档和知识清单从真源重新生成，1064 product / 4 authoring / 1 interface。

目录门禁发现上游内部能力 ID 与正式示例页面 ID 同名：将内部能力名从原值改为 `tab-content-layout`，同步版本断言及生成的独立校验器，不改变示例 URL 或功能。命名修复未新增函数，版本断言回调自身 CC 58 → 58（既有连续版本断言，保留以避免扩大本批范围）；完整测量见 version-complexity-before.json / version-complexity-after.json，其余源码函数均未修改。该存量测试复杂度仍由后续复杂度治理计划处理。

新基线验证：核心 10 文件 / 87 项通过；目录、页面中立性、版本及 local-authoring 6 文件 / 63 项通过；engine、page、Playground 类型检查通过；生产构建及 authoring 生成一致性通过。合并后实际页面仍为 Header 到正文 16px，指标与图表正常，截图 merged-main.jpg。仅文档和交付证据在验证后补充；提交、远端 SHA 与 CI 结论单独报告，不以前述本地通过代替。
