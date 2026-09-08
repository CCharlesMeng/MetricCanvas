# #113 公开面收口验证（2026-09-08）

## 改动与边界

- 承接 `10f3db4` 的页面协议主入口收窄与 `de8c645` 的明细实现迁出；不重新设计四个交付物。
- RuntimeSurface 在解析文档前检查页面声明的协议版本。超出支持区间时停止渲染和取数，发出独立 `version-error` 事件，包含 requiredSchemaVersion、currentSchemaVersion、supportedSchemaVersions、message。版本字段均指页面协议版本，与 npm SemVer 无关。
- 缺失或格式非法的版本仍由页面协议校验并发出 `invalid`；更新为受支持的文档可恢复查询与渲染。RuntimeView、MetricCanvas 与 embed 共用此实现，embed 继续以 RuntimeViewEvent 为事件真源。
- 页面协议 ERROR_TYPES 及跨语言契约没有变更。新事件是运行时能力失败，不扩展 TypedError 闭集。
- #125 删除旧服务链时，原服务端开发期明细实现一并退出。本次把原脱敏、环境和采样实现迁至平台浏览器工作台并接到现有注入式 DQE 网关；不恢复旧服务端链。
- 工作台仅在开发构建且 VITE_DQE_DEV_DETAIL=1 时把脱敏后的生效 DQE 项写到浏览器 debug 控制台，VITE_DQE_DEV_DETAIL_SAMPLE_RATE 控制采样。默认关闭。精确修订预览仍使用默认正式渲染网关，不消费该开关。
- 引擎仍仅公开 DqeDevDetail 的 record 接口，无实现。工作台接入位于私有 application-runtime 与 platform，不新增引擎顶层导出。

## 验证

| 检查 | 结果 |
|---|---|
| pnpm test | 131 个文件通过 / 1 跳过；958 个用例通过 / 12 跳过 |
| pnpm check | 全仓通过，Svelte 0 errors / 0 warnings |
| VITE_DQE_DEV_DETAIL=1 pnpm build | embed ESM/IIFE、平台构建通过；平台仍为 adapter-node |
| 浏览器版本失败回归 | Chrome 上 ESM/IIFE 两项均通过；7.0、6.1、5.4 失败且无查询，6.0 恢复真实网关取数，bad 分类为 invalid |
| 平台明细回归 | 显式启用可记录；业务取值、身份头、结果均不进入记录；生产、默认关闭、零采样、非法采样均不记录；正式渲染网关不消费开关 |
| 实际纯渲染构建隔离 | 模块图不加载平台明细实现；产物无明细实现名称、输出标记或脱敏占位值 |
| 平台与 embed 生产 JS 检查 | 扫描 72 份 JS，四种明细实现/输出标记均为零，即使构建时传入启用开关 |
| 公开面快照 | 通过，无新增导出名；RuntimeViewEvent 的联合分支显式增加 version-error |
| authoring:contracts:check | 183 product / 4 authoring / 1 interface 文件一致 |
| authoring:check | 既有 Python venv 下 460 digest checks、153 tests 通过 |

浏览器测试移除了示例自带的首屏快照，并提供符合分页契约的 totalCount，确保恢复证据来自真实网关调用。全仓测试与 Bundle 回归需要本地监听/进程通信，沙箱下相关检查被拒绝；在沙箱外重跑上述检查后通过。

## 待对齐

#113 正文要求主入口导出 ERROR_TYPES，而 `10f3db4` 已明确将其留在 internal，公开消费者使用 TypedError['type']。本次保持现有主入口，已向用户提出这一规格差异，待确定是否保留收窄或恢复数组导出。该项未定前不关闭 #113，也不将 #114–#116 的交付前置宣称完成。

#105 外部接口、#104 静态部署、#103 真实集成与发布均未由本次验证替代。
