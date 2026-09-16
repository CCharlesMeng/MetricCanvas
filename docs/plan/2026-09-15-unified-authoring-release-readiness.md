# 统一创作交付、内部迁移与 S8 就绪边界

日期：2026-09-15。本记录不批准生产切换。代码在独立实施分支，本地验收与真实提供方验收分别记账。产品实现冻结版本为09982cb；新版runner集成冻结e526358，见[runner证据](2026-09-15-unified-authoring-runner-evidence.md)。完整三层状态和产品HEAD验收见[验收记录](2026-09-15-unified-authoring-s6-s7-evidence.md)。

## 2026-09-16 接口核查补充

下述冻结版本和 F1–F17 是先前验收记录，不能据其 blocked 状态推导“本仓消费者未实现”或“提供方没有接口”。代码已合入 main；本次逐项事实、现有接线和剩余验收见[提供方核查](2026-09-16-provider-integration-audit.md)。#105 的目录/详情/普通新增更新已具资料和 TS 消费者，Python 当前匹配读取也已存在；强保存/原操作查询/不可变精确读取仍无真实验收。#108 的本地页面状态已有工作台消费者，生产精确草稿 reader 仍未开放。真实模型与生产切换状态不变。

## F1–F17 迁移清单

来源版本统一为架构调查引用HEAD `aef4400d`；未直接取得内部Java/前端/业务源码、真实凭据或规则原文。下表“本地证据”仅描述本仓可验证替代接口，内部迁移状态全部为 **blocked：待提供方事实与逐项验收**。不得根据本表宣布内部功能已搬迁。

| ID | 原职责／目标接口 | 兼容要求与本地验证 | 尚缺真实证据 |
|---|---|---|---|
| F1 | define-report注册→同一canonical作者部署选择 | 唯一注册名、同Skill/服务/契约来源锁；S7装配 | 内部注册加载实际接受同源选择 |
| F2 | recall-report消费 | 独立消费；本次不改消费者 | 内部列表/打开/发布页执行回归 |
| F3 | Spec创建→受控组合；既有页→完整可信基线 | S5公开创建/新增保留手工页，S6混合组合 | 内部旧调用迁移、无Spec重建既有页旁路 |
| F4 | metadata CRUD→Lifecycle Adapter | S3最终稿自动保存、S4精确发布/恢复；模型无写工具 | Java事务/权限/精确引用与直接CRUD退役 |
| F5 | 数据发现→DataContext/SourceDescription ports | 查询hash/源版本/字段和刻度核验，缺失拒绝 | 内部用户权限、字段/源协议和刷新行为 |
| F6 | 组件选择→现有构造器与硬门控 | S5/S6受控操作；不支持组件拒绝，不生成假图 | 内部自定义组件schema/编辑/渲染整套版本 |
| F7 | 页面协议→唯一产品Schema/正反例 | 全量契约回归及TS/Python共用向量 | 内部旧页扩展结构语义与新旧消费兼容 |
| F8 | 业务词汇→独立业务解释扩展 | S7业务propose经discovery校验当前governed目标、来源版本和歧义；不改写Spec | 内部规则出处、来源版本及歧义/优先级实测 |
| F9 | 组织业务规则→独立解释扩展 | 可替换业务解释器，不允许公司字段覆盖核心或主流程 | 原职责边界、组织/权限规则真实用例 |
| F10 | 缓存/预览占位符→修订绑定预览端口 | S4保存回执/精确回读后才可打开，预览单独重试 | 实际缓存键、占位符及失效协议 |
| F11 | 可见工具→bundle服务/公开list_tools | 单一统一服务五工具，缺可信上下文明确不可用 | 内部Relay生产工具暴露与配置 |
| F12 | 对话工具投影→程序产物分流 | 完整候选/源证据不进入modelSummary | 真实Relay确实隔离产物；本地可信轮次runner已另行验证 |
| F13 | 历史测试资产→逐项审查H1–H15 | 未取得用例，不伪造恢复断言或通过率 | H1–H15原用例、对应事实和适用性 |
| F14 | 错误归一化→领域/Adapter错误 | 参数/冲突/取消/未知写入/源不支持分开；异常净化 | 真实服务错误码与阶段映射 |
| F15 | 操作身份/幂等→执行记录+Lifecycle | SQLite进程重建/丢回执、原操作查询、一次写入 | 后端幂等、原子查写、取消竞争实际保证 |
| F16 | 布局→共享creation/transition算法 | S6显式report/dashboard、顺序/span；既有页保持 | 内部容器/响应式实际渲染和自定义能力 |
| F17 | 内部业务时间→版本化规则扩展 | 通用解析保留；业务时间提案校验day/month/year，其他粒度及未支持规则拒绝 | 内部时间划分、参数/顺序及等价证明 |

## S8 必须先补齐的验收

| 门禁 | 当前证据 | 结论 |
|---|---|---|
| 真实模型与采样 | 新请求0；历史14例不是新版本结果；新版可信本地runner已完成并通过定向验证 | blocked，不能用确定性替身替代 |
| latest与本轮身份 | 本地工作台/可信turn契约覆盖 | 真实提供方blocked |
| 候选、程序通道、取消、预算 | 本地不可变候选/SQLite执行记录/故障回归 | Relay消费与共享模型预算blocked |
| 远端原操作查询、保存、精确回读 | 本地Lifecycle与恢复纵切，无重复写入 | Java强能力实测blocked |
| 内部数据源、格式、刷新 | 合成描述符/实际TS显示向量；未支持转换明确失败 | 内部源描述与真实刷新blocked |
| 发布、旧页扩展、回退 | 本地精确确认/发布重启；完整契约回归 | 实际新旧版本读写和H1–H15 blocked |
| 单写切换 | 本次无生产写入、未开放默认真实工厂 | 未执行，不能切换 |

真实模型请求曾被自动审批审查拒绝；所请求的是向api.deepseek.com发送评测请求。审查指出：一般性的有界评测授权没有明确授权把这类项目上下文发送到该目的服务。母任务已向用户说明并请求授权，未获新回复。本任务未重试、未绕过、未泄露凭据。

## 成组切换与回退操作顺序（尚未执行）

1. 冻结完整Git实现版本、bundle/contract-lock/bundle.lock、实际安装产物hash、Skill目录hash、部署注册名、Adapter/扩展实现版本和来源hash。保存上一组可用版本的相同清单；只回退文案不成立。
2. 在隔离工作区接通真实身份、latest、原操作查询及精确回读，验证产物分流与真实源语义。以同一已冻结版本跑真实模型及全部适用H1–H15，保留原始脱敏轨迹与失败。
3. 影子生成只能比较候选，不调用保存/发布；同根基线比较完整合法产物与用户意图，不能用生成hash相同作为全部语义验证。
4. 先证明上一组能够消费本组新产物及扩展字段，检查旧页读取、编辑与发布。无法兼容时保留原写路径，补迁移策略，不能试切生产。
5. 切换需由真实部署方停旧写入口，再启新单写入口，并保留所有未决操作记录。未知结果始终查询原operationId；回退不重新生成命令或另发写入。
6. 出现目标错配、内容丢失、原操作重复写入或未知状态被覆盖时停止新任务，保留证据与执行记录；由获授权部署方将整组版本回退。精确读取已保存修订并恢复未决任务后，才能恢复人工编辑。

本地SQLite路径不是生产后端保证，合成Adapter不能替代上述门禁；本记录交付可审查步骤，不声称已完成影子部署、真实回退或整体规格验收。

## 实施提交链

基线9d4f4444efc43f47d039d882b141207b915c8e9e；下列链条含各共享契约、消费者与历史证据提交，最后另加本次证据文档提交。

```text
2a52f43 Unify Platform authoring skill and preserve contract distribution ownership
9ac7b23 test(authoring): add traceable unified skill model evaluation harness
4fcb581 Lock integrated S1 authoring and model evaluation assets
1a1cdb3 Record integrated S1 verification and zero-request preflight
ff93b61 Freeze trusted authoring turn contract and execution ownership
27d1c9d test(authoring): distinguish S2 unified content preflight surface
89e884a test(authoring): block legacy model runner on S2 skill protocol
80ad2a7 Gate unified content tools on trusted latest authoring turns
5749be9 Record same-head S2 integration verification
bdd2195 Define immutable authoring candidates and trusted submission ports
d2efc94 Chain immutable authoring candidates and submit only the trusted final draft
2f9d620 Record S3 candidate submission integration evidence
d2e13e1 Define persistent authoring recovery and cancellation protocol
ba83002 Persist authoring execution and recover original operations across restarts
2093524 Define governed source descriptions and controlled data additions
bb8ea82 feat(workbench): restore pending authoring operations before editing
9d83820 feat(authoring): map governed sources into atomic data additions
dfd9fce feat(authoring): compose mixed pages and select verified data extensions
09982cb feat(authoring): bind business component and system extension consumers
```

## 后续 runner 集成提交

- 5669b1c：新版五工具共享评测循环、transport与评分适配（来源2f7117a）。
- b8fb2d2：保留多轮安全历史、限制当轮候选引用（来源ca4b1b7）。
- e526358：集成评测资产生成锁；30定向测试、12本地场景、导出及分发检查通过。

可信本地runner适配已完成，不再列作本仓待实现项；真实外发授权与实际提供方验收仍分别阻塞。

## 2026-09-16 本地页面回退兼容补充

固定实施前9d4f444与当前0e740ec，完成新版公开MCP创建→旧版独立进程读取/编辑→新版公开MCP继续编辑，report/dashboard两条完整结构无损往返通过。页面协议/渲染器源码树在两组间一致，详见[新旧消费者证据](2026-09-16-page-compatibility-evidence.md)。该文档兼容项已有本地证据；真实内部扩展、持久化操作、远端发布与整组部署回退仍待验收，不能混成同一个“回退通过”。
