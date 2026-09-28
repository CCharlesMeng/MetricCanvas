**# IOC 数据设计/开发 Skill 体系总结**

\> **\*\*版本\*\***: 1.0 · 2026-09-18

\> **\*\*定位\*\***: 面向 SE / 数据开发 / AI Agent 的 skill 使用与配合关系总览

\> **\*\*真源\*\***: \`.cac/skills/\`（skill 定义） + \`codespec/guidelines/ioc-kernel/activities-registry.yaml\`（机读编排） + \`contracts-index.md\`（契约索引）

\---

**## 1. 整体介绍**

本 Workspace 采用 **\*\*SDD（Specification-Driven Development）工程化架构\*\***，数据设计/开发能力全部以 **\*\*Skill（\`.cac/skills/\`）\*\*** 形式封装，由 **\*\*Activity 注册表（\`activities-registry.yaml\`）\*\*** 机读编排，配以 **\*\*harness/tools 结构校验器\*\***、**\*\*.cac/hooks 行为守卫\*\***、**\*\*knowledge-base 知识底座\*\*** 和 **\*\*clouddp-cli / cloudioc-cli 外部平台工具\*\***共同构成完整的"设计 → 开发 → 验证 → 发布"流水线。

**### 1.1 两条主路径**

\| 路径 | 起点 | 目的 | 关键区别 |

\|------|------|------|---------|

\| **\*\*data\_main\_path\*\***（ADS 路径） | PRD（indicator v0） | 看板 ADS 应用表 | 面向"看板消费模型"，指标资产只做绑定 |

\| **\*\*subject\_main\_path\*\***（Subject 路径） | subject-requirement / PRD | DWD/DWS 主题层 | 面向"事实 grain 与上游数据模型"，可 Embedded（为 ADS 补缺表）或 Standalone（独立交付） |

两条路径在 \`sql-generate\` 之后合并，共享同一套 SQL 生成/验证/作业/平台/归档尾段。

**### 1.2 核心数据契约：feature-delta-indicator.md 四阶段**

数据设计的"主线"围绕 indicator 文件生命周期展开（真源：\`ioc-kernel/references/indicator-lifecycle.md\`）：

\`\`\`

v0 业务盘点 + PM数据来源建议          → sdd-prd

v1 来源类型 + 逻辑来源引用（逻辑层）   → ioc-data-design

v2 ADS表名/字段名 + 消费数据源（落点）→ ioc-ads-design

v3 表服务名 + serviceCode + 出参      → ioc-service-design（前端主读入口）

\`\`\`

每一阶段的 skill 负责一个"升版"，并通过 \`gates.\*\` 门禁 + \`validators\` 结构校验收口。

\---

**## 2. 模块介绍（按职责分组）**

**### 2.1 设计阶段 Skill**

\| Skill | 阶段 | 职责 | 主要产物 |

\|-------|------|------|---------|

\| \`ioc-data-design\` | \`data-design\` | 逻辑数据设计：SE 裁定每个看板字段的来源类型（指标/中间表/接口/复用 ADS）与逻辑来源引用，indicator v0→v1。**\*\*不做\*\*** ADS 物理 schema | \`feature-delta-indicator.md\`（v1）、\`evidence/indicator-table.xlsx\`、可选 \`data-design-clarification-questions.md\`、条件 \`subject-requirement.md\` |

\| \`ioc-ads-design\` | \`ads-design\` | ADS 物理 schema 设计：消费 indicator v1，产出 \`delta-design-ads.md\`，回填 indicator v2 | \`delta-design-ads.md\`、indicator v2 回填、\`ads-clarification-questions.md\` |

\| \`ioc-ads-design-validate\` | \`ads-design-validation\` | **\*\*只读\*\***差分对账：看板字段/GWT/复用表覆盖校验，产出校验报告 | \`ads-design-validation-report.md\` |

\| \`ioc-subject-design\` | \`subject-design\` | 主题层 DWD/DWS 表设计：grain 定义、维度/度量、增量策略、上游 ODS/SDI 来源绑定 | \`delta-design-subject.md\`、\`subject-source-bindings.yaml\`、\`subject-clarification-questions.md\` |

\| \`ioc-subject-design-validate\` | \`subject-design-validation\` | **\*\*只读\*\***校验 subject 设计产物（grain/scd/incremental/partition、来源绑定、澄清闭环） | \`subject-design-validation-report.md\` |

\| \`ioc-service-design\` | \`service-design\` | 数据服务设计：裁定每个服务 create/modify/reuse，写清出参/维度角色/固定 where/可选筛选维度，indicator v2→v3 | \`ioc-service-design.md\`、indicator v3 回填 |

\| \`ioc-frontend-plan\` | \`frontend-plan\`（并行轨） | IOC 上下文注入器 + 委托 \`sdd-frontend-design\` 做前端方案 | \`requirement-frontend-design.md\` + \`testability-map.md\` |

\| \`ioc-data-plan\` | 早期（ioc-spec 之后） | 交叉分析需求规格/视觉解码/存量指标，产出 \`Data-Dev.md\` / \`Display-Contract.md\` / \`Mock-Spec.md\` | 三份对接文档（被 ioc-ads-design 主路径取代/互补） |

**### 2.2 SQL 生成与验证 Skill**

\| Skill | 阶段 | 职责 | 主要产物 |

\|-------|------|------|---------|

\| \`sql-generator\` | \`sql-generate\` | 按数据契约生成 DDL/ETL/查询脚本；**\*\*唯一真源驱动\*\***（列名以 \`table-schema.json\` + \`sql-source-bindings.yaml\` 为准）；支持 \`--layer ads\` / \`--layer subject\`；extend 模式基于存量 ETL 增量修改 | \`hql\_test/\*\_test.sql\`（测试态） |

\| \`sql-validator\` | \`sql-validation\` | 双职责：R2 静态校验（DDL/ETL 审查 + 列引用 + 设计文档一致性 R2c）与 R3 平台回填登记 | \`validation-report.md\` |

\| \`sdd-job-creator\` | \`job-create\` | 将已验证 SQL 打包为工作平台可导入作业包（TEST/FORMAL zip），**\*\*不\*\***重新生成 SQL | \`job-package/\` 三层资产 + zip |

\| \`sdd-create-us\` | — | 从 \`requirement-design.md\` 表格批量调用 \`codespec devops create-story\` 创建 US 工单 | US ID 回填 |

\| \`sdd-clouddevops-update\` | \`clouddevops-review\` | 上传设计文档到云捷、提交 FE 评审、跟踪 canCreateStory | \`clouddevops-review-report.md\` |

**### 2.3 数据质量/稽核 Skill（支撑轨）**

\| Skill | 定位 | 配合关系 |

\|-------|------|---------|

\| \`grain-join-analysis\` | 表粒度三元组 (E,T,V) 推断 + JOIN 正确性判定 | **\*\*前置于 JOIN 设计\*\***；产出 grain-contract + 验证 SQL；\`--mode static-only\` 供试算前静态分析 |

\| \`source-field-profiling\` | 来源表字段七维探查（枚举/时间格式/NULL三态/JOIN键唯一性/类型一致性/包含度/值样本） | 被 \`source-field-profiler\` subagent 调用；**\*\*JOIN 设计前\*\***探查（subject Phase 1.5 / ads Phase 2.5） |

\| \`table-validation\` | 四方一致性表验证（源表↔设计↔DDL↔数据），CLI 实际执行 | \`--phase A-only\` 试算前 / \`--phase B-only\` 试算后 |

\| \`data-validation\` | ETL 产出主题表**\*\*数据内容\*\***稽核（发现驱动） | 管"数据内容对不对"；与 grain-join（JOIN 对不对）、table-validation（结构和首载对不对）配套 |

\| \`design-doc-conformance\` | 原始设计文档一致性校验（7 类内容类型） | 被 \`design-doc-conformance-checker\` subagent 调用；防断链 1/2/3 |

\| \`audit-rule-generator\` | 从 data-validation 产出生成 CloudIOC 平台常态化稽核 JSON 规则 | etl-audit post-platform 完成后调用 |

\| \`audit-report-view\` | ETL 稽核报告 HTML 可视化工作台 | 读取 etl-audit 产出的 \`audit-reports/\*.md\` |

\| \`single-data-table-update\` | 1-5 张表数据割接执行器 | 用户直接调用；依赖 clouddp-cli |

\| \`data-table-update\` | 批量数据表割接编排器（CSV 清单） | 按类型分组并行调度 single-data-table-update |

**### 2.4 外部平台工具 Skill（CLI 封装）**

\| Skill | 平台 | 提供能力 | 使用方 |

\|-------|------|---------|--------|

\| \`clouddp-cli\` | CloudDP | 表结构（get-columns-info）、执行 SQL（get-data-result-by-sql）、指标挂靠资产（get-metric-info）、建表、全文搜索脚本、作业导入等；CN/INTL 双站点 | ioc-data-design / ioc-ads-design / ioc-subject-design / table-validation / data-validation / sdd-job-creator |

\| \`cloudioc-cli\` | CloudIOC(CloudBI) | 表血缘（get-table-lineage）、数据服务搜索/详情（data-search/data-detail）、服务创建/修改（create-service/update-service，灰度）、DQC 稽核配置、工作流/脚本/作业历史 | ioc-data-design / ioc-ads-design / ioc-service-design / ioc-service-develop / etl-lineage-explorer |

**\*\*关键约束（CORE-AX10）\*\***：CLI 工具失败即停工——禁止落盘 evidence、禁止换用遗留脚本/推断列/DDL 反推等替代取数；须反馈用户待修项，人修工具后 Agent 重试。

**### 2.5 澄清/协作 Skill**

\| Skill | 职责 |

\|-------|------|

\| \`clarification-view\` | SDD 澄清工作台：DD-Q/ADS-Q/SUBJ-Q .md → HTML 可视化交互，支持人工裁定、Markdown 导出、迭代反馈 |

\| \`data-context-gather\` | 需求名词澄清工具：设计前通过问答对齐关键业务术语，避免指标匹配语义偏差 |

**### 2.6 前端数据消费 Skill**

\| Skill | 职责 |

\|-------|------|

\| \`datav-lowcode\` | L1 产品层：\`@cloud/datav-lowcode\` npm 包完整使用手册 |

\| \`ioc-frontend-graphql\` | L2 项目层：IOC 前端 GraphQL 数据调用编码约束，需配合 datav-lowcode 使用 |

**### 2.7 基线/逆向 Skill（数据底座建设）**

\| Skill | 职责 |

\|-------|------|

\| \`sdd-reverse-data\` | 从工作流资产（.script + .job）逆向生成 DataTree 一表一文件、维度定义、SQL 工程规范、架构知识 |

\| \`bigdata-knowledge-reverse\` | 大数据数仓知识逆向：Agent 读全部 SQL 脚本，提炼业务规则编码为决策规则注入 Agent 决策路径 |

\| \`sdd-knowledge-index\` | 创建/修复知识索引（knowledge-base/index.md、codebase/codespec/index.md） |

\| \`semantic-creator\` | 从 API/CLI/表构建证据型 Kimball 语义层（OKF/YAML） |

\| \`excel-table-schema-extractor\` | 从华为云数据模型设计 Excel 提取 ADS 表 schema 为 YAML |

\---

**## 3. Skill 架构说明**

**### 3.1 编排中枢：activities-registry.yaml**

\`ioc-kernel/activities-registry.yaml\`（主文件）→ \`activities/act.\*.yaml\`（每文件 1 个 activity，≤80 行）。loader 透明合并为 \`{activities: {act\_id: {...}}}\`。

每个 activity 定义六要素：

\| 字段 | 含义 |

\|------|------|

\| \`stage\_id\` | 阶段标识（可多 activity 共享，如 act.requirement + act.prd） |

\| \`skill\_name\` | 该 activity 绑定的 skill（\`required\_skill\_invocation\` 强制经 Skill 工具调用） |

\| \`consumes\` / \`produces\` | 契约 ID（CTR-\*，见 contracts-index.md） |

\| \`evidence\` | 需登记的证据（E-\*，gate 与 evidence 同步） |

\| \`sets\_gate\` / \`blocks\_when\` | 出口门禁与阻塞条件（gate 值 / missing\_contract / min\_level） |

\| \`validators\` | 结构校验脚本（harness/tools/validate\_\*.py） |

\| \`required\_tools\` | **\*\*条件触发\*\***的 CLI/知识库工具（含 \`when\` 条件与 \`on\_failure=stop\_and\_report\_user\`） |

\| \`next\` | 下游 activity |

**### 3.2 Skill 配合关系（数据主路径）**

\`\`\`

act.prd (sdd-prd, indicator v0)

  → act.data-design (ioc-data-design, v1) ── 澄清须人工(CORE-AX8)，澄清工作台 clarification-view

  → act.ads-design (ioc-ads-design, v2) ── 委派 etl-lineage-explorer / source-field-profiler / design-doc-conformance-checker

  → act.ads-clarification-apply (澄清回写)

  → act.ads-design-validation (ioc-ads-design-validate) ── gates.ads\_design\_validation=pass 才放行

      ├── 并行轨 A: act.service-design (ioc-service-design, v3) → act.service-develop (ioc-service-develop)

      ├── 并行轨 B: act.frontend-plan (ioc-frontend-plan → sdd-frontend-design)

      ├── 并行轨 C: 测试三件套 (test-analyzer → testpoint-analyzer → testcase-designer)

      └── 数据轨: act.clouddevops-review (sdd-clouddevops-update)

  → act.sql-bindings-ready (sql-source-bindings.yaml + table-schema.json)

  → act.sql-generate (sql-generator) ── 消费 join\_safety / field-profile evidence

  → act.sql-validation (sql-validator) ── 委派 sql-policy-verifier

  → act.job-create (sdd-job-creator TEST zip)

  → act.platform-test (工作平台试算) → act.promotion → act.platform-formal

  → act.archive (sdd-archive-workspace)

\`\`\`

**\*\*Subject 路径\*\***：\`requirement → subject-design (ioc-subject-design) → subject-clarification-apply → subject-design-validation → subject-sql-bindings-ready → sql-generate(→sql-validation→job-create→platform…→archive)\`。

**### 3.3 indicator 生命周期写权限（CORE-AX6）**

\| 列族 | 可写 Activity |

\|------|--------------|

\| 需求澄清列 | \`act.prd\`；后续只读 |

\| 逻辑来源列（v1） | \`act.data-design\`；\`act.ads-clarification-apply\`（来源变更） |

\| 交付绑定列（v2） | \`act.ads-design\` Phase 6；\`act.ads-clarification-apply\`（映射变更） |

\| 数据服务列（v3） | \`act.service-design\`；后续只读 |

**### 3.4 委派架构：subagent 承担重活**

设计/验证类 skill 通过 subagent 委托实现，主 Agent 只给指针（feature\_dir），subagent 自读文件构建上下文：

\| subagent | 委派场景 | 依赖 skill |

\|----------|---------|-----------|

\| \`etl-lineage-explorer\` | 血缘 + 存量 ETL 探查（subject Phase 0c/0d、ads Phase 2b/2c） | cloudioc-cli（get-table-lineage/get-job-detail/get-script-detail）、clouddp-cli（search） |

\| \`source-field-profiler\` | JOIN 前字段质量探查（subject Phase 1.5、ads Phase 2.5、信号驱动探查） | \`source-field-profiling\` 方法论 + clouddp get-data-result-by-sql |

\| \`design-doc-conformance-checker\` | 原始设计文档忠实度（ads/subject Phase 0e、sql-validator R2c Check 8） | \`design-doc-conformance\` 方法论 |

\| \`sql-policy-verifier\` | 逐 SQL 全策略校验（POL-SQL-*\*/POL-NAMING-\**/POL-QUALITY-*\*/PAT-DOM-\**） | sqlglot（alias 提取） |

\| \`etl-audit\` | 稽核两阶段编排（pre/post-platform） | grain-join-analysis + table-validation + data-validation |

**### 3.5 行为守卫（Behavioral Guards）**

\- **\*\*结构型守卫（AUTO）\*\***：写入匹配 guard 模式的文件后，\`PostToolUse\` Hook 自动运行 \`validate\_\*.py\`；FAIL 须先修再走。

\- **\*\*语义型守卫（MANDATORY）\*\***：写入受约束文件后须显式调用 \`sdd-verify\` skill 做语义级比对，否则 stage gate BLOCKED。

\- **\*\*模板格式约束（Pre-Write）\*\***：\`PreToolUse\` Hook 在写入前按 \`template-constraints.yaml\` 校验文件名/格式，违规直接拒绝写入。

\- 守卫定义：\`behavioral-guards.yaml\`（BG-READ-001 / BG-CONTEXT-001 / BG-CLARIFY-001 / BG-TOOL-001 / BG-UPSTREAM-001 / BG-LIFECYCLE-001 / BG-REUSE-001 等）。

**### 3.6 门禁与停工机制（Fail-Closed）**

\- 每阶段出口运行 \`python harness/tools/sdd\_stage\_gate.py --feature \<FE> --stage \<stage>\`；返回 BLOCKED 即停工（CORE-AX9）。

\- BLOCKED 后 \`PostToolUse\` Hook 写入 \`.stage-gate-blocked.json\` → \`PreToolUse\` Hook **\*\*硬 deny\*\*** 后续 Write/Edit/Bash（白名单：重跑 gate / 只读 git / 运行 validator），并保护 \`harness/tools/validate\_\*.py\` 不被自改绕过。

\- 澄清项 \`answered\`/\`closed\` 只能由人类裁定（CORE-AX8）；AI 不得推断来源表并 closed P0。

**### 3.7 知识底座依赖**

Skill 运行期消费的唯一真源（\`knowledge-base/\`）：

\| 知识域 | 路径 | 消费方 |

\|--------|------|--------|

\| 指标索引 | \`architecture/metric/指标索引.json\` | ioc-data-design / ioc-ads-design |

\| DataTree 资产注册表 | \`data-tree/registry.yaml\` | ioc-data-design / ioc-subject-design |

\| 语义层事实 | \`ontology/hwcloud\_marketing/facts/\*.md\` + \`catalog.yml\` | ioc-ads-design / ioc-subject-design |

\| 一致性维度 | \`ontology/shared-dimensions.yml\` + \`architecture/dimension/dimension-registry.yaml\`（ontology\_ref 桥接 JOIN 路径） | 设计类 skill |

\| 六层调用规则 | \`specification/data-design/ontology-layers.yaml\`（TABLE\_TOKEN\_RE / VALID\_SOURCE\_TYPES） | 设计类 skill + validate\_layer\_consumption |

\| SQL 工程规范 | \`specification/data-design/\`（sql-etl-patterns.yaml、sql-ddl-snippets.yaml、hive-set-config.yaml、data-design-constraints.yaml、engine-differences.yaml、platform-conventions.yaml、domain-source-patterns.yaml） | sql-generator / sql-validator |

\| 领域模式 | \`domain-patterns-index.yaml\`（PAT-DOM-\*） | sql-generator / sql-validator |

**### 3.8 引擎分离与测试态隔离**

\- \`change-manifest.yaml\` 顶层 \`engine\`（hive/dli）是单一真源，驱动 SET 配置、测试库（\`bi\_test\` / \`cbc\_test\`）、DDL 末尾分支。

\- 验证前只执行 \`hql\_test/\*\_test.sql\`；测试态表名格式 \`{表}\_{MMDD}\_{原始库}\`，仅目标表加后缀，源表按 role 区分因果派生（intra\_fe\_source 用测试态名，upstream\_main/dimension 直用原始名）。

\- 页面全量数据契约以 \`delta-design-ads.md\` + 校验报告 §4 为准，**\*\*非\*\*** \`hql\_test/\` 表清单。

\---

**## 4. 快速查找表（skill → 使用时机）**

\| 用户诉求关键词 | Skill |

\|---------------|-------|

\| PRD 完成后确认字段逻辑出处、来源类型、ZB/表/API 绑定 | \`ioc-data-design\` |

\| ADS schema / 看板字段 / 应用表设计 | \`ioc-ads-design\` |

\| ADS 设计覆盖校验 / 看板字段覆盖 | \`ioc-ads-design-validate\` |

\| DWD/DWS 主题层表设计 / grain / 增量 | \`ioc-subject-design\` |

\| 数据服务设计 / 表服务 / API 服务 / 筛选维度 | \`ioc-service-design\` |

\| 数据服务开发 / create-service / update-service | \`ioc-service-develop\` |

\| SQL/HQL 脚本生成 | \`sql-generator\` |

\| SQL 验证 / validation-report / 静态校验 | \`sql-validator\` |

\| 作业打包 / DLF workflow / TEST/FORMAL zip | \`sdd-job-creator\` |

\| 表粒度 / JOIN 判定 / 数据翻倍 | \`grain-join-analysis\` |

\| 表验证 / 四方一致性 / 数据量验证 | \`table-validation\` |

\| 数据稽核 / 数据内容对错 / 稽核点推导 | \`data-validation\` |

\| 来源表字段探查 / 枚举分布 / JOIN 键唯一性 | \`source-field-profiling\`（subagent: source-field-profiler） |

\| 原始设计文档一致性 / 防断链 | \`design-doc-conformance\`（subagent: design-doc-conformance-checker） |

\| 常态化稽核规则 JSON | \`audit-rule-generator\` |

\| 稽核报告可视化 | \`audit-report-view\` |

\| 澄清可视化交互 | \`clarification-view\` |

\| 数据割接 | \`single-data-table-update\` / \`data-table-update\` |

\| 数据层基线逆向 | \`sdd-reverse-data\` / \`bigdata-knowledge-reverse\` |