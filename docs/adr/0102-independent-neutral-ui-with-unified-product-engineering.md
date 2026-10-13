---
status: accepted
date: 2026-10-12
note: 用户确认 Q14–Q21；UI 独立版本，同仓工程；部分修订 ADR-0071
---

# MetricCanvas UI 独立版本并共用产品工程

平台需要页面资产管理工具面，统一运行时仍拥有报告与看板的内容视觉。页面 Table 消费页面协议、数据槽与字段格式，不能作为资产目录的中性表格；将基础控件留在引擎会让 UI-only 消费者安装图表与领域依赖。用户选择保持 Svelte，按 TinyVue OS Theme 的固定官方基线还原所需控件。

新增第五个交付物 `@metriccanvas/ui`（`packages/ui`），提供受控中性值、选项、行列、焦点、键盘与浮层。UI 不依赖 page、engine、DQE、ECharts、页面资产或创作会话；页面协议属性类型仍归 page。平台和引擎向下消费 UI。普通页面 Table 不在本轮整体替换，DatePicker 提取保持既有视觉和页面筛选语义，领域校验留在适配器。

部分修订 [ADR-0071](0071-four-release-artifacts-with-standalone-page-protocol.md)：公开面门禁覆盖五包，page/engine/metric-canvas/embed 四包继续锁步；UI 独立 SemVer。工程共用同仓 workspace、锁文件、Svelte 打包、质量命令和 CI。产品组合使用已验收 UI 的精确版本；UI 版本不进入页面 Schema 或 Bundle 的产品契约版本。UI-only 与 page-only 仓外消费分别证明无反向依赖，最低与当前 Svelte 分别验证，不以工作区源码导入代替 tarball 消费。

UI 固定视觉资源随控件发布，平台不提供任意 theme 入口、不广域覆盖 RuntimeView；样式和浮层保持原挂载根。管理与 UI 分开 SDD Story，官方版本、状态、图标与资产摘要可追溯。独立包建设不改变 [ADR-0066](0066-self-contained-rendering-engine-host-boundary.md) 对引擎内容视觉的所有权。

人工修改持续在本地保护，明确保存才提交远端；AI 沿用工具单次提交。工作会话由平台实例拥有，内部切换不销毁工作，恢复作用域绑定身份、workspace 和服务目标。未决操作保持原身份并停发；新格式不自动重放旧未知记录。

Java 页面资产服务由外部提供方拥有。按已确认 Q19，先实施 UI 与服务确实支持的旅程；发布隔离、历史正文、追加恢复、整体删除和全目录查找未获保证时不开放目标动作。[ADR-0080](0080-java-assets-single-attempt-save-and-status-publication.md) 当前服务事实不因界面存在而被改写。提供方保证与真实服务验收另行落实。

实施与追溯：[主计划](../plan/2026-10-12-platform-ui-management-implementation.md)、[工程 Story](../plan/platform-ui-management/requirement-frontend-design.md)。决策已接受不代表视觉、仓外消费、CI 或真实门户全部已验证。
