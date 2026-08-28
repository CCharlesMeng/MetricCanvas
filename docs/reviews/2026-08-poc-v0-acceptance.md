# POC V0 端到端验收报告(2026-08,#69)

> **性质**:POC 验收,**不是生产就绪评估**。结论仅证明「一句业务问题 → 域路由 → 检索消歧 → 口径卡 → 真实取数 → 临时页面文档 → 沉淀为修订」这条链路在受控环境(DQE 仿真 + mock 身份 + scripted/确定性模型)下端到端成立;上生产的四项 blocker 见第 7 节,保持未解决状态。
>
> **基线**:`main` @ `11ee804`(三期全部实施切片 #60–#68、#32 已合入),验收工作在分支 `issue-69-golden-questions` 完成。
>
> **方法**:确定性部分(黄金问题集守卫、端到端、会话回放、追问增量)以 vitest 进 CI;真实模型评测按需运行、不进主 CI(存量约定,见 `apps/platform/tests/agent/real-model-eval.test.ts` 与探针脚本头注释);另以 scripted 模式(无 DEEPSEEK key)+ DQE 仿真完成一轮联机手验,输出摘要见第 4 节。

## 1. 总体结论

**POC V0 验收通过。** issue #69 的 10 条验收标准全部有证据落地(逐条对照见第 3 节);其中黄金问题集所依赖的业务口径输入(域清单、高频指标口头说法、时间口径默认约定等)当前不可得,按 issue 约定如实标注为待业务侧补充(第 8 节),不做编造。

验收过程暴露并修复了两个真实缺陷(第 5 节),另确认两处已知限制(第 6 节)——这正是「验收切片必须真实走一遍」的价值:此前 #66 的测试经注入的假执行端口通过,而生产接线走真实数据网关时问数必然装配失败,直到本切片才暴露。

## 2. 交付物清单

**评测资产(版本化,v0)**

| 文件 | 内容 |
|---|---|
| `apps/platform/scripts/fixtures/golden-questions.json` | 黄金问题集 V0:10 条,直答 6 / 需澄清 2 / 无指标缺口 1 / 跨域易混 1(= ADR-0037 配额 60/20/10/10);难度 easy 2 / medium 5 / hard 3;每条含问题原文、期望域/指标/维度/筛选/时间口径(`timeScope`)、可接受替代答案(`altStatuses`/`altGroupBy`)、难度标签与判定说明 |
| `apps/platform/scripts/fixtures/few-shot-examples.json` | few-shot 提示词示例唯一真源(4 条),与评测样本物理分离 |
| `apps/platform/scripts/probe-nl-to-unit.ts` | 探针脚本改造:few-shot 从 fixture 渲染;`--fixture golden-questions.json` 即黄金问题集真实模型评测;报告随评测资产版本落盘 |

**测试(全部进 CI)**

| 文件 | 覆盖 |
|---|---|
| `apps/platform/tests/ask/golden-questions.test.ts` | 守卫三组:few-shot 与评测样本交集为空(混用防护)、期望值程序化对照语义面真源(真元归一,不手抄第二份清单)、结构与四类配额断言 |
| `apps/platform/tests/ask/golden-end-to-end.test.ts` | 黄金问题集端到端:scripted 结构化决策 + **进程内 DQE 仿真真实取数**(生产数据网关与生产执行端口),覆盖直答 6 条全阶段出文档、同面换组合与全新组合取数(非回放)、消歧阻塞与确认续跑、面外四段降级零执行零文档、跨域硬闸拒绝 |
| `apps/platform/tests/ask/retrieval.test.ts` | 检索最长命中词规则回归(见第 5 节缺陷 2) |
| `apps/platform/tests/session-replay-endpoint.test.ts` | 会话回放端点:归属者 200、他人 404(与不存在同响应)、管理员 200 |
| `apps/platform/tests/workbench/session-replay.test.ts` | 当时的落库事件流经 run-state 同一状态机物化只读时间线;ADR-0058 后叠加最新会话检查点恢复 |

**功能补齐(会话回放,验收标准 8 的缺口)**

- `GET /api/sessions/{sessionId}`(`apps/platform/src/routes/api/sessions/[sessionId]/+server.ts` + `$lib/server/session/replay-endpoint.ts`):按存储可见性返回全量步骤事件流。
- 工作台(`PageAuthoringWorkbench.svelte` + `$lib/workbench/session-replay.ts`):首次提问生成会话 id 随流式请求落库并写入 URL(`?session=`),刷新后按会话 id 拉取事件流物化回放时间线。此前工作台不传 `sessionId`,步骤事件根本不落库,标准 8 无从成立。

**提交列表**(分支 `issue-69-golden-questions`,基于 `11ee804`)

1. `c08bd7a` feat: 黄金问题集 V0 评测资产与守卫
2. `5afc0ad` fix: 创作期真实取数两处缺陷(行键还原、最长命中词)
3. `5520ac8` test: 黄金问题集端到端
4. `cc34ac0` feat: 分析会话回放端点与工作台接线
5. (本报告)docs: POC V0 验收报告

## 3. 验收标准逐条对照

| # | 验收标准 | 证据 | 结果 |
|---|---|---|---|
| 1 | 问题集含问题原文、期望域、期望指标与维度、期望时间口径、可接受替代答案与难度标签 | `golden-questions.json` 每条样本;`golden-questions.test.ts`「字段齐全」断言 | ✅(时间口径默认约定待业务侧确认,见第 8 节) |
| 2 | 覆盖直答、需澄清、无指标缺口、跨域近义易混四类 | 6/2/1/1 = ADR-0037 配额 60/20/10/10;守卫测试「四类全覆盖且配额」断言 | ✅ |
| 3 | few-shot 与评测样本物理分离,有守卫防止混用 | 两份独立 JSON 文件;守卫断言 few-shot 问题与(黄金 ∪ 种子)评测问题**交集为空**,且评测样本相互唯一 | ✅ |
| 4 | 一条端到端:一句问题走到真实取数并渲染成功 | CI:`golden-end-to-end.test.ts` 直答 6 条——经生产数据网关从进程内 DQE 仿真取回真实行,文档过 `validate()` 且内嵌初始行与执行行数一致;联机:第 4 节 A(完整事件序列 → outcome 文档 → 数据行落进文档,工作台以 RuntimeView 直渲同一文档,#65 既有路径) | ✅ |
| 5 | 换一个同面内组合仍能取到数,证明不是回放 | CI:两个不同组合输出字段与数值不同,另有一个**不在任何评测样本与仿真精确匹配 fixture 中的全新组合**(客户留存率×客户级别×金融筛选)同样取到数——仿真按语义面组合确定性合成,不是录制回放;联机:第 4 节 C | ✅ |
| 6 | 面外问题明确降级并给出四段分类,不伪造数据 | CI:`step_failed(stage=discovery, OUT_OF_SEMANTIC_SURFACE)`,四段分类闭集断言(discovery/generation/execution/presentation),零执行、零文档,转缺口登记确认;另有跨域硬闸用例:模型误产跨域单元时真实执行拒绝(`DQE_QUERY_REJECTED`)不编造;联机:第 4 节 D | ✅ |
| 7 | 追问只变动被提到的部分 | 既有 `orchestrator.test.ts`「一轮同时改口径/筛选/展示;未提及的显式设置保持不变」;联机:第 4 节 B(「只看金融行业」只新增筛选,output_dims、时间、指标全部不变) | ✅ |
| 8 | 刷新后按会话 id 能回放全部步骤;换 mock 用户看不到他人会话 | 新增回放端点与工作台接线(第 2 节);CI:`session-replay-endpoint.test.ts`、`session-replay.test.ts`、存储契约测试;联机:第 4 节 F(归属者 200 回放 12 步,developer-2 404,admin-1 200) | ✅ |
| 9 | 沉淀产出可在管理界面看到的页面修订 | 联机:第 4 节 G——问数文档经 `promoteToDataApp` 换正式 id,`POST /api/pages/{id}/revisions` 存为 R1,`GET /api/pages`(管理台页面清单同一数据源)命中该页面;CI:既有 `promote-flow.test.ts` | ✅ |
| 10 | 验收结论标注为 POC 而非生产就绪,保留四项 blocker | 本报告标题注记与第 7 节 | ✅ |

## 4. 联机手验记录(输出摘要)

环境:DQE 仿真 `127.0.0.1:18228`(复用开发环境实例,健康检查 `{"status":"ok","service":"dqe-sim"}`);平台 dev 于 `127.0.0.1:5176`,`METRICCANVAS_OFFLINE=1`、`DQE_ENDPOINT` 指向仿真、**无 DEEPSEEK key**(`GET /api/agent` → `{"provider":"scripted","model":"component-selecting-scripted"}`,问数走 lexical 确定性回退)。验毕进程已停止。

**A. 完整问数运行**(`POST /api/agent/stream`,问题「上个月各行业的新增客户数是多少?」,session `poc69-a-msr7mnvb`)

```
事件序列: 1:run_started → 2:domain_routed → 3:candidates_retrieved → 4:scope_card_presented
          → 5:execution_started → 6:rows_ready → 7:document_ready → 8:assistant_replied → 9:run_completed
rows_ready: {"rowCount":5,"totalCount":5,"outputFields":["行业","新增客户数"]}
outcome: status=completed, document.id=ask-transient-d248cd73, dataSource type=query, initial rows=5
initial rows 前两行: [{"行业":"金融","新增客户数":642},{"行业":"制造","新增客户数":850}]
assistant: 已完成:业务域「客户经营」,指标 新增客户数,2026-07 ~ 2026-07(month),返回 5 行,呈现为 barChart。
```

**B. 追问只变动被提到的部分**(同会话追问「只看金融行业」)

```
口径卡: {"businessDomain":"客户经营","metricName":"新增客户数","timeRange":"2026-07 ~ 2026-07",
        "granularity":"month","filters":[{"dimension":"行业","values":["金融"]}]}
生效查询 output_dims(不变): ["行业"];filter.dims(仅新增): [{"dim_name":"行业","dim_value_list":["金融"]}]
rows_ready: {"rowCount":1,...}   ← 指标、分组、时间口径均未被改写
```

**C. 换一个同面内组合**(「最近3个月各区域的Tokens消耗量是多少?」——另一域、另一指标、另一维度)

```
rows_ready: {"rowCount":7,"totalCount":7,"outputFields":["区域","Tokens消耗量"]}
initial rows 前两行: [{"区域":"华东","Tokens消耗量":39590062},{"区域":"华南","Tokens消耗量":31500446}]
```

**D. 面外问题明确降级**(「上个月的营业收入是多少?」)

```
事件序列: ... → 4:step_failed → 5:assistant_replied → 6:run_interaction_required
step_failed: {"stage":"discovery","code":"OUT_OF_SEMANTIC_SURFACE",...}
interaction: confirm_gap_entry;outcome 不含 document(未伪造任何数据)
assistant: 语义面内没有能回答该问题的数据能力:…已按发现阶段降级,不编造数据。可确认把该需求登记为指标需求条目…
```

**E. 近义歧义消歧**(「上个月客户数是多少?」,以 ADR-0037 的域改写把业务域改为两域)

```
事件序列: ... → 4:scope_card_presented(blocked) → 5:run_interaction_required(confirm_scope_card)
候选: 客户经营·客户数(期末在册口径,半可加/期末值) / 运营分析·客户数(在用调用口径,不可加/均值)
确认选择「客户经营·客户数」续跑: ... → 3:execution_started → 4:step_failed(execution, DQE_QUERY_REJECTED)
```

消歧阻塞、候选口径差异并列、确认后按用户选中口径进入执行,全部成立;确认后执行失败是已知限制(第 6 节第 1 条),系统如实按执行段降级、不编造。

**F. 会话回放与 mock 用户隔离**(`GET /api/sessions/poc69-a-msr7mnvb`)

```
developer-1(归属者): 200,question=上个月各行业的新增客户数是多少?
回放步骤(同一会话两轮共 12 步): 1:domain_routed → ... → 6:document_ready → 7:domain_routed → ... → 12:document_ready
developer-2(x-mock-actor): 404 {"error":{"code":"SESSION_NOT_FOUND",...}}(与不存在同响应)
admin-1(平台管理员): 200
```

**G. 沉淀为管理界面可见的页面修订**(Run A 文档 → `promoteToDataApp` → 保存修订)

```
保存修订: 201,pageId=poc-issue69-acceptance-msr7mnvb,revisionNumber=1,
          dataContextVersion=2026-07-31.1,createdBy=developer-1
管理界面页面清单(GET /api/pages)命中: {"pageId":"poc-issue69-acceptance-msr7mnvb",
          "latestRevision":{...},"publishedRevision":null,"visibility":"hidden"}
```

## 5. 验收暴露并修复的两个真实缺陷

1. **创作期执行端口的行键空间错误**(`apps/platform/src/lib/server/agent/run-mcp.ts`)。数据网关把行归一化为稳定页面字段 id(`field-1`…),而创作期端口契约是 DQE 原始输出字段名——验真样例行会成为内嵌初始行(ADR-0020:字段键使用 DQE 输出字段名)。生产接线直接透传归一化行,导致问数走真实网关时装配必然失败(`DQE 内嵌初始行缺少映射字段`)。修复:经同一份查询字段映射把行映射回原始键(含明细项字段),归一化校验仍由数据网关执行。此前未暴露的原因:#66 测试用注入的假执行端口,它返回的本来就是原始键行。
2. **检索子串误命中导致误消歧**(`apps/platform/src/lib/server/ask/retrieval.ts`)。「各模型的**新增客户数**是多少?」会把子串「客户数」当作独立概念,在两域并列命中触发无谓的跨域消歧阻塞。修复:每个指标取最长命中词(规范名与别名一并参与),命中词是其他候选更长命中词的真子串时按误命中剔除;「在用客户数」这类别名长命中随之直指单一口径,不再过度澄清(与种子样本 cross-3 的判定预期一致)。代价(已注明):同句并提「客户数和新增客户数」时短词被遮蔽,V0 接受。

## 6. 已知限制与待裁决(如实记录,不掩饰)

1. **生效查询没有业务域承载位**:DQE 请求体只有指标名/维度名/取值/时间,业务域靠名称组合在仿真侧反推。跨域同名指标(两域「客户数」)在取数单元不含任何域内维度或筛选时,即使用户已在口径卡上完成消歧,协议层仍无法定位业务域,执行按 `DQE_QUERY_REJECTED` 如实降级(联机 E、CI clarify 用例)。域如何进入查询协议,关联 ADR 基线未决事项「英文 `metric_code` 与 DQE 中文指标名的关系」,应在接入真实数据源时一并裁决。
2. **lexical 回退模型的路由收窄会掩盖歧义**:scripted 模式下按字面把「客户数」路由到单域,消歧路径需借助域改写演示(联机 E);真实模型把两域都路由进来时不受影响。这是回退实现的已知边界,不是编排缺陷。
3. **当时的会话回放只有只读时间线**:outcome 帧(续跑基线消息、页面文档)未落库,刷新后可复看全部步骤,但不能从回放直接续跑对话或复现文档。**该限制后续已由 ADR-0058 以最新会话检查点解除**;本段保留的是 POC V0 验收时点的事实。
4. **黄金问题集 V0 只有 10 条**:ADR-0037 首版目标 30–50 条;当前语义面是 DQE 仿真的两域小语义面,扩容有效性取决于业务输入(第 8 节),扩容时须递增资产版本,否则准确率历史不可比较。
5. **真实模型评测本轮未运行**:worktree 无 `apps/platform/.env`(DEEPSEEK key 在主检出,不随 git)。运行方式已具备且不进 CI:`pnpm exec tsx --env-file=apps/platform/.env apps/platform/scripts/probe-nl-to-unit.ts --fixture golden-questions.json`,逐条判定与命中率汇总打印,JSON 报告(含 fixture 版本)写入 `.learnings/`;无 key 时优雅跳过。

## 7. 四项 blocker(POC ≠ 生产就绪)

1. **真实数据源**:全部取数发生在 DQE 仿真;真实 DQE 的协议细节(域/schema 承载、指标名唯一性、错误形状)未经验证,语义面也是仿真侧构造的两域样例。
2. **真实身份**:身份是 mock 多用户(`x-mock-actor`),可见性过滤真实执行但来源不可信;接入真实身份是上生产前置条件(ADR-0030),此前不得把会话数据用于跨用户推荐、评测或对外分享。
3. **数据权限**:行级与指标级数据过滤由 DQE 承担还是本平台承担尚未裁决;当前 `actorId` 过滤只保证会话可见性,不保证数据行可见性。
4. **成本配额**:创作期真实执行与每轮问数产生真实数仓成本,按身份的次数与资源限制策略未定;口径卡的「预估成本超阈值阻塞」在成本预估能力具备前处于退化状态(ADR-0032/0037 Consequences)。

## 8. 待业务侧补充输入(黄金问题集扩容与准确率基线的前置)

以下无法从数据推断,本轮一律未编造(ADR-0037 Consequences 原文要求):

- **正式域清单与一句话描述**:当前两域(运营分析/客户经营)是仿真语义面样例,非业务确认的域清单。
- **每域高频指标 top 20 与常见口头说法**:当前别名(如「用量」「在册客户数」)是构造样例。
- **时间口径默认约定**:「本月」是否到昨天、「同比」比同月还是同期累计等;黄金问题集 v0 的 `timeScope` 暂按「完整自然周期、以评测时钟为锚」求值,已在 fixture `$comment` 标注待确认。
- **存量/流量指标划分**:影响可加性与跨时间聚合判定(当前取语义面声明的可加性字段)。

## 9. 验证命令结果(worktree 根,全部通过)

| 命令 | 结果 |
|---|---|
| `pnpm install` | 通过(1.3s) |
| `pnpm test`(先 `pnpm --filter canvas exec svelte-kit sync`) | **119 个测试文件通过、4 跳过;814 用例通过、22 跳过(联机/真实模型类,按设计跳过);既有测试零回退** |
| `pnpm -r check` | 全部包 svelte-check/tsc 0 错误 0 警告 |
| `pnpm validate` | 7 个页面文档全部通过 |
