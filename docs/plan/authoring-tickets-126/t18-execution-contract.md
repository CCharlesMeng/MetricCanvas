# T18 / #144 执行消费与精确预览契约

S2 任务 `01a09f69-a06b-7703-b87b-ccdfe05d765e`，分支 `codex/s2-execution-consumer-144`；从已验收 #143 `be73806a0120d0826fd57a0edf62745760d5561a` 开始，消费 #134/#135/#139/#140 后共同基线为 `155346f2eae7c5dc8d9e35c8613f69ffa15de22a`。页面协议保持 6.2，四交付物候选版本统一 `1.0.0-rc.4`。

## 端口和边界

`@metriccanvas/engine` 与 Embed ESM/IIFE 暴露 `loadExecution`、`prepareExecution`、`ExecutionError`、`createLastFilterRecorder` 及相应类型。执行端口采用 T04 内部提案，具体 HTTP、metadata 解析、鉴权、参数提取、权限裁决及跨客户端历史并发属于提供方适配器。未接端口时 `loadExecution` 返回 `CAPABILITY_UNAVAILABLE`；拒绝响应不能转成无条件查询或旧服务降级。没有新增在线地址或替代服务。

请求为 `{target, operationId, explicitInputs}`。target 是精确 draft / candidate / template 引用；后两者必须含 `source:{pageId,revisionId,resourceId}`。加载器在调用前复制请求，回执以原请求核对，前后检查 AbortSignal。目标、操作键及页面 id 错配拒绝。

响应为 `{status, target, operationId, executionId, document, appliedInputs, filterValues, conditionKey, dataSources}`。document 必须通过完整页面校验；实际参数必须符合声明，必需参数不能缺失，筛选必须符合声明且与 `initialParam` 的实际值一致。实际值由权威服务按显式输入→有效历史→默认→允许范围回退裁决；浏览器只消费回执，初始化时不再读取 URL 或套用模板默认。测试四类固定回执，不实现权限优先级算法。

`conditionKey` 是服务提供的不透明关联值，每个数据源须相等。数据源清单须恰好覆盖文档全部 query 数据源。成功源 `{status:'success', rows, conditionKey, totalCount?, rowFormat?}`，空数组是空快照；失败源 `{status:'error', error:{code,...}, conditionKey}`，不得同时有 rows。查询分页成功源必须给出合法 totalCount。顶层状态对应全部成功 `success`、混合 `partial`、全部失败 `error`。这是当前消费约定，须提供方确认，不能视为已冻结的线上 DTO。

`rowFormat` 默认 `page`，行字段以页面字段 id 命名；显式 `query` 使用已声明 queryField 映射。两者均经过现有 `normalizeQueryRows`，字段映射/类型失败只隔离该源，沿用 `DQE_FIELD_MAPPING_ERROR` / `DQE_ROW_CONTRACT_ERROR`。服务错误只接受现有分类或 UNKNOWN，展示脱值消息，不展示提供方原始 message。顶层状态按提供方逐源状态校验，客户端行校验失败可再将对应成功源降为错误快照。

## 统一运行时接入

宿主把经过 `prepareExecution` 的 bootstrap 作为 RuntimeView/Embed `execution` 传入，同时传入其原始 document。文档与 bootstrap 不匹配时拒绝渲染。bootstrap 保留实际 params、filters 与数据快照；不保存参数替换后的运行副本，不改历史 hash。

编排器只在当前筛选与 bootstrap 筛选一致、且该源初始化后的查询和字段定义一致时采用执行初始快照，不重复查询，包括空集及失败源。旧 `source.initial` 不与新执行结果混用。查询/筛选变化重走既有数据网关；后续筛选不会被原始参数覆盖。来源键只验证客户端定义未变，不能证明服务确实按权限/条件执行；该保证仍须真实提供方证据。

后续筛选、分页等仍需要现有 DataGateway。无 execution 的入口保持现有初始化行为；execution 不是可跨页面、修订或身份复用的缓存。

## 精确修订预览

`RevisionPreview` 新增可选 `executeRevision(loadedRevision, signal): Promise<ExecutionBootstrap>`。先由既有 reader 读取指定 pageId/revisionId，再把完整已读修订交适配器；回执必须是同 pageId/revisionId/resourceId 的 draft target。旧请求在切换、重试或卸载时取消，读取和执行两个阶段都丢弃迟到结果。未注入执行器时保留旧精确修订预览。

本票没有把未确认的精确读取能力变成可用：原始持久化文档 hash / 引用核验仍在可信读取边界，适配器不得用 latest 冒充精确修订。当前 hook 为 S1/#145 对接点，不宣称线上端点已接通。

## 最后筛选记录

可信宿主创建 `createLastFilterRecorder({actorId,workspaceId,targetMetadata,clientId}, port, onStatus)`，把 `record` 交 `prepareExecution` 第三参数。首次初始化不记录；之后每次页级筛选变更都发送完整 filterValues、独立 operationId、单实例递增 clientSequence。归属固定，不能来自页面文档或模型。宿主在切换身份、工作区、metadata 或销毁时调用 dispose，并为新实例生成新的 clientId。

只有当前最大序号的有效回执更新记录状态；错误、未知/错操作键回执报告 failed，缺能力报告 unavailable。失败和观察者异常不回滚筛选、不重初始化、不重发。dispose 取消在途并忽略迟到回执。本地序号隔离不等于服务器写入有序；服务仍须阻止旧请求覆盖新记录，并对跨实例并发提供版本裁决。刷新复用历史前重新校验权限属于服务权威。

## 后续验收

本仓证据在 t18-evidence.md。#145 可消费上述执行/预览接缝，但仍依赖 #138/#140；S0 分别记录本仓回归、提供方确认、真实环境联调。#103/#104/#105/#106 的真实异构消费、部署、Java/Relay 权限与历史记录保证不由本票关闭。
