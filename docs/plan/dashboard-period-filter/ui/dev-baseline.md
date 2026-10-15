# 执行基线

用户已于 2026-10-15 批准主计划并授权实施，不重复请求阶段审批。基线源为已确认文字规格，视觉继承 UI baseline PATTERN-COMP-1 / PATTERN-STYLE-1。原型只作用户意图证据，不复制原型实现或另造 Dashboard 外框。

工作区原始源码保存在 /tmp/metriccanvas-period-baseline-20261015，manifest.json 保存逐文件 SHA256；HEAD 为 ea6e453efa6bab0d580d31bd80baa2fcf979f01f。该快照包含并行未提交基线，交付仅列本次增量。

## 工程依据

采用 PATTERN-STRUCT-1、PATTERN-COMP-1、PATTERN-DATA-1、PATTERN-STYLE-1、PATTERN-TEST-1、PATTERN-RUN-1。

## QA 基线

冻结于用户批准主计划的 2026-10-15，标准为 Story 文字规格及主计划验收 1—10。R1 顶部单控件／四档顺序；R2 Q1—Q4 和近一年短范围；R6 窄容器不溢出／不重叠／浮层可达；F3 历史期间恢复、闰年、相同范围模式变化、跨月；F4 实际请求范围与原聚合不变。无视觉豁免，不声明原型 Dashboard 外框像素还原。

## 执行起点（环境）

基线为上述逐文件快照。正式页面浏览器使用仓内 embed 静态服务及 Chrome，DQE 为合成响应；真实 DQE／Relay／Java／模型不在本地环境中。Edge 浏览器未安装，保持未验证。
