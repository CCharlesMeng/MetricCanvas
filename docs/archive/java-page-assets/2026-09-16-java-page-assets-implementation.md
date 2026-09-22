# Java 页面资产接入实施计划

依据：`2026-09-16-java-page-assets-architecture.md`，用户已批准实施。范围不包含 execute、筛选历史或外部 Java/Relay 服务代码。

- [x] A：独立内部资产契约，集中 Java Adapter；资源 ID 定位、分页列表、读取、保存、历史、回退、删除；配置与 DQE 解耦。
- [x] B：平台组合入口接入单次自动保存，持久化发送状态，未知结果不重发；现有记录隔离与资源范围保护。
- [x] C：Python 生命周期单次保存和当前读取；可信候选提交消费保存回执，不再强制远端 lookup/精确回读；结果交接不重复保存。
- [x] D：列表→新建→编辑入口、简单发布、历史摘要/指定回退、删除接线。
- [x] E：更新 ADR/架构说明与 Skill 行为，测试 Adapter 契约、超时/重启、身份/基线和架构依赖，检查分发锁。

每项完成后在本文记录证据和实际限制；不以替身测试推断真实 Relay 事件协议或 Java 运行事实。保持既有组件和页面协议，不做视觉还原。


## 实施结果

- `apps/platform/src/lib/page-assets/contract.ts` 定义内部资产接口；`java-adapter.ts` 集中 URL、Java 字段与错误映射；`page-assets.ts` 是生产组合入口。旧 `page-assets-client.ts` 仅保留兼容导出，不再承载业务实现。架构测试禁止 Java 页面字段泄漏到其他平台源文件。
- `single-save.ts` 接入既有串行创作队列。format 2 记录发送意图与成功快照，未知/冲突停写；旧未决记录保留且禁止重放。已确认的人工/AI 回执不会被陈旧 GET 覆盖，回退则替换该本地投影。
- 列表保留同 pageId 的不同资源；编辑/历史/删除携带 resourceId，旧链接歧义时报错。发布沿用同一保存队列，普通编辑重新保存为草稿。历史只展示摘要，不伪造历史正文。
- Python `KnownLifecycleHttp` 支持单次 POST/PUT，`AuthoringSubmissionCoordinator` 的持久执行声明控制唯一发送者。MCP 单独调用不能绕过声明；程序回执通过 programToken 交付，前端直接应用后不再保存。
- `dialogue/authoring-integration.ts` 提供部署注入接缝，复用盘古对话输入，不新增第二个聊天面板。真实 Relay 的 prepare/run/lookup/read 与 SDK 回调由部署侧映射，契约见 `apps/platform/src/lib/dialogue/README.md`。
- 开发入口尊重已注入配置，不再强制改写为灰度地址；未注入时使用原配置模块的本地默认地址。资产配置不再要求 DQE endpoint，execute 仍属于运行态。
- ADR-0080、领域词汇表、方案、Skill 主文/参考和分发锁已同步。Java 未返回的审计字段保持可选，不补造哈希或创建人。

## 验证与边界

- 前端自动化：平台测试及共享配置回归 371 项通过、1 项跳过；涵盖目录歧义、资源编码、发布状态、历史/回退/204 删除、未知结果不重发、管理操作重启与身份变化、AI 直接回执、陈旧 GET 重开与架构依赖。
- `pnpm --filter platform check`：Svelte/TypeScript 检查通过，无错误或警告。
- `pnpm --filter platform build`：静态构建通过。
- 最终 Python 全量 431 项通过，包括回执状态元信息与单次提交验证。
- `apps/platform/tests/workbench/java-assets-browser.mjs`：真实浏览器运行本地应用，Java HTTP 使用拦截响应；目录→编辑→自动保存→发布→重开→历史回退/删除→新建空态通过。测试阻断外部来源，不访问灰度服务。
- 合约导出及 bundle 摘要校验通过。完成 1473 项摘要核对。

这些证据不等同于真实 Java/Relay 联调。新建的真实 AI 旅程依赖部署侧注入可信创作程序 Adapter；本仓已经验证候选单次 POST 和前端结果交接两个边界。未知写入需要人工核实，不提供自动重试；回退跨窗口并发限制沿用 YAML，不承诺独立发布副本。兼容强保存代码仍供旧契约测试使用，不是生产降级路径。
