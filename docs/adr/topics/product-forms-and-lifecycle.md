# 产品形态谱系与两速生命周期

> 问数、探索、报告、Data App 共用一份页面文档；临时页面态与资产态的两速生命周期，以及分析会话的归属。

**现行结论:** 产品形态不只有看板。问数(Ask)、探索(Explore)、报告(Report)、Data App(App)与未来的监测(Monitor)共用**同一份页面文档表达**,页面文档同时是 Data Agent 与 Data App 的**汇合点**(0033 挂起计算数据集后,汇合点从计算数据集回落到页面文档)。生命周期分两速:问数与探索产生**临时页面态**——一份通过页面校验、由现有统一运行时直接渲染的页面文档,不进入页面仓储、不产生页面修订、不占页面目录、不参与发布治理,并使用临时页面 id;只有用户显式要求沉淀时才进入资产态。

沉淀分两个方向,时间语义相反:沉淀为 App 走 `saveRevision`,页面时间必须是结构化相对时间(ADR-0035)才会随周期滚动,且若含临时指标需过 ADR-0036 的门槛;沉淀为 Report 则**保留查询定义与内嵌初始行、不声明筛选绑定**——按 ADR-0020,默认状态下存在内嵌初始行且无筛选变化时统一运行时不重新查询,报告因此天然冻结在采集时点,同时保住口径溯源。Report 不新增数据源类型或渲染路径。

问数的 NL2DQE 发生在创作期,统一运行时收到的始终是已经确定的页面文档,因此"统一运行时不执行 NL2DQE"这条不变式原样成立,并未因新增形态而放宽。当前实现由 Platform 承载,ADR-0060 的目标形态改由 Relay/Skill 与 Python Tool 承载,但创作期/运行期分界不变。**分析会话已裁决为服务端一等概念:** 保存 `sessionId`、追加式步骤事件流与一份最新**会话检查点**;步骤事件解释过程,检查点恢复已校验临时页面态、结构化续跑状态、组件钉住结果与待确认交互。它不是页面修订,不进页面仓储或发布治理;不保存完整对话文本、模型 prompt 或原始 `outcome.messages`。会话按 90 天保留,仅平台管理员与本人可见;身份当前允许 mock,但 mock 必须提供多个可切换用户且按 `actorId` 的可见性过滤必须真实执行,接入真实身份是上生产的前置条件。**ADR-0064 已把目标所有权裁决给 Relay Session:** Relay 保存步骤事件和最新检查点,完整页面构建产物经双通道 Adapter 写检查点并供 Svelte 读取,模型只见摘要;Java 不复制会话。Monitor 当前不建设,其依赖(调度、基线、稳定指标口径)已记录,其中稳定口径由 ADR-0031 承载、每期重算由 ADR-0035 承载。

**平台创作的证据、工作稿与工具内保存([ADR-0083](../0083-platform-evidence-work-and-internal-draft-save.md)):** 部分替代 0064 与 [ADR-0079](../0079-trusted-authoring-turns-gate-content-tools.md) 的「平台不保存」与候选选择——0079 的可信创作轮次约束内容工具、最新页面与模型上下文分通道继续生效,被替换的只有平台不保存与候选选择这一段;v2 查询后分析,授权的有界证据进入模型,完整产物留在程序侧;单份工作稿加冻结提交快照,compose/edit 内部单次保存合法有效变化及 partial。ADR-0080 的「未知写入保留工作并停止、不以新操作重发」继续适用。Relay 预览工具与两个占位符保留,**普通问数仍不自动保存**,本节前述临时页面态边界不变;真实部署仍须外部接线验收。

来源:[ADR-0030](../0030-transient-page-state-for-ask-and-explore.md)、[ADR-0058](../0058-latest-session-checkpoint-restores-transient-page-state.md)、[ADR-0009](../0009-node-postgres-platform-beside-runtime.md)、[ADR-0021](../0021-page-id-is-not-a-rendering-switch.md)、[ADR-0020](../0020-embedded-initial-rows-and-query-pagination.md)、[ADR-0022](../0022-page-data-sources.md)、[ADR-0035](../0035-structured-relative-time-expressions.md)、[ADR-0036](../0036-metric-gap-non-blocking-exit.md)、[ADR-0060](../0060-static-svelte-java-page-governance-relay-python-authoring.md)、[ADR-0064](../0064-agent-returns-page-artifact-relay-and-java-own-persistence.md)、[ADR-0083](../0083-platform-evidence-work-and-internal-draft-save.md)。
