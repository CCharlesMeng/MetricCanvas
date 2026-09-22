# ioc-data-dev 可信性改造方案

**目标**：让 `ioc-data-dev` 插件汇报的纪律等于它实际执行的纪律。当前有三处断链，使门禁、守卫与注册表各自声明了并未被执行的约束。本方案只关闭断链、并让"未实现"变成可观测的数字，**不补齐**尚未落地的 ~50 个 skill 与 ~21 个校验器。

**来源**：流程规格 `参考/项目地图/ioc-workflow.md`；实现 `ioc-data-dev/`（本次逐文件核对）。失败分层词汇沿用 `.agents/skills/session-optimize/references/failure-map.md` 的 L1–L5。

本文是执行计划。第 2 节每条问题带文件行号证据，第 3 节每项改动给出目标、精确改法、影响面、验证方式，以及**失效条件**——什么结果说明这次改动没有生效。

---

## 1. 背景

### 1.1 插件的真实状态

`ioc-data-dev` 是一个可被 DSH 加载的真插件，不是空脚手架：宿主注册 3 个工具（`ioc_stage_gate` / `ioc_validate` / `ioc_init_workspace`）+ 文件系统 skills provider + 写入守卫 + 只读 `/ioc-api`；9 个零依赖 Python 门禁与校验脚本可运行；25 张阶段薄卡片、schema 注册表、ioc-kernel 规范、种子级 knowledge-base、一个端到端示例 feature 构成一套自洽的**纸面流程**。

问题不在"没做完"——README:98 已诚实写明"待补"。问题在于**声明层是手写的、实现层是渐进的，两者之间没有任何一致性约束**，因此：

| 声明 | 实际 | 谁会被误导 |
|---|---|---|
| `schema.yaml:132`"仅白名单内 skill 可被调度" | 白名单 58 个，磁盘 8 个；且磁盘上 3 个不在白名单内 | Agent 路由到不存在的 skill 时行为未定义 |
| `schema.yaml` validation 映射的校验器 | 约 21 个只有名字，无文件 | Agent 以为产物已被校验 |
| `behavioral-guards.yaml:133`"stage gate 检查 guard-report.md，缺失即 BLOCKED" | 全仓无任何代码读取该文件 | 所有写后结构校验的 FAIL 都是空操作 |
| `activities-registry.yaml` 声明 34 个分片 | `activities/` 目录不存在 | 按注册表索引会落空 |

你能看出差距，Agent 看不出。这是本方案要解决的唯一一件事。

### 1.2 为什么现在做

三条理由，按紧迫度：

1. **门禁当前会给出假 PASS。** 见 P0-1 / P0-2。一个 fail-closed 系统一旦能被自我声明绕过，它提供的就不是保障而是错觉，越晚发现代价越大。
2. **还没有真实 feature 在跑。** 阶段 id 拆分（P1-4）是破坏性变更，现在只需改示例与卡片；等有了历史 feature 目录，迁移成本会翻几倍。
3. **同类失败已在本仓台账计过数。** `.learnings/ledger.md` 的 `project.silent-failure`（严重程度高）就是"验收看似成功但不能证明契约成立"，前端域为此补了成对 GREEN/RED fixture；数据域现在重开了同一个洞。

### 1.3 证据边界

第 2 节除两处明确标注外，全部为本次逐行核对。标注为「盘点结论」的条目未逐行复核，落地前需先确认，且它们都不在批次 A/B 的关键路径上。

---

## 2. 问题清单

### P0-1 · 守卫链终止在一个没人读的文件

**层**：L4 项目实现 · **严重程度**：高

**现象**：写后结构守卫跑完 `validate_*.py`，FAIL 时把结果写进 `guard-report.md`，并在文件里承诺门禁会拦；门禁不读它。

**证据**：
- `dsh/guards.js:186-189` FAIL 分支写入并追加"阶段门禁(ioc_stage_gate)将检查 guard-report.md；修复前不得放行"
- `codespec/guidelines/ioc-kernel/behavioral-guards.yaml:133` 写"MANDATORY: stage gate 检查 guard-report.md，缺失即 BLOCKED"
- `rg guard-report harness/tools/*.py` 返回空；`sdd_stage_gate.py` 与 `blocks_when.py` 均无该逻辑

**后果**：`validate_sql_ddl` / `validate_sql_etl_patterns` / `validate_domain_patterns` / `validate_lifecycle_columns` / `validate_ads_clarification` 五个校验器的 FAIL 全部无效——它们只在磁盘上留一份没人看的记录。

**附带缺陷**：`writeGuardReport` 只在 FAIL 时写、从不在 PASS 时删除（`dsh/guards.js:113-129`）。因此一旦门禁开始读它，任何曾失败过的目录会被永久阻塞。修复必须同时定义生命周期。

**另一处空转**：`dsh/guards.js:80-82` 把 `validation-report.md` 列入受约束产物但 `validators: []`——列而不查。

### P0-2 · gate=pass 不需要被挣得

**层**：L4 项目实现 · **严重程度**：高

**现象**：门禁的判据只有 `change-manifest.yaml` 的字段合法性与 `blocks_when`，而 manifest 由 Agent 自己写。写前守卫只校验 gate **值**合法，不校验它**有没有对应产物**。

**证据**：
- `harness/tools/sdd_stage_gate.py:58-60` 注释明确放弃："gate=pass 但产物缺失 → 视为伪造嫌疑(WARNING，不自动 BLOCKED，由 validate_gate_change.py 的 --strict 处理；此处记录)"——而门禁从不调用 `--strict`
- `harness/tools/validate_gate_change.py:69-75` `--strict` 实现完整、可用
- `harness/tools/validate_gate_change.py:28-35` `GATE_ARTIFACT` 只覆盖 12 个 gate 中的 6 个，另 6 个（`ads_clarification_applied`/`service_design`/`service_develop`/`test_execution`/`platform_test`/`platform_formal`）即使调用 `--strict` 也无从校验
- `dsh/guards.js:20-38` 写前守卫只判断值是否属于 5 个合法值

**示例本身即证据**：`examples/0.1.0/fw-2026-0818-001/change-manifest.yaml` 中 `sql_validation_static: pass` 与 `validation-report.md: not_started` 并存（该文件确实不存在），`ads_clarification_applied: not_started` 而 CL-001 已 closed。**唯一的黄金样本不自洽**，无法作为回归基准。

**后果**：Agent 想推进阶段，只需把 gate 改成 `pass`。CORE-AX9"禁止自改 gates.* 绕过"目前靠提示词维持，不靠机制。

### P0-3 · 注册表与磁盘之间没有一致性约束

**层**：L4 项目实现 · **严重程度**：高

**证据**：
- `schema.yaml:132`"仅白名单内 skill 可被调度；白名单外一律禁止"
- `rg` 计数：`ioc-vertical` / `ioc-stage-gate` / `ioc-clarification` 在 `schema.yaml` 中出现 **0** 次，但三者都在 `skills/` 下——包括那个自称"总纲"的 `ioc-vertical`
- `schema.yaml` validation 段引用 `validate_sdd_state.py` / `validate_layer_consumption.py` / `validate_sql_column_refs.py` / `validate_tool_evidence.py` / `validate_sql_bindings.py` / `validate_ads_table_design.py` 等，`harness/tools/` 下均无
- `policies-index.yaml` 另引用 `validate_registry_consistency.py` / `validate_indicator_source_binding.py` / `validate_reuse_precheck.py`，同样缺失

**后果**：两个方向都失控。缺失方向——Agent 相信产物已被校验；多余方向——磁盘上的 skill 绕过了白名单规则。二者都无法在 CI 里被发现，因为没有 CI。

### P1-1 · AX3/AX4 零机器强制，而它们是本垂直域存在的理由

**层**：L4 项目实现 · **严重程度**：高

**现象**：已实现的 3 个 SQL 校验器管别名、`SELECT *`、嵌套层数——LLM 很少犯的表面问题。而唯一能拦住"编造列名"的 `validate_sql_column_refs.py` 缺失。

**证据**：`schema.yaml` 对 `hql_test/*_test.sql` 与 `hql/*.sql` 都列了 `validate_sql_column_refs.py  # 列引用(从 evidence)`；文件不存在。CORE-AX3/AX4 在 `core-ontology.md` 中只是散文。

**前置障碍（本次新发现）**：`examples/.../table-schema.json` 是**单表**结构（`{table, columns[], provenance}`），而同目录合规 SQL 引用了两张表——`dws_t_customer_active_daily` 与 `dwd_t_customer_insight_map_m`，后者不在 schema 里。所以列校验器落地前必须先把 `table-schema.json` 改成多表容器，否则它只能校验一半引用。

### P1-2 · RED fixture 放在交付目录里，示例永远无法全绿

**层**：L4 项目实现 · **严重程度**：中

**证据**：`examples/0.1.0/fw-2026-0818-001/hql_test/bad_ads_0818_ads_db_marketing_test.sql` 是故意的反例（首行自述"该文件不应通过任何校验"），但它位于交付目录 `hql_test/` 内，且文件名以 `_test.sql` 结尾，正好命中 `guards.js` 的 `(hql_test|hql)/*.sql` 规则与 manifest 的 `"hql_test/*_test.sql": done` 交付 glob。

**后果**：只要对该 feature 做整目录校验，它必然 FAIL。GREEN/RED 两个 fixture 都已经写好了，却因为放在同一个交付目录而互相抵消——这是"已有素材、缺一个装配"的典型。

### P1-3 · blocks_when 独立运行时非法 gate 值不阻塞

**层**：L4 项目实现 · **严重程度**：中

**证据**：`harness/tools/blocks_when.py:131-135` 计算出 `illegal` 并 append 一条 FAIL 到 `checks`，但**从不 append 到 `reasons`**；而 `main()`（`:190-196`）只依据 `reasons` 决定退出码。

**后果**：`python blocks_when.py --feature X --stage Y` 遇到非法 gate 值会打印 FAIL 却返回 0。经 `sdd_stage_gate.py` 调用时该场景被后者的 `validate_manifest` 兜住，所以这是独立 CLI 路径的漏洞——而卡片和文档都把它当独立工具介绍。

### P1-4 · `job-create` 一个 stage id 承担两次出现，TEST/FORMAL 无法分别设卡

**层**：L4 项目实现 · **严重程度**：中

**证据**：
- `skills/ioc-vertical/SKILL.md:10` 标题写"data 主路径(15 阶段)"，实际列出 **16** 项（`job-create` 出现两次：TEST 与 FORMAL）；`AGENTS.md:35` 同样
- `codespec/schemas/ioc-workflow/schema.yaml` main_paths 同样把 `job-create` 列两次
- `harness/stages/stage-index.yaml` 只有 15 个 key（`job-create` 一次）
- `blocks_when.py:37` `'job-create': ['validation-report.md']`——对 FORMAL 次而言应当要求 `hql/` 非空与 `platform_test: pass`
- `dsh/api.js` 的 `DATA_STAGES` 为 16 项（盘点结论）

**后果**：两次 job-create 的进入条件被迫相同，FORMAL 次实际上没有门禁。同时"15 阶段"这个数字已经在 4 个位置漂移，说明缺一个能发现它的检查。

### P2-1 · 真源重复，且漂移已经发生

**层**：L4 项目实现 · **严重程度**：中

讲单一真源（CORE-AX4）的系统，自己的门禁词汇有 5 份拷贝：

| 内容 | 拷贝 | 位置 |
|---|---|---|
| 12 个 gate 名 | 5 | `schema.yaml` gates 段、`gates-glossary.md`、`ioc_common.py:18-23`、`dsh/guards.js:23-28`、`templates/change-manifest.yaml` |
| CORE-AX 清单 | 4 | `core-ontology.md`、`AGENTS.md`、`skills/ioc-vertical/SKILL.md`、`preset/agent.cordis.yml` |
| PAT-DOM-* | 3 | `domain-patterns-index.yaml`、`knowledge-base/.../domain-source-patterns.yaml`、`validate_domain_patterns.py` 的 `BUILTIN_PATTERNS` |
| 分层规则 | 2 | `ontology-layers.yaml`、`profiles/kimball-profile.yaml` |

另有两处"机器行为与声明不一致"：
- `blocks_when.py:29-44` 的 `STAGE_CONTRACTS` 硬编码在 Python 里，而 `schema.yaml` 的注释声明有 `missing_contract` 字段（schema 中并无此字段）
- `blocks_when.py:140-143` 把 schema 的 `stage: "*"` 全局规则**改写**为"仅当存在 P0 open 澄清项时生效"。这个语义大概是对的，但 YAML 里写的不是它

**小项**：`ioc_common.py:39` 的 PyYAML 回退路径拼成 `HERE/lib`，而 `HERE` 本身已是 `lib/`，得到 `lib/lib`。目前因调用方已把 `lib/` 加进 `sys.path` 而侥幸可用。

### P2-2 · 基线未命中的行为未定义

**层**：L2 流程/决策 · **严重程度**：中

CORE-AX4 要求"写维表/指标/设计约束前先查 `knowledge-base/` 基线"，但没写"查不到怎么办"。而基线目前是 12 文件的种子：3 个维度、2 个事实、1 行占位指标，`hwcloud_marketing/index.md` 声明的 `dimensions/` `facts/` `models/` `references/` 四个目录都不存在。

**后果**：最可能的实际行为是 Agent 查不到 → 认定"无约束" → 静默退化为无约束生成。需要显式写明 **未命中 ≠ 无约束**。

### P2-3 · 常载上下文重复计费

**层**：L4 项目实现 · **严重程度**：中

公理与阶段清单被付费 3–4 次：`preset/agent.cordis.yml`（278 行）在系统提示里重述人格 + CORE-AX + 15/13 阶段，每轮都付；`AGENTS.md` 作为规则自动附加；`skills/ioc-vertical/SKILL.md` 再一份。按渐进披露原则，只有 name+description 应常驻，可枚举内容应工具可取。

另一个尚未触发但会触发的问题：58 个 skill 全部落地后，description 空间会超过"同时启用 20–50 个"的经验阈值，路由准确率下降。

### P2-4 · 交互契约缺失，BLOCKED 没有出路

**层**：L2 流程/决策 · **严重程度**：中

8 个 IOC skill **无一**声明 `## 交互规范`，也未引用 `PRINCIPLES.md` 的 P1–P7（单轮单决策 / 结构优于散文 / 不解释过程 / 确认门标准格式 / 三行索引收口）。数据域因此继承了零交互纪律，而它比前端域更需要——15 个阶段、每阶段多产物、中间还有澄清回环。

更关键的是：**fail-closed 系统的错误信息就是它的 UI**，而 BLOCKED 输出目前只有 reason 列表，没有"接下来做什么"。

**盘点结论（待确认）**：`dsh/client.js` 的 `load()` 只请求 `/ioc-api/features`，从不请求详情端点，导致工作台的流水线状态与未决澄清列表恒为空；界面文案有 `IOCC` 拼写错误。

### P3-1 · 没有测试与 CI

**层**：L4 项目实现 · **严重程度**：中

`tests/dsh-index.test.js` 共 73 行、2 个用例，只覆盖 `webServer` 注入与 `/ioc-api` 前缀注册/注销。未覆盖：3 个工具的执行路径、守卫 pre/post、9 个 Python 校验器、API handler、示例 feature 端到端。`package.json` 无 `scripts`，无 CI——回归靠"有人记得手跑 `node --test`"。

对照：同一作者的 `sdd-dev-frontend` 有约 5,700 行脚本配约 4,200 行测试与一个 22/22 门禁覆盖率棘轮。能力存在，只是没用在这里。

### P3-2 · plugin / preset / workspace 三者无版本握手

**层**：L4 项目实现 · **严重程度**：中

安装路径为 `dsh plugin add` + **手工 `cp preset/*` 到 `~/.dsh/.agent-presets/`** + 重启 + UI 选择。手工拷贝必然漂移，且无任何版本比对。`ioc_init_workspace` 拷贝 `codespec/` `harness/` `knowledge-base/` `.cac/` 但不拷 `skills/`，初始化出的工作区有规则无技能。

这与台账里已计数 2 次的 `knowledge.doc-stale`（本仓跑着过期的 vendored skill 而源仓已前进）是同一类：两份拷贝、无 lock、无检查。

---

## 3. 改造方案

四个批次。**批次 A 是其余一切的前提**：在门禁能给假 PASS 的状态下做任何其他改动，都无法验证改对了没有。

### 批次 A — 关闭可信性断链

#### A1 · 让 guard-report 真正阻塞，并给它生命周期

**目标**：结构守卫的 FAIL 必须能挡住阶段推进；修好之后必须能自动放行。

**改法**：

1. `dsh/guards.js` — 改变报告落点与生命周期。当前落在被写文件的同目录（`dirname(filePath)`），导致 `hql_test/x.sql` 的报告落在 `hql_test/` 下，门禁需递归扫描。**改为落在 feature 根目录的单一 `guard-report.md`**，按文件分节追加；feature 根定义为"含 `change-manifest.yaml` 的最近祖先目录"。全部 validator PASS 时删除该文件对应的节，节全空则删除文件。
2. `harness/tools/lib/ioc_common.py` — 新增 `guard_report_status(feature_dir) -> (blocked: bool, detail: str)`，读取 feature 根的 `guard-report.md`，存在且含 FAIL 节即 blocked。
3. `harness/tools/sdd_stage_gate.py` — 在 `blocks_when` 检查之后加入该判据，命中则 append 到 `reasons`（走既有 BLOCKED 路径，不新增退出码）。
4. `dsh/guards.js:80-82` — `validation-report.md` 的 `validators: []` 二选一：接上 `deliverable_level.py --min L1`，或从 `CONSTRAINED` 移除。**不保留空列表**，列而不查比不列更有害。

**为什么可能有效**：这是唯一让 5 个已实现校验器产生后果的路径。当前它们的 FAIL 不改变任何下游行为。

**影响面**：2 个 JS 文件 + 2 个 Python 文件；只影响 IOC 约束产物的写入与门禁判定，不影响其它文件。

**验证**：
- 黄金样本（A2 修好后）跑门禁 → PASS，无 `guard-report.md`
- 把 `tests/fixtures/sql/bad_ads.sql` 写入 feature 的 `hql_test/` → 守卫写出 FAIL 节 → 门禁 BLOCKED 且原因指向该文件
- 删除该文件并重写合规 SQL → 节被清除 → 门禁恢复 PASS

**失效条件**：写入违规 SQL 后门禁仍 PASS（说明没读）；或修好后仍 BLOCKED（说明没清）。任一出现即视为本项未完成。

#### A2 · gate=pass 必须有产物支撑，并修正黄金样本

**目标**：把 CORE-AX9 从提示词约束变成机制约束。

**改法**：

1. 把 `validate_gate_change.py:69-75` 的产物存在性检查提取为 `ioc_common.gate_artifact_missing(manifest, feature_dir) -> list[str]`，`validate_gate_change.py --strict` 与 `sdd_stage_gate.py` 共用——顺手消除一份重复。
2. `sdd_stage_gate.py` 无条件执行该检查，缺失即 BLOCKED（删掉 `:58-60` 那段"仅记录"的注释与决定）。
3. 补全 `GATE_ARTIFACT` 缺的 6 个 gate。其中依赖外部平台、无法用交付产物证明的三个（`test_execution` / `platform_test` / `platform_formal`）映射到 evidence 回执文件（如 `evidence/platform-test-receipt.json`）——这正是 CORE-AX10 的落点，回执缺失即不得置 pass。
4. 修正 `examples/0.1.0/fw-2026-0818-001/`：补 `mock-data-plan.md` 与 `validation-report.md`（后者已被 `validation-report.md:9` 引用），把 `ads_clarification_applied` 置为 `pass`（CL-001 已由人裁定 closed）。使示例成为真正可复跑的黄金样本。

**为什么可能有效**：把"挣得"的判据从 Agent 可写的字段移到 Agent 需要真实产出的文件上。回执一步进一步移到工具输出上。

**影响面**：2 个 Python 文件 + 示例目录。会让当前示例立刻 BLOCKED——这是预期的，同批修复。

**验证**：
- 黄金样本 → PASS
- 手工把任一 gate 改成 `pass` 而对应产物不存在 → BLOCKED，原因写明缺哪个产物
- 删除 `evidence/platform-test-receipt.json` 后置 `platform_test: pass` → BLOCKED

**失效条件**：伪造任一 gate 仍能 PASS。

#### A3 · 注册表一致性检查，并输出诚实的完成度

**目标**：让"哪些声明还没有实现"成为一个每次都能跑出来的数字，而不是需要人工盘点的隐性知识。

**改法**：新增 `harness/tools/validate_registry_consistency.py`（该名字已被 `policies-index.yaml` 引用，正好落地）。检查项与判级：

| # | 检查 | 不通过时 |
|---|---|---|
| 1 | `schema.yaml` 白名单每个 id 有 `skills/<id>/SKILL.md` | **WARNING** + 计入未实现（渐进落地是有意的） |
| 2 | `skills/` 下每个目录都在白名单内 | **FAIL**（schema 声明白名单外禁止调度） |
| 3 | `schema.yaml` validation 每个脚本存在于 `harness/tools/` | **WARNING** + 计入未实现 |
| 4 | `guards.js` 实际挂载的 validator 都存在，且 ⊆ schema.validation | **FAIL**（守卫承诺与注册表不一致） |
| 5 | `harness/stages/*.md` frontmatter 的 `skill:` 都在白名单内 | **FAIL** |
| 6 | 每个 category 的 `count` 等于 `ids` 长度 | **FAIL** |
| 7 | `main_paths` 各路径的阶段数与散文声明的数字一致 | **FAIL**（这一条抓 15/16 漂移） |
| 8 | `blocks_when.py` 的 `STAGE_LEGAL` ⊇ schema 中出现的所有 stage | **FAIL** |
| 9 | 已实现的每个校验器都有成对 GREEN/RED fixture | **WARNING**（批次 D 起升为 FAIL 并做棘轮） |

stdout 末尾打印一张完成度表：`skill 8/61 · validator 9/30 · fixture 覆盖 n/9`。

配套修正：把 `ioc-vertical` / `ioc-stage-gate` / `ioc-clarification` 作为新 category「插件原生」写入白名单（count: 3）。

**为什么可能有效**：它把 P0-3、P1-4、P2-1 的漂移从"下次有人读到时发现"变成"每次运行都发现"。它也是批次 B/C 的回归网——没有它，后面每一步都在盲改。

**影响面**：新增 1 个脚本 + `schema.yaml` 加一个 category。纯读，不改任何被检查对象。

**验证**：当前仓跑一次得到基线数字；删掉任一 `SKILL.md` → 数字下降；在 `skills/` 新建一个未注册目录 → 检查项 2 FAIL；把某 category 的 `count` 改错 → 检查项 6 FAIL。

**失效条件**：新增未注册 skill 仍 PASS；或完成度数字与人工清点不符。

### 批次 B — 补上真正拦得住错误的准确性

#### B1 · 落地 `validate_sql_column_refs.py`（AX3/AX4 的机器强制）

**目标**：编造列名必须被拦住。这是整个规格里最值钱的校验器，也是本垂直域存在的理由。

**前置改动**：`table-schema.json` 从单表对象改为多表容器：

```json
{ "tables": { "<table_name>": { "columns": [...], "provenance": {...} } } }
```

同步更新 `examples/.../table-schema.json`（补 `dwd_t_customer_insight_map_m`）与 `codespec/schemas/ioc-workflow/templates/` 下的相关模板。

**改法**：新增校验器，输入为 SQL 文件 + 同 feature 的 `table-schema.json`：

1. 用 `sqlglot` 解析（支持 Hive/DLI 方言），提取 `别名 → 表名` 映射与所有 `别名.列` 限定引用
2. 引用表在 schema 内 → 列必须存在，否则 FAIL 并给出该表的可用列
3. 引用表**不在** schema 内 → FAIL，要求先补 evidence。**不跳过**——跳过就是静默降级
4. 目标表（本次新建的 ADS 表）的列不校验来源，留给 `validate_ads_table_design.py`（不在本方案范围）
5. `sqlglot` 不可用时输出 WARNING 并明确写"未验证"，退出码 1；**绝不静默返回 PASS**

**依赖决策**：引入 `sqlglot` 打破当前"零依赖"。备选是自研最小解析器，但那会重演正则校验器的问题——SQL 方言的边界情况太多。选择加 `requirements.txt` + 明确的降级路径，代价是插件多一个可选依赖，收益是这一条能真正拦住错误。

**影响面**：新增 1 个脚本 + 1 个 contract 变更（`table-schema.json` 格式）+ 示例与模板同步 + `guards.js` 的 hql 规则加入该校验器。

**验证**：
- 黄金样本 SQL 中 `base.active_cnt` 在 schema 内 → PASS
- 改成 `base.active_count` → FAIL，指出该列不在 `dws_t_customer_active_daily`
- 移除 schema 里的 `dwd_t_customer_insight_map_m` → `map.space` 触发"表无 evidence" FAIL
- 卸载 `sqlglot` → 退出码 1 且输出含"未验证"

**失效条件**：编造的列名仍 PASS；或依赖缺失时静默 PASS（这一条比前一条更严重，因为它会让整条防线在部署环境里无声消失）。

#### B2 · 把 RED fixture 移出交付目录，建立成对 fixture 集

**目标**：让示例能全绿，同时让每个校验器都有可执行的反例。

**改法**：
1. `examples/0.1.0/fw-2026-0818-001/hql_test/bad_ads_0818_ads_db_marketing_test.sql` → `tests/fixtures/sql/bad_ads.sql`
2. 为每个已实现校验器建立 `tests/fixtures/<validator>/{green,red}/` 成对样本，至少各 1 例
3. 在 A3 的检查项 9 中登记覆盖率

**为什么可能有效**：GREEN/RED 成对是本仓台账 `project.silent-failure` 的既有处置（"新增检查模式必须同时有 GREEN 与 RED fixture"）。它能证明校验器不是恒真。

**影响面**：文件移动 + 新增 fixture 目录，不改任何逻辑。

**验证**：示例目录内全部 SQL 通过；`tests/fixtures/**/red/*` 全部被对应校验器拦下。

**失效条件**：某个 red fixture 通过了校验——说明该校验器名义存在、实际恒真。

#### B3 · 修 blocks_when 独立路径的不阻塞

**改法**：`blocks_when.py:131-135` 的 `illegal` 加入 `reasons`。一行。

**验证**：对含非法 gate 值的 manifest 独立运行 `blocks_when.py` → 退出码 2。

**失效条件**：仍返回 0。

#### B4 · 拆分 `job-create` 阶段 id，一次性关闭 15/16 漂移

**目标**：让两次 job-create 能有不同的进入条件；顺带消除已经发生的数字漂移。

**改法**：stage id 拆为 `job-create-test` / `job-create-formal`，同步 6 处：
- `schema.yaml` 的 `main_paths` 与 `blocks_when`
- `harness/stages/stage-index.yaml` 与 `10-job-create.md`（拆成两张卡或加 frontmatter 分支）
- `blocks_when.py` 的 `STAGE_LEGAL` 与 `STAGE_CONTRACTS`
- `dsh/api.js` 的 `DATA_STAGES`
- 散文里的"15 阶段"统一改为 16（`AGENTS.md`、`README.md`、`skills/ioc-vertical/SKILL.md`）

契约差异：`job-create-test` 需 `validation-report.md` 且等级 ≥ L2；`job-create-formal` 需 `hql/` 非空且 `platform_test: pass`。

**顺带修正**：`harness/stages/07-sql-validation.md:7` 的 `requires_gates: [sql_validation_static]` 写的是本阶段的**出口**门禁，应为入口条件。

**影响面**：跨 6 个文件的破坏性变更。当前无真实 feature 在跑，是成本最低的时机。

**验证**：A3 检查项 7 通过；`hql/` 为空时 `job-create-formal` BLOCKED 而 `job-create-test` 不受影响。

**失效条件**：两个阶段仍共享同一组进入条件。

### 批次 C — 降低认知负担

#### C1 · 单一真源，消除 5 份 gate 拷贝

**目标**：让 CORE-AX4 对这个插件自己也成立。

**改法**，逐项指定真源：

| 内容 | 机器真源 | 其余拷贝怎么办 |
|---|---|---|
| 12 个 gate | `schema.yaml` 的 `gates` 段 | `ioc_common.GATES` 改为运行时读 `SCHEMA_PATH`（常量已存在）；`guards.js` 通过 `py('dump_gates.py', ['--json'])` 取，**不引入第三个 YAML 解析器**；`gates-glossary.md` 保留为人读文档，由 A3 校验其与真源一致 |
| PAT-DOM-* | `domain-patterns-index.yaml` | 删除 `validate_domain_patterns.py` 的 `BUILTIN_PATTERNS`，改为读文件；**读不到即 FAIL，不回退内置**——回退内置就是静默降级。`knowledge-base/.../domain-source-patterns.yaml` 改为指针 |
| CORE-AX | `core-ontology.md` | `AGENTS.md` / `ioc-vertical` / `preset` 只留不可协商 3 条 + 指针（与 C3 同批） |
| 阶段契约 | `schema.yaml` 的 `blocks_when[].missing_contract`（新增字段，注释已声明） | `blocks_when.py` 的 `STAGE_CONTRACTS` 改为读 schema |
| `stage: "*"` 语义 | `schema.yaml` | 把"仅 P0 open 时生效"写进 schema 的规则表达，删掉 `blocks_when.py:140-143` 的隐式覆盖 |
| 分层规则 | `ontology-layers.yaml` | `kimball-profile.yaml` 改为引用 |

**顺带修正**：`ioc_common.py:39` 的 `os.path.join(HERE, 'lib')` → `HERE`。

**依赖**：应在 B4 之后做，否则阶段 id 要改两遍。

**验证**：改任一真源，所有消费点行为随之改变；A3 的一致性检查全绿。

**失效条件**：仍能只改一处而让两处不一致地共存。

#### C2 · 定义"基线未命中"协议

**目标**：让 CORE-AX4 在基线稀疏时不退化为无约束生成。

**改法**：`core-ontology.md` 给 CORE-AX4 补一条子款——**未命中 ≠ 无约束**。未命中时必须产出一条 P1 澄清项或写入 change-packet 的"基线缺口"节，对应 gate 保持 `not_started`，不得凭常识继续。相关阶段卡片的 DoD 各加一行。

**诚实标注**：本项**规范先行，暂无机器强制**。机器强制需要 `validate_ads_table_design.py`（检查每个维度列有 `ontology_ref` 或澄清项编号），成本较高，排在本方案之外。

**验证**：在基线中不存在的维度上跑一次 ads-design，观察是否产出澄清项而非直接落盘。

**失效条件**：Agent 仍在查不到基线时自行决定维度定义。

#### C3 · 削减常载上下文

**目标**：公理只付一次费，可枚举内容改为按需取。

**改法**：
1. `preset/agent.cordis.yml` 的人格段只保留：路由三步（定位阶段 → 读卡片 → 跑门禁）+ 不可协商 3 条（AX9 BLOCKED 即停工、AX8 澄清人裁定、AX10 工具失败不落盘）+ 指针。删除 15/13 阶段枚举与策略枚举。
2. `AGENTS.md` 只留"先读什么"的指针表。
3. `skills/ioc-vertical/SKILL.md` **保留全文**——它是 skill，只在触发时进上下文，正是渐进披露里该放这些内容的层。
4. （后续，依赖"当前阶段"可推断）白名单加 `stages: [...]` 字段，skills provider 的 `list()` 按当前阶段过滤，控制 description 空间。

**验证**：改前/改后各测一次首轮上下文规模；黄金样本全流程行为不变。

**失效条件**：**Agent 开始忘记跑门禁或忘记 AX8**。这就是本项砍过头的判据——一旦出现，把对应条目移回常载。

#### C4 · 交互契约与 BLOCKED 出路

**目标**：让使用者知道自己在哪、被问什么、被挡住之后怎么走。

**改法**：
1. 把 `PRINCIPLES.md` 的 P1–P7 内联一份到 `codespec/guidelines/ioc-kernel/interaction-principles.md`，文件头注明上游来源与同步责任。**这份拷贝是必要的**——插件独立分发，不能相对链接到 `moon-skills`。
2. 8 个 IOC skill 各加 `## 交互规范` 段，引用该文件 + 本 skill 的每 Phase 输出格式表。
3. BLOCKED 消息契约：新增 `ioc_common.blocked_reason(axiom, locus, action, waiver) -> str`，所有校验器改用。每条阻塞项必须带四元素——**违反哪条公理/策略 · 文件:行 · 建议动作 · 可否 waive 及由谁**。

**验证**：随机取 3 条 BLOCKED 输出，交给没读过规格的人，看能否照着修好。

**失效条件**：使用者拿到 BLOCKED 后仍需要读源码才知道下一步。

### 批次 D — 让改动不再退化

#### D1 · 测试与 CI

**改法**：
1. `package.json` 加 `scripts`：`test`（`node --test tests/` + Python fixture 套件）、`check`（A3 的一致性检查）、`gate:example`（对黄金样本跑门禁，期望 PASS）
2. 新增 fixture 驱动测试，遍历 `tests/fixtures/**` 断言 green→PASS / red→FAIL
3. GitHub Actions 跑 `npm run check && npm test && npm run gate:example`
4. 棘轮：A3 检查项 9 升为 FAIL，fixture 覆盖率只能升不能降

**验证**：把任一校验器改成恒返回 PASS → 对应 red fixture 必须失败。

**失效条件**：注入恒真校验器后测试仍全绿。

#### D2 · 版本握手

**改法**：`preset/preset.yml` 增 `requires_plugin: ">=0.1.0"`；`dsh/index.js` 的 `apply()` 比对并在不匹配时 `console.warn` + 工作台顶部提示；`ioc_init_workspace` 在目标写 `.ioc-plugin-version`，门禁启动时比对，漂移则 WARNING。

**验证**：把 preset 要求改高 → 出现告警。

**失效条件**：preset 与 plugin 版本不符时无任何提示。

---

## 4. 排期与依赖

| 批次 | 内容 | 依赖 | 粒度 |
|---|---|---|---|
| A | A1 guard-report 闭环 · A2 gate 挣得 · A3 一致性检查 | 无 | 一个工作块（4 个文件改动 + 1 个新脚本 + 示例修正） |
| B | B1 列引用校验 · B2 fixture 归位 · B3 一行修复 · B4 阶段 id 拆分 | A3 作为回归网 | B3/B2 极小；B1 中等；B4 跨 6 文件 |
| C | C1 单一真源 · C2 基线协议 · C3 上下文瘦身 · C4 交互契约 | **C1 必须在 B4 之后** | C1/C4 中等；C2/C3 小 |
| D | D1 测试与 CI · D2 版本握手 | A、B 完成后收口 | 随 A/B 增量补，不单独排期 |

关键路径：**A3 → B4 → C1**。其余项可并行。

## 5. 明确不做

- **不补齐** ~50 个未实现 skill 与 ~21 个未实现校验器。本方案只让缺失可观测，不消除缺失。
- **不实现** lineage API（`/ioc-api/feature/tables` 保持显式 stub）。
- **不引入** codespec CLI，手动路径继续作为唯一运行路径。
- **不填充** knowledge-base 的领域内容——那是数据资产工作，不是工程工作，且需要业务侧输入。
- **不修** 工作台数据接线与 `IOCC` 文案（P2-4 的盘点结论部分），单独确认后另排。
- **不改** MetricCanvas 主仓的任何运行时代码；本方案的写入范围限于 `ioc-data-dev/` 与本计划文件。

## 6. 风险与回退

| 风险 | 影响 | 处置 |
|---|---|---|
| `sqlglot` 打破零依赖 | 部署环境缺依赖时 B1 失效 | 降级为 WARNING + 明确"未验证"，绝不静默 PASS；把这一条写进 D1 的测试 |
| B4 是破坏性变更 | 已有 feature 目录需迁移 | 当前无真实 feature，现在改成本最低；越晚越贵 |
| A1/A2 会立刻挡住现有示例 | 示例暂时 BLOCKED | A2 同批修示例，两项必须一起合入 |
| C3 可能砍掉必要纪律 | Agent 忘记跑门禁 | 失效条件已定义为可观察信号，出现即回滚对应条目 |
| A3 暴露的完成度数字偏低，可能被读成"项目很差" | 影响判断 | 数字衡量的是**声明与实现的差**，不是工作量；README:98 已有同样的诚实表述 |

回退方式：批次 A 的四项改动都是局部的（4 个文件 + 1 个新脚本），`git revert` 即可；A3 是纯新增只读脚本，无需回退。

## 7. 整体验收

一句话判据：在黄金样本上 `npm run check && npm test && npm run gate:example` 全绿，且对下列 6 类可控缺陷各注入一次，全部转为 BLOCKED/FAIL：

| 注入 | 期望 | 对应项 |
|---|---|---|
| 把 gate 改成 `pass` 但产物缺失 | BLOCKED，指明缺哪个产物 | A2 |
| 写入违规 SQL 后尝试推进阶段 | BLOCKED，指向 guard-report 的 FAIL 节 | A1 |
| 把列名改成 schema 里不存在的 | FAIL，列出该表可用列 | B1 |
| 澄清项 `closed_by: AI` | 写前 deny | 已实现，纳入回归 |
| 非法 gate 值（含独立运行 `blocks_when.py`） | 退出码 2 | B3 |
| 在 `skills/` 新建未注册目录 | 一致性检查 FAIL | A3 |

全部 6 项通过，才说明这个插件汇报的纪律等于它执行的纪律。
