# 页面参数原位引用：执行计划

日期：2026-09-17。状态：P1—P7 本仓实现与验收已交付；两项全仓基线失败、E1 外部未验证项详见 verification.md。
需求基线：[参数 Spec](../2026-09-17-page-template-inputs-spec.md)。验收：[acceptance.md](acceptance.md)。

## 目标与边界

在同一 Page Schema 中表达无值模板和填值页面，继续使用 params / param 引用，以查询取值位置的引用替代新生成的 paramBindings。构建阶段算法提取、用户确认；召回由外部自有服务填写参数并调用确定性模块。模板和填值页面除 params.value 外保持一致。

用户已明确授权本次实现与验证 P1—P7。此次不创建 GitHub Issues，不分配虚构工单号；E1 保持外部真实联调边界。

范围内：协议、校验、解析模块、运行时接入、提取、发布确认、创作工具的程序交接、契约导出和文档。范围外：外部召回算法、实例存储、Java 服务实现、生产部署以及真实模型/服务的接入改造。

本仓当前存在其他创作功能的未提交改动。实施前重新记录 git status；版本分配、导出器、Python 校验器和生成快照有交叉，须在当时基线合并，不能覆盖或清除其他工作。

## 顺序与依赖

| 任务 | 交付 | 前置 | 完成后的可用能力 |
|---|---|---|---|
| P1 | 新版 Page 契约、TS/Python 结构与关系校验、共同夹具 | 无 | 能识别合法模板和非法引用，但尚未执行 |
| P2 | 独立参数解析与旧绑定转换 | P1 | 模板 + 值可确定性形成有效查询/展示输入 |
| P3 | 运行时、筛选、网关和 initial 门禁 | P2 | 本地直接加载填值页面可正确取数和展示 |
| P4 | 确定性提取与候选摘要 | P2 | 具体页面可转换为无值模板，并原值回填验真 |
| P5 | 发布契约与确认/预览/保存接入 | P3、P4 | 本仓确认流程可处理同构模板与时间参数 |
| P6 | 创作期程序交接与外部服务调用交付 | P5 | 创作期消费者能接候选；外部服务得到独立调用包和示例 |
| P7 | Tokens 端到端验收、兼容与文档收口 | P3—P6 | 本仓改造有完整证据，可提交外部接入 |
| E1 | Java / 外部自有服务真实联调 | P7；提供方能力 | 证明生产保存、召回填值与执行链路接通 |

P3 与 P4 在 P2 稳定后可分别推进；P5 等两者完成。其余按依赖顺序执行。这里表示任务依赖，不自动派发代理或创建新任务。

最小完整闭环是 P1—P7；仅 P1/P2 通过不得宣布提取与发布已完成。E1 不阻塞本仓核心实现，但缺少 E1 时不能声称生产可用。

## 实施纪律与验证入口

每个任务先添加行为测试并确认失败，再实现到通过。验证关注请求语义、状态与调用次数，避免测试仅复述实现。每次只跑受影响的定向测试，P7 再统一执行全套必要检查。

已核实：TS 使用 Vitest，Python 使用 unittest，浏览器现有 Playwright 测试及脚本。测试脚本见根 package.json。下列新建文件名为本计划的目标路径；现有路径按当前代码核实。

共同命令：

```sh
pnpm exec vitest run packages/page/tests
pnpm exec vitest run packages/engine/runtime/tests
pnpm exec vitest run apps/platform/tests/workbench/authoring-publication.test.ts
python3 -m unittest discover -s metriccanvas-authoring/test-harness/tests -p 'test_page_validation.py'
python3 -m unittest discover -s metriccanvas-authoring/test-harness/tests -p 'test_lifecycle_publish.py'
pnpm authoring:contracts
pnpm authoring:contracts:check
python3 metriccanvas-authoring/scripts/check_bundle.py
```

执行命令、通过结果及基线失败见 [verification.md](verification.md)。公共生成快照均通过作者导出，未人工批改。

## P1 — 同构 Schema、版本门禁与共同校验

主要文件：

- 修改 packages/page/src/schema/primitives.ts、schema/data-source.ts、page-param.ts、query.ts、param-bindings.ts、version.ts：新增 value、timeRange、原位维度/时间引用及消费统计。
- 修改 metriccanvas-authoring/tool/metriccanvas_authoring/domain/page_validation.py：对齐新版本、引用和时间关系规则。
- 修改 tools/scripts/export-authoring-contracts.ts；导出既有 contracts 和 Bundle 快照。
- 新建 packages/page/tests/inline-param-contract.test.ts、packages/page/fixtures/contract-valid/inline-params-page.json；扩展 Python test_page_validation.py 和共享正反例。

- [x] 在开工时读取版本真源，登记下一可用 minor；建立无值模板、填值页面、物化请求的完整夹具，不使用 spec 的局部片段替代完整页面。
- [x] 验证新版本允许省略 required 并解释为 true；旧版本不能因此接受原本非法的省略写法。value/default 互斥，值类型与声明严格匹配。
- [x] 指定 DQE 引用位置和封闭形状，检查 time 双端同源、window 一致、引用存在、单查询旧新绑定冲突；不以 body 为宽泛 object 就放过新规则。
- [x] 单独表达“结构合法”与“输入完整可执行”，无值模板不因为缺值而保存失败。
- [x] 公共键命名、ID 精确匹配、外部协议原文均加入共同向量；更新 TS 与 Python 校验。
- [x] 跑新增 Vitest、page-param/version 相关测试和 Python 页面校验；导出检查通过。

完成条件：AT01—AT04、AT12 结构相关场景通过；没有新 PageTemplate 根类型。旧版本行为保持，运行入口尚未启用新查询请求也不会误发引用对象。

## P2 — 参数解析模块与旧查询转换

主要文件：

- 新建 packages/page/src/resolve-page-params.ts、packages/page/src/inline-query-params.ts、packages/page/src/migrate-param-bindings.ts。
- 修改 packages/page/src/materialize.ts、page-param.ts、query.ts、time-param.ts、index.ts：复用日历/文本规则，提供小型公开入口。
- 新建 packages/page/tests/resolve-page-params.test.ts、migrate-param-bindings.test.ts；扩展现有 time-params.test.ts。

- [x] 固定 resolvePageParams 的结果类型：保留引用与有效 params.value 的文档、执行所需已解析副本/有效输入，以及可定位错误；不让物化结果覆盖保存原稿。
- [x] 先测原对象不变、同输入确定性、未知输入、非法显式值不回退、缺值不产生执行结果、文本与查询一致。
- [x] 实现单值转列表、多值复制、月/日闭区间、已有 time window 的 start/end 求值；只访问协议声明的消费位置。
- [x] 实现旧 dimension/time paramBindings 的按查询原子迁移，保留窗口及查询选项；value/default 冲突和无法证明等价的情况明确拒绝。
- [x] 保留导航读取有效参数；正确处理 required:false 的旧文本语义，不放宽新查询引用的必填要求。
- [x] 导出独立于 Svelte/渲染包的入口和共同输入输出向量，更新公共导出快照；定向测试与 page 包类型检查通过。

完成条件：AT02—AT05、AT10—AT12；外部调用无需模型或浏览器即可解析。模块不查 DQE、不读取 URL/历史、不持久化。

## P3 — 运行时、筛选与发送门禁

主要文件：

- 修改 packages/engine/runtime/src/page-params.ts、packages/engine/data-gateway/src/dqe.ts，以及执行回执消费的实际调用点（通过 initializePageParams / loadExecution 的调用链定位）。
- 扩展 packages/engine/runtime/tests/param-initialization.test.ts、time-param-initialization.test.ts、page-params.test.ts。
- 扩展 packages/embed/tests/browser/params-initialization.spec.ts；新增 packages/engine/runtime/tests/inline-param-initialization.test.ts。

- [x] 用 spy 网关验证缺值时零请求、无 initial 旧行闪现、无“条件缺失等于查全部”。
- [x] 统一调用 P2，不在 runtime、gateway、URL 解析层各实现替换；旧路径按版本/能力路由，避免双注入。
- [x] 核实 initializePageParams、执行回执、导航、首屏 initial 的优先级：外部已确认输入不再被 URL 或历史覆盖。
- [x] 参数关联 initialParam 时只初始化筛选；后续修改和清空由筛选状态控制。未关联筛选的同参数查询仍保留本次固定输入。
- [x] DQE 发送边界断言指定取值位置均已解析，不发送 param 对象；指定期间空结果保持为空。
- [x] 定向运行 runtime 测试和 embed 参数浏览器用例，核对实际 HTTP 请求及显示值。

完成条件：AT03、AT05、AT08、AT09、AT11；runtime 不引入自然语言或模板发现能力。

## P4 — 批量提取与稳定候选

主要文件：

- 新建 packages/page/src/extract-page-params.ts、packages/page/tests/extract-page-params.test.ts。
- 新建 packages/page/fixtures/parameter-extraction/ 下的具体页面、候选选择、无值模板和原值回填向量。
- 在 packages/page/src/index.ts 导出面明确区分提取与解析，不暴露内部扫描细节。

- [x] 定义提取输入：已验证页面基线及来自可信数据上下文的维度身份依据；没有跨源身份依据时保守分开，不新增模型猜测调用。
- [x] 测试只抽简单维度谓词/固定时间区间，不抽 groupBy、指标、金额条件或任意同名字符串。
- [x] 实现同语义同值归并、异值不合并、稳定 ID 复用及冲突后缀；覆盖比例派生于查询源清单。
- [x] 产生全量候选和勾选建议；按用户实际选择生成 params 与原位引用，未选条件保持；仅在选中后移除 value/default 与 query initial。
- [x] 把确认原值保留于候选程序上下文；安全处理已有受控文本。无法识别的复合文本标为待处理，不任意全文替换。
- [x] 同候选用原值调用 P2，与原查询比较语义等价；不相等禁止作为可发布候选。
- [x] 定向测试包括局部覆盖、单查询、同名跨域、同维度异值、重复提取和相同 label 不同身份。

完成条件：AT06、AT07、AT09、AT10、AT12；仅生成候选与无值页面，不保存或发布。TS 为本计划提取算法作者，Relay/Python 通过可信程序交接消费结果，不再手写一套提取算法。

## P5 — 发布候选、预览、确认与保存

主要文件：

- 修改 metriccanvas-authoring/contracts/authored/publication-contract.ts 及 publication-conformance.json。
- 修改 apps/platform/src/lib/workbench/authoring-publication.ts、apps/platform/src/routes/publication/+page.svelte、相关 fixture 与测试。
- 修改 metriccanvas-authoring/tool/metriccanvas_authoring/application/lifecycle_publish.py 的候选关系校验；保留其非提取职责。
- 核对 apps/platform/src/lib/page-assets/management.ts、single-save.ts 和 java-adapter.ts 的当前发布入口，接入新候选产物。

- [x] 参数摘要从维度扩为 dimension/timeRange/time，并从原位引用派生作用范围。document 仍为 Page，不另造 template 根。
- [x] 新模板发布不提供“保留具体维度值”的选择；旧 retainDimensionValues 仅在旧兼容调用中保留，新候选为无值模板。预览输入与要保存的模板载荷分离。
- [x] 确认界面显示原值、覆盖/未覆盖查询、未提取原因和选择结果；用户可以取消或修正，时间也可选择。
- [x] 修复当前“预览 document 和候选 document 直接相等”的假设：验证候选来源及固定结构一致，允许且仅允许本次已确认输入和确定性物化差异，不能简单删除完整性校验。
- [x] 源修订、候选选择或输入变化使相应预览/确认失效；保存无值引用文档，不保存预览填值副本或数据行。
- [x] 沿当前 Java 单次写入/真实回执规则发布；旧 PublicationPort 中的 lookup/lease 能力不可直接假定当前 Java 支持，不恢复强保存协议。
- [x] TS/Python publication 共同向量、状态测试与本地 HTTP 替身浏览器流程通过。

完成条件：AT07、AT09、AT13、AT14；确认及真实写入证据区分，未接外部服务时明确不可用。

## P6 — 创作程序交接与外部消费交付

主要文件：

- 修改 metriccanvas-authoring/ARCHITECTURE.md、RELAY-HANDOFF.md 及两个分发 Skill 中与已交付能力相关的说明。
- 核对 metriccanvas-authoring/tool/metriccanvas_authoring/application/publish_ports.py、adapters/inbound/publish_mcp.py 的程序交接；P4 产物不能经模型完整转抄。
- 新建 docs/plan/page-parameter-inlining/external-integration.md 和独立调用示例（后者随实现放 packages/page/examples/resolve-page-params.ts）。
- 扩展 metriccanvas-authoring/test-harness/tests/test_lifecycle_publish.py、test_publish_stdio.py；更新契约导出和 Bundle 锁。

- [x] 给可信程序交接明确输入输出：基线身份、候选引用、摘要、完整文档的程序通道、用户确认和失败状态；Relay 只编排创作阶段。
- [x] Python 继续消费生成契约并验证候选关系，不在 Skill 中追加“自行遍历并改 JSON”或召回新工作流。
- [x] 外部调用示例同时展示填写 params.value 和 suppliedValues 两种方式，输出真实普通 DQE；明确 TS 模块可直接调用、非 TS 外部服务需提供适配，不能宣称 Java 已有实现。
- [x] 交付包含完整页面夹具、错误格式、版本要求、命名规则、原对象不变保证和调用前后的字段对照。
- [x] 仅在 P4/P5 真正接通后更新 Skill 能力声明；当前 skill 的调用限制不可因文档更改被绕开。
- [x] 运行程序交接测试、独立消费包示例、生成一致性与 Bundle 检查。

完成条件：AT14、AT15；文档清楚区分本仓确定性能力与外部部署适配，召回及临时渲染编排保持外部所有。

## P7 — 集成验收、兼容与文档收口

- [x] 建立用户 Tokens 示例的完整数据源和页面，用有协议依据的 DQE 仿真数据验收；不将仿真当真实服务结果。
- [x] 跑完整链路：具体页面 → 提取 → 选择 → 无值模板 → 外部样例填中国区/上半年 → 查询/展示 → 换区域/下半年。
- [x] 比较模板与填值原稿，仅 params.value 不同；检查每个请求和文本，无布局/指标/分组漂移。
- [x] 旧 flow-analysis-report-params 页面迁移前后逐查询核对 period/lastN/yearToDate 等窗口；保留不能安全迁移的页面，不强制批量升版。
- [x] 更新 PAGE-PARAMETERS.md、PAGE-METADATA.md、docs/page-metadata/parameters.md、相关 ADR 与领域词条，只记录实际落地行为。
- [x] 执行 pnpm test、pnpm authoring:test、pnpm check、pnpm validate、pnpm authoring:contracts:check、Bundle 检查、pnpm build:packages 和 pnpm packages:check；运行受影响 embed/发布浏览器用例。
- [x] 写 verification.md，逐 AT 记录命令、结果与证据，分列本仓测试、浏览器、外部未验证项；检查只包含本任务修改。

完成条件：AT01—AT15 全覆盖；E1 未完成不阻止记录“本仓完成”，但交付状态不能写“生产接通”。

## E1 — 外部提供方接入清单（非本仓实现任务）

- Java 接受并回读新版本同构 Page，保留引用对象，不自行删除或改写参数键。
- 自有服务召回模板，规范化维度/时间、缺值追问，给全参数后调用解析模块或消费其产物。
- 旧 global_params 注入和 filter-history 回退不与新路径叠加；DQE 收到完整解析后的请求。
- 明确外部服务采用的执行适配方式、版本与真实保存回执；各方以共同向量验收，不自写不一致的窗口或命名规则。

## 风险与回退

核心风险是旧/新版本解释差异、筛选清空恢复参数、旧 initial 泄漏和 Java 对引用对象的不识别。分别由 P1、P3、P3/P5、E1 验证。

上线前保持旧读路径可用。若新消费方未部署，暂停生成/发布新版本文档；已经保存的新文档必须保留支持其版本的读取/解析程序，不能靠降 schemaVersion 或删引用回退。旧绑定到原位引用的迁移总是显式、可对比，不覆盖原资产修订。

## 完成状态

- [x] P1
- [x] P2
- [x] P3
- [x] P4
- [x] P5
- [x] P6
- [x] P7
- [ ] E1（外部）
