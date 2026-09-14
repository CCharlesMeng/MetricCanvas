# #130 / T04 Java 与 Relay 修改方案

消费语义提案 `authoring-lifecycle-proposal/1`，2026-09-14。基线 `5d06583878fc18ab145be9315d608c6e90ca6775`。S0 作者；S1/S2 本仓消费对齐已完成，最终映射见本文末尾与 t02-evidence.md；外部提供方未确认。本文的操作名、字段和错误码是本仓拟消费的逻辑端口，不是提供方 HTTP/SDK 定义；没有新增生产端点、外部服务或公共产品 DTO。

## 事实、拟新增与未知

按 #105/#106 完整票及截至本次读取的评论核对；#130 原生 blocked_by 为空。事实真源：`docs/plan/wayfinder-105-provider-api-2026-09-10.txt`；盘古对账 `docs/plan/wayfinder-105-106-fact-check-2026-09-09.md`。旧 Swagger/旧 Java 仅供历史对比，后出正文取代旧要求。

| 能力 | 已知资料 / 当前代码 | 本版拟新增消费要求 | 外部未知及跟踪 |
|---|---|---|---|
| 目录/详情/新增更新 | #105 用户确认服务已实现；GET 集合带 pageNo/pageSize/needDefinition，GET/PUT 资源以 page_metadata_id 寻址，POST 新增，PUT 带 base_revision_id；CommonRsp retCode/retDesc；definition 请求 object、响应 JSON 字符串 | 保留已知适配，不改其资源命名 | 同一 page_id 唯一性、metadata id 更新前后关系与多记录选择仍待 #105 真实核验 |
| 当前客户端 | page-assets-client.ts 已直连 user-page-metadata，读取 runtime-config，两身份头；当前匹配修订可读 | 能力声明区分 currentRead/exactRead/history/stableSave/operationLookup/candidate/execute | 当前 getRevision 先读 current；不是历史接口。saveRevision 虽接收 idempotencyKey 但未发送，不能依赖其重试去重 |
| 修订/历史/写后读 | 响应有 revision_id/revision_number | 不可变精确读取、历史分页、提交后精确读可见、操作结果查询 | 是否已有接口及一致性保证未知；资料最终一致窗口不足以证明精确写后读 |
| 幂等/来源/说明 | base_revision_id 已有；当前适配的 hash/createdBy 为空，不能作事实 | 稳定操作键、指纹冲突、来源与说明、保留维度取值选择持久留痕 | 提供方字段、去重保留期/作用域、错误码及 token/actor 校验待 #105 |
| 提取/发布/执行/最后筛选 | ADR-0078 与 #126 已决定职责和产品行为 | Java 自动提取、候选校验、租约与确认、执行和最后筛选存储 | 未收到这些 wire 契约/真实结果；记录为拟新增，不能等同确认不存在 |
| 盘古/Relay | 指南有 instance/renderChat/destroy、ask:void；真实 skillInfo/referrer/holdingSkill 组合、事件 payload 未确认 | 受控创建/修改路由、可信产物直达生命周期工具、保存引用通知、精确确认绑定 | #106 路由/身份/事件，#107 实例，#108 产物/恢复；指南方法名不是已接通证据 |

不把当前客户端的 revisionNumber 排序当成多个资源归属已明确，不把空 contentHash 当作完整性校验。S1 在 #128 能力端口隔离这些限制；S2 在 #129 冻结布局版本、#143 冻结 params 绑定，本文不抢定新 schemaVersion/params 子字段。

## 所有权及通道

Java 权威：页面/修订持久化、同一基线并发、提取/候选修正校验、授权范围、发布事务和执行取值。Relay 权威：理解意图、创建/修改 Skill 路由、受控操作计划及等待确认编排。内容 MCP：合法文档的确定性构造/修改，不保存、不提取、不发布；生命周期 MCP：鉴权服务调用与结果归一，不复制算法。

可信上下文由集成门户/Relay 注入；`actorId` 只能是经过服务验证的身份语义，不由模型指定。workspaceId 用于本地隔离及最后筛选归属，不推断新版 Java 要求第三身份头；实际头/Cookie 保持提供方契约。token 不进文档、队列、日志、模型输入或样例。

本仓实际入口为 `metriccanvas-platform-create` 与 `metriccanvas-platform-edit`；普通问数继续 `metriccanvas-page-builder`。Bundle 的 `skills` 只登记分发目录，旧 `skill.entrypoint` 保持，不证明 Relay 已注册路由。两个 Platform Skill 分别随目录携带共享编排、report/dashboard 基线及完整页面参考；Relay 应按新建/已有页修改意图显式选择，并在缺部署入口时明确不可用。

创建 Skill 在首次生成完整合法页面前不调用保存。修改 Skill 必须有精确基线，从可信程序通道读完整文档；缺基线拒绝重建整页。已有页面新增组件仍为修改；只有明确另建才创建。普通问数不改路由。report/dashboard 的默认及切换由内容线既有规范负责。

程序流：可信基线上下文 → Relay 受控计划 → 内容工具程序产物 → 生命周期保存 → 已保存引用 → Platform 精确读取/校验 → 当前轮次及工作副本基线检查 → 画布更新。完整文档/数据行只走程序通道；模型只见摘要、受控操作结果及引用。内容工具返回的部分成功须为合法依赖闭合子集，保存一次；全失败/no-change 不保存。未经验证的 Page Artifact Adapter 不向真实模型开放 compose_page。

## 逻辑值类型（全为提案）

- `DraftRef = {pageId, revisionId, resourceId}`：三个不透明值；resourceId 是适配器可寻址值，不能推断它与 pageId/revisionId 相等。不可按字符串大小比较修订。
- `OperationContext = {operationId, actorId, workspaceId, origin}`：origin 为 manual 或 relay，relay 含受控 skillVersion、sessionId/runId（可得时）；操作键在发出请求前持久化。关联标识不代替鉴权。
- `Save = {context, base: DraftRef|null, pageId, document, description, retainDimensionValues}`。document 是完整合法页；description 是修订说明，页面自身说明仍在 meta.description；retainDimensionValues 为显式布尔，不以缺省替代用户选择。保存不暗中参数化/删除 DQE 条件，该选择交 Java 留痕，在发布时再确认。
- `Saved = {status:'saved', operationId, ref, base, contentHash, canonicalization, revisionNumber}`；hash 由可信端对持久化文档计算，首次为空哈希不可接受。canonicalization 的跨语言算法/版本必须协商；样例只使用固定 ASCII 文档与排序紧凑 JSON 的示范算法，不能据此推断生产 canonicalization 已确认。
- `SaveOutcome = saved | pending | unknown | rejected`。pending/unknown 绝不带伪造 ref；rejected 含 code/retryable/requestId，可包含 type/path/message 校验错误。HTTP/业务码均须成功且载荷通过端口校验才映射 saved。
- 候选引用 `CandidateRef = {candidateId, candidateVersion, source:DraftRef}`；修正产生新 candidateVersion，预览和确认均固定此版本。
- 模板引用 `TemplateRef = {templateId, templateRevisionId, source:DraftRef}`；模板不可变；候选和页面修订号不混用。

逻辑错误：INVALID_PAGE / INVALID_REQUEST / UNAUTHENTICATED / FORBIDDEN / REVISION_NOT_FOUND / REVISION_CONFLICT / IDEMPOTENCY_CONFLICT / CAPABILITY_UNAVAILABLE / CANDIDATE_EXPIRED / CANDIDATE_CHANGED / CONFIRMATION_REQUIRED / CONFIRMATION_EXPIRED / LEASE_EXPIRED / NO_ACCESS_SCOPE / RESPONSE_MISMATCH。wire 错误只能基于已验证映射转换；未知错误保留可诊断 requestId，不能猜成成功或冲突。

## 保存、重试、读取与历史

1. `saveDraft` 对 pageId 的最新基线原子比较，再追加不可变修订；base=null 只首建，同 pageId 并发创建须明确冲突。事务同时写操作结果，不能先创建修订再单独记幂等状态。
2. 幂等作用域提议 `(verified actor, workspace, saveDraft, operationId)`，Platform/Relay 共用。指纹包含 pageId、base、规范 document、description、retainDimensionValues、origin；同键同载荷返回首次结果，同键不同载荷拒绝。它是本版提案，相比旧历史指纹规则扩展了留痕字段，必须由提供方确认，不覆盖 #105 已有接口事实。新动作即使内容相同也有新键；传输重试永远沿用原键/原字节语义。
3. 回执丢失：先 `getOperationResult(context, operationId)`；saved 读取原 ref，pending 有界退避，unknown 不视为未执行。仅在服务保证仍在去重有效期内重试同键；去重结果过期时暂停人工恢复，禁止换键重发。权威 not-applied 才允许按原键继续；重连不能自行把未确认提交丢弃。提供方须保证离线重试窗口内幂等，实际期限待确认。
4. 写后读取：`readRevision(ref)` 精确返回该 ref 的原始持久化文档及 hash；当前已前进也不得返回 latest。若尚不可见，返回 pending/受控暂不可读并有界查询，绝不更新画布。先验证原始字节语义/hash，再在 S2 受控边界规范化旧协议；不得用规范化后的文档去比原始 hash。
5. 历史：`listRevisions(pageId, cursor, limit)` 使用固定 snapshot/head 和不透明 cursor，返回 ref、base、说明、来源、时间及可验证审计字段；`readRevision` 读取任意允许的历史。未知审计字段显式缺失，不能由当前用户补造。恢复/撤销是基于当前 head 保存旧内容的新动作，不倒退 head、不删除历史。
6. REVISION_CONFLICT 保留工作副本并暂停队列，不自动合并；身份失败暂停到外层重新提供身份。后续编辑可保存在本地，语言与发布入口等队列清空且未知结果解决；语言轮期间禁用手工编辑。取消只失效本地接收资格，已发保存必须查询实际结果。

## 候选与人工发布

逻辑操作：prepareCandidate(source, operationId) → readCandidate(ref) → reviseCandidate(ref, corrections, operationId) → previewCandidate(ref, inputs) → confirmPublish(ref, confirmation, lease, operationId)。读取/修正/确认均须鉴权。

Java 只提取 DQE 维度等值/多值，可作用于部分数据源。候选完整返回：精确 source、candidateVersion、expiresAt、leaseId/leaseExpiresAt、候选完整定义（程序通道）、diff、affectedDataSources、parameterSummary、retainDimensionValues、validation。参数绑定结构引用 S2 正式作者源，本文不定义 params 语法。独立样例使用无可提取维度的合法候选，不冒充维度提取算法已实现；维度提取的正反场景另见联调清单。

修正范围仅为候选参数选择/保留值等受控字段；修正后 Java 重新校验，旧版本及其确认全部失效。修改页面内容须回草稿、保存、重新 prepare。不同取值共享、时间/金额范围提取须拒绝或列为未提取，不隐式增加手工合并路径。未保留具体值须明确 required/missing，不能将未填参数当可执行默认。

确认由受信任人工操作生成，并绑定 actor、CandidateRef、source、retainDimensionValues、候选摘要/hash、有效期；模型的一句“确认”不能直接制造该证明。Relay 可发起确认请求，受约束发布等待人工事件和 Java 最终校验。确认修正后的最新候选之前必须再次展示差异与预览。

Java 在同一发布事务校验：权限、当前草稿 head、候选版本/hash/有效期、未撤销且有效的人工确认、页面级 15 分钟发布租约；时钟以服务为准，不从客户端时间决定有效。成功生成不可变 TemplateRef；相同操作重复返回相同结果，未确认/过期/基线变化不产生模板。取消/拒绝/超时释放租约；租约期内是否允许草稿保存按提供方实现明确映射，但一旦 head 改变旧候选不得发布。

## 执行结果与最后筛选

`execute({target, explicitInputs, operationId})` 的 target 是一个精确 DraftRef、CandidateRef 或 TemplateRef，绝不隐含 latest。IOC 外部 metadata 标识先由服务解析为精确 target。Java 决定取值并执行查询；响应属于本次 target 与 operationId。

程序响应逻辑形状：`{status, operationId, target, executionId, document, appliedInputs, filterValues, conditionKey, dataSources}`。document 是按本次条件实例化后的完整合法页面；appliedInputs 固定本次参数，filterValues 是初始化筛选值；conditionKey 是服务为本次有效条件给出的关联摘要。每个 dataSources 项判别为 success（rows、可选 total/dataTime）或 error（code/message/retryable）；不能同时带 rows 与 error。字段已归一则使用页面字段 id；原始响应须先按 queryField 映射。映射方式由 S2 #144 适配，禁止把 DQE 字段直接灌组件。

必须校验 target、operationId、文档协议、每个源归属与条件一致；缺少任何必需查询源结果是 RESPONSE_MISMATCH，不把缺 rows 视为空数据或已表达错误。success + rows:[] 是有效空集；partial 保留成功项，将失败映射到现有 `packages/page/src/snapshot.ts` 的 error 分支；全失败保留可渲染框架与各源错误，不能显示假成功。混合成功/失败状态必须一致。成功初始行只能在 conditionKey 与当前条件匹配时复用；筛选变化后走既有数据网关，不重跑模板初始化。

取值优先级：显式入口 → 完全有权的历史 → 页面默认 → 授权交集回退；权限是所有阶段的硬约束。历史任一值越权则整份相关历史条件无效；显式或默认越权静默回退到允许范围，响应显示实际取值与实际查询一致。无任何可访问范围返回 NO_ACCESS_SCOPE 并且零取数，不生成无条件查询；未暴露为参数/筛选的限制仍由服务强制。

`recordLastFilters({targetMetadata, filterValues, clientSequence, operationId})` 按 verified actor/workspace/metadata 存储最后一次筛选；metadata 究竟使用哪类提供方 id 待确认。服务防止旧序号或迟到请求覆盖新记录，跨窗口需服务版本并发校验，不能比较不同客户端的本地序号。记录失败可告知未持久化，但不回滚当前筛选、不重初始化；刷新复用前重新校验权限。URL 只读一次。

## 消费方对齐清单与验收

S1 #128：确认 DraftRef/操作键/保存四态、能力不可用、保存时序、旧页保留；S2 #129/#143/#144：确认原始 hash 与规范化顺序、候选参数作者源、执行目标/错误数据快照/条件匹配；S4 #138/#145 消费同语义。三方回执记录具体接口路径与版本再冻结正式 DTO。未登记时只交付提案，不称已对齐。

`t04-contract-examples.json` 是完整内部边界样例，含共享 fixture、顺序步骤和预期裁决。`t04-verify-examples.py` 检查样例自洽性及关键安全不变量；它不是 Java/Relay 模拟实现，不能证明真实服务行为。消费者实现后把这些输入/预期放到公开端口回归，不照抄 checker 当业务实现。

真实联调清单（全部待 #105/#106 及环境）：

- 两客户端同 base 保存，只有一个推进；回执丢失、重试同键、换载荷、长期离线/结果过期；旧 R1 在 R2 后仍精确可读；业务 retCode 非零不成功。
- 首建/说明/来源/保留值读回；历史分页期间有新修订，仍不漏不重；撤销后新修订保留原历史。
- 维度等值、多值、部分数据源共享成功；同维度不同值共享、时间、金额范围拒绝；候选修正重新校验；保留/不保留值各走一次人工二次确认。
- 未确认、错 actor、旧 candidateVersion、内容已改、超期、租约失效、重复确认均给确定结果；发布版本不受后续草稿改变。
- 显式/历史/默认/权限回退、无权限零取数、权限隐藏维度、条件匹配初始行、空集、部分/全部失败、缺源拒绝；最后筛选乱序/跨用户隔离。
- 创建/修改路由真实生效；完整产物只走程序通道，模型只见摘要；可信引用读回；取消/迟到/身份变化不替换旧页；上游兼容更新后重复同场景。

三类结论独立记录：本仓方案与样例检查、本仓消费者回归、外部书面确认及真实联调。#130 文档交付不等于 #138/#144/#145/#146 实施，也不关闭 #95/#105/#106。外部能力未就绪时端口返回 CAPABILITY_UNAVAILABLE，无旧 Node/Java 回退。

## M0 最终消费对齐（2026-09-14）

S1 `authoring-coordinator/1` 及 `draft-notification/1` 已按本仓范围验收。21 个样例逐项对应 t02-evidence.md：本仓已实现的保存保护有实际测试；未来候选/执行/强保存只记录接缝和关闭能力，不以不可用替代成功样例的业务实现。S2 已确认原文验证先于规范化、精确执行目标和条件匹配、逐源错误数据快照；#129–#133提供旧新版本兼容证据，参数/执行实际功能留#143/#144。

现有客户端的保存结果 `assurance:provider-response` 仅代表已确认协议的成功回执及资源/页面/规范文档匹配，不可转换成本文强 Saved。hash/canonicalization、稳定幂等、操作查询、任意历史精确读取仍未由提供方确认。pending/unknown 禁重发，冲突保留副本；PUT固定已打开resourceId，错资源回执为unknown。内部操作ID目前仅内存，未冒充服务端幂等键或持久队列。

用户明确：盘古 dispatch 全局 `metriccanvas:draft-saved`，detail仅 `{draftId}`；部署配置仅静态资源地址+版本号。draftId为不透明通知引用，与DraftRef三个字段不混同；服务读取适配器负责将其解析为不可变保存版本，并校验权限/原文完整性/当前接收资格。当前精确draftId读取能力未证实，真实端口返回CAPABILITY_UNAVAILABLE。盘古真实dispatch及Java解析端点、版本/资格保证列入#105/#106/#108后续确认；不擅自增加事件JSON、序号、令牌或页面正文。SDK同document固定资源/版本，更新配置后整页重载。

M0通过只证明架构与本仓方案可独立验证。#138/#144实现时必须继续区分本仓替身、提供方确认、真实联调；Java/Relay代码不在本仓实现。
