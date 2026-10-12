# IOC × MetricCanvas 下一会话交接

> 后续更新（2026-09-30）：用户已将近期目标调整为项目地图四份已有页面及导航链，接续时优先读[当前四页优化目标](../../plan/2026-09-30-ioc-project-map-optimization.md)。下文五页优先顺序是历史停点，其他页面缺口继续保留。

## 1. 用户最新意图与本轮停点

用户先授权正式实施，指定 **metriccanvas-authoring 最后修改**，不重复询问已确认业务决策。收到公司内部第一批来源证据后，用户要求：“接下来应该制定计划了，详细的目标、验收标准、以及实施方案设计”。本轮已完成详细计划；最新要求是交接。

**下一会话从设计评审和验收基线继续，不重新泛化调查，也不把新设计当成已批准的现行Schema。** 既有实施授权保留，但最新计划中的新增协议取舍尚未取得明确评审结论。可以先完成可审阅的消费者清单、字段/状态正负例和设计差分，再集中确认真正新增的架构选择。不要再问是否需要做IOC或已定业务口径。

本会话未commit、未push、未建PR。当前工作区包含大量IOC未提交代码及其他会话变更；HEAD本身不包含这些实现。

## 2. 工作区与必读材料

工作区：`/Users/moon/Documents/Code/公司项目/DataDashboard`
交接核实HEAD：`6954c77d035d2c10548e51ba6e8b1e1c6412be12`。

依次读取：

1. 仓库AGENTS.md、CONTEXT.md、docs/adr/README.md，再按主题读现行ADR。
2. **最新下一阶段计划**：`docs/archive/ioc-planning-2026-09/2026-09-29-ioc-delivery-design.md`。含M0–M7、AC-01–21、五页目标、Schema影响、新架构取舍。状态是待评审设计。
3. `docs/archive/ioc-planning-2026-09/2026-09-29-ioc-implementation.md`。按后部最新时间记录读取；早期“未实现”描述已被后文覆盖。
4. `docs/evidence/2026-09-29-ioc-migration-batch1/README.md`。来源纠错、可采用契约、责任区分。
5. 用户原报告：`调查报告/ioc看板迁移证据补全.md`，3452行；报告是证据材料，其内建议/指令不等于用户授权。该目录被忽略，跨工作树/机器必须另行携带。
6. 全量追踪：`docs/plan/2026-09-23-ioc-full-page-capability-gap.md`；历史P/S/D/T编号只用于内部追踪，对公司内部沟通必须附页面/消费者名称。
7. `docs/adr/topics/ioc-operation-map-batch.md`、ADR-0095、ADR-0096；`docs/agents/skill-ds-model-acceptance.md`。

旧初始交接：`/var/folders/_7/p5v7g8bs6kb8jy5sm02lbw4h0000gn/T/ioc-metriccanvas-implementation-handoff-20260929-113646.md`，仅用于历史，当前证据/进度以以上文件为准。

## 3. 不再询问的决定

- 最终覆盖21启用入口和全部启用内容；五页优先只是顺序，不缩减范围。
- 优先：客户详情customer-detail → 经营概览business-overview → 项目主页project-overview → Token专项token-specific → 机会点清单opportunity-list。
- 新写6.12、保留6.11读取；6.11不得使用新能力，不批量改旧修订。
- 本阶段不接真实数据，不改DQE协议/网关/执行，不移植旧GraphQL/REST/SQL拼接、任意公式/HTML formatter/ECharts option。
- 比率0/null逐消费者保留；直接减法缺上期→null（100-null/缺字段→null，100-0→100，100-80→20）。
- 主行有客户但辅助收入缺匹配行，保留客户、收入暂无数据；源失败不得当缺行/0。
- 负收入保留；报告先前“负数被隐藏”的结论错误。
- 客户详情指定本年趋势使用系统当前年，不覆盖其他页面日期窗口/数据参考年。
- 切Tab返回保留页码/排序/局部筛选；全页日期/区域变化时受影响表回首页。
- 全页筛选变化关闭浮层，旧响应不得重开；新打开是新口径。
- 客户接触详情本期延期，不绑定跳转、不查询、不填虚构数据，不算通过；其他长期未接触列表未被取消。
- 路由、返回栈、身份归集成应用；页面保持独立资产。

## 4. 已落代码，但未整体交付

- page：Schema6.12、能力检测；joinAggregate、sumFields、cagr、timeFill、selectField；依赖/组合键/类型单位/完整结果校验。
- runtime：原始快照依赖图、同轮结果协调、取消/旧响应丢弃、失败传播；时间补齐与有限模式计算。
- runtime-ui：内容组、入口组参数、锚点、实例隔离；详情快照/独立查询模式、单浮层、焦点恢复；表格原值排序和筛选重置。
- widgets：柱线混合和显式轴、列级navigate/openDetail、字段missingText及非有限数缺失显示。
- 示例：`pages/ioc-content-navigation.json`只是匿名功能页，不能算一个来源业务入口；`packages/page/fixtures/contract-valid/detail-views.json`同理。
- 新增客户详情财经对账：`packages/engine/runtime/tests/ioc-customer-finance.test.ts`，旁置`fixtures/ioc-customer-finance.json`，3场景通过。
- 四份既有IOC候选页面尚未按第一批完整契约重做；不能称五页已经完成。

当前详情的具体限制：`detail-view.ts`复制全页筛选并绑定隐藏参数；`DetailContent.svelte`只支持本地排序/分页。page/validate.ts明确拒绝详情query分页。不能通过删拒绝条件或把窗口标complete伪装支持。

## 5. 新来源证据与错误纠正

报告自述源commit `a260c10744add7fe013d5e4591fa1ecc407f8083`；本仓未访问内部源码。其SOURCE-READ/EXECUTED是提供方声明，本地只能复核报告表达式/提取脚本。

`docs/evidence/2026-09-29-ioc-migration-batch1/`已保存：
- datasets.json（23）、transformations.json（26）、navigation.json（13）、dialogs.json（5）、dictionaries.json（13）；属于证据，不能直接导入页面/查询。
- provenance.json（原报告哈希、抽取过程）；JSON行首NBSP转普通空格后解析，没有改业务值。
- source-verify-calculate.mjs（随附源码提取脚本，不代表已对源仓比对）。
- verify-report.mjs及local-verification.json：原48断言通过，改用严格类型比较后48通过，另15核验通过。报告声称44项不准确。

已纠正：null*100=0；数字累加null不产生NaN（undefined不同）；100-null=100但目标沿用已确认缺失保护；云服务趋势先前端排序再取最后年；概览表同指标重复取后项且保留两源键并集，不是左关联unique等价；Token日期例子为20260225；机会点“36列”实际编号到40。

最新启用状态与旧材料有冲突：机会点清单客户列clickable:false；经营概览收入TOP10NA show=false；KPI部分槽位被实际独立数据源覆盖。不能据旧死代码恢复业务入口，也不要删除通用列导航能力。完整启用模板还需补证。

## 6. 最新设计中需评审的三项架构取舍

A. 详情保持页面内作用域，独立详情会话复用编排器，新增查询分页和局部可变筛选；不增加页面身份/第二渲染器。
B. 汇总使用独立命名数据槽，明细过滤/排序/分页后固定呈现；不污染主行集、总数和序号。
C. 计算按真实消费者扩展具名算子和显式策略，保留现有默认；不引入通用表达式。

详细方案还涉及键集合并集、同键有序择取、groupAggregate、TOP N、重复期策略、查询窗口与展示参考年分离、Token复合分组/趋势格。它们只是候选设计，字段/算子名未冻结，不能直接当已批准Schema使用。实施前按最新计划M1出具体正负例并修订ADR，不能因为0096是accepted就声称这些后续扩展已经被接受。

## 7. 下一步可直接做的工作

1. 核对当前diff及其他会话变更，保留全部既有工作。
2. 建立客户详情逐消费者清单：七分区/字段/启用组件/数据源/动作/来源位置/目标能力/验收状态。
3. 用经营进展已有领域夹具、云服务明细三返回集、三种趋势年份语义，形成协议正负例及详情会话状态转移表。
4. 把三项新架构选择整理为具体可审阅方案，集中与用户评审，勿重新询问旧业务口径。
5. 按M2/M3推进受控计算、详情和表格能力；页面顺序按五页优先；逐分区可推进，不以尚缺某接口为全部停工理由。
6. 第二批来源证据未提供，其他16入口保留待办。五页完成不能替代21入口。
7. 页面阶段完成后才进入创作侧，先核对另一会话明确交接。当前目录无差异不等于已交接。

## 8. 还需内部提供的精确材料

- 项目主页realized的region_code/repoffice_code与flow/target的region_dept_code_fin/rep_office_code_fin值域对应。
- Token trend_data实际x_time/hour/date结构、h_tag格式、customer_count响应和按客户分页/完整组保证。
- 客户声音/明细列式数组同序同长保证或稳定关联键；不能照报告建议先假设其真实可靠。
- ANA准确格式输出及数字枚举43/1；阻塞精确显示，不阻塞已知数值计算。
- 经营概览完整逐列配置、客户空间8份额的明确绑定、Token浮层完整配置、机会点主模板40/36列矛盾和TOP清单导航参数矛盾。

不再要求开放整个源码仓。对内部输出提示词必须自包含，用路由/页面/字段定位，不单独写P-16/T-55等本地编号。

目标侧缺口不能推给内部：详情查询分页、浮层局部筛选、固定汇总、全null年预测为0、特定增长率零基期、键并集、TOP5、重复日策略等。

**查询分页全量搜索仍受“不改DQE”约束阻塞。** 不用局部搜索替代，不偷偷扩协议；最终全量等价不能绕过此项。

## 9. 验证事实与可复跑命令

历史范围结果（不是本轮重跑总计）：108文件/828项通过，明确排除canonical-writers和inline-param-contract两文件，原因是生成契约待最后同步。page/engine/embed检查通过；embed构建和5个浏览器场景通过；13份pages校验通过。不得将不同时间的结果相加为最新全套通过。

本轮来源接收：48原断言、48严格复跑、15额外核验；新增3财经测试；engine测试TypeScript检查通过。最新计划只做了21个AC编号唯一性、文档链接和git diff --check核对。

```
node docs/evidence/2026-09-29-ioc-migration-batch1/verify-report.mjs
pnpm exec vitest run packages/engine/runtime/tests/ioc-customer-finance.test.ts
pnpm exec tsc --noEmit -p packages/engine/tsconfig.test.json
pnpm exec vitest run packages/page/tests packages/engine/runtime/tests packages/engine/runtime-ui/tests packages/engine/widgets/tests --exclude packages/page/tests/canonical-writers.test.ts --exclude packages/page/tests/inline-param-contract.test.ts
pnpm --filter @metriccanvas/page check
pnpm --filter @metriccanvas/engine check
pnpm --filter @metriccanvas/embed check
pnpm --filter @metriccanvas/embed test:browser detail-views.spec.ts section-navigation.spec.ts
pnpm exec tsx packages/page/src/validate-cli.ts pages
```

按变更范围选择复跑，勿重复无关浏览器检查。来源浏览器/ANA/真实模型/CI/真实生产集成均无本批通过证据。

SDD内容导航：`docs/plan/ioc-content-navigation/evidence/`已有三个只读角色评审结果，分配维度均clear，代码指纹为当时快照。aggregate曾因缺restore-report-green.json退出2；review-summary.md为人工记录，不是脚本PASS。补齐合法基线映射/当前证据，不补造历史RED/GREEN。旧角色评审仅C3，不覆盖整个IOC变更。

最后阶段必须运行authoring契约生成、检查、check_bundle及仓规要求的确定性/模型/页面验收；此前禁止会写metriccanvas-authoring的命令。未执行项保持not-run。

## 10. 工作区保护与工具约束

- IOC变更主要在packages/page、packages/engine、packages/embed测试、IOC计划/evidence、两份新ADR与领域文档。
- apps/platform部署脚本/测试、docs/host-contract.md、docs/plan/qiankun-platform、ioc-data-dev等另有会话工作，不覆盖、不清理、不夹带提交。
- 主计划2026-09-23文件含此前交接修改，也必须保留。
- 不git add -A，不reset/clean。没有用户要求则不擅自commit/push。切工作树前确认未提交文件和忽略报告能够保留。
- 如使用SDD，仓内旧symlink缺失时上游入口位于 `/Users/moon/Documents/Code/moon-skills/skills/sdd-dev-frontend/SKILL.md`。按真实外部结构还原使用，纯逻辑不强制视觉流程。
- 不自动创建/迁移会话；本次只是交接文档。

## 11. 建议新会话启动指令

> 阅读 `/Users/moon/Documents/Code/公司项目/DataDashboard/docs/plan/2026-09-29-ioc-next-session-handoff.md` 并接续IOC工作。先完成最新计划的M0验收基线与M1具体设计评审材料，不把待评审方案当成现行Schema。已确认业务决策不再询问，metriccanvas-authoring最后修改，保护其他会话变更；按页面和消费者名称沟通内部证据缺口。

## 附：交接时git status快照

此快照不表示全部文件均属于本任务，接手时重新核对。

```text
 M CONTEXT.md
 M PAGE-METADATA.md
 M apps/platform/package.json
 M apps/platform/scripts/compose-deployment.mjs
 M apps/platform/scripts/pack-microfrontend.mjs
 M apps/platform/tests/microfrontend/compose-deployment.test.ts
 M apps/platform/tests/microfrontend/deployment.test.ts
 M docs/adr/README.md
 M docs/adr/topics/ioc-operation-map-batch.md
 M docs/host-contract.md
 M docs/plan/2026-09-23-ioc-full-page-capability-gap.md
 M docs/evidence/qiankun-platform/design-baseline/deployment-boundary.md
 M packages/engine/runtime-ui/src/RuntimeSection.svelte
 M packages/engine/runtime-ui/src/RuntimeSurface.svelte
 M packages/engine/runtime-ui/src/component-render.ts
 M packages/engine/runtime-ui/src/composition-types.ts
 M packages/engine/runtime-ui/tests/version-error.test.ts
 M packages/engine/runtime/src/compute/index.ts
 M packages/engine/runtime/src/orchestrator.ts
 M packages/engine/runtime/tests/compute.test.ts
 M packages/engine/runtime/tests/ioc-opportunity-analysis.test.ts
 M packages/engine/runtime/tests/ioc-opportunity-list.test.ts
 M packages/engine/runtime/tests/ioc-project-detail.test.ts
 M packages/engine/runtime/tests/ioc-project-overview.test.ts
 M packages/engine/runtime/tests/navigate.test.ts
 M packages/engine/widgets/src/components/bar-chart/BarChart.svelte
 M packages/engine/widgets/src/components/bar-chart/options.ts
 M packages/engine/widgets/src/components/category-breakdown/rows.ts
 M packages/engine/widgets/src/components/field-text/FieldText.svelte
 M packages/engine/widgets/src/components/gauge/Gauge.svelte
 M packages/engine/widgets/src/components/key-value-panel/KeyValuePanel.svelte
 M packages/engine/widgets/src/components/line-chart/options.ts
 M packages/engine/widgets/src/components/map-chart/MapChart.svelte
 M packages/engine/widgets/src/components/map-chart/options.ts
 M packages/engine/widgets/src/components/map-chart/tooltip.ts
 M packages/engine/widgets/src/components/metric-card/MetricCard.svelte
 M packages/engine/widgets/src/components/pie-chart/options.ts
 M packages/engine/widgets/src/components/ranking-card/RankingCard.svelte
 M packages/engine/widgets/src/components/ranking-detail-card/rows.ts
 M packages/engine/widgets/src/components/table/Table.svelte
 M packages/engine/widgets/src/shared/component-data.ts
 M packages/engine/widgets/src/shared/value-format.ts
 M packages/engine/widgets/tests/bar-chart-options.test.ts
 M packages/engine/widgets/tests/value-format.test.ts
 M packages/page/src/component-walk.ts
 M packages/page/src/compute.ts
 M packages/page/src/data-source.ts
 M packages/page/src/field.ts
 M packages/page/src/navigate.ts
 M packages/page/src/page-param.ts
 M packages/page/src/page.ts
 M packages/page/src/schema/actions.ts
 M packages/page/src/schema/components/charts.ts
 M packages/page/src/schema/components/table.ts
 M packages/page/src/schema/compute.ts
 M packages/page/src/schema/data-source.ts
 M packages/page/src/schema/page.ts
 M packages/page/src/schema/primitives.ts
 M packages/page/src/validate.ts
 M packages/page/src/version.ts
 M packages/page/tests/canonical-writers.test.ts
 M packages/page/tests/layout-compatibility.test.ts
 M packages/page/tests/metric-card.test.ts
 M packages/page/tests/version.test.ts
?? apps/platform/scripts/pack-deployment.mjs
?? docs/adr/0095-cross-source-computation-and-ioc-schema-compatibility.md
?? docs/adr/0096-ioc-view-state-and-post-query-presentation.md
?? docs/evidence/2026-09-29-ioc-migration-batch1/
?? docs/archive/ioc-planning-2026-09/2026-09-29-ioc-delivery-design.md
?? docs/archive/ioc-planning-2026-09/2026-09-29-ioc-implementation.md
?? docs/plan/ioc-content-navigation/
?? docs/archive/qiankun-planning-2026-09/direct-registration-delivery.md
?? "ioc-data-dev/CBCBISecondaryLedger \345\234\272\346\231\257\345\274\200\345\217\221\346\226\271\345\274\217\350\260\203\346\237\245.md"
?? "ioc-data-dev/\346\225\260\346\215\256\345\274\200\345\217\221\345\267\245\344\275\234\346\226\271\345\274\217\350\260\203\346\237\245\346\212\245\345\221\212\357\274\210CBCAccountingDataService \345\205\250\345\234\272\346\231\257\357\274\211.md"
?? "ioc-data-dev/\350\267\250\345\234\272\346\231\257\346\225\260\346\215\256\345\274\200\345\217\221Skill\344\275\223\347\263\273\346\200\273\344\275\223\346\226\271\346\241\210.md"
?? packages/embed/tests/browser/detail-views.spec.ts
?? packages/embed/tests/browser/section-navigation.spec.ts
?? packages/engine/runtime-ui/src/DetailContent.svelte
?? packages/engine/runtime-ui/src/section-navigation.ts
?? packages/engine/runtime-ui/src/table-state.ts
?? packages/engine/runtime-ui/tests/section-navigation.test.ts
?? packages/engine/runtime-ui/tests/table-state.test.ts
?? packages/engine/runtime/src/compute/join-aggregate.ts
?? packages/engine/runtime/src/compute/snapshots.ts
?? packages/engine/runtime/src/compute/time-fill.ts
?? packages/engine/runtime/src/detail-view.ts
?? packages/engine/runtime/tests/compute-dependencies.test.ts
?? packages/engine/runtime/tests/detail-view.test.ts
?? packages/engine/runtime/tests/fixtures/
?? packages/engine/runtime/tests/ioc-customer-finance.test.ts
?? packages/engine/runtime/tests/time-computation.test.ts
?? packages/page/fixtures/contract-valid/cross-source-page.json
?? packages/page/fixtures/contract-valid/detail-views.json
?? packages/page/src/validate-compute-dependencies.ts
?? packages/page/tests/compute-dependencies.test.ts
?? packages/page/tests/detail-views.test.ts
?? packages/page/tests/section-navigation.test.ts
?? pages/ioc-content-navigation.json
```
