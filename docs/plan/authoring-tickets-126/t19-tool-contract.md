# #145 / T19 发布工具与共同消费契约

**状态：S0 已于 `ea19706f0079805e7473ed16b6e8de48b782ad98` 冻结本仓实施，后续边缘规则以台账更正为准；不是已实现或外部提供方已确认的契约。** S4 task `01a0a034-68fb-79e1-bfe3-cf7d3ab15d38`，分支 `codex/s4-publish-145`，干净开工基线为 S0 验收 #138 后发布的 `9dcb2b8539fd4597fdd6816928e0fbffa0486b89`。前置 #138/#140/#144 本仓已验收；S1 的 #146 优先推进，不等待本文。

沿 T04 `authoring-lifecycle-proposal/1`、ADR-0078 和 #143 参数/ #144 执行接缝。本文只提出本仓消费字段及保护规则，不是 Java/Relay HTTP/SDK 定义。S2 已只读确认总体方向，S1 已给出最小 UI 消费字段（稳定参数ID/名称/值类型/选择/required/缺值/作用源、可读diff与可定位validation）；下文已合入这些建议。共同作者为 S2 维护的 `metriccanvas-authoring/contracts/authored/publication-contract.ts`，Python 消费其闭合生成 JSON；S4 不修改 S1 工作台、页面资产客户端或公共产品导出。

## 1. 操作与程序通道

在独立生命周期 MCP 中提供五个工具，每个只收 `request_token`：

| 工具（S0冻结名称） | 可信请求 | 输出 |
|---|---|---|
| prepare_candidate | context、精确 source、显式 retainDimensionValues | 新候选引用、状态、程序输出令牌 |
| read_candidate | 精确 CandidateRef | 候选状态、程序输出令牌 |
| revise_candidate | context、精确 CandidateRef、受控 corrections | 新版本候选引用、状态、程序输出令牌 |
| confirm_publish | context、精确 CandidateRef、confirmationToken | 已发布 TemplateRef 或 pending/unknown/rejected |
| get_publish_operation_result | 原 prepare/revise/confirm 请求令牌 | 原操作的权威结果；只查询，不自动重发 |

最后一个工具查询发布流程中所有写操作，包括准备和修正，避免其回执丢失后无恢复路径。S0已指定正式工具名 get_publish_operation_result。read 是只读，不需要稳定写操作键。

完整请求、候选文档、diff、参数取值、错误细节与确认记录只走 #138 的身份作用域程序通道。模型只见状态、精确引用、计数、摘要 hash 和程序输出令牌。确认 proof 不进入模型 text/structuredContent，不是页面字段，也不写入普通保存文档。所有通道按 actor/workspace 隔离；令牌只是引用，不认证操作者、不证明发生过人工确认。

S0已指定装载方式：生产独立 lifecycle stdio 固定注册九工具（#138四项加本票五项），默认发布端口明确 unavailable。既有 create_lifecycle_mcp_server(service, programs, identities) 三个位置参数保持兼容，仅通过可选关键字发布依赖扩展；缺任何必需端口时新工具返回明确 unavailable，不影响原四项。不会向内容 MCP 注册发布工具。

## 2. 身份、精确引用与候选评审面

沿用三个独立不透明字段 `DraftRef={pageId,revisionId,resourceId}`，不得把 resourceId 推断为 pageId/revisionId，不能回退 latest。

`CandidateRef={candidateId,candidateVersion,source:DraftRef}`；`TemplateRef={templateId,templateRevisionId,source:DraftRef}`。版本是精确标识，不比较字符串大小。新修正必须返回同一 candidateId/source 下不同 candidateVersion；已有确认不跨版本复用。

`OperationContext={operationId,actorId,workspaceId,origin}`，来源 manual 或 relay（skillVersion、可得时 sessionId/runId）。由可信编排在发送前持久固定，模型不可改；缺轮次字段不等于已验证轮资格。服务按已验证身份、操作种类和原操作键去重；指纹包含完整原请求，确认写请求中的 confirmationToken 也固定。

共同 Candidate：

```text
{ref, document, contentHash, canonicalization,
 expiresAt, leaseId, leaseExpiresAt,
 diff, affectedDataSources, parameterSummary,
 retainDimensionValues, validation,
 reviewHash, reviewCanonicalization}
```

其中 ref/document/contentHash/有效期/租约/评审字段沿 T04；canonicalization 明确原始文档算法。**reviewHash/reviewCanonicalization 是 S0 冻结的实施选择**，用于绑定整份展示给人的评审面，避免相同 document 但保留值/参数选择/diff 已变时复用旧确认。具体定义以共同作者为准。

reviewHash 固定覆盖以下无歧义对象：`{ref,contentHash,canonicalization,diff,affectedDataSources,parameterSummary,retainDimensionValues,validation,expiresAt,leaseId,leaseExpiresAt}`。document 先单独验 contentHash，reviewHash/reviewCanonicalization 自身不进入该对象；候选 source 已包含在 ref。算法由显式可信 `verifyReview` 端口协商并验证，不仅检查摘要字符串非空。原文 canonicalization 标识在精确payload中；reviewCanonicalization 必须匹配可信端口预先协商的算法身份，并作为验证上下文绑定，不由候选自行降低算法要求。未知标识或降级请求均拒绝，不能逐个尝试弱算法直到通过。本仓测试算法只能用于明确边界替身，不能成为生产默认。候选复用同一 ref 时其评审面必须不可变；客户端先核验原文和评审摘要，再校验页面结构与关联。

候选的完整文档必须经既有公开页面校验。业务 validation 可以为 false，供程序通道展示错误并修正，但不得发布。非法页面或结构错误的响应不得被工具当作可发布候选。期限是否已过、当前 head、租约状态由服务权威裁决；不把本机时钟当作发布授权。

## 3. diff、参数摘要与修正

以下字段由 S2 共同作者定义，不引入新 params 语法：

- diff 条目为 `{summary,sourcePath?,candidatePath?,parameterId?,before?,after?}`，仅为 Java 产出的展示记录，不是让工具执行的 JSON Patch。完整值只进程序通道。
- parameterSummary 条目为 `{parameterId,label,valueType,selected,required,valueState,defaultValue?,targets,extractionKind,sharing}`。valueType 仅 string / string[]；valueState 为 retained / missing / not-selected，缺值必须明确 missing，不伪造默认值；defaultValue 只在 retained 时存在且类型一致。未保留值但 required 的合法模板可等待执行显式输入，missing 本身不自动成为禁止发布的理由。targets 固定 `[{dataSourceId,queryField}]`，引用现有 6.2 `params` / DQE `paramBindings`；不得另造 globalParams/dimensionValues。本次新提取的 extractionKind 仅 dimension-eq / dimension-in，且有实际非空 targets；extractionKind=null 仅用于精确 source 证明的既有维度参数保留，不能根据 targets=[] 自动推断既有来源；sharing 仅 none / identical-values。字段只是权威服务报告，不证明服务算法正确。
- validation 为 `{valid,issues:[{severity,code,message,parameterId?,path?}]}`，severity 为 blocking / warning；valid 与不存在 blocking 条目一致，warning 不假装阻塞。所有可读说明均由 Java 提供且只在程序通道/人工界面展示。
- `affectedDataSources` 为精确候选内已存在的查询数据源标识，不得带任意外部来源；selected=false 必须 valueState=not-selected，且该参数不进入候选维度参数声明/绑定；selected=true 的维度参数与文档声明、全部 targets 双向对账。建议对账面固定为 document.params 中 type=dimension 的参数及相应全部 paramBindings，既有 string/number 等非维度参数仍合法且不作为提取候选；此对账面已由 S2 逐项核验。required 在页面协议中显式必填，缺失拒绝，不能缺省false。targets 可为空，但完整页面仍须有合法非query消费者（例如text参数引用）；unused参数依然拒绝，不新增或弱化Page规则。未选择但尚未入 document.params 的服务候选 ID 仍可被修正选中。
- corrections 仅 `{retainDimensionValues?,parameterSelections?:[{parameterId,selected:boolean}]}`，至少一项；参数条目不得重复，不能指向未列出的候选参数；不接受文档、查询、任意 patch、参数类型、共享合并或范围字段。实际参数选择和保留值变更由 Java 重新提取/校验，返回新版本候选。
- 第一版只消费 DQE 维度等值/多值及其部分数据源共享。明确标注为时间/金额范围、不同取值共享、未知提取类型或不支持的校验结果不可发布；本仓不读取查询条件重写 Java 的提取算法。真正排除这些路径的服务保证须独立联调。

字段结构以 S2 共同作者和生成 Schema 为唯一来源；Python 应用关联检查使用同一组共享向量验证。

## 4. 人工确认凭据

新增独立 `HumanConfirmationPort.read(confirmationToken, identity)`，由可信人工操作集成实现，默认 unavailable。它不从一般程序请求中的 `proof` 字符串推断有效确认，不提供模型可调用的“生成确认”工具。

返回的可信确认记录绑定：

```text
{actorId, workspaceId, candidate:CandidateRef, source:DraftRef,
 retainDimensionValues, contentHash, canonicalization,
 reviewHash, reviewCanonicalization,
 leaseId, expiresAt, proof}
```

proof 是已登记的人工事件证明/外部验证凭据，不能只是调用方编的 UUID 或布尔 true。用户可自然语言发起准备发布；模糊“是的/确认”或自动得到的 confirmationToken 不自动证明用户已看到并确认当前候选。人工操作必须来自 S1 的候选展示/预览之后的受信任路径；确认记录来源与 Java 验证机制仍需真实提供方确认。

新发布请求读取当前精确候选及可信确认，逐项比较 actor/workspace、完整 candidate/source、文档 hash、reviewHash、算法、retainDimensionValues 和 leaseId；不一致直接拒绝且零发布提交。候选修正后须重新展示与确认；不把旧 proof 改写成新版本。

Java 在最终同一事务中复验：实际身份与权限、当前草稿 head、候选版本与评审摘要、候选/确认期限、proof 有效且未撤销、页面级发布租约。客户端前置比较不能代替该事务，因此一致的旧候选/旧确认仍可能被 Java 拒绝；拒绝后不得自动重新 prepare、合并或发布。

## 5. 写回执、重复、未知与恢复

写回执为带 `operationId` 的共同判别式：

- prepare/revise 成功：`{status:'completed', operationKind:'prepare'|'revise', operationId, candidate:Candidate}`。
- confirm 成功：`{status:'completed', operationKind:'publish', operationId, template:TemplateRef}`。可信 `verifyResult(identity,originalCommand,result)` 端口必须验证完整原请求指纹及关联（包括精确 CandidateRef/confirmationToken），不能仅匹配 source；模板来源同时须等于原候选来源。该端口默认不能验证，不得用无条件 true 的生产实现绕过。
- 等待或结果未知：`{status:'pending'|'unknown',operationKind,operationId}`，不带伪造候选/模板成功引用。
- 拒绝：`{status:'rejected',operationKind,operationId,code,retryable:false}`，模型只获白名单错误码和脱值摘要。
- **仅 lookup** 可返回 `{status:'not-applied',operationKind,operationId,retrySafe:boolean}`；mutation 预查收到 retrySafe=false 时映射 unknown，零提交。

每个写工具先查询原操作；只有权威 not-applied 且 retrySafe=true 才按原命令提交。既有成功重放先校验原请求指纹、operationId、候选/来源/模板关联，再返回原结果。**不要求已完成操作的人工确认仍未过期**：重放不是新的发布授权，不能因确认自然过期而换键再发布。新逻辑操作才需要新的确认与权威事务。

网络断开、格式/关联不符、提交后程序输出写失败均保留 unknown+原操作标识；相同请求令牌可查询原结果。unknown/pending/去重期限不明不自动重试、不换键。取消仅停止本地接收，已提交请求仍须按原操作恢复。身份变化后不交付旧结果给新用户，原用户恢复后仍可查询。

## 6. #144 预览接缝

本票工具不重建执行器。S1 使用 `loadExecution/prepareExecution` 的精确 candidate target 做预览；target 包含 CandidateRef/source，执行回执保持原候选文档完整性。预览结果本身不生成确认。需要工具发起预览时，由 Relay 调用既有执行程序端口，当前五工具提案不新增第二份执行 DTO。是否增公开 preview_candidate 工具须单独冻结，不因 T04 逻辑操作名存在就擅自注册。

## 7. 文件与验收范围

S0 已登记 S4 新文件（Bundle 路径）：

- `tool/metriccanvas_authoring/application/lifecycle_publish.py`、`application/publish_ports.py`。
- `tool/metriccanvas_authoring/adapters/inbound/publish_mcp.py`、`adapters/outbound/publish_unavailable.py`。
- `contracts/authored/publish-request.schema.json`（仅引用共同 Request）。
- `test-harness/publish_stdio_server.py`、`tests/test_lifecycle_publish.py`、`tests/test_publish_stdio.py`。

修改既有生命周期入口/装载 `lifecycle_server.py`、`adapters/inbound/lifecycle_mcp.py`，仅新工具注册；`tool/pyproject.toml`/`test_distribution.py` 仅新增 schema 打包；`test_lifecycle_stdio.py` 仅默认工具集合；README 仅发布工具节。文档 `t19-tool-contract.md`、`t19-tool-evidence.md`。S2 唯一公共作者/导出/生成锁；S1 唯一 UI/客户端/整票验收，S3 内容工具与 Skill 不改。

S0/S1/S2 已冻结：工具集合和注册方式、共同 Candidate/Confirmation/MutationOutcome 作者源、reviewHash 绑定面、diff/参数摘要/修正准确子字段、人工确认端口不可用行为。测试将覆盖成功/修正后再确认/重复、相同内容不同评审面、旧确认/旧候选、head前进、过期/租约失效/未确认/伪proof/跨身份、请求换载荷、回执或程序输出丢失与原键查询、发布后草稿前进不改变旧模板、未支持提取类别拒绝，以及生产 stdio 关闭能力与隔离安装。示例服务在外部边界替身内；本仓工具不实现提取或发布事务。

本仓工具验收、外部提供方确认、真实 Java/Relay/盘古联调三类证据分开；#145 整票只由 S1/S0 汇合验收，本文件不解锁或代替其 UI 工作。

## 8. 完整消费场景与验收期望

以下约定给出确定的程序输入、服务端口响应与工具期望。`D` 是完整读取 `packages/page/fixtures/contract-valid/dimension-params-page.json` 得到的 JSON，不是模型摘要；禁止用变量名 D 代替实际程序传输的完整文档。场景替身只消费该固定候选，不在测试或产品工具中实现参数提取。所有场景独立，除明确顺序步骤外不共享状态。

基础值：

```text
identity = {actorId:'actor-a', workspaceId:'workspace-a', authToken:'fixture-user-token'}
source = {pageId:'dimension-params-page',revisionId:'draft-r1',resourceId:'resource-a'}
ref1 = {candidateId:'candidate-a',candidateVersion:'v1',source}
ref2 = {candidateId:'candidate-a',candidateVersion:'v2',source}
context(op) = {operationId:op,actorId:'actor-a',workspaceId:'workspace-a',
               origin:{kind:'relay',skillVersion:'fixture/1',runId:'run-a'}}
C1 = {
  ref:ref1, document:D,
  contentHash:hashDocument(D), canonicalization:'fixture-document/1',
  expiresAt:'2026-09-14T15:15:00Z', leaseId:'lease-a',
  leaseExpiresAt:'2026-09-14T15:15:00Z',
  diff:[{summary:'提取区域为多值参数',sourcePath:'/dataSources/sales/source/query',
         candidatePath:'/params/0',parameterId:'regions'}],
  affectedDataSources:['sales','shared'],
  parameterSummary:[{parameterId:'regions',label:'区域',valueType:'string[]',
    selected:true,required:true,valueState:'retained',defaultValue:['APAC'],
    targets:[{dataSourceId:'sales',queryField:'region'},
             {dataSourceId:'shared',queryField:'region'}],
    extractionKind:'dimension-in',sharing:'identical-values'},
    {parameterId:'segment',label:'细分',valueType:'string',selected:true,required:false,
     valueState:'missing',targets:[{dataSourceId:'shared',queryField:'segment'}],
     extractionKind:'dimension-eq',sharing:'none'}],
  retainDimensionValues:true,validation:{valid:true,issues:[]},
  reviewHash:hashReview(exactReviewPayload(C1)), reviewCanonicalization:'fixture-review/1'
}
```

上述 hashDocument/hashReview 是显式替身端口各自算法，需对完整输入实际计算并在测试中破坏其值验证拒绝；不是生产算法标识。`exactReviewPayload(C1)` **恰好**包括第 2 节列出的 11 个字段（ref、contentHash、canonicalization、diff、affectedDataSources、parameterSummary、retainDimensionValues、validation、expiresAt、leaseId、leaseExpiresAt），没有 document、reviewHash、reviewCanonicalization。hash 是完整性摘要，不认证服务或人工操作；身份/通道真实性仍由独立可信端口建立。

每个请求包装为 `{actorId:'actor-a',workspaceId:'workspace-a',request:<下列输入>}` 放入只由可信程序写入的 `<token>.json`。MCP 实参始终只有 `{request_token:<token>}`，没有 document/proof/actor 或可写 operationId。

### 8.1 prepare_candidate

输入 `P1={kind:'prepare',context:context('prepare-1'),source,retainDimensionValues:true}`。首次 lookup 返回 `{status:'not-applied',operationKind:'prepare',operationId:'prepare-1',retrySafe:true}`；服务 prepare 返回 `{status:'completed',operationKind:'prepare',operationId:'prepare-1',candidate:C1}`。验证完整请求指纹、source、原文及评审摘要后，完整结果写程序通道，模型结果仅 completed / prepare / operationId / ref1 / programToken / 计数与 hash。零模板发布。

反例：响应 source.resourceId 错、operationId 错、reviewHash 错、contentHash 错、相同 ref 但摘要外展示字段改变，均拒绝为 unknown/RESPONSE_MISMATCH 并保留 prepare-1 供查询，不输出候选成功引用。lookup unknown/pending 时不调用 prepare；not-applied 且 retrySafe=false 时 mutation 返回 unknown，lookup 工具仍如实返回 not-applied，零提交。服务已准备成功而回执/程序写入丢失时，原 P1 查询返回 C1，不能生成第二候选/租约。

### 8.2 read_candidate

输入 `{kind:'read',ref:ref1}`。服务读取返回 C1；应用先验原文和 exactReviewPayload，再做结构/引用校验，将完整 C1 写程序通道。模型只返回 `{status:'read',ref:ref1,programToken,contentHash,reviewHash}` 等受控摘要。这里没有执行参数提取或建立确认。

反例：只返回“最新候选v2”冒充ref1、跨source/page、只改diff.summary而沿用旧reviewHash、非法候选文档或未知extractionKind，均拒绝，零写与零确认。服务报告业务 `validation.valid:false` 且有对应 blocking 项时，允许人工读取合法结构的候选错误，但不允许 confirm 成功。读取旧候选本身不代表它仍可发布，服务事务可因过期/head/version变化拒绝后续发布。

### 8.3 revise_candidate

输入 `R1={kind:'revise',context:context('revise-1'),ref:ref1,corrections:{retainDimensionValues:false,parameterSelections:[{parameterId:'regions',selected:true}]}}`。lookup先确认未执行且可重试，服务返回 `{status:'completed',operationKind:'revise',operationId:'revise-1',candidate:C2}`。

C2 由服务固定样例提供：ref2，document 中 regions 的 default 被服务移除、required 保持；parameterSummary regions 为 valueState=missing 且无 defaultValue；retainDimensionValues=false；完整文档/hash/reviewHash重新计算。其他未涉及页面配置保持。工具不自行删除default或改写查询。修正后需重新展示/预览并产生 ref2 的人工确认；ref1 的证明不能转成 ref2 的确认。

反例：重复parameterId、候选未列出的parameterId、corrections中混入document/query/范围字段，本地零修正提交；服务返回同candidateVersion、换candidateId/source、未应用请求的retainDimensionValues或选项、review不符，保持unknown/RESPONSE_MISMATCH，原revise-1可查询。未选择但尚未进入document.params的服务候选ID仍是合法修正目标，不能错误只从页面params枚举候选。

### 8.4 confirm_publish 与人工证明

可信人工端口仅在实际人工界面确认当前 C2 后，登记不透明 `human-confirmation-v2`；查询这个令牌得到：

```text
H2 = {actorId:'actor-a',workspaceId:'workspace-a',candidate:ref2,source,
      retainDimensionValues:false,contentHash:C2.contentHash,
      canonicalization:C2.canonicalization,reviewHash:C2.reviewHash,
      reviewCanonicalization:C2.reviewCanonicalization,leaseId:'lease-a',
      expiresAt:'2026-09-14T15:14:00Z',proof:'verified-human-event-2'}
```

proof 必须在可信人工端口/Java 的登记或验证体系内确实有效；它不是测试中任意非空字符串就能通过的布尔门禁。原请求输入 `W2={kind:'publish',context:context('publish-2'),ref:ref2,confirmationToken:'human-confirmation-v2'}`。新操作 lookup=not-applied/retrySafe=true 后，应用读取精确 C2 和可信 H2，验证全部关联；服务原子检查权限、head=source、currentCandidate=ref2、review/lease/期限/证明后，返回 `{status:'completed',operationKind:'publish',operationId:'publish-2',template:{templateId:'template-a',templateRevisionId:'template-r1',source}}`。verifyResult 核对 W2 的完整指纹；模型只获不可变 TemplateRef 与状态，不获 proof。

独立反例及期望（每项断言无新模板）：

| 变化 | 期望 |
|---|---|
| 没有人工端口/记录，只有模型“确认”或未知confirmationToken | CONFIRMATION_REQUIRED 或明确 CAPABILITY_UNAVAILABLE，零发布提交 |
| 请求里自行塞proof:true或任意字符串 | schema拒绝；不能经一般spool认证人工操作 |
| H2 actor/workspace不同 | FORBIDDEN，零发布提交 |
| ref2请求配ref1的旧H1 | CANDIDATE_CHANGED/CONFIRMATION_REQUIRED，零发布提交 |
| 相同文档hash但reviewHash/保留值/leaseId不同 | 关联拒绝，零发布提交 |
| C2与H2一致，但服务当前候选已到v3 | 服务CANDIDATE_CHANGED，零模板 |
| C2与H2一致，但服务head已到draft-r2 | 服务REVISION_CONFLICT，零模板 |
| 候选/人工证明过期或被撤销 | 服务CANDIDATE_EXPIRED/CONFIRMATION_EXPIRED/CONFIRMATION_REQUIRED，零模板 |
| 租约失效/被其他操作取代 | 服务LEASE_EXPIRED，零模板 |
| 当前身份无权读取或发布 | 服务FORBIDDEN，零模板，程序不泄漏旧候选 |
| 服务声明时间/金额范围/不同值共享候选或blocking校验 | 本仓拒绝不支持候选或服务拒绝，零模板，不运行本仓提取算法 |
| 成功后草稿前进到draft-r3 | 已发布template-r1仍引用原source及原不可变内容；新发布须新候选/确认 |

### 8.5 get_publish_operation_result、过期、撤权与重放

输入仍是原 P1/R1/W2 的程序令牌，查询原完整命令及其作用域。完成回执先验证 operationKind、operationId、完整原请求指纹和对应候选/模板关联；不执行新的 prepare/revise/publish。

- publish-2 服务已提交、传输回执丢失：confirm_publish 为 unknown，get_publish_operation_result 返回原 template-r1；总发布事务一次。
- 服务已提交、程序输出文件写失败：同样unknown+publish-2，恢复输出通道后查询交付原结果；不丢原操作、不生成新键。
- 服务结果 pending/unknown：原样返回且零新写；not-applied+retrySafe=false只允许查询结果表明该事实，禁止工具自动重发。原命令同键改候选/选项/confirmationToken，服务指纹冲突IDEMPOTENCY_CONFLICT。
- **已完成操作之后候选、租约或H2自然过期/被撤销，甚至草稿head前进**：仍具备原结果读取权限时，查询/同操作重放只返回原不可变结果，不重新运行过期校验、不再写模板，也不生成新的授权。它不是以失效证明发起新发布。
- **权限撤销/身份变化**：当前服务仍须先鉴权，旧成功操作也不能绕过当前结果读取权限；FORBIDDEN不能返回旧候选/模板内容。相同用户重新获权后可按服务政策恢复查询，工具不以本地缓存授予权限。
- **未完成/权威未执行的新发布**：哪怕输入与旧成功类似，新的operationId也必须重验当前候选、有效人工证明和服务事务；已过期/撤销H2、旧head或旧版本均不可发布。
- 本地取消或身份切换时不把迟到结果交给新轮/新用户；取消不声称撤销服务事务，原用户仍可查询原操作。read/lookup都没有自动重试循环。

## 9. T04 已有要求与新增实施选择

| 内容 | 归属 |
|---|---|
| 精确CandidateRef/TemplateRef/source；修正产生新版本；保留值二次确认；Java提取与原子发布；租约/有效期/身份/head保护；完整文档程序通道；稳定操作/回执未知恢复 | T04、#126、#145已有要求 |
| #144精确candidate target预览、合法6.2 params/paramBindings、维度多值与required缺值 | 已验收#143/#144消费边界 |
| request_token和身份作用域spool、模型无完整文档、默认未知服务能力关闭 | #138已验收程序通道；本票复用 |
| 五个具体工具名、默认注册方式、独立HumanConfirmationPort、reviewHash的11字段payload和verifyReview/verifyResult端口、operationKind+completed分支 | S0 已冻结的本仓实施选择，非外部 wire 事实 |
| 非空diff/parameterSummary/validation的具体子字段、受控parameterSelections、共同作者源/Schema路径/公共DTO出口 | S0 冻结的 S2 内部共同作者；不进入公共 page 包或升版 |
| 原成功操作过期后重放不新写，当前权限撤销仍限制结果读取 | 对T04幂等/鉴权语义的明确消费解释，S0 已冻结；不能冒充提供方已保证 |

以上场景定义验收期望；实际运行记录见 t19-tool-evidence.md，不能引用本表代替行为验证。

共同契约由 S2 维护内部 `metriccanvas-authoring/contracts/authored/publication-contract.ts`；不创建公共 DTO 出口、不升版。

实施起点已合 S0 正式产品组合 `812ad98241e31a1e24ebd6b739a9e3844ef9e5e6` 与冻结台账 ea19706，保留双Platform Skill及#138成果。最终消费 S0 正式共同基线 b3261ae；工具作者 7c9d802、分发生成 a15730f 的实际验证见 t19-tool-evidence.md。
