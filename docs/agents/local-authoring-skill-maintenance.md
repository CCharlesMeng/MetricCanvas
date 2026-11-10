# 独立本地创作 Skill 的维护

维护 `metriccanvas-local-authoring` 时读取本页。分发实体是 `metriccanvas-authoring/skill/metriccanvas-local-authoring/`；仓内发现入口 `.agents/skills/metriccanvas-local-authoring` 指向该实体目录。安装复制完整实体，内部知识路径必须闭合。

所有新功能的场景、页面元数据文档和本 Skill 同步均按[新功能验收要求](feature-acceptance.md)执行，为同批必选完成项。

安装副本附有[维护说明](../../metriccanvas-authoring/skill/metriccanvas-local-authoring/references/maintenance.md)，只使用自身目录。下面的仓库路径与命令属于维护流程，不是 Skill 使用者的运行依赖。

## 修改入口

| 改动 | 真源 |
|---|---|
| 触发条件、流程、数据口径复核、布局及地图说明 | Skill 的 SKILL.md 和作者维护的 references/*.md |
| 尝试快照及局部验收组合 | Skill 的 scripts/snapshot-attempt.mjs、scripts/finish-edit.mjs；组合入口复用生成校验器，不另写页面规则 |
| 页面字段、约束、校验 | packages/page/src/ 及合法/非法夹具；涉及公共协议时按产品契约流程同步 |
| 协议语义正文、示例路由 | docs/page-metadata/ 与 tools/scripts/page-reference.ts |
| 成型页面范式 | `tools/scripts/local-authoring-patterns.ts` 选择 `pages/` 中页面并提炼结构；形态识别及分支范式卡由 Skill 作者维护 |
| PC Report章节组合参考 | `tools/mc-content/layouts/report-composition.md`为单一作者源；经`localPagePatternOutputs`生成到本地`references/page-patterns/report-composition.md`，MC与Platform参考同源。勿在安装目录另维护一份 |
| 通用概览完整样例 | tools/scripts/local-authoring-overview-example.ts；使用当前写出版本并重新校验 |
| 目录封闭、参考净化与校验器打包 | tools/scripts/local-authoring-projection.ts、local-authoring-validator.ts |
| 实际地图地名 | 产品底图，经导出器投影；保留源摘要，移除仓库路径 |
| 注册与分发 | metriccanvas-authoring/bundle.json、scripts/check_bundle.py |
| 精确知识主题与结构 | `reference-map.json` 的 `authoringTopics` / `authoringContracts`、`local-authoring-knowledge.ts` 与纯读取核心；语义从产品参考原文分块，不另写摘要 |
| 页面用数、MD 索引与报告/候选检查 | `metriccanvas-authoring/core/page/data-scan.ts`、`data-scope.ts`、`data-read*.ts` 维护无 I/O 扫描、局部事实和读取闭包；`local-authoring-data-analysis.ts` 保留 MD/报告及兼容导出，`local-authoring-data-cli.ts` 保留文件、hash、manifest 和退出码；组件字段位置沿产品 Schema 和组件树遍历发现 |
| 旧页面继续开发与确定性升级 | `packages/page/src/upgrade-document.ts`、`upgrade-chart-filters.ts` 与 `tools/scripts/local-authoring-upgrade.ts`；生成 `scripts/upgrade-page.mjs`，作者流程在 `references/page-upgrade.md` |

精确知识的生成树为 `references/authoring-knowledge/`；新增 `scripts/read-knowledge.mjs`、`scripts/analyze-data.mjs`、`scripts/associate-data.mjs`，均接入清单、漂移检查和仓外测试。模型按任务读取 JSON 输出，不读取机器知识包或脚本全文。精确主题失效/过大时修复真源，不截断约束。语义章节保持单一原文，显式主题的标题选择器在更名时生成失败；全部章节自动成为可发现主题，新语义不静默丢弃。

`model.json` 是 gzip/base64 编码的生成知识封装；读取器先校验封装哈希再解压，按请求选择输出。不要手工编辑封装或将压缩体积当作模型上下文及 token 节省。

对比统计分别报告脚本输出 UTF-8 字节、实际工具读取、请求 input/cached/output 与修复轮次；确定性路由字节对比不能冒充实际 Agent token/费用节省。没有相同模型/编码器的逐请求证据时，实际收益保留未验收。默认只运行 local-authoring 相关检查，不追加其他 Skill 或真实 DS 专项验收。

生成范围由导出器管理：references/page-metadata/、references/page-patterns/、references/map-regions.json、references/knowledge.json、assets/layouts/overview-map-led.json、scripts/validate-page.mjs、scripts/THIRD-PARTY-LICENSES.md。其他文件归作者维护，重新生成必须保留。真源映射总表见[真源与派生链](../../metriccanvas-authoring/SOURCES.md)。

## 知识与示例渐进消费

Skill 作者消费流程的唯一入口为 [知识与示例渐进读取](../../metriccanvas-authoring/skill/metriccanvas-local-authoring/references/knowledge-consumption.md)。新增或修改能力时，核对 `find` 是否能从实际任务找到相关例子或属性，再通过 `show --select` 读取指定方面；旧主题和 Schema Pointer 接口保留兼容。作者指引使用返回的 id、分支和续查位置，不绑定某次生成的数组下标或知识摘要。

Playground 示例按 [示例维护约定](playground-example-maintenance.md)维护用途、参考对象、移植边界和可观察预期。完整页面是单一真源，目录、局部片段与依赖从源页面派生；布局范式仍只承担结构参考。安装目录仅携带所需副本，不新增手工同步的片段文件。索引、父子关系、条件和行为检查共同约束提取，删除后仍通过 Schema 不能证明示例行为保持。

读取验证覆盖短候选、准确归属、所选分支、必需依赖、未知位置、分页与超预算继续读取；默认发现预算为 1 KB、单项读取为 2 KB，超限须提供明确的收窄或续查入口，不截断必需约束。独立安装检查同时验证示例文件与索引的来源一致性；整个示例可在 CLI 内部解析，模型默认只读取任务相关投影。

结构、CLI 和 Skill 流程的效果按原始任务验收：取匹配例子的合法基线，处理 owner 绑定的 `contextRules`，只补未解决依赖和实际差异，映射目标页，完整校验并核对声明行为。既有片段原样沿用时无需逐属性复查；简短规则已完整内联时无需为阅读而重复调用。比较累计读取量、调用次数、耗时、错误类型和修复轮次；单次字节上限和调用次数增加都不能单独代表收益。

新响应的语义需随作者指引一并验收：card 的 sourceTypes、outline 的 page 与对象路径可直接用于选型；依赖末页 complete 与客户端是否解决依赖分开；semantic 章节 id、focus 和 preview 分别承担完整续读、定点读取和候选提示。前向试用记录模型实际如何解释这些字段，避免小输出仍引导多余查询或遗漏必要上下文。

累计消费优化先按实际轨迹区分宽搜、重复确认、正文续读、作者说明与目标页投影，不将所有分页都视为浪费。语义发现可用 `find --kind semantic --example <returned-example-id> --query <能力词>`，按登记的完整示例文件关联模块并优先标题命中；这是模块范围，不能声称每段正文都适用该示例。已有位置不重读placement，已解决问题不机械跨指南/语义/Schema再次确认；保留的可信来源不触发示例全依赖遍历。客户端复用已读事实，不为少量重复短规则引入跨调用会话状态。作者入口仅放共享规则和停止条件，专项分支放在 `references/task-routing.md`。验证同时冻结安装包与原件，以相同任务独立消费，累计作者说明、CLI、原件投影及失败回执，并分别检查首稿、修复次数和非目标内容保持。

`reference-map.authoringRuleBindings` 仅登记产品 rule id 到实际 Schema owner 的关联；正文、合法/非法见证由既有产品 rules 派生。示例的组件 owner 从所属 section.components 等组件槽位的联合分支解析，不按同值 type 在全局 Schema 中扫描，避免将数据源或其他同名结构的规则混入组件上下文。

目标组件目录同时暴露局部scan读取描述，供调用方使用准确documentAt。真实目标配置、绑定、字段契约和共享消费者复用`analyze-data scan`与core/page扫描逻辑，不通过Schema定义猜目标值；只有真正改变来源/查询才进入MD匹配或查询创作。新的方面读取有2KB预算及输入身份绑定，样本显式字段/来源/数量，旧无select扫描保留兼容。消费验证同时检查CLI结果和作者自由投影的日志，不把截断输出从成本中剔除；过读失败现场留在本地，普通版本变化不追加所有模型任务。

目标页面定位由 `local-authoring-document-context.ts` 沿实际 Schema 槽位和判别条件执行，仅要求目标 JSON 可解析；CLI 的 document/at 与资源 show 的 at 分开。README 通过场景标记关联真实页面，`local-authoring-example-guides.ts` 从原有四类说明生成局部指南，正文只维护一处；作者声明与本轮验证分开。新场景按示例维护约定登记，不随每次 Schema 次版本重复改 Skill。

生成默认复用本地缓存：知识按模块、示例输入分别寻址，独立脚本按完整传递源码、安装依赖、解析配置和构建参数校验缓存。缓存不分发；损坏或不确定时冷构建。`authoring:contracts:check` 固定无缓存检查，`--no-cache` 可显式复验，`--generation-report <本地路径>` 记录命中和实际写入。生成树保留未变化文件字节与mtime，合法示例保留来源版本；需要能力升级或旧写法迁移的示例仍升级并完整校验。

MC布局快照只在三个 `tools/fixtures/mc-content-layout/` 测试文件中使用内容身份占位。替换前仍实际编译和装配，并将受控内容身份与已验证的当前清单逐项比对；旧值、缺失或新增关联位置均阻断。页面、plan/document关联哈希和能力版本保留实际值，结构变化仍触发漂移。

完整生成一致性、链接、哈希及仓外安装检查继续执行。根据产品与示例的反向引用选择昂贵回归，无法证明影响时扩大范围；来源变化不能自动沿用旧浏览器或服务回执。CLI 契约、示例索引和消费流程实质变化时，同批升级 Skill 版本并生成分发清单；生成核心与 MC 共用的入口由同一真源同步，不在安装副本修补。

## 验收范围

Skill 验证按 [仓库约定](../../AGENTS.md#skill-验收范围) 只验收 local-authoring。知识、示例、独立校验器与分发清单仍从产品真源生成；不把其他 Skill、历史 Bundle 行为测试或真实模型验收作为默认完成条件。产品契约和受影响代码的测试仍照常执行。

## 更新与交付

先确认实际产品版本；混合工作区中在独立检出承接本次改动，再从该检出的产品真源生成。不能把其他任务未提交的 Schema 或组件知识散入安装包。

交付前按安装副本维护说明中的[版本约定](../../metriccanvas-authoring/skill/metriccanvas-local-authoring/references/maintenance.md#版本约定)更新 `SKILL.md` 的 `metadata.version`，再生成并检查分发锁；仅修改仓库维护材料、不改变安装目录内容时无需升版。

```sh
pnpm install --frozen-lockfile
pnpm authoring:contracts
pnpm authoring:contracts:check
pnpm skills:check
pnpm exec tsc --noEmit -p tests/tsconfig.json
```

Python 测试需要 Bundle 锁定依赖；使用已装依赖的环境执行，不能把缺依赖当成产品失败。独立安装运行校验只需 Node.js 22+，无需上述维护工具链。

检查生成差异、第三方许可证、注册入口及完整目录链接闭合。tests/local-authoring-skill.test.ts 会复制实体至临时位置，核对生成哈希、短片段/完整样例、快照与产品契约向量的一致性；导出隔离测试验证生成漂移与作者文件保留。显式暂存本次真源和对应派生物，保持其他任务的源文件与本地证据不变。

`skills:check` 组合 repair 的定向类型检查、真实 CLI 回归和独立归档回验，以及既有 `authoring:check`。CI 保留一次生成一致性检查；包导出或工具移动同样触发入口检查，避免 Skill 内脚本游离于常规类型检查之外。repair 复用 `inspectPageDocument` 与 `pageFilesById`，维护其报告格式时保持产品错误内容与顺序。

## 独立 Skill 发行与回退

运行 `pnpm skills:pack --output <new-path.tar.gz>` 生成完整安装目录归档与同名 `.release.json` 回执。维护工具需 Python 3.12+ 和 Node.js 22+；安装后的 Skill 仍只依赖 Node。工具拒绝覆盖、符号链接、知识清单漂移，回读实际归档，在仓库外执行版本、合法示例和非法文档检查。回执锁定作者文件在内的全部文件摘要、Skill/Schema/产品版本、来源提交和脏工作区标记，并记录实际校验命令和退出码。

CI 在生成与两个核心入口检查通过后上传归档与回执，再下载执行 `python3 tools/scripts/skill-release.py verify --archive <downloaded-path.tar.gz>`。CI 运行与回执来源为同一提交；脏工作区产物只作为本地检查证据。Schema、产品发行与 Skill 版本各自演进，来源 SHA 放外部回执，避免生成文件提交自引用。

安装或回退时核对回执摘要，并完整替换 Skill 目录；替换后运行版本命令和代表页面校验，记录实际安装版本。仓库更新、归档通过和外部安装成功分别报告。真实 Relay、DQE 和目标设备部署由实际环境另验。

## 行为复测

实质工作流变化以独立输入复测。先总结原始页面特征；模型仅取得冻结 Skill、需求、设计与原始数据，不取得旧页面JSON、预期答案或之前生成结果。独立期望值必须从输入程序化计算，特别记录分组分子/分母、百分刻度、零分母和未知值。

保留模型版本、提示词、输入/知识哈希、原始尝试、校验回执与实际使用的作者说明版本。浏览器检查宽/窄屏、最终显示文字、地图地域命中、Tab、排序、筛选状态和导航值。静态成功、控制状态变化与真实数据变化分别判定；真实DS复验另按[模型验收流程](skill-ds-model-acceptance.md)执行。

项目概览的历史复测见[问题与改进](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/local-authoring-ioc-overview/improvements.md)：布局和结构改善，完整业务/视觉验收仍失败；后续文档追加不能改写历史结论。记录所用知识版本与当前分发版本的差异，不能用过去模型测试替当前版本背书。

升级与回退均交付完整Skill目录，重新核对版本、哈希及用户页面。Skill内知识清单覆盖生成文件；作者文件随完整目录/仓库提交版本保存，Bundle锁覆盖所有分发文件。

## MC 同步完成条件

页面 Schema、验证器、迁移、组件目录、语义章节/规则/例子、发现/查询/参数或工具契约更新（包括不升 Schema 的语义修复），同批执行 `pnpm authoring:contracts` 与 `pnpm mc:content:check`。原有导出入口从同一产品输出图生成 MC 和 local-authoring；完整 MC 覆盖检查使用产品注册/reference-map/活动工具注册作为分母，不能只核对已有文件 hash。不要从安装副本回读事实。

CI authoring job 不按变更路径跳过此链路；MC 独立归档使用 `pnpm mc:content:pack --output <new-path>`，源树/内容/归档摘要和部署状态分开记录。每次发布补旧页可读/可迁移/人工处理矩阵及受影响产品引擎回放；真实 Relay/DQE/保存/预览由部署方另验。local-authoring 仍整目录仓外安装，不依赖 MC 兄弟目录。说明与验收入口见 `tools/mc-content/README.md`、`HANDOFF.md` 和 `docs/plan/2026-10-24-layout-standards/mc-content-completeness-plan.md`。

## 局部读取与委派的效果复测

局部绑定、材料匹配和全页审计分别冻结输入；短说明共用指标默认单 Agent，大材料独立分析才比较委派。组件范围只用于 scan，保留源依赖、共享消费者、全局筛选/参数及诊断；报告检查和最终页面校验保持全量。快照默认系统临时目录，长期证据另行归档至页面发现范围之外。

优先从宿主执行轨迹采集主 Agent 与全部子代理的逐请求 usage、工具耗时、等待/合并/修复过程，不在 Skill 常规使用中强制增加日志文件。比较相同验收边界的墙钟、主上下文、总 token 与质量；没有 usage 时仅报告可观测读取字节和调用结果，不能据此声称模型更快或更省。小型共享指标、大页面局部修改、多业务域与缺执行环境分别复测；真实 DQE 和 DS 模型仍按明确授权另验。

## 目标关联契约

`read-knowledge resolve --document --at --aspect` 通过实际 Schema 上下文，将明确变更方面关联到结构与产品语义原文。`authoringContracts` 只登记作用位置、章节、适用范围和示例关系，不另写协议摘要；生成时验证位置与章节身份。读取预算8KB，按身份绑定游标续读；原find/show预算保持。coverage表示登记范围，complete表示所选读取完成，二者均不表示本轮行为验收。未知目标/分支或未登记关系明确返回缺口，不回退全量知识。

局部格式修改的作者流程只读取所选方面和目标事实；带符号方面包含基础数值规则。普通精度关联独立的显式格式/版本章节，创作工具覆盖推断、符号示例保持按需可发现；正文只在产品参考中维护。命令级 `--help` 不依赖知识包；续页使用 `--cursor`，`--next` 为兼容别名，参数与内容身份检查保持。

新增方面同时提供真实目标与不适用位置回归、原文重建、来源漂移及仓外CLI验证。消费对照冻结完整Skill和原件，记录所有读取与失败的原始输出、实际墙钟；模型usage缺失时保留unknown。
