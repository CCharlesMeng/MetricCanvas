# IOC harness 能力评审(2026-08)

> **先读这个**:可直接派工的事项、内网自查手册、以及**验收能力**这一维(本文五维划分漏掉的、也是最根本的一维)在 [`2026-08-ioc-harness-action-pack.md`](./2026-08-ioc-harness-action-pack.md)。**本文是证据档案**——每条结论的行号、实测命令与推导过程在这里,不必通读。
>
> **性质**:只读评审。对象是 `参考/项目地图/ioc-workflow.md` 描述的 IOC 数据开发 harness 能力集,及其在本仓的实现 `ioc-data-dev/`(v0.1.0)。产出结论、证据、优化建议,不修改任何被评审对象。
>
> **方法**:全部结论落到 `文件:行` 或可复跑的命令。§3 的两条准确性结论来自本次构造的对抗样本实测(命令与样本见 §3.1),不是读码推断。业界实践部分只引一手或准一手来源(Anthropic 官方 skill 指南、harness engineering 综述),用于对照,不用于论证本仓事实。
>
> **与 `docs/plan/ioc-data-dev-soundness.md` 的关系**:那份方案关闭"声明与执行之间的断链",本文评审"声明本身的形状与代价"。重叠处显式标注 `[已覆盖]` 并只补充新证据,不重复论证。§8 给出一处对该方案**排期的修正建议**——按现有顺序执行会把假告警升级成硬阻塞。
>
> **修订 v1.1(2026-08-24)**:§9 的四项裁决已由项目负责人回答——①外部 CLOUDIOC-SDD 工作区**完整**;②目标用户是**不熟悉 IOC 流程但需要逐步熟悉的人**;③依赖问题转为"有什么风险",见 §8.3;④平台回执自动获取**较困难但保留可能**,见 §8.4。裁决①推翻了 v1.0 的主结论,§0 与 §1 已重写;裁决②新增 §6.3;裁决①另新增 §7.5。v1.0 的原结论("声明规模远超经验规模")保留在 §9.1 作为对照,不删除。

---

## 0 执行摘要

**一句话结论**(裁决①之后):上游完整,所以问题不是"声明超前于经验",而是**移植只搬了声明层,判据层被留在原地或就地重写,且两侧都没有测量过它的精度**。

`ioc-data-dev/` 完整拷贝了上游的注册表——58 个 skill 白名单、20 个校验器映射、11 节点 artifacts DAG、12 个 gate、`behavioral-guards.yaml` 与 `template-constraints.yaml` 两份守卫声明——却只带过来 **6 个校验器、0 个 hook**(实测,见 §6.1、§7.1)。而带过来的这 6 个,在真实 SQL 上的表现是**反向的**:拦合法的、放违规的(§3.1 实测,可复跑)。

于是三件事同时成立,它们互相放大:

1. **声明层因为"在上游是真的"而显得权威。** Agent 无法分辨哪 15% 是活的——它读到的白名单、DAG、守卫定义全都语气一致。这比"声明是草稿"更危险,因为没有任何线索提示不可信。
2. **判据层的精度从未被任何一侧测量。** 两侧都没有 GREEN/RED 语料。如果这 6 个脚本是**原样移植**,那么 §3.1 的注释误判(把注释里的 `hive/bi_test` 当成除法分母)**此刻正运行在上游的生产链路里**——这一条待 §9.2-U1 确认,但它决定修复该落在哪一侧。
3. **两份拷贝、无 lock、无方向约定。** `.learnings/ledger.md` 的 `knowledge.doc-stale` 已计数 2 次(本仓跑着过期的 vendored skill 而源仓已前进)。同一个洞在这里第三次打开,而且这次两侧都是"权威"。方向错了,修复会被下一次同步冲掉(§7.5)。

`docs/plan/ioc-operation-map.md:72` 那条原则仍然适用,只是适用对象从"建能力"变成"排移植顺序":

> 每个业务页只拉动它真正需要的框架能力。不预先把框架建全——没有真实页面拉动的能力,边界一定定错。

上游已经有真实运行经验,**但传下来的是形状,不是频次**。当前 6 个已移植校验器管的是别名、`SELECT *`、嵌套层数——LLM 很少犯的表面问题;最值钱的列引用校验(soundness P1-1)与分层校验(本文 §3.3)都没来。这不是巧合,是"按注册表顺序移植"的必然结果。**上游的拦截频次是现成的排序依据,把它取过来即可**(§8.2 R18′)。

五个维度各自最大的单项问题:

| 维度 | 最大单项问题 | 证据锚点 | 建议 |
|---|---|---|---|
| 准确性 | 已实现校验器在合法 SQL 上产生**无法修复的假 FAIL**(注释里的 `hive/bi_test` 被当成除法分母),同时对 ADS 直读 ODS + 编造列名**全部放行** | §3.1 实测 | R1 R2 R5 |
| 执行效率 | 同一份 SQL 被校验两遍(守卫自动跑 + skill 指示再跑);全流程无任何运行日志,削减上下文的收益无法验证 | §4.1 §4.3 | R6 R8 |
| 交互体验 | fail-closed 系统的错误信息就是 UI:BLOCKED 只给原因不给出路;工作台的流水线与澄清列表**恒为空**(已核实,原为待确认) | §5.1 §5.3 | R9 R11 |
| 使用者认知负担 | `AGENTS.md §2` 规定开工前按序读 6 份文件 = **25,957 字节**,其中最大的一份里 50/58 个 skill 在磁盘上不存在;新人要面对约 138 个具名实体而没有"先记哪 5 个"的答案 | §6.1 §6.3 | R12 R13 R19 |
| 维护者认知负担 | 三套声明(artifacts DAG、behavioral-guards.yaml、template-constraints.yaml)**没有任何代码读取**,却需要人工同步;插件与上游之间**没有方向约定也没有 lock** | §7.1 §7.5 | R14 R15 R20 R21 |

**新增的高危发现(soundness 方案未覆盖)**:

1. **F2 · 假 FAIL 与批次 A 冲突(§3.2)。** A1 把 `guard-report.md` 的 FAIL 升级为 BLOCKED,而当前校验器会对合法 SQL 报 FAIL,且 guard-report 从不删除。按现有排期执行,第一份合法 SQL 就会把 feature 永久阻塞。**B2(成对 fixture)必须前移到 A1 之前。**
2. **F3 · 分层公理在 SQL 上没有判据,补齐 21 个校验器也拦不住(§3.3)。** `schema.yaml:281-292` 给 hql 挂的校验器清单里没有 `validate_layer_consumption.py`——它只挂在 `sql-source-bindings.yaml`(:276-280)这份由 Agent 自己写的中间产物上。
3. **F11 · artifacts DAG 与两份守卫声明从未被执行(§7.1)。** 11 节点的 `requires` 边(`schema.yaml:73-128`)无人读取,真正生效的是 `blocks_when.py:29-44` 手写的另一份字典,两者内容不同。实测:`mock-data-plan.md` 不存在,`job-create` 门禁照样 PASS。同一位置还有:`delta-design-ads.md` 写入后零守卫。
4. **F13 · 阶段感知的能力过滤缺前置条件(§7.3)。** C3 第 4 点想按当前阶段过滤 skill 白名单,但"当前阶段"目前只在 `dsh/api.js:133-152` 的 web 侧从 gates 反推,Python 门禁与 skills provider 都不知道它。**先要有单一真源的 `current_stage` 字段。**
5. **F15 · 移植方向未定义,修复会被下一次同步冲掉(§7.5,裁决①之后新增)。** 上游完整意味着插件是一个 fork。当前没有任何文件记录"这份是从上游哪个路径、哪个时点取来的",也没有约定哪类文件的修改该往哪边流。soundness P3-2 只覆盖 preset↔plugin 的版本握手,范围不到上游。

裁决②(目标用户是需要逐步熟悉流程的新人)把上表的**交互体验与使用者认知负担从 P2 提到 P0/P1**,理由不是"体验重要",而是:**对新人而言误报的代价是双倍的——既费一轮修复,又教会一条不存在的规则**。§3 的精度问题因此从技术债升级为教学债。§6.3 与 §8.2 已按此重排。

---

## 1 我读到的目的与规划取向

**目的**(用于校准后文的判据,若理解有偏请在 §9 纠正):把一套组织内既有的数据开发流程(PRD → 指标盘点 → ADS 设计 → 绑定 → SQL → 作业 → 平台试算 → 归档),从"靠人记纪律"变成"靠机制强制":纪律写成公理与策略,产物写成契约,推进写成门禁,领域知识写成可查基线,让 Agent 在其中执行且**无法自我放行**。`ioc-workflow.md` 是外部 CLOUDIOC-SDD 工作区的能力地图,`ioc-data-dev/` 是把它移植成一个可分发 DSH 插件的第一版。

**规划取向的强项**——这几条在同类文档里少见,值得保留为习惯:

- **证据带行号,结论可反驳。** soundness 方案每条问题都能被独立复核,§1.3 还主动划出"未逐行复核"的边界。
- **每项改动写"失效条件"。** 这是把验收从"做完了"变成"能观察到"的关键动作,业界 harness 清单里的 `Verification` 一栏通常只写"要有测试",你写到了"什么结果说明这次改动没生效"。
- **诚实的完成度。** A3 要求打印 `skill 8/61 · validator 9/30`,并预判这个数字会被误读成"项目很差"——把度量与情绪分开。
- **失败分层与复发计数。** `.agents/skills/session-optimize/references/failure-map.md` 的 L1–L5 + `Pattern-Key` + 复发门槛,是一套真正的失败归因协议,不是事后总结模板。
- **明确不做。** soundness §5 六条"不做",避免方案膨胀。

**取向上的系统性偏差**——这是本文所有建议的共同根源:

> **你把"形状"移植得完整,把"经验"留在了上游。**

一次移植可以搬四样东西:形状(注册表与词汇)、判据(校验器与门禁)、经验(什么真的会出错、多久出错一次)、回路(样本、CI、trace、失败分类)。实测这次搬了第一样、搬了 1/3 的第二样、第三第四样一样没搬:

| 层 | 上游(裁决①:完整) | 移植到插件 | 缺口的后果 |
|---|---|---|---|
| 形状 | 完整 | **100%**(58 skill / 20 校验器映射 / 11 节点 DAG / 12 gate / 2 份守卫声明) | 权威语气覆盖了不可用的部分 |
| 判据 | 完整(50+ 脚本、14 hook) | **6 个校验器、0 个 hook** | 声明与判据比 ≈ 3:1,Agent 以为产物已被校验 |
| 经验 | 有(真实 feature 在跑) | **0**(拦截频次、失败分类、常见返工点都没带过来) | 移植顺序只能按注册表排,而不是按价值排 |
| 回路 | 未知(§9.2-U3) | **0 组成对样本、0 条 CI、0 份运行日志** | 精度、误报率、上下文成本三项都无基线 |

证据:`tests/dsh-index.test.js` 全文 73 行 2 例,且两例都只测 `webServer` 注入;`package.json` 无 `scripts` 字段(`npm test` 未定义);`harness/tools/` 6 个校验器无一有配套样本。

**这不是能力缺失,是能力未迁移。** soundness `P3-1` 自己记了对照:同一作者的 `sdd-dev-frontend` 有约 5,700 行脚本配约 4,200 行测试和一个 22/22 覆盖率棘轮。前端域的回路是完整的。所以后文所有"补回路"的建议,都是搬运而不是新建——**而且现在多了一条更省的路:第三样(经验)可以直接从上游取,不必重新积累**(§8.2 R18′)。

---

## 2 已有方案覆盖了什么(不重复的边界)

soundness 方案已充分论证、本文不再展开的:

| 问题 | 编号 | 本文态度 |
|---|---|---|
| guard-report 无人读取,守卫链空转 | P0-1 | `[已覆盖]`,但 §3.2 补一条它与假 FAIL 的**交互风险** |
| `gate=pass` 不需要被挣得 | P0-2 | `[已覆盖]`,§7.2 补一条**同类模式的泛化**与一处证据纠正 |
| 注册表与磁盘无一致性约束 | P0-3 | `[已覆盖]`,§7.1 补三处 A3 清单未覆盖的声明 |
| `validate_sql_column_refs.py` 缺失 | P1-1 | `[已覆盖]`,§3.3 补"补齐后仍有缺口"的证据 |
| RED fixture 放在交付目录 | P1-2 | `[已覆盖]`,§8 建议**提前执行** |
| blocks_when 独立路径不阻塞 | P1-3 | `[已覆盖]` |
| `job-create` 一个 stage id 承担两次 | P1-4 | `[已覆盖]` |
| 真源重复(gate/公理/PAT-DOM/分层) | P2-1 | `[已覆盖]`,§7.1 补三处新的重复 |
| 基线未命中行为未定义 | P2-2 | `[已覆盖]` |
| 常载上下文重复计费 | P2-3 | `[已覆盖]`,§6.2 纠正一处量级估算 |
| 交互契约缺失,BLOCKED 无出路 | P2-4 | `[已覆盖]`,§5.3 把"待确认"部分核实为确认 |
| 无测试与 CI | P3-1 | `[已覆盖]`,§4.3 补"缺 trace 导致无法验证 C3" |
| plugin/preset/workspace 无版本握手 | P3-2 | `[已覆盖]` |

---

## 3 准确性

### 3.1 F1 · 已实现的校验器同时产生假阳与假阴,且假阳无法修复

**复跑方式**(两份样本全文见文末附录 B,落盘到任意路径即可):

```bash
cd ioc-data-dev
python3 harness/tools/validate_sql_etl_patterns.py <A>.sql   # 期望 PASS,实测 FAIL 3 项
python3 harness/tools/validate_domain_patterns.py  <B>.sql   # 期望 FAIL,实测 PASS
python3 harness/tools/validate_sql_ddl.py          <B>.sql --engine hive --test   # 期望 FAIL,实测 PASS
```

**样本 A(合法 SQL,应 PASS)**:标准测试态 DDL + CTE + `INSERT OVERWRITE ... PARTITION`,聚合含 `COUNT(DISTINCT src.order_id)`,除法用 `NULLIF` 保护,首行注释写 `-- 合规意图:统计客户订单数与客单价(hive/bi_test)`。

实测 **FAIL,3 项**:

```
[FAIL] POL-SQL-ETL-009: 聚合 COUNT(...) 内部 COALESCE      ← ×2
[FAIL] POL-SQL-ETL-006: 分母 bi_test 未用 NULLIF(分母为 0 → NULL)
```

- `COUNT(DISTINCT x)` 内部套 `COALESCE` 在语义上是错的(会把 NULL 计入基数),校验器却把它作为必要条件。成因:`validate_sql_etl_patterns.py:75-80` 对每个聚合函数取其后 200 字符找 `COALESCE`,不区分聚合种类。
- **"分母 `bi_test`" 来自注释里的 `hive/bi_test`。** 成因:`:38` 的 `DIV_RE` 直接在全文匹配 `x / y`,`:87-92` 未剥离注释与字符串字面量。同一原因在样本 B 上把 `KW-AX8/POL-DESIGN-001` 里的 `POL` 报成分母。

**这一项的后果不是"少拦一次",是判据不可修复。** 使用者拿到 `分母 bi_test 未用 NULLIF`,SQL 里没有任何叫 `bi_test` 的分母;唯一的"修法"是删掉注释。一个改不动的 FAIL 会训练出两种行为:忽略 FAIL,或删注释迎合校验器。两种都比没有守卫更坏。

**样本 B(违规 SQL,应 FAIL)**:ADS 表直接 `FROM ods_t_crm_customer_raw`(违反 KW-AX8 / POL-DESIGN-001,是整个垂直域最硬的一条分层公理),并引用 `raw.column_that_does_not_exist`(违反 CORE-AX3)。

实测:`validate_domain_patterns.py` **PASS**、`validate_sql_ddl.py` **PASS**、`validate_sql_etl_patterns.py` 唯一的 FAIL 是上面那条注释误报。**两条最重的违规零拦截,唯一的告警来自注释。**

**附带发现:红 fixture 自身有一条假 PASS。** `examples/.../hql_test/bad_ads_...test.sql` 第二条语句 `SELECT party_id, active_cnt / total_cnt FROM t1` 的字段完全没有表别名,而 `POL-SQL-QRY-002` 判定 PASS。成因:`:61` 的 `SELECT\s+(.*?)\s+FROM` 非贪婪只匹配文件里**第一个** SELECT(即 `SELECT * FROM`)。这条假 PASS 之所以没被发现,正因为该文件在其他检查上已经 FAIL——**"红 fixture 整体 FAIL"不能证明每条检查都有效。**

> **R1 · 给每个已实现校验器建立精度基线,再谈把它接进阻塞路径。** 每条策略一对 GREEN/RED 最小样本(不是每个校验器一对),跑出"该策略是否恒真/恒假"。这正是 soundness B2,建议扩展为**逐策略**而非逐校验器,并前移(见 §8)。
> **失效条件**:某条 RED 样本通过校验,或某条 GREEN 样本被拦——说明该策略名义存在、实际是噪音。

> **R2 · 正则校验器统一剥离注释与字符串字面量,并按语句切分。** 一个共享的 `sql_text.py`:去 `--`/`/* */`、去引号内内容、按 `;` 切语句,所有 SQL 校验器改为逐语句检查。这一步能同时消掉上面三类误判,成本远低于引入解析器。
> **失效条件**:注释或字符串里的内容仍能改变校验结论。

> **R3 · 把"精度未知"写成机器可见的状态,而不是隐性知识。** 给每条策略加 `enforcement: blocking | advisory | declared`。只有配了成对样本并跑通的才允许 `blocking`;`advisory` 的 FAIL 不进阻塞路径,只进报告。README 的完成度数字改为从这个字段汇总,而不是靠文件存在性反推。
> **失效条件**:出现 `enforcement: blocking` 而无对应样本的策略。

### 3.2 F2 · 假 FAIL 与 soundness 批次 A 的交互:会产生不可解除的永久阻塞

三条事实叠加:

1. `dsh/guards.js:95` 对任何 `hql_test/` 或 `hql/` 下的 `.sql` 写入,自动跑 `:86-88` 的三个校验器。
2. `dsh/guards.js:110` 把 `guard-report.md` 写在**被写文件的同目录**,`:113-129` 只在 FAIL 时写、**从不在 PASS 时删除**(soundness P0-1 已记为"附带缺陷")。
3. soundness A1 计划让 stage gate 读该文件,含 FAIL 即 BLOCKED。

**合成后果**:把 §3.1 的样本 A(完全合法)写进 `hql_test/`,守卫写出 FAIL 节 → 门禁 BLOCKED → 使用者按提示去修 SQL,但 SQL 没有错 → 唯一出路是删注释或手删 guard-report(后者正是 CORE-AX9 禁止的"绕过")。**fail-closed 的前提是判据可靠;判据不可靠时,fail-closed 会把误报变成停工。**

> **R4 · A1 的合入前置条件:接进阻塞路径的校验器必须先有精度基线(R1),且 guard-report 必须先有生命周期。** soundness A1 已包含"PASS 时删除对应节",顺序上必须是:先 R2(消掉已知误判)→ 再 R1(证明不恒真/不恒假)→ 才 A1(升级为阻塞)。
> **失效条件**:合法 SQL 写入后门禁 BLOCKED,且无法通过修改 SQL 语义解除。

### 3.3 F3 · 分层公理在最终产物上没有判据(补齐 21 个校验器也拦不住)

`schema.yaml` 的 validation 段对两类文件的挂法不同:

- `sql-source-bindings.yaml`(:276-280):挂了 `validate_layer_consumption.py`(KW-AX8)。
- `hql_test/*_test.sql` 与 `hql/*.sql`(:281-292):挂了 ddl / etl / domain-patterns / file-naming / column-refs——**没有 layer-consumption**。

也就是说,即便按注册表把 ~21 个缺失校验器全部补齐,"ADS 直读 ODS"这条 BLOCKED 级策略的唯一判据仍然落在 `sql-source-bindings.yaml` 上——一份**由 Agent 自己声明来源表的中间产物**。SQL 里真实 `FROM` 了什么,没有任何一条规则去读。§3.1 样本 B 就是这条缺口的实证。

这与 soundness P0-2(`gate=pass` 由 Agent 自述)是**同一类错位**,泛化表述见 §7.2。

> **R5 · 每条 BLOCKED 级公理至少要有一条判据落在不可自述的产物上。** 对 KW-AX8:把分层检查加到 hql 的校验器清单里,直接从 SQL 的 `FROM/JOIN` 表名前缀判分层,而不是读绑定文件。表名 → 分层的映射真源用 `knowledge-base/ontology/ontology-layers.yaml`,读不到即 FAIL(不回退内置)。
> **失效条件**:一份 `FROM ods_*` 的 ADS SQL 通过全部校验。

---

## 4 执行效率

### 4.1 F4 · 同一份 SQL 被校验两遍

`dsh/guards.js:169-185` 在写后自动跑 `validate_sql_ddl / validate_sql_etl_patterns / validate_domain_patterns`;而 `skills/sql-generator/SKILL.md`「生成后」段又指示 Agent 依次调用 `ioc_validate(validator=sql-ddl|sql-etl|domain-patterns)`。同一份文件、同三个脚本、跑两遍;第一遍的结果只在 FAIL 时落 guard-report(Agent 看不到),第二遍的完整输出进上下文。

`skills/sql-validator/SKILL.md`「执行」段第 1 步再来一遍,`harness/stages/06-sql-generate.md` 的 DoD 又列一遍。**同一动作在四处被规定。**

> **R6 · 守卫结果回传给 Agent,skill 侧删掉手动重跑。** 写后守卫已经有结论,把它作为 `post-execute` 的返回内容注入(PASS 一行、FAIL 明细),skill 与卡片改为"读守卫结论",不再自行调用。省一半校验开销,并消除"两次结果不一致时信哪个"的歧义。
> **失效条件**:Agent 仍在写后自行调用同名校验器。

### 4.2 F5 · 门禁输出的噪声比

实测进入 `sql-generate` 的门禁输出 12 行,其中 11 行是 PASS 明细;`gate 值全部合法` 出现两次——`sdd_stage_gate.py:52-57` 与 `blocks_when.py:131-135` 各查一遍同一件事。16 个阶段每阶段至少一次,全部进上下文。

> **R7 · PASS 时只输出一行摘要,明细留给 `--verbose`;去掉重复检查。** 门禁的默认输出应当是 `PASS sql-generate(3 gate · 3 契约)` 一行;BLOCKED 时才展开。
> **失效条件**:PASS 路径的输出仍超过 2 行。

### 4.3 F6 · 没有 trace,所以效率与准确性的改动都无法验证

工具只返回文本(`dsh/index.js:118-123`、`:156-162`),守卫只在 FAIL 时落盘,`harness/tools/` 无任何日志写入。全仓没有一份记录"哪个阶段、跑了哪些判据、耗时多少、结论是什么"的文件。

直接后果:soundness C3(削减常载上下文)的验证方式写的是"改前/改后各测一次首轮上下文规模"——**当前没有任何机制能测出这个数**;C3 的失效条件"Agent 开始忘记跑门禁"也需要 trace 才能观察到。同理,R1 的精度基线、R6 的开销削减,都需要一个共同的数据源。

业界 harness 清单把 Observability 与 Evals 并列为两项独立门槛(deepset《Harness Engineering》把"失败分类"称为该回路的前提:没有结构化 trace,失败归因就是猜)。你自己的 `failure-map.md` 就是一套失败归因协议——但它目前只作用于**会话复盘**,没有作用于**流程运行**。

> **R8 · 每次 `ioc_stage_gate` / `ioc_validate` 追加一行 JSONL 到 feature 目录的 `run-log.jsonl`。** 字段:时间、stage、判据 id、结论、耗时、被检文件。它同时是四件事的数据源:D1 的回归语料、A3 完成度的分母、C3 的效率基线、`failure-map.md` 在流程层的输入。成本约 20 行 Python。
> **失效条件**:跑完一个 feature 后无法回答"哪条判据最常 FAIL、每阶段平均几次工具调用"。

---

## 5 交互体验

### 5.1 F7 · BLOCKED 没有出路(补强 soundness C4 的形状)

实测 `promotion` 阶段的 BLOCKED 输出:

```
[RESULT] BLOCKED — 停工(CORE-AX9 Fail-Closed)
  - gate test_execution = not_started(需 pass)
  - gate platform_test = not_started(需 pass)
```

它说了"哪条不满足",没说"谁能让它满足"。而这个信息**系统里已经有**:`schema.yaml:244-249` 记着 `test_execution` 与 `platform_test` 的 `setter` 都是 `platform-test`,`stage-index.yaml` 记着该阶段的卡片是 `06b-platform-test.md`。soundness C4 提出的四元素(公理 · 文件:行 · 建议动作 · 可否 waive)方向正确;这里补一点:**这四元素不必人工撰写,三项可以从注册表自动生成。**

> **R9 · BLOCKED 的每条原因自动带上"由谁产出 / 读哪张卡片 / 跑哪条命令"。** 从 `gates` 段的 `setter` 与 `stage-index.yaml` 反查即可。这也顺带给 gate 词汇表加了第一个机器消费者——`gates-glossary.md` 目前被 6 份文档指向,`.py`/`.js` 里的引用数为 **0**。
> **失效条件**:随机取 3 条 BLOCKED,没读过规格的人无法照着修好(沿用 C4 的判据)。

### 5.2 F8 · 12 个 gate 里有一对语义重复

`schema.yaml:244-249`:`test_execution` 与 `platform_test` 的 `setter` 同为 `platform-test`,`blocks` 同为 `[promotion]`。两个字段、同一置位者、同一阻塞对象。实测 `promotion` 的 BLOCKED 因此永远成对出现,使用者看到两条原因、修一件事。

> **R10 · 合并为一个 gate,或在词汇表里写清二者的差别。** 若差别是"平台执行"与"业务验收"两件事,则 setter 应当不同;若没有差别,12 个 gate 应当是 11 个。
> **失效条件**:仍存在两个 gate 无法用一句话说清差别。

### 5.3 F9 · 工作台的流水线与澄清列表恒为空(soundness 的"待确认"已核实)

soundness P2-4 把这条列为"盘点结论(待确认)"。本次核实,结论成立且可定位:

- `dsh/client.js:272` 只请求 `/ioc-api/features`。
- 该端点的返回体由 `dsh/api.js:228-239` 构造,字段为 `feature_id / feature_name / main_path / engine / version / dir / current_stage / gate_summary / artifact_summary / open_p0_count`——**不含 `stages`,不含 `clarifications`**。
- 而面板渲染的是 `sel.stages`(`client.js:244`)与 `sel.clarifications`(`:251`)。
- 这两个字段只有详情端点 `/ioc-api/feature?path=` 才返回(`api.js:181-205`,由 `parseClarifications` 与 `deriveStages` 填充),而**该端点全仓无调用方**。

所以:阶段流水线那一行永远不渲染,未决澄清列表永远不渲染。`api.js:127-152` 的 `deriveStages` 是一段完整实现但无人消费的代码。另:`IOCC` 拼写出现在 `client.js:207`、`:211`、`:220` 三处。

> **R11 · 选中 feature 时请求详情端点。** 一处 fetch。这条的价值不在工作台本身,而在于:`deriveStages` 是全仓唯一一处"从 gates 推出当前阶段"的实现,它一旦被真正使用,就会暴露该推断是否正确——见 §7.3。
> **失效条件**:选中 feature 后流水线仍不显示。

---

## 6 使用者认知负担

### 6.1 F10 · 开工前的规定阅读量:25,957 字节,其中最大一份的多数内容指向不存在的东西

`ioc-data-dev/AGENTS.md:16-23` 规定"先读什么(按序)"六份文件。实测字节数:

| 文件 | 字节 |
|---|---|
| `codespec/schemas/ioc-workflow/schema.yaml` | 12,259 |
| `codespec/guidelines/ioc-kernel/policies-index.yaml` | 4,797 |
| `codespec/guidelines/ioc-kernel/core-ontology.md` | 3,036 |
| `codespec/guidelines/ioc-kernel/gates-glossary.md` | 2,500 |
| `codespec/guidelines/ioc-kernel/contracts-index.md` | 2,500 |
| `harness/stages/03-ads-design.md`(当前阶段卡片) | 865 |
| **合计** | **25,957** |

最大的一份里,`skills` 白名单占 `:134-213` 共 80 行、58 个 id,其中 50 个在磁盘上不存在;`validation` 段 `:261-298` 引用 20 个不同脚本,**磁盘上只有 6 个**(实测:`validate_ads_clarification` / `validate_domain_patterns` / `validate_gate_change` / `validate_lifecycle_columns` / `validate_sql_ddl` / `validate_sql_etl_patterns`)。**规定阅读量的一半以上指向不可执行的声明。**

此外 `contracts-index.md` 只被两份人读文档以"真源位置"的形式指向(`AGENTS.md:22`、`core-ontology.md:12-13`),**没有任何代码读取它**——契约的 tier 与路径不参与任何判定,却排在开工必读第 5 位。

对照 Anthropic 的 skill 指南:第一层只应常驻 `name` + `description`,第二层是被触发的 SKILL.md 正文(建议 < 500 行),可枚举的明细进第三层 `references/` 按需读取。这套 harness 把"注册表全文"放进了第一/第二层。

> **R12 · 把 `AGENTS.md §2` 从"读六份文件"改为"三步定位 + 按需取"。** 常驻只留:当前阶段怎么定位、卡片在哪、门禁怎么跑;公理只留不可协商的三条(AX9/AX8/AX10)。注册表明细改为工具可取(`ioc_query(what=gates|policies|contracts, stage=...)`),而不是让 Agent 通读 YAML。
> **失效条件**(沿用 C3 的判据,更严):Agent 开始忘记跑门禁或忘记 AX8。出现即把对应条目移回常驻。

> **R13 · 声明里"未实现"的部分对 Agent 可见。** 给白名单每个 id 加 `status: implemented | declared`。这比 A3 事后用文件存在性反推更早生效——Agent 读注册表时就知道哪些能用。soundness A3 的完成度表可以直接从该字段汇总。
> **失效条件**:Agent 路由到一个不存在的 skill。

### 6.2 一处量级纠正:常载成本没有那么大,砍的时候别砍错对象

soundness P2-3 写「`preset/agent.cordis.yml`(278 行)在系统提示里重述人格 + CORE-AX + 15/13 阶段,每轮都付」。实测:该文件真正进提示的只有 `:27-55` 的 persona 文本,**3,215 字节**;其余 250 行是 DSH 宿主组合的 tool/service 行(`tool-bash`、`compaction-basic`、`tool-subagent` 等),不进模型上下文。

真实的常载账本:

| 项 | 字节 | 何时付 |
|---|---|---|
| persona(`preset:27-55`) | 3,215 | 每轮 |
| `AGENTS.md` | 3,127 | 每轮(规则自动附加) |
| 8 个 skill 的 description | 2,813 | 每轮 |
| `skills/ioc-vertical/SKILL.md` | 3,000 | 触发时 |

即每轮约 9.2 KB,而 §6.1 的开工阅读是一次性 26 KB。**优化的主战场是规定阅读量,不是 persona。** C3 若只砍 persona,收益约 3 KB 且直接损失纪律提示——性价比最差的一刀。按 `description` 2,813/8 ≈ 352 字节的比例,58 个 skill 全落地后常载 description 约 20 KB,那时 C3 第 4 点(按阶段过滤)才是主战场,而它有前置条件(§7.3)。

### 6.3 F14 · 两类读者被同一份文件服务,而要记的具名实体约 138 个(裁决②之后新增)

裁决②把使用者从"作者本人"改成"不熟悉 IOC 流程、但需要逐步熟悉的人"。这个改动暴露一个此前不成问题的结构问题:**`AGENTS.md` 同时服务两类读者,而两类读者的最优形状相反。**

| 读者 | 需要什么 | 最优形状 |
|---|---|---|
| Agent | 当前该做什么、判据在哪、怎么跑 | 最短路径,三步收口,可枚举内容改为工具取 |
| 新人 | 为什么有这套流程、一个 feature 长什么样、这个词第一次在哪出现 | 有顺序的课程,带 why,允许长 |

当前 `AGENTS.md` 是第二种的骨架(四仓契约、先读什么、核心纪律、阶段流程、工作区布局),被当第一种用(规则自动附加,每轮计费)。结果两边都不达标:Agent 每轮付 3,127 字节读一份导航,新人拿到一份导航却学不到流程。

**词汇量清点**(按 `ioc-workflow.md` 与 `core-ontology.md` 逐项数):

| 类别 | 数量 | 备注 |
|---|---|---|
| CORE-AX 公理 | 8 | 编号跳过 AX2/AX7(`core-ontology.md:39` 写"保留不占位") |
| KW-AX 公理 | 4 | 编号为 3/5/7/8,同样不连续 |
| 顶层类 | 15 | |
| 门禁类型 | 5 | Invariant / DoD / Decision / Handoff / Playbook |
| manifest gate 字段 | 12 | 其中一对语义重复(§5.2) |
| POL-DESIGN | 9 | |
| POL-SQL | 15 | DDL 6 · ETL 6 · QRY 3 |
| PAT-DOM | 9 | SITE 4 · SRC 5 |
| 契约层 | 4 | Deliverable / Evidence / Governance / Asset-Delta |
| 产物等级 | 3 | L1 / L2 / L3 |
| 指标生命周期版本 | 4 | v0→v3 |
| 阶段 | 16 | data 主路径;subject 另 13,共享 6 张卡片 |
| activity | 34 | |
| **合计** | **≈138** | |

**新人要先记住哪 5 个?文档没有答案——每一份都是全量呈现。** 两处不连续编号(AX2/AX7 空缺、KW-AX 只有 3/5/7/8)是白送的绊脚石:新人第一反应是"我漏了 AX2 吗",而正确答案是"上游文档没写过它"。

更关键的一条,把裁决②与 §3 连起来:**对新人,误报的代价是双倍的。** 熟练者看到 `分母 bi_test 未用 NULLIF` 会判断这是校验器的 bug 并跳过;新人会认为自己不懂某条规范,然后去改注释,并**把"注释里不能出现斜杠"内化成一条规则**。误报在新人身上不是噪音,是错误教学。这就是 §8.2 把 R2/R1 与 R9 一起放进 P0 的理由。

> **R19 · 拆两类读者,并给新人一个"最小可用集"。**
> ① `AGENTS.md` 只留三步路由(定位阶段 → 读卡片 → 跑门禁)+ 不可协商三条(AX9/AX8/AX10)+ 指针,与 R12 同批;
> ② 新增 `ONBOARDING.md` 承接课程职责:一个真实 feature 从 intake 到 archive 的完整走查(可直接用 §8.2 R18″ 那一趟的 run-log 生成),每个术语在第一次用到它的地方解释,其余 130+ 个实体一律"被门禁提到时再查";
> ③ 只要求新人先掌握 5 个概念:feature 目录、`change-manifest.yaml` 的 gates、阶段卡片、BLOCKED 的读法、澄清项;
> ④ 补齐 AX2/AX7 与 KW-AX 编号缺口的一句说明,或在本仓改为连续编号并记一条与上游的差异(受 §7.5 的方向约定管辖)。
>
> **失效条件**:新人读完 `ONBOARDING.md` 后,仍需要有人口头解释才能独立推进第一个阶段。

---

## 7 维护者认知负担

### 7.1 F11 · 三套声明无人读取,却需要人工同步

| 声明 | 规模 | 谁读它 | 后果 |
|---|---|---|---|
| `schema.yaml:73-128` artifacts DAG(11 节点 + requires 边) | 56 行 | **无**(`rg` 只命中 `api.js:161` 读 manifest 的 artifacts 段,与 schema 的 DAG 无关) | 真正执行的是 `blocks_when.py:29-44` 手写的 `STAGE_CONTRACTS`,内容与 DAG 不同 |
| `behavioral-guards.yaml`(4 hook + 8 结构守卫 + 3 语义守卫) | 133 行 | **无**(仅出现在 `guards.js:16` 的注释"与…对齐") | 实际生效的是 `guards.js:17-83` 的 JS 对象字面量 |
| `template-constraints.yaml`(8 类文件的 rules + required_reads) | 61 行 | **无** | `required_reads`(写 DDL 前注入规范 section)这一整个机制没有实现 |

**已经发生的漂移,一处实测**:`blocks_when.py:37` 规定 `job-create` 只需 `validation-report.md`;而 DAG(`schema.yaml:114-118`)规定 `validation-report` requires `mock-data-plan`。示例 feature 里 `mock-data-plan.md` **不存在**,`python3 harness/tools/sdd_stage_gate.py --feature examples/0.1.0/fw-2026-0818-001 --stage job-create` 返回 **PASS**。DAG 的边从来没有被执行过。

**第二处漂移**:`behavioral-guards.yaml:98-102` 给 `delta-design-ads.md` 声明了三个校验器,而 `guards.js:17-83` 的 `CONSTRAINED` 里**没有这个文件名**。结果:**全流程最核心的设计产物写入后零守卫**,而 SQL 的表面规则有三个守卫。

soundness A3 的 9 项一致性检查覆盖了 skill/validator/stage 数量,**没有覆盖这三处**。

> **R14 · A3 增加三项检查。** ①`schema.yaml` 的 DAG requires 边 ⊆ `blocks_when` 实际执行的契约集(或反过来:让 `blocks_when.py` 直接读 DAG,删掉 `STAGE_CONTRACTS`);②`behavioral-guards.yaml` 的 `structural_guards` 与 `guards.js` 的挂载表逐项对齐;③`template-constraints.yaml` 的每条 `file` 在 `guards.js` 有对应规则,`required_reads` 有实现或标注 `declared`。
> **失效条件**:改 DAG 或改 behavioral-guards 而不改代码,一致性检查仍全绿。

> **R15 · 更省的终局:让 `blocks_when.py` 与 `guards.js` 都从 YAML 读,而不是各存一份。** soundness C1 逐项指定真源的方向对,但 §7.1 这三处的真源目前是**代码**、YAML 是影子。方向应当反过来:YAML 是真源,代码是解释器。JS 侧取值走 `py('dump_*.py', ['--json'])`(C1 已有此模式),不引入第二个 YAML 解析器。

### 7.2 F12 · 一个可泛化的模式:判据落在"自述的中间产物"上

三处独立发现指向同一个结构问题:

| 公理 | 当前判据 | 判据是谁写的 | 落点 |
|---|---|---|---|
| CORE-AX9 门禁不可绕过 | `change-manifest.yaml` 的 `gates.*` | Agent | soundness P0-2 |
| KW-AX8 ADS 禁消费 SDI/ODS | `sql-source-bindings.yaml` 的 source 分层 | Agent | 本文 §3.3 |
| 产物完成度 | manifest 的 `artifacts:` 段 | Agent | 下段 |

第三处的实测:示例 manifest 写 `validation-report.md: not_started`(`examples/.../change-manifest.yaml:33`),而该文件**真实存在**于同目录(同段 `:32` 的 `mock-data-plan.md: not_started` 才是真的缺失)。这一整段没有任何校验器读它(唯一消费者是 `api.js:161`,用于展示)。顺带纠正 soundness P0-2 的一处证据:那里写"`validation-report.md: not_started` 并存(该文件确实不存在)"——方向相反,文件存在、声明说没有。结论(示例不自洽、不能作为回归基准)不变,但**漂移的方向决定修法**:不是补文件,是让这一段要么被校验、要么删掉。

> **R16 · 一条设计准则,写进 `core-ontology.md`:公理的判据不得只落在受约束方自己撰写的文件上。** 每条 BLOCKED 级公理至少一条判据落在最终产物(SQL 文本)、外部工具回执(evidence receipt)或平台执行结果上。manifest 的 `artifacts:` 段要么接上校验(与磁盘比对)、要么删除——列而不查比不列更有害(此判断沿用 soundness A1 第 4 点对 `validators: []` 的处置)。
> **失效条件**:仍存在一条 BLOCKED 级公理,其全部判据都由 Agent 自己声明。

### 7.3 F13 · "当前阶段"没有真源,阻塞了阶段感知的一切优化

`blocks_when.py` 的 `--stage` 由调用方传入;`STAGE_LEGAL`(`:46-54`)是硬编码的 26 项集合;唯一"推断当前阶段"的实现是 `api.js:127-152` 的 `deriveStages`,从 `gates` 反推,且只在 web 侧、且当前无人调用(§5.3)。

这意味着三件事都做不了:C3 第 4 点(按阶段过滤 skill 白名单)、R9 的"下一步该跑什么"、`run-log` 的按阶段归集。

> **R17 · 把 `current_stage` 变成 manifest 的一个显式字段,由门禁在 PASS 时推进,`deriveStages` 降级为一致性校验(推断值 ≠ 声明值即 WARNING)。** 这是 C3-4 的前置条件,soundness 未标出该依赖。
> **失效条件**:仍需要靠 gates 组合反推当前阶段。

### 7.4 声明与实现的比重

`ioc-data-dev/` 共 6,076 行(不含 node_modules)。其中可执行代码约 2,500 行(`dsh/` 1,129 + `harness/tools/` 1,298 + tests 73),其余约 3,600 行是注册表、规范、卡片、模板与示例。**声明:实现 ≈ 3:2,而声明里被机器消费的比例低于一半**(§7.1 三套完全不被读取)。

这个比值本身就是维护成本:改一条 gate 语义要同步 5 处(soundness P2-1 已列),改一个阶段 id 要同步 6 处(P1-4),改一条守卫要同步 2 处(§7.1)。R15 + R14 之后,同步点应收敛到 1 处 + 1 个检查。

裁决①之后要补一句:上面数的都是**插件内部**的同步点。插件与上游之间还有一整层同步点,一个都没被约定——见 §7.5。

### 7.5 F15 · 移植方向未定义,修复会被下一次同步冲掉(裁决①之后新增)

上游完整意味着 `ioc-data-dev/` 是一个 **fork**,而不是一个新项目。fork 需要三样东西:每份拷贝的来源、每类文件的修改方向、一个能发现漂移的检查。三样都没有。

**证据**:

- 全仓没有一份文件记录上游路径与取得时点。`schema.yaml:10` 的 `source: 《IOC 数据开发全流程与周边依赖》v1.0` 是文档名,不是可比对的路径或 commit;`rg` 搜"上游/upstream/CLOUDIOC"在 yaml/py/md 里的命中全部是领域词"数据来源"和仓内指针,与移植来源无关。
- 无任何 lock 文件。
- soundness P3-2 覆盖的是 `preset ↔ plugin ↔ workspace` 三者的版本握手,**边界止于插件内部**,不涉及上游。

**后果分三种,都已经在本仓的台账里出现过**:

1. **修复方向错 → 被冲掉。** 若 §3.1 的三个 SQL 校验器是移植件(§9.2-U1),R2 在插件里改完,上游仍在误判,下一次同步把修复覆盖回去。
2. **上游前进 → 下游沉默过期。** 这正是 `.learnings/ledger.md` 里 `knowledge.doc-stale` 已计数 2 次的形态("本仓跑着过期的 vendored skill 而源仓已前进")。同一个洞第三次打开。
3. **双向漂移 → 谁是权威说不清。** 插件已经有了上游没有的东西(`dsh/*.js`、`preset/`、`mini_yaml.py` 这套零依赖 YAML 解析),它们**不该**回推;而注册表**只该**从上游流下来。当前没有任何地方写明这个区别。

**现成的解法就在本仓根目录。** `skills-lock.json` 已经是这个模式的可用实现:

```json
{ "version": 1, "skills": {
  "sdd-dev-frontend": { "source": "/Users/moon/Documents/Code/moon-skills",
                        "sourceType": "local",
                        "computedHash": "bafdeae6…" } } }
```

这是 `knowledge.undiscovered-asset` 的典型形态:资产存在且可用,只是没被用到这里。

> **R20 · 一张按文件类别的移植方向表,写进 `ioc-data-dev/AGENTS.md` 或独立的 `PORTING.md`。**
>
> | 文件类别 | 真源 | 方向 | 漂移检查 |
> |---|---|---|---|
> | 注册表(`codespec/schemas/`、`codespec/guidelines/ioc-kernel/`) | 上游 | 上游 → 插件,**单向** | 内容哈希比对,不一致即 WARNING |
> | 知识底座(`knowledge-base/`) | 上游 | 上游 → 插件,单向 | 同上 |
> | 阶段卡片(`harness/stages/`) | 上游 | 上游 → 插件,单向 | 同上 |
> | 校验器(`harness/tools/*.py`) | 上游(若为移植件) | 修复**先回推上游**,再同步下来 | 哈希 + 成对样本双侧跑 |
> | 插件原生(`dsh/`、`preset/`、`lib/mini_yaml.py`) | 插件 | **不回推** | 无需 |
> | 示例(`examples/`) | 插件 | 不回推 | 由 A2 的黄金样本约束 |
>
> **失效条件**:改了任一"上游真源"类文件而没有任何提示,或一次上游同步把插件的修复静默覆盖。

> **R21 · 给每个移植件加一行 provenance,并复用 `skills-lock.json` 的形状做 `porting-lock.json`。** 字段沿用既有的三项(`source` / `sourceType` / `computedHash`),粒度到目录。`validate_registry_consistency.py`(soundness A3)顺带增加一项检查:每个"上游真源"类目录在 lock 里有条目,且哈希与当前内容一致——不一致时输出"本地已改 / 上游已变"两种诊断中的哪一种。
>
> **失效条件**:仍需要人工 diff 才能回答"这份注册表和上游一样吗"。

---

## 8 优先级、排期修正,与两项裁决的落地形状

### 8.1 关键路径(按四项裁决重排)

soundness §4 写的是 `A3 → B4 → C1`。三处需要改:

1. **A1 之前必须先有精度**(§3.2):否则第一份带注释的合法 SQL 就造成不可解除的停工。
2. **R2 的落地位置取决于 §9.2-U1**(校验器是移植件还是插件内重写):若是移植件,先在上游改,再同步下来,否则修复会被冲掉(§7.5)。这是裁决①引入的新前置。
3. **R20 应当最先做**,因为它决定后面每一项改动写在哪一侧。它是一张表,不是工程量。

```
R20(移植方向表) → U1(确认校验器来源) → R2(剥离注释,落在 U1 指出的那一侧)
  → B2+R1(逐策略成对样本 + 精度基线) → A1(guard-report 阻塞) → A2
  → A3+R14+R21(一致性检查 + porting-lock) → B4 → C1+R15
```

`R8`(run-log)与 A3 同批;它同时是 R1 的精度数据源、R18′ 的载体、R19 的 `ONBOARDING.md` 素材来源。

### 8.2 优先级表

裁决②(新人用户)把 R9/R19 提到 P0/P1;裁决①把 R20/R21 提到 P0。

| 优先级 | 项 | 理由 | 成本量级 |
|---|---|---|---|
| P0 | **R20** 移植方向表 | 决定后续每一项改动写在哪一侧,零工程量 | 一张表 |
| P0 | **R2** 剥离注释/字符串 + 按语句切分 | 消掉已知三类误判;A1 安全合入的前提;对新人是"错误教学"止损 | 共享模块 + 3 处改调用 |
| P0 | **R1/B2** 逐策略成对样本 | 没有它,"接进阻塞路径"是赌;也是唯一能证明策略非恒真的手段 | 每条策略 2 个最小样本 |
| P0 | **R5** KW-AX8 判据落到 SQL | 本垂直域最硬的公理当前零机器强制 | 1 个校验器 + 挂载 |
| P0 | **R9** BLOCKED 带出路 | 裁决②之后是主项:新人被挡住时若无出路,流程直接中断 | 中,三项可自动生成 |
| P1 | **R8** run-log.jsonl | R1/R6/C3/D1/R18′/R19 的共同数据源 | ~20 行 |
| P1 | **R19** 拆两类读者 + 最小可用集 | 裁决②的直接产物;`ONBOARDING.md` 可由 R18″ 那一趟自动生成 | 中 |
| P1 | **R21** porting-lock + provenance | 复用本仓已有的 `skills-lock.json` 形状,挡住 `doc-stale` 第三次复发 | 小 |
| P1 | **R14** A3 增补三项一致性检查 | 抓 DAG / guards / templates 三处漂移 | 并入 A3 |
| P1 | **R6** 守卫结果回传,删手动重跑 | 一半校验开销 + 消歧 | 小 |
| P1 | **R16** 判据准则写进公理 | 防止新增公理重犯同一错位 | 文档 + 1 条检查 |
| P2 | **R12/R13** 常驻瘦身 + `status: ported/upstream-only` | 26 KB → 目标 < 8 KB;裁决①之后 `status` 语义从"未实现"变为"未移植" | 中 |
| P2 | **R3** `enforcement` 分级 | 与 R1 配套:只有配了样本的策略才允许 blocking | 小 |
| P2 | **R17** `current_stage` 单一真源 | C3-4 与 R9 的前置 | 小 |
| P3 | **R7** 门禁降噪 · **R10** gate 去重 · **R11** 工作台接线 | 局部 | 小 |

**R18 按裁决①拆成两条,原版作废**:

> **R18′ · 从上游取"拦截频次"与"使用频次",作为移植顺序的排序键。**
> 上游在跑真实 feature,所以"哪条判据真的在拦人、哪个 skill 真的在被用"这份数据已经存在或可采集(是否可导出待 §9.2-U3 确认)。按频次移植,而不是按注册表顺序。**这比在插件侧重新积累经验便宜一个量级,是裁决①带来的最大红利。**
> **失效条件**:下一批移植的选择依据仍是注册表顺序。

> **R18″ · 用一个真实 feature 在插件上端到端跑一遍,目的是验证移植本身,不是发现优先级。**
> 上游经验证明不了插件的移植正确性——判据只有 6 个、hook 一个都没有、`ioc_init_workspace` 还不拷 `skills/`(soundness P3-2)。这一趟要回答的是:插件独立可用吗、门禁在真实目录结构下判对了吗。顺带产出 R19 的 `ONBOARDING.md` 素材与 R8 的第一份 run-log。
> **失效条件**:跑完仍不能回答"独立安装的插件能不能完成一个 feature"。

### 8.3 裁决③的答复:引入依赖的风险与折中

问题是"有什么风险"。按风险从高到低,前两条是裁决①**新增**的,soundness B1 当时不可能考虑到:

| # | 风险 | 严重度 | 说明 |
|---|---|---|---|
| 1 | **阻断回推上游** | 高 | 若上游校验器是零依赖(极可能:插件的 `mini_yaml.py` 就是为避开 PyYAML 而自研的,这个取向大概率继承自上游),那么一个依赖 `sqlglot` 的修复**无法回推**。§7.5 要求修复先回推,二者直接冲突——依赖会把这条校验器永久钉在下游,变成两侧行为不一致的源头 |
| 2 | **两侧行为分叉** | 高 | 同一份 SQL 在上游 PASS、在插件 FAIL(或反之),而两侧都自称权威。对裁决②的新人用户,这是最难自救的一类困惑 |
| 3 | **部署环境装不上包** | 中高 | 插件经 `dsh plugin add` 分发,运行时只保证有 `python3`。`pip install` 是否可用不由插件决定。soundness B1 已给出正确的降级("WARNING + 明确未验证 + 退出码 1,绝不静默 PASS"),但降级的实际含义是:**在装不上包的环境里,这条防线不存在** |
| 4 | **方言覆盖不确定** | 中 | Hive 方言 `sqlglot` 支持成熟;DLI 需要选一个近似方言(Spark SQL 系)。选错的表现是解析失败或静默解析成别的语义。必须"解析失败即 FAIL",不能跳过 |
| 5 | **版本漂移改变判定** | 中 | 解析器升级可能改变结论。必须 pin 版本,并把版本写进 R8 的 run-log,否则"上周还 PASS"无法归因 |
| 6 | **破坏零依赖卖点** | 低 | `README.md:90` 明确宣传"零依赖、无需安装任何依赖"。这是文档与承诺问题,改文档即可 |

**折中建议(与裁决①一致)**:**分两层,核心零依赖,高精度层可选。**

- **R2(剥离注释/字符串 + 按语句切分)不需要解析器**,约 40 行正则即可,零依赖、可回推上游、收益最大风险最低。**先做这一层,它消掉本文实测到的全部三类误判。**
- **R5(分层判据)也不需要解析器**:从 `FROM/JOIN` 后的表名取前缀判分层,正则足够,同样可回推。
- **只有 B1(列引用校验)真的需要"别名 → 表 → 列"的解析**。把它单独放在一个 `optional/` 校验器目录:未安装 `sqlglot` 时该校验器**报"未验证"并退出码 1**,不进 blocking 路径(与 R3 的 `enforcement` 分级天然对齐);安装后升为 blocking。这样核心链路始终零依赖、始终可回推,而愿意装依赖的环境能拿到最值钱的那条检查。
- 若最终选择自研最小解析器以便回推:**先在上游做**,并且必须配 R1 的样本——soundness B1 对此的判断("会重演正则校验器的问题")是对的,而 §3.1 恰好是这个判断的实测证据。

### 8.4 裁决④的答复:判据形状不变、来源可升级

裁决④是"比较困难,但保留这个可能"。对应的设计原则:**现在就把判据形状定成将来自动化不需要改的样子,只让"来源"字段可升级。**

`platform_test` / `platform_formal` / `test_execution` 三个 gate 的判据落在一份 evidence 回执上(沿用 soundness A2 第 3 点),但回执的内容契约按下面定,使人工与自动两条路产出同一形状:

```json
{
  "gate": "platform_test",
  "source": "human",              // human | cli(将来 cloudioc-cli 可取时改这里
  "platform_run_id": "…",         // 平台执行标识;human 路径下手工填
  "result": "success",
  "confirmed_by": "张三",          // 必填,且不得为 AI
  "confirmed_at": "2026-08-24T10:00:00+08:00",
  "attachments": ["evidence/platform-test-2026-08-24.png"]
}
```

三点设计理由:

1. **`confirmed_by` 不得为 AI,复用既有机制。** `dsh/guards.js:45-54` 已经实现了"AI 不得 closed P0 澄清项"的写前 deny,把同一个判断套到回执文件上,是**零新增机制**的复用。这样这三个 gate 就不再是 §7.2 的"自述判据"——人类署名是 Agent 写不出来的(有守卫拦)。
2. **`source` 字段让自动化不需要改判据。** 将来 `cloudioc-cli` 能取回执时,只是把 `source` 从 `human` 改成 `cli` 并补 `provenance`(工具/时间/命令,`template-constraints.yaml:55-58` 已有这个 evidence 契约),门禁的检查逻辑一行都不用动。保留可能性的正确方式是留字段,不是留 TODO。
3. **人工路径必须留痕,不能只留"存在"。** 只检查文件存在等于回到自述;检查 `confirmed_by` 非 AI + `platform_run_id` 非空 + 有附件,才是"人确实去平台看过"的最低证据。对裁决②的新人用户,这份回执同时是一张检查清单,告诉他试算之后该记录什么。

**失效条件**:Agent 能在没有人类署名的情况下让这三个 gate 变成 `pass`;或将来接入自动回执时需要改动门禁判据。

---

## 9 裁决记录与剩余未知

### 9.1 四项裁决及其后果

| # | 问题 | 裁决 | 对本文的改动 |
|---|---|---|---|
| ① | `ioc-workflow.md` 是规格还是现状地图? | **外部工作区完整**——它是现状地图,插件是移植件 | §0 主结论重写;§1 偏差层改为四层移植缺口表;新增 §7.5(F15 移植方向)与 R20/R21;R18 拆为 R18′(取上游频次)+ R18″(验证移植);R13 的 `status` 语义从"未实现"改为"未移植" |
| ② | 目标用户是谁? | **不熟悉 IOC 流程、但需要逐步熟悉的人** | 新增 §6.3(F14 双读者 + 约 138 个具名实体)与 R19;R9 从 P2 升 P0;§3 的精度问题定性从"技术债"改为"教学债" |
| ③ | 是否接受引入依赖?(转为"有什么风险") | 已答复 | 新增 §8.3:六项风险(前两项由裁决①新增:阻断回推、两侧分叉),折中为"核心零依赖 + 可选高精度层" |
| ④ | 平台回执能否自动获取? | **较困难,保留可能** | 新增 §8.4:回执契约固定形状、`source: human\|cli` 可升级、`confirmed_by` 非 AI 复用既有写前 deny |

**v1.0 原结论(留作对照,不删除)**:"这套 harness 的短板不是没做完,而是声明规模远超经验规模——它在一个真实 feature 跑通之前就固化了 16 阶段 / 58 skill / 20 校验器 / 12 gate 的形状。"

裁决①之后这句话**只有后半句仍然成立**:形状确实先于本仓的经验固化了,但那形状不是凭空定的,它在上游被验证过。所以诊断从"设计过早"改为"移植不全",修法从"按需重建"改为"按上游频次补判据 + 定方向防冲掉"。**这个区别很重要:前者的处方是删,后者的处方是搬。** 差别在于本文实测到的 §3.1 精度问题——那是唯一一处两种诊断都指向同一动作的地方(无论上游是否完整,校验器都必须先能分对错)。

### 9.2 剩余未知(按是否阻塞 P0 排序)

| # | 未知 | 阻塞什么 | 怎么确认 |
|---|---|---|---|
| **U1** | `harness/tools/` 的 6 个校验器是**原样移植**还是插件内重写? | **阻塞 R2 的落地位置**(P0) | 与上游同名文件做一次 diff。若相同:§3.1 的三类误判**此刻正运行在上游生产链路里**,R2 必须先在上游落地再同步下来;若是重写:在插件侧改,并在 R20 的方向表里把这几个文件标为"插件原生" |
| **U2** | 插件的部署形态:独立安装到任意项目,还是装在上游 CLOUDIOC 工作区里用? | 决定白名单里 50 个"缺失" skill 是真缺失还是**运行时由工作区的 `.cac/skills/` 解析** | 直接影响 soundness P0-3 的判级与 R13 的语义。若两种形态都要支持:skills provider 需要合并两个来源,且**缺失时必须显式报错而不是静默返回空**——`dsh/index.js:31-35` 当前在读不到 `skills/` 时静默返回空列表 |
| **U3** | 上游是否有可导出的运行记录 / 判据拦截频次? | R18′ 的输入 | 若没有,R18′ 退化为"访谈上游使用者,列出最常返工的 5 个点"——仍然比按注册表顺序排好,只是证据弱一档 |
| **U4** | 上游校验器是否零依赖? | 决定 §8.3 的风险 1/2 是否成立 | 若上游本来就有依赖,则"阻断回推"与"两侧分叉"两条高危风险消失,`sqlglot` 的决策可以更宽松 |
| **U5** | DSH 的 `tools/post-execute` 是否支持向 Agent 回传内容? | R6 的可行性前提(保留自 v1.0) | 读 DSH 钩子契约或试一次 |
| **U6** | `preset/agent.cordis.yml` 的 250 行宿主组合行确实不进模型上下文 | §6.2 的量级估算(低影响) | 基于文件注释与行内容判断,未实测 token 计数 |

**U1 与 U2 建议在动手之前先答**——它们各自决定一批改动写在哪一侧、以及一个 P0 级问题的判级。其余四项可以边做边答。

---

## 附录 A:引用的业界实践来源

| 来源 | 用于对照的观点 |
|---|---|
| [Anthropic《Equipping agents for the real world with Agent Skills》](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) | 三层渐进披露:仅 name+description 常驻;先用真实任务找出能力缺口,再增量建 skill |
| [Anthropic skill-creator / best-practices](https://mintlify.wiki/anthropics/skills/creating-skills/best-practices) | SKILL.md < 500 行;明细进 `references/` 且一层深;同时启用 20–50 个 skill 是经验上限;过度使用 ALWAYS/NEVER 使 skill 脆化 |
| [deepset《Harness Engineering》](https://www.deepset.ai/blog/harness-engineering) | harness 工程的核心是"跑真实任务 → 观察失败 → 分类 → 改 harness"的回路;没有结构化 trace,失败分类就是猜 |
| [《Harness Engineering for AI Agents》](https://dev.to/akki907/harness-engineering-for-ai-agents-16a0) | 九项落地清单(终止条件与预算、常驻 vs 按需上下文、最小权限、确定性判据把关完成、全链路 trace、回归评测、护栏、恢复、上下文压缩) |
| ONES《AI Harness Engineering in 2026》 | 先选一类可重复任务并定义"成功必须证明什么",再分阶段加控制;Agent 自称成功不构成证据 |

---

## 附录 B:§3.1 的两份对抗样本(可直接落盘复跑)

**A · 合法 SQL,期望 PASS,实测 FAIL 3 项**(误判源:注释里的 `hive/bi_test` + `COUNT(DISTINCT)`)

```sql
-- 合规意图:统计客户订单数与客单价(hive/bi_test)
DROP TABLE IF EXISTS bi_test.ads_dm_order_stat_m_0818_ads_db_marketing_test;

CREATE TABLE IF NOT EXISTS bi_test.ads_dm_order_stat_m_0818_ads_db_marketing_test (
  party_id   string,
  order_cnt  bigint,
  avg_amt    decimal(18,2)
)
PARTITIONED BY (stat_month string)
ROW FORMAT SERDE 'org.apache.hadoop.hive.ql.io.orc.OrcSerde'
STORED AS ORC;

WITH order_src AS (
  SELECT
    ord.party_id,
    ord.order_id,
    COALESCE(ord.amount, 0) AS amount
  FROM dws_t_customer_order_daily ord
  WHERE ord.stat_date >= date_sub(current_date, 30)
)
INSERT OVERWRITE TABLE bi_test.ads_dm_order_stat_m_0818_ads_db_marketing_test
PARTITION (stat_month = '2026-07')
SELECT
  src.party_id,
  COUNT(DISTINCT src.order_id) AS order_cnt,
  SUM(COALESCE(src.amount, 0)) / NULLIF(COUNT(DISTINCT src.order_id), 0) AS avg_amt
FROM order_src src
JOIN dim_t_party dim
  ON dim.party_id = src.party_id
GROUP BY src.party_id;
```

**B · 违规 SQL(ADS 直读 ODS + 编造列名),期望 FAIL,三个校验器全部放行**

```sql
-- 违规意图:ADS 直接消费 ODS(KW-AX8/POL-DESIGN-001),且引用一个不存在的列
DROP TABLE IF EXISTS bi_test.ads_dm_cust_raw_m_0818_ads_db_marketing_test;

CREATE TABLE IF NOT EXISTS bi_test.ads_dm_cust_raw_m_0818_ads_db_marketing_test (
  party_id       string,
  ghost_metric   bigint
)
PARTITIONED BY (stat_month string)
ROW FORMAT SERDE 'org.apache.hadoop.hive.ql.io.orc.OrcSerde'
STORED AS ORC;

WITH raw_src AS (
  SELECT
    raw.party_id,
    COALESCE(raw.column_that_does_not_exist, 0) AS ghost_metric
  FROM ods_t_crm_customer_raw raw
  WHERE raw.dt = '2026-07-31'
)
INSERT OVERWRITE TABLE bi_test.ads_dm_cust_raw_m_0818_ads_db_marketing_test
PARTITION (stat_month = '2026-07')
SELECT
  src.party_id,
  SUM(COALESCE(src.ghost_metric, 0)) AS ghost_metric
FROM raw_src src
JOIN dim_t_party dim
  ON dim.party_id = src.party_id
GROUP BY src.party_id;
```

两份样本各有一条 FAIL 来自注释文本(A 报 `分母 bi_test`,B 报 `分母 POL`)。删掉首行注释后实测:**B 变为完全 PASS**(违规 SQL 零告警),**A 仍 FAIL 2 项**——剩下的是 `COUNT(DISTINCT)` 被要求内套 `COALESCE`。

因此这两份样本正好是 R2 与 R1 各自的最小验收用例:
- **R2(剥离注释/字符串)的验收**:注释在与不在,校验结论不变。
- **R1(逐策略成对样本)的验收**:`POL-SQL-ETL-009` 必须对 `COUNT(DISTINCT ...)` 放行、对 `SUM(裸列)` 拦下——当前它对前者误拦,说明这条策略的实现与策略本身不是同一件事。
