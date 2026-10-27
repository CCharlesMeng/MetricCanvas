# 已开发能力同步与 main 合并计划

状态：B1 已提交 main；B2 及配套材料正在完成交付。日期：2026-10-27。

## 目标与基线

将已经开发的产品增量按依赖迁入最新 main，补齐同版协议分发和内部运行验证；对已交付的旧副本、原型、临时业务页、文档及证据分别收口，避免重复实现或覆盖较新的代码。

本轮再次执行 `git fetch origin --prune`，基线仍为 `1955324fe7392957c5663996a1e076842ad19efe`，main 当前 Schema 为 6.66。范围与逐文件分类见[本地盘点](../evidence/local-main-audit-20261027.md)，机器清单为 `out/unmerged-main-audit-20261027/analysis.json`。执行每一批之前重新 fetch；以下版本号是按当前基线建议的分配，若 main 先有其他版本交付则顺延。

本次仅新增计划及计划索引，不改源代码、页面或工作树状态，不进行 commit、push、部署或清理。产品函数复杂度测量不适用于本次文档变更；实施时按各批修改函数重新测量。

## 总体决策

1. 采用两个顺序产品交付批次：**期间能力 6.67 → 时间字段下推 6.68**。每批形成独立可验收的提交/PR，按对应 SHA 等待 CI。
2. 从最新 main 的隔离工作树承接；现有两个开发工作树继续保存原始实现及证据，不直接更新或重置当前混合主工作区。
3. 按文件及 hunk 迁移产品真源，再从集成基线生成契约、local-authoring 和 MC 内容。不得整目录覆盖，也不直接搬运旧工作树的生成树。
4. 现有 `part:"mode"` 与 `periodPolicy` 作为同一期间批次交付。二者各有清晰行为，但现有实现、工作台及验收已围绕同一能力组织；当前不为缩小提交再拆成第三个协议版本。
5. 代码合入、发行物生成、内部安装、真实业务查询分别验收。内部环境消费同一交付提交生成的 Schema、校验器和运行时后，才能把页面标为内部可运行。

## 全部本地内容的处理矩阵

| 内容 | 处理批次 | 同步方式与完成条件 |
|---|---|---|
| 期间模式读取、组件/列组显隐、查询期间策略及工作台配置 | B1，产品能力 | 移植真源，能力下限改为 6.67，复验后合入 |
| 普通 DQE 显式时间字段范围下推、审批记录预算修复及业务页 | B2，产品能力 | 基于 B1 的 main 移植，能力下限改为 6.68，复验后合入 |
| local-authoring 的使用问题回灌与工作流说明 | B3，文档与分发 | 逐段保留新增知识，合入 main 已更新的局部读取/升级流程；不回退整份文件 |
| 成熟度、伙伴健康度、治理合规及报表实验页 | B4，页面与实例 | 按目标运行时校验，标明静态/真实数据与待验项；必要页面保留 temporary，实验批次归档 |
| 饼图原型提交 f6fd243c0、IOC Select、Platform 创作流程、Report 布局等原型 | B5，设计资产 | 核对与已交付产品能力的差异；仅迁移仍有价值的说明/独立演示，原型不替换正式组件 |
| 主工作区已被 main 包含的 1084 个状态路径 | R1，工作区整理 | 不是新能力，不再提交；完成快照及剩余工作转移后另行对齐 |
| 主工作区其余源码重叠、历史版本及生成物 | R1，工作区整理 | 逐 hunk 判断新增意图；较旧实现不覆盖 main，生成物重新生成，不能整批当成待交付代码 |
| ioc-data-dev 调研、附件、截图、日志及历史计划 | B5/R1，知识与证据 | 有引用的证据保留可追溯摘要；已收口探索按文档寿命归档；缓存不作为产品交付 |

“已开发”不等于“均应进入正式产品”。本表为全部审计发现指定去向，原型和缺真实数据的实例有明确保留位置，不计入 B1/B2 的产品能力清单。

## B0：冻结输入与建立集成基线

- [ ] 重新核对全部工作树状态、HEAD、最新 origin/main 和活动服务 cwd；记录源工作树文件清单与内容哈希。
- [ ] 保存两个开发批次的 tracked diff、未跟踪源码/测试/页面及验收材料。忽略的关键证据单独保留；不靠 stash 或仅保存提交来代表全部工作。
- [ ] 按 scoped-main-delivery 选择/创建本任务隔离工作树，建议分支 `codex/integrate-local-capabilities`；基于最新 origin/main，不从旧主工作区派生当前文件全集。
- [ ] 先保留 main 的 DQE 单字段排序、记录关联、图表常量、KPI primaryDetail、列显隐及知识压缩修复。迁移每项增量时核对该文件最新内容。
- [ ] 建立交付表：能力、真源路径、页面入口、协议版本、Skill 版本、验证输入 SHA、CI SHA、部署状态。源工作树在能力完全交付前保持可恢复。

## B1：期间能力，建议 Schema 6.67

### 要交付的行为

- `visibleWhen`/`enabledWhen` 的既有统一条件读取 `display:"period"` 筛选器的已应用 `selection.mode`，供内容分区、KPI、列及列组共用。
- 缺少已应用选择为 pending，非法来源为 error；`not` 不把 pending/error 反转为允许。模式显隐不改变原始行粒度、查询范围或权限。
- 每个指标查询可显式声明 `periodPolicy`，选择固定 day/month/year，或按所选期间并声明 supportedPeriods；省略继续旧行为，普通编辑不自动迁移已有查询分支。
- 工作台显式迁移时同步该查询全部静态分支；未选择的查询保持原配置。

### 真源范围

源工作树：`/Users/moon/.codex/worktrees/period-query-policy/DataDashboard`。

- 页面协议与运行计算：`packages/page/src/condition.ts`、`schema/condition.ts`、`presentation-policy.ts`、`period-query.ts`、`period-capability.ts`、`query.ts`、`schema/data-source.ts`、`report-date-filters.ts`、`internal.ts`、`version.ts`。
- 查询执行：`packages/data-execution/src/effective-query.ts`、`intersect-filters.ts`、`dqe/dqe.ts`。
- 工作台：`ReportDateProperties.svelte`、`report-date-edit.ts`、`report-date-bindings.ts`、`period-policy-edit.ts`、`condition-editor.ts`，以及对应 harness/测试。
- 页面与文档：`period-query-columns-demo`、`period-query-branches`、目录 README、PAGE-METADATA、PAGE-PARAMETERS、conditions/filters/table/queries-and-bindings 正文及 reference-map。
- 对应 page/data-execution/platform 定向测试、浏览器脚本、合法/非法协议夹具、公共 API 快照与能力版本测试。

### 合并必须保留的边界

1. 新能力门槛从开发中 6.66 调整到 6.67；main 已发布的 6.66 审批记录能力不改号。正式例子改用新版本，历史读取向量保留各自版本，不进行全仓字符串替换。
2. **四种 UI 模式可显隐，不代表 DQE 已有四种原生查询编码。** 当前直接 quarter 编码尚未验证，selection 策略仍明确拒绝；季度可由作者显式配置固定 day/month 范围，不能静默回退或自动合计月度得分。
3. 固定 year 可能扩大到完整自然年，保持工作台预览与文档说明；不把扩大的范围描述为精确原区间。
4. 近一年消费已应用窗口；查询、缓存或导出时不重新锚定当前月份。
5. 既有对象查询及 timeModes 不叠加 periodPolicy。与 window、queryField/valueFormat 等重复时间来源的组合继续拒绝。
6. 本次只复用已有组件和样式。若移植后发现真实样式冲突，按仓库约定展示差异后处理，不顺便设计替代控件。

### 验收

- [ ] 页、查询执行、工作台定向回归，覆盖旧声明不迁移、所有分支显式迁移、未绑定查询、非法粒度、等待/错误、版本下限。
- [ ] Playground 正式场景四模式切换，KPI 与两张表对应列组；同时验证隐藏列排序/搜索状态、空列组、Excel/PDF/PNG 的适用导出投影及 URL 恢复。
- [ ] 实际 `contract-maturity-score` 页面作为独立输入回放，检查原始 data 槽合法，不能只靠泛化演示页通过。
- [ ] 390px、正常视口及工作台标签修改/显式策略迁移；记录请求粒度和时间范围，而不只看控件文字。
- [ ] 页面文档、能力下限、产品公共 API、local-authoring 仓外安装/独立校验与 MC 内容同批同步。
- [ ] 新增及修改函数按 metriccanvas-ts-ast/1 重测；存量超限按规则保持/降低并记录，而非宣称全部达标。

既有证据为源工作树 `docs/evidence/period-query-policy/acceptance.md`：记录 1925 项产品回归、Chrome、包构建及 local-authoring 等已通过。本计划只读取了记录；更换基线和版本后，不能以旧记录代替新集成输入的复测。

## B2：显式时间字段下推，建议 Schema 6.68

源工作树：`/Users/moon/.codex/worktrees/rejection-time-pushdown/DataDashboard`。在 B1 已进入 main 后重新取基线；若预先准备依赖分支，合入前仍需按 B1 最终 SHA 复验。

### 真源范围与行为

- `packages/data-execution/src/dqe/dqe.ts` 的指定时间字段编码，保留 B1 的 periodPolicy 分支和 main 的单字段排序编码。
- `packages/page/src/query-selection-validation.ts`、`report-date-filters.ts`、`validate-object-query.ts`、`version.ts` 及对应测试。
- 审批明细 Playground 适配器、`business-rejection-details`、`record-join-demo` 与其 README。
- 查询绑定、数据源文档、reference-map 和 Skill 的“记录关联预算与期间筛选”说明。

把普通 DQE 的 `target:"time" + queryField + valueFormat` 编码为指定字段的范围谓词，在记录预算之前筛选。保留旧统计 `filter.time`、对象查询、记录身份、商务 ID 关联补列和全部读取预算。

### 冲突与兼容验收

- [ ] 能力下限从开发中 6.67 改为 6.68，旧 6.66 的合法 records.timeFilters 继续可读；仅迁移明确指定的审批主查询。
- [ ] 月/日、闰年、iso/compact/datetime 输出编码正确；分钟精度输入仍拒绝，不隐式扩大为整日，不新增时区换算。
- [ ] 静态同字段范围与筛选条件保持 AND，原有更严格业务条件不丢失。
- [ ] 主表审批期间在预算前下推；基本信息不接收审批期间，继续按商务 ID 补列；空主集不补列，多审批记录不去重。
- [ ] periodPolicy、旧统计时间、显式字段时间三条合法路径各自回归；同一绑定混合 periodPolicy 与 queryField/valueFormat 明确拒绝，不能因合并校验分支改变路径而漏检。
- [ ] 过滤后仍超预算继续报错；失败、取消、部分结果、跨批计数和导出行为保持既有约束。
- [ ] 真实内部服务核对实际谓词、按期间缩小后的 total_count、跨批稳定性。没有真实执行证据时保留“代码/Sim通过，真实DQE待验”，不阻断可独立完成的代码交付，也不宣称内部问题已解决。

既有证据为源工作树 `docs/evidence/rejection-time-pushdown/acceptance.md`：记录 1683 项回归、类型、页面、Chrome 与分发通过，明确真实 DQE 未运行。其模拟的 1299225 条预算失败与期间内 12 条成功必须在新基线复现。

## 共享文件的处理原则

| 共享位置 | 合并方式 |
|---|---|
| `dqe/dqe.ts` | 保留最新排序实现，B1 处理策略解析后的统计期间，B2 处理显式时间字段；不能二选一覆盖 |
| `report-date-filters.ts` | 按时间绑定种类保留规则，显式测试交叉非法组合；不因增加一个分支绕过另一项约束 |
| `version.ts` / version 测试 | 在 main 的能力表上累加 6.67/6.68，不搬入旧 CURRENT_MINOR 或删改已发布能力 |
| 工作台属性及条件编辑器 | 在 main 新的 tableColumn/常量/置顶行编辑基础上添加期间选择，不拷贝主工作区的旧实现 |
| `contracts/`、contract-snapshot、local-authoring、MC | 合并真源及作者文件后重新生成，不手工合并旧哈希/压缩知识/打包脚本 |
| public API、版本快照及诊断回执 | 从本批实际产物重建，只更新对应期望，不能改测试使旧错误被忽略 |

## B3：使用问题回灌、作者说明与知识分发

- [ ] 以 main 最新 SKILL.md、page-upgrade、局部读取和知识压缩工作流为基底，按段提取主工作区 data-analysis.md/local-workflow.md 的新增经验。
- [ ] 合并多槽主行集保留、独立图表 filterId、queryModes 实际范围检查、上游排序失效定位和本次同版包能力差异的有效经验；已存在的规则仅补可发现性，不重复堆叠。
- [ ] 规则与 DSL 问题索引相互引用，历史失败记录及旧验证结论保持；不把内部未部署改写成 JSON 拼写错误。
- [ ] 清理仅因旧副本造成的流程分歧，不删除 main 已有的页面升级、局部分析及快照能力。

Skill 版本与 Schema 版本分开。当前 main 的 local-authoring 为 1.0.0；建议 B1 新能力升 1.1.0，B2 新协议知识升 1.2.0。B3 若只有兼容说明修订则升 PATCH；若实际新增工作流则按既有版本约定升 MINOR。每个独立交付批次只升一次，完整目录及清单随同版产物交付。

## B4：页面与实例收口

| 页面/材料 | 合并处理 |
|---|---|
| 成熟度得分 | B1 后以 `contract-maturity-score.json` / 原 id 作为最终目标；保留原始输入快照，将验证过的 20 处条件迁入并使用正式版本。linked 副本在完成对照验收后退出常用入口，避免两份文件语义不清。当前仍为静态数据，不扩为真实查询接入 |
| 伙伴健康度 | 保留已验证主行集和查询，逐一核对新增指标/多槽对齐/查询失败行为；没有真实执行依据的查询继续标注待验，不能因页面可渲染就标为真实接数完成 |
| 治理合规 | 按原输入核对独立图表控件、filterId 与查询绑定；未验真的业务查询保留明确状态 |
| Report 多批版式实验 | 仅把已经确认的范式资产及入口同步到适当位置；实验输入、评分及截图成批归档，不复制全部实验页进入正式示例目录 |

所有新 Dashboard 示例保持显式 `layout:"dashboard"`；复用现有页头与组件。正式通用期间能力的推荐场景仍为 `period-query-columns-demo`，业务临时页不取代通用协议场景。

## B5：原型、调研与设计资产

- 饼图分支 `f6fd243c0` 先按 9 个文件核对用途。正式表格图例已在 main，不整分支重复合并；仍有价值的设计结论/对照截图迁入证据，独立原型需要保留时维持原型路径和明确标签。
- IOC Select 样式研究、Platform 创作流程和 Report 布局原型逐项标记“已被正式实现吸收 / 继续验证 / 已关闭”。只有前两类中确有新增价值的资产才提交，视觉规则不绕过既有样式审核。
- ioc-data-dev 调研、HTML/MD 和附件按用途独立文档批次处理；压缩包及可再生副本不混入引擎交付。
- 已关闭探索遵守 docs/plan、docs/evidence、docs/archive 的寿命规则。跨目录迁移时核对链接；有产品/ADR 引用的证据保留可定位入口。

## 每个产品批次的固定交付步骤

1. **取最新基线并审阅范围**：记录源文件/新辅助文件/测试/页面/文档清单；先迁真源，检查 shared hunk 和新旧能力兼容。
2. **定向验证与复杂度**：使用 `pnpm test <相关测试路径>`，保留 SvelteKit sync 前置；按同工具口径重测修改函数与全部新辅助函数。实现变化后补行为复验，不机械重跑无关真实模型。
3. **生成分发**：在本批隔离检出使用可用 authoring Python 环境，从同一真源执行 `pnpm authoring:contracts`；运行 `pnpm authoring:contracts:check`、`pnpm mc:content:check`，以及 local-authoring 相关校验和仓外完整目录安装验证。遵守仓库默认范围，不追加其他 Skill/真实 DS 专项。
4. **验证产品输入**：受影响页面与目录检查、类型、构建、公共包消费、Chrome/Edge 兼容性按实际影响执行；浏览器验收精确页面及关键异常。main 迁移后重新验证，不复用旧基线的成功结论。
5. **形成独立交付**：显式暂存本批路径/hunk，提交并 push；PR 若创建必须附着当前任务。禁止全仓暂存、force push 或 skip CI 作为默认做法。
6. **确认 main 与 CI**：核对远端包含提交，用 `pnpm ci:wait <完整SHA>` 或仓库等待器确认该 SHA 全部必需 CI 成功，再启动下一产品批次的最终集成。
7. **发行与部署交接**：记录包/静态前端归档、MC、Skill 的源 SHA、版本、哈希和构建参数；内部部署回执与 CI 分开。具备部署授权和入口时更新目标环境，否则提供完整同版产物及确定的部署步骤，不声称已经更新。

不把旧工作树生成器采用的临时环境启动器直接移入产品。若新基线仍出现 Python stdin/依赖问题，定位实际工具边界，再决定是否属于必要工具修复；单独记录而不默默改变生成语义。

## 内部运行的验收与回退

- [ ] 内部页面校验器、渲染引擎、编辑工作台实际加载的构建版本可追溯至同一批提交；不能仅看 JSON 的 schemaVersion 或包版本号。
- [ ] B1 的 mode 最小页、正式期间场景和成熟度目标页在内部校验通过，四种模式各显示 3 张 KPI 与两张表的对应列组。
- [ ] `data`、`visibleWhen/all`、`visibleWhen/any` 联合分支连带报错消失；不通过删除合法 data 或补错 all/any 结构修复。
- [ ] B2 另核对真实审批请求、总数和补列范围；Sim、浏览器合成适配和真实 DQE 分列记录。
- [ ] 保留前一正式运行时及其配套 Schema/Skill/MC 发行物；回退时恢复整套匹配产物。新能力页面暂退回对应旧修订，不把旧引擎强行读取新字段当成回退成功。

## R1：主工作区和工作树整理

产品批次、必要页面/文档和重要证据迁入并验收后，再处理本地副本：

1. 对每个剩余路径注明已吸收、仍有独有意图、原型保留或可再生产物，重新检查 HEAD/远端变化及未跟踪文件。
2. 主工作区不得通过 reset/clean 直接追齐。先把剩余独有工作移入可恢复位置，再按确认的范围逐项对齐；已被 main 包含的改动不重新提交。
3. 清理遵守 scoped-main-delivery 与 git-cleanup 标准。只有已合入、无独有未保存内容且不再承担活动任务的工作树/分支才进入清理范围；重要忽略证据另存。
4. 关闭本任务预览服务后再移除其工作树；其他任务仍使用的干净工作树保留，记录原因。
5. 更新计划总览中“产品代码未实施/未交付”等过期状态，区分已合入、CI、发行和真实内部接入。源码交付并不自动关闭外部验收待办。

## 完成判据与当前未关闭项

完成时应能逐项回答：能力在哪个提交、哪个协议版本、哪个页面入口、哪个 Skill 发行物、哪个 CI、内部加载哪个构建、真实业务是否验证。全部审计路径有去向，未交付材料有明确保留理由。

当前尚未关闭：B1/B2 在新 main 的移植与复测、正式版本重新分配、内部实际部署包身份、真实 DQE 的季度编码与审批谓词接受性、业务临时页的数据验证、原型资产取舍及剩余工作树清理。季度原生编码仍以明确拒绝为现行边界，不因其真实验真未完成而阻止已有合法期间显隐和固定粒度能力交付。


## 执行记录：2026-10-27

B0已完成三个源工作区的patch/文件/hash快照。B1提交0297ca393已进入main，CI链接为 https://github.com/CCharlesMeng/MetricCanvas/actions/runs/40479485334 。B2采用6.68；为减少重复分发，B3的兼容说明增补、B4已验证临时页及B5/R1保留清单随B2同批提交，Skill版本保持1.2.0。原型尚需视觉或真实服务验证的内容继续保存，不作产品能力合并。最终远端、CI和内部部署状态分别记录于交付说明。
