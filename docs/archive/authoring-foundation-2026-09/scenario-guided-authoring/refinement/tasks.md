# 实现计划：模型与 tool 协作、业务组织与卡片呈现

## 当前状态：v3

v3 本地工具、Skill 和离线回归已落地，见[实施记录](architecture-implementation-results.md)；新方案与维护分工见[架构调整](authoring-architecture-proposal.md)。旧 v1/v2 兼容，480 项离线回归通过。v3 尚未开展外部模型对照或完成新产物视觉验收；不将旧版模型成绩计为新版成绩。

以下 S0–S6 清单及更新属于 **v2 阶段历史**。未勾选条目不自动补勾，也不解释为 v3 尚未实现；历史评测、授权和失败记录继续保留。

## v2 阶段记录

最新更新：修正后的 12 轮干净 DeepSeek 对照已完成，新版 6/6 一次创建并通过结构专项验证。详见 [真实对照报告](evidence/neutral-clean-review.md)。S6 的真实运行与成本证据已交付，但业务初审仍有 1 处对象范围不一致，用户视觉/业务签收待完成；不能将下面完整清单一概标为通过。此前“尚未重跑”的段落为阶段历史。

状态：S0–S5 的主要实现与离线回归已落地，S6 尚未全部完成。设计真源：[design.md](design.md)；验收真源：[acceptance.md](acceptance.md)；当前完成度以 [verification.md](verification.md) 的逐项证据为准。下面未勾选的原计划条目保留为完整验收清单，不表示代码未开始，也不表示全部验收通过。无提交、保存或发布。

用户明确取消截图，视觉验收由用户完成；因此 S6 的浏览器截图不再由 agent 执行。两场景新旧中性模型各三次的真实对照尚未执行，自动审批要求明确目标与载荷授权，已向用户询问。不能用历史 v1 运行或确定性产物替代该对照。

后续更新：用户已明确授权并执行首批 12 轮，但旧组运行时隔离失效，不能作为完整版本对照。评测器已离线修正，原始失败与成本全部保留，见 [真实评测记录](evidence/neutral-review.md)。S6/A11 仍未通过，尚未追加收费重跑。

技术栈：Python 3.12 / FastMCP / jsonschema；unittest 公共工具集成测试；TypeScript 产品页面校验；Svelte 既有运行时与浏览器验证。以下路径相对于仓库根，括号内标注新建或修改。

执行顺序：S0 → S1 → S2 → S3 → S4 → S5 → S6。逐任务先补能暴露行为缺口的测试，再实现并运行相关回归；任务完成以验收证据为准，不能仅凭代码存在打勾。

## S0 冻结兼容契约与验收基线

- [ ] 核对当前工作区首期实现，记录文件摘要；保留已存在的未提交改动及旧评测证据。
- [ ] 冻结 v2 大纲语义、指标关联证据、呈现意图、批量结果和 edit_page 局部补丁的具体 Schema；明确哪些字段进模型摘要、候选程序审计或最终页面。
- [ ] 区分 metadata 受信关系、用户明确关系与模型提议；没有受信入口时返回缺口，不能自行伪造 evidenceRef。
- [ ] 保留 v1/operations/compose_page 行为，并确定新版本能力如何被部署和模型发现。
- [ ] 记录每个验收用例的实现位置和预期失败点，冻结中性模型提示；避免用后续产物反推测试题。

文件：本目录 design.md、acceptance.md（细化）；`metriccanvas-authoring/contracts/authored/page-structure-plan.schema.json`（新建，v1/v2 输入真源）；`metriccanvas-authoring/contracts/authored/section-patterns.json`（修改）；`metriccanvas-authoring/tool/metriccanvas_authoring/domain/page_structure.py`（后续消费契约）；`docs/adr/0082-explicit-business-sections-in-platform-authoring.md`（实施时补充版本/边界说明）。

完成条件：Schema 无重复 required、悬空引用；兼容行为及所有模型字段可审查。覆盖 A01、A02、A06、A12。

## S1 有界发现与静态批量预检

- [ ] 扩展能力发现投影，返回受信来源已有的关联与覆盖范围；未提供关联明确标注未知。维持分页及快照一致性。
- [ ] 新建纯预检模块，收集全部可知引用/结构/预算错误；不执行查询，不调用模型。
- [ ] 规范化查询与展示引用，输出精确重叠事实；跨快照/口径不误判相同，字段相同但不同用途只提示。
- [ ] 批量摘要按阻断、非阻断提示和确定性展开分类，保留稳定对象 ID 与修订路径；控制摘要大小并提供明确截断信息。

文件：`application/discover_data_context.py`、`adapters/inbound/unified_content_mcp.py`（修改，均在 `metriccanvas-authoring/tool/metriccanvas_authoring/`）；同目录 `domain/structure_preflight.py`（新建）；`metriccanvas-authoring/test-harness/tests/test_structure_preflight.py`（新建）。

验证：公共 discover/create 调用验证边界，预检单测验证纯函数；运行 `python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p 'test_structure_preflight.py'`。覆盖 A02、A03、A06、A10。

## S2 主辅指标组合与确定性呈现

- [ ] 支持同源唯一行上的主值/变化值组合；验证关系证据、期间及字段类型。允许金额主值附带百分比变化，继续拒绝无区分的混合量纲共轴。
- [ ] 依据注册表将对象概况展开为 compactSummary 的 rows/changes；生成独立卡片表面，避免标题与同层标签机械重复。保留用户显式文本意图。
- [ ] 复用既有格式、布局与响应式规则。无受信关系时保留可独立展示指标或返回需判断的问题，不自动把名称相似字段关联。
- [ ] 统一创建和复用数据源新增组件的展开逻辑，避免两条路径样式或绑定规则不同。

文件：`metriccanvas-authoring/tool/metriccanvas_authoring/domain/page_structure.py`（修改）；同目录 `domain/section_presentation.py`（新建）；`metriccanvas-authoring/contracts/authored/section-patterns.json`（修改）；`metriccanvas-authoring/test-harness/tests/test_section_presentation.py`（新建）。产品 `packages/page/src/schema/components/metric-card.ts` 与 `packages/engine/widgets/src/components/metric-card/MetricCard.svelte` 为读取的能力真源，默认不改。

验证：对公开创建产物断言 variant、rows/changes、唯一行、格式及合法性；同对象错误关联有负例。运行 `python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p 'test_section_presentation.py'`。覆盖 A04、A05、A07。

## S3 一次调用内部编排与说明管理

- [ ] 接入 v2 预检 → 查询 → 关系验证 → 展开 → 最终校验；不新增必经工具，不在 tool 内嵌模型调用。
- [ ] 非阻断重叠随成功候选返回；阻断问题按依赖隔离，独立内容遵循 partial 策略。静态已知错误不触发无谓查询。
- [ ] 口径说明由程序按结构化签名去重并稳定更新；保留差异口径及人工正文，不做模糊文本删除。
- [ ] 结果摘要一次返回当前阶段全部问题、已完成项与确定性调整；安全投影不能泄露数据行/查询/凭据。

文件：`metriccanvas-authoring/tool/metriccanvas_authoring/application/structure_composition.py`、`application/unified_composition.py`、`adapters/inbound/unified_content_mcp.py`（修改）；`metriccanvas-authoring/test-harness/tests/test_structure_plan.py`（修改）。

验证：一个 create 请求生成合法完整候选；多错误同批返回；独立正文/图表保留；协议安全回归。运行 `python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p 'test_structure*.py'`。覆盖 A01、A03、A08、A10。

## S4 候选局部修订与查询复用

- [ ] 在 edit_page 实现 S0 冻结的稳定 ID 补丁，验证父候选/计划版本；同轮修订复用有效查询结果。
- [ ] 查询签名包含身份/权限/快照、规范化有效查询和字段契约；布局/标题/组合变更零查询，取数改变仅执行受影响项。
- [ ] 保留未触及人工配置和扩展；源引用清理、跨章节移动、删除冲突、过期候选分别验证，失败不破坏原候选。
- [ ] 保留旧编辑操作行为，不要求历史页面先迁移到 v2。

文件：`metriccanvas-authoring/tool/metriccanvas_authoring/application/unified_edit_page.py`、`domain/section_editing.py`（修改）；候选存储接口沿现有实现复用，只有 S0 证实缺少计划/查询证据承载时再在该接口增加程序私有字段并测试；`metriccanvas-authoring/test-harness/tests/test_structure_revision.py`（新建）。

验证：使用计数查询适配器、不可变候选链和人工编辑基线；运行 `python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p 'test_structure_revision.py'`。覆盖 A09、A10、A12。

## S5 Skill 与部署参考投影

- [ ] 创建流程改为一次完整业务计划提交，按需局部修订；大纲与章内组合是思考顺序，不是强制分轮。
- [ ] 经营/用量场景写清业务问题、对象、主辅关系及可选内容；不要求固定章节，不把数据源名作为默认标题。
- [ ] Schema/组合注册表维护唯一枚举；Skill 仅保留选择规则和例子。场景按需注入，记录注入内容与成本。
- [ ] 明确批量结果阅读、语义歧义处理、图表明细重叠的用途裁决；删除例行全候选回读和逐组件调样式的要求。

文件：`metriccanvas-authoring/skill/metriccanvas-platform-authoring/workflows/create.md`、`workflows/edit.md`、`references/scenarios.md`、`references/tools.md`、`references/layouts/report.md`（修改）；`metriccanvas-authoring/test-harness/model-evals/eval_evidence.py`（修改）；`tools/scripts/export-authoring-contracts.ts`（修改，生成物只经生成器更新）。

验证：脱离源码目录的 Bundle 加载测试；实际工具 Schema 与文档枚举一致；运行 `python metriccanvas-authoring/scripts/check_bundle.py` 和 `node --import tsx tools/scripts/export-authoring-contracts.ts --check`。覆盖 A01、A11、A12。

## S6 对照评测、视觉验收与交付

- [ ] 先运行离线公共工具链、失败注入、局部修订回归，再运行全量 `python -m unittest discover -s metriccanvas-authoring/test-harness/tests`（Python 3.12；HTTP 测试需允许 localhost）。
- [ ] 新增中性需求组，不预设章节；对经营/用量各 3 次真实运行。旧提示只用作历史兼容对照，不能作为自主业务组织得分。
- [ ] 冻结相同模型配置、样例和参考注入策略，记录模型请求、工具、查询、token、耗时及失败；旧版与新版对照不改题、不拼接成功轮次。
- [ ] 实现前为按示例还原的视觉部分走 sdd-dev-frontend，冻结复用组件变体与视觉验收基线。优先只调整 authoring 产物；若必须改渲染器，再明确新增文件范围与验收，不借本任务全局调 gap。
- [ ] 在真实运行时检查 1440、768、390 视口：独立卡面、主辅层次、标签、相邻组件留白、表格内部滚动、无页面溢出；截图与人工业务审查分别记录。
- [ ] 交付新 JSON、截图、逐用例证据、成本对照与未验证外部能力。通用 runner 的 inconclusive 不能手改成通过，建立专项评分记录。

文件：`metriccanvas-authoring/test-harness/model-evals/scenario-neutral.cases.json`、`scenario_quality.py`（新建）；`run_scenario_flow.py`、`run_trusted_local.py`（按对照调度需求修改）；本目录 `verification.md`、`evidence/`（实施时生成）。已有 `scenario-flow.case.json` 与首期证据保留。

完成条件：acceptance.md 全部用例有证据；业务质量和视觉质量不以 Schema 通过替代。覆盖 A01–A12。

## 风险与回退

- 关系元数据缺失：能力发现明确缺口，使用独立展示；不得临时靠模型猜关系补验收。
- 新组合产生过多隐式调整：调整只限登记的视觉展开，实质业务变化返回模型裁决。
- 缓存误用：签名与可信范围不成立就重新验证；数据正确性优先于查询次数指标。
- 评测波动：逐次披露失败，固定单次预算；不以更长提示词换取未披露的成本上升。
- 兼容回退：新入口按版本选择，故障可停用 v2；v1/旧编辑与已保存页面仍可读取。已经人工修改的页面不自动恢复成默认样式。
