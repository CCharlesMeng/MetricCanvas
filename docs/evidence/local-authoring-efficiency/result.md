# local-authoring 数据源编写效率改进验收

日期：2026-10-27。记录范围：本地实现与验收。实施基线：独立检出 `cc2ae9155528cf7387683bc3bbf7feee97085af5`，Schema 6.65。主工作区保持原状；远端提交与 CI 另行核验，本报告不包含部署验收。

## 用户可感知的变化

1. 已有可信字段绑定直接复用，局部修改不强制生成完整分析报告。新增口径、指标匹配和查询修改才进入数据分析；编写前确认已有执行条件，缺入口时保留候选，不自动改成演示数据。
2. `analyze-data.mjs scan --page <file> --component <id>` 支持重复组件参数。返回相关字段及共享消费者、父级用数和数据源依赖；不输出数据行。全局筛选器、参数和诊断保留，最终页面校验仍覆盖全页。
3. `draft` 已执行扫描和材料分块，不再要求先重复 `scan/index`。短材料直接读取，长材料按需查找；`--component` 不用于缩小 `draft/check/prepare` 的证据覆盖。
4. `snapshot-attempt.mjs <file>` 默认在系统临时目录创建唯一目录，避免快照进入页面递归扫描。仍保存原始字节、SHA256 和只读文件，错误 JSON 也可捕获。长期保留使用显式目录并放在页面发现范围外。
5. 默认单 Agent。复杂且独立的语义分析才读取委派说明，初始最多两个 worker；worker 只返回相关结论与证据，主 Agent 统一共享口径并作为唯一页面写入者。未新增调度框架、模型服务或常驻性能日志。

入口：[Skill](../../../metriccanvas-authoring/skill/metriccanvas-local-authoring/SKILL.md)；规则：[数据识别与接数](../../../metriccanvas-authoring/skill/metriccanvas-local-authoring/references/data-analysis.md)、[按需委派](../../../metriccanvas-authoring/skill/metriccanvas-local-authoring/references/data-delegation.md)。

## 正确性与兼容边界

范围筛选是读取视图，仍先扫描完整页面，因此主要减少返回给模型的内容，不承诺脚本 CPU 时间下降。强关联页面的依赖闭包可能接近全页，不能为追求输出更小而截断必要上下文。

行展开查询模板使用独立页面数据源；行输入绑定归属父行；recordList 子字段使用项契约，分析产物中的 `recordListField` 区分父子同名字段。该字段不进入页面协议。静态候选准备也须按相同上下文核对证据，不能用子字段证据证明同名父字段映射。

兼容的 query 分组字段复用产品 materializePageDocument 规范化，保留 queryField 与角色信息，清除现有大页的未知字段误报。页面、数据源、校验器均复用产品真源；作者说明单独维护，分发产物统一重新生成。未新增页面 Schema 属性，也未修改渲染组件样式。

## 验证

- `pnpm exec vitest run tests/local-authoring-tools.test.ts tests/local-authoring-row-expansion.test.ts tests/local-authoring-skill.test.ts`：最终版本 **76/76**。覆盖范围闭包、未知/重复 ID、CLI 约束、输入不变、行展开上下文、父子证据隔离、分组字段兼容和快照字节/隔离。
- `pnpm exec tsc --noEmit -p tests/tsconfig.json`：通过。
- `pnpm --filter playground exec playwright test local-authoring-scoped-data.browser.ts --workers=1`：**1/1**，用例内含两个视口；截图经人工检查。
- `pnpm authoring:contracts:check`：1,247 product / 4 authoring / 1 interface 文件一致。
- `check_bundle.py`：6,106 项摘要检查通过。
- MC 内容检查：覆盖对账与 30 项单测通过；首次 fixture 检查提示摘要漂移，已用 `mc-content-fixtures.py` 正式再生成三份诊断证据，结果仅摘要变化，页面字节未变。整条 `pnpm mc:content:check` 最终复跑通过。
- `pnpm authoring:check`：含独立导出/升级的完整套件 **6 个文件、207/207**，663.94 秒。最后的字段证据修复另由上述 76 项定向回归与当前分发检查覆盖；该维护期测试耗时不是 Skill 使用时耗时。
- 最终分发目录再次复制到仓外，独立试用的规范命名产物重新完整校验通过；整个结果与预期仅差一列的独立对比通过。
- `git diff --check`、本批报告链接检查通过。

Python 执行使用已安装 FastMCP 的独立环境；系统 Python 缺少该包不属于 Skill 消费者依赖。local-authoring 独立使用仍只需 Node.js。

浏览器场景：[局部接数示例](../../../pages/capabilities/layout/local-authoring-scoped-data-demo.json)。两表共用合成闭环率数据，独立卡片保持 999；宽 1440 / 390 下核对 0%、50%、100%、行数、独立排序及页面横向溢出。该场景不是真实 DQE 证据。

## 独立使用验证

一个不带本轮实现历史的子 Agent 仅获得仓外安装的完整 Skill 和页面，执行“将现有闭环率列补入复核表”。父级独立比较确认：仅增加目标列，其他 JSON 内容不变。执行者读取入口、相关表对象和两个知识主题，未创建数据分析报告，未读取源码或联网。

验证输入被命名为 `page.json`，与原页面 ID 不一致，额外触发文件名校验和帮助查询。执行者准确报告了失败；同字节规范命名副本通过完整校验。此人为夹具命名问题产生的附加开销保留在记录中，不计作流程提速证据。还发现校验器不支持 `--help`，因此将通用入口指引改为只对明确支持帮助的脚本使用该参数。

原始执行记录见 [独立使用记录](forward-verification.md)。主流程随后按原 ID 保存规范命名副本，并用最终冻结、重新复制到仓外的 Skill 再次校验通过。执行者沿用宿主默认模型；未取得可独立核实的精确模型版本或逐请求 usage，因此不报告模型速度指标。本次仅证明路径可用，不构成成功率、模型 token 或墙钟提速的 A/B 结论。

## 效果与复杂度

### 输出范围测量

输入为仓库现有 [customer-activity-risk-briefing.json](../../../pages/business/report/customer/customer-activity-risk-briefing.json)，165,089 bytes，SHA256 `0b377cfaaea09178d0719de52f28902e1a09d3f4a6690d84017536d630673258`。在同一最终版本分别运行全页 scan 与 `--component na-overview`，每条命令执行三次：

| 指标 | 全页 scan | 组件 scan |
|---|---:|---:|
| stdout 原始字节 | 72,672 | 3,756 |
| 页面数据源 | 22 | 1 |
| 用数位置 | 188 | 7 |
| 诊断条数 | 0 | 0 |
| 脚本墙钟三次，ms | 343.59 / 472.27 / 392.38 | 607.32 / 432.03 / 286.81 |
| 脚本墙钟中位数，ms | 392.38 | 432.03 |

该任务的返回字节减少约 **94.8%**。脚本墙钟未显示加速，测量时有其他校验进程并行；此数据只证明读取范围更小，不能换算模型 token 或总任务提速，也不构成旧版/新版 A/B。

中文业务标识规范补充时，原三个作者说明合计 19,065 → 19,353 bytes；新增按需委派说明 1,022 bytes，该阶段四份文件共 20,375 bytes。后续场景索引补充后的文件范围与体积另见本文末节。收益来自按任务少读内容，不是把安装包压小；上述字节均不等同于 token。

### 代码复杂度

口径：仓内 `metriccanvas-ts-ast/1`，TypeScript 5.9.3，`selfCC`；每个闭包/回调单独计量，目标 ≤15。生成后的压缩脚本由源文件证明，不对压缩行数作质量解释。

| 函数/职责 | 改前 → 改后 |
|---|---|
| CLI `run` | 18 → 10 |
| CLI `prepareCandidates` | 17 → 14 |
| 原组件扫描回调 | 16 → `scanComponent` 10、`resolveComponentUses` 7 |
| `scanPageData` | 13 → 13 |
| draft 的条目回调 | 9 → 9 |
| 新增 CLI helpers | `readMarkdown` 7、`readSchema` 3、`analyzeReport` 5、`fieldMappingErrors` 4、`candidateFieldErrors` 4 |
| 新增 scope helpers | `componentLocations` 1、`requestedLocations` 1、`within` 2、`sourceScope` 4、`addAncestors` 3、`readingClosure` 2、`scopePageData` 1；内部回调最高 4 |
| 新增字段上下文 helpers | `rowInputUses` 9、`rowExpansionContext` 5、`scanRowExpansion` 5、`useFieldContract` 4、`projectDataSources` 1 |
| 快照 | 原逻辑在顶层，无可比函数值；新 `run` 13，`digest` 1 |
| 本次扫描到的测试函数/回调 | tools 文件最高 9、rowExpansion 文件最高 6、Skill 文件最高 12、浏览器文件最高 2 |

未关闭存量：`auxiliaryUses` 20 → 20，本次未改；`checkAnalysis` 的条目检查回调 19 → 19，本次仅在身份字段列表增加 `recordListField`，未增加分支。保留现有校验顺序以限制小修复的行为风险；后续若调整该检查职责，应按[复杂度计划](../../plan/2026-10-22-code-complexity.md)拆分并覆盖有序错误列表。

## 未取得的证据

没有真实业务 DQE/Relay、DS 模型验收、逐请求模型 usage、多次同任务基线对照或远端 CI。不能据此声称端到端耗时下降某个百分比。后续应按同一业务输入、相同质量标准，分别测量主 Agent 上下文、全部子 Agent token、等待与合并耗时，防止只把成本转移给子 Agent。

## 补充：DQE 中文业务标识创作规范

接 partner-health 会话转达的用户确认，在同一独立工作树补入创作规则，未新增产品 Schema 或执行分支。规则唯一维护位置为 [data-analysis.md](../../../metriccanvas-authoring/skill/metriccanvas-local-authoring/references/data-analysis.md) 的“中文业务标识”节；[SKILL.md](../../../metriccanvas-authoring/skill/metriccanvas-local-authoring/SKILL.md) 仅新增一条指向该规则的入口提醒。内容覆盖可信中文业务标识、真实输出字段证据、英文来源的确认例外及既有查询/稳定字段 id/编码值的边界，不收录特定业务字段名或自造 alias。

补充验收：

- 正式再生成后，两份作者文档 SHA256 与生成前逐字节一致。
- 仓外实体安装中，从入口提醒可解析到唯一规则正文；作者文件完整保留。
- 使用仓外安装的校验器验证现有 `table-row-expansion-query.json`，确认其中英文 queryField 合法且仍通过，未引入全局中文硬校验。
- `pnpm authoring:contracts:check` 通过；Bundle 的 6,106 项摘要检查通过；`git diff --check` 通过。
- 本次只有作者文档和分发锁变化，没有可执行函数变更，不产生新的复杂度测量项。此前 207/76 项与浏览器结果对应效率实现；本补充的范围采用上述定向验证，不重复运行无关回归。

此前独立 Agent 试用早于这条规则补充，不能用作模型已遵循新规则的证据；本次未调用真实 DQE 或 DS 模型。

## 补充：操作与数据逻辑场景索引

根据用户要求，以已有 Playground 与独立 Skill 内的示例为依据，新增 [scenario-index.md](../../../metriccanvas-authoring/skill/metriccanvas-local-authoring/references/scenario-index.md)。入口按“操作 → 数据逻辑”组合，避免穷举操作与逻辑的全部组合：

- 6 类操作：新增、修改、删除、debug、仅分析、升级。
- 17 类数据逻辑：指标聚合、已有数值投影、对象记录、按键补列、逐行合并、查询结果级联、当前窗口级联、跨源计算、候选级联、点击或按钮联动、已有行内明细、按行查询明细、详情浮层、跨页明细、时间模式、查询分支、表格浏览与导出。
- 5 类 debug 症状：结构或引用错误、执行或空结果、行集与分页、数值与格式、交互与输入传播。
- 整页创作继续使用现有 4 张 Dashboard 和 2 张 Report 范式卡，不复制范式正文。

索引明确区分“指标表／详情表”的行粒度与组件类型，不能根据页面名字或数字字段猜查询类型；也区分 resultBindings、候选依赖、筛选状态及父行查询输入。删除操作先检查全页引用与剩余共享消费者，不能把局部 scan 的缺席当作可以删除的证明。示例数据和仿真仍不构成真实 DQE 证据。

只修改作者维护的入口和引用路由，协议知识与示例继续复用生成内容。当前 `SKILL.md` 为 6,261 bytes；按需读取的场景索引为 10,607 bytes / 72 行。此次索引不作为每项任务的必读文件，已有可信绑定的小改动保持直接路径；已知协议能力仍可直接读取对应主题。

定向验收：

- `skill-creator` 的 `quick_validate.py` 通过。
- 正式再生成后，3 份作者文档的 SHA256 与生成前一致。
- 最终完整 Skill 复制到仓外实体目录后，索引的 47 个本地链接全部位于安装目录内且可解析；14 个显式知识主题全部存在。
- 22 个 Playground 页面 id 与当前页面文件一致；26 个索引引用的完整 JSON 示例均通过仓外校验器。验证副本按各自页面 id 命名、内容逐字节保留，避免将模板文件名差异误判成协议错误。
- `pnpm authoring:contracts:check` 通过；Bundle 的 6,107 项摘要检查通过；`git diff --check` 通过。
- 本补充只改变 Markdown 路由与分发锁，没有新增或修改可执行函数，复杂度与前文代码测量一致。未重跑与本次文档变更无关的整套回归，也未新增真实模型耗时或 DQE 可用性结论。

独立路由试用使用未携带本轮历史的新子 Agent，只提供仓外完整 Skill、五个用户表述和只读边界；未提供预期选型。它读取入口、场景索引、3 份协议文档的相关章节及 4 个示例，未读取仓库、联网或修改页面。父级按协议独立核对结果：

| 用户表述 | 实际识别 |
|---|---|
| 删 A 表，B 仍共用查询 | 检查完整引用图，保留 B 的查询及其依赖 |
| 每次审批一行，同一项目可重复 | 对象查询，不能把项目身份当审批记录身份 |
| 区域改变后部门候选没更新 | 候选依赖及真实候选请求，不能误选 resultBindings |
| 翻页或排序后下游跟随当前页 | 查询分页窗口的结果绑定，区别于本地分页、TopN、完整输入 |
| 来源已算好的项目数量加一列 | 可信字段直接投影，不能因 measure 角色重新聚合 |

试用发现删除缺少具名示例、最小对象查询未展示记录标识。最终索引链接既有共享消费者示例，并明确对象标识需真实契约确认；同时强调当前窗口级联使用查询分页。未增加新的示例或协议能力。最终再生成、仓外链接及分发检查已覆盖这些文字澄清；26 份示例与校验器与已通过版本逐字节一致。该试用证明这五种表述可以路由，未实际执行五项页面编辑，不代表所有操作组合的成功率或提速测量。

试用旁查发现既有协议参考的独立缺口：`filters.md` 正文允许 `multiple + required` 非空多值，部分生成属性说明仍写“required 恰好一个值”；对象查询正文还以普通代码文本提及仓库内 README。前者需要在产品真源统一语义后再生成，后者不在索引的必读路径。本轮未扩展到这些既有协议文字的修订，不能将链接与示例校验解释为全部协议正文已无歧义。

## 交付复验：压缩知识的平台标记

首次推送 `284b87a383038f31390a84b343d83e8924593caa` 已核实到远端 main；[该次 CI](https://github.com/CCharlesMeng/MetricCanvas/actions/runs/40443363184) 的 Linux authoring 导出检查发现两个知识封装及其派生清单漂移，本地同一检查通过。不得将首次推送当作 CI 已通过。

定向比较排除了本次 Node 补丁版本的压缩正文变化：macOS 上 Node 24.11.1 / zlib 1.3.1-470d3a2 与官方 Node 24.21.0 / zlib 1.3.2.1-motley-8002e91 对同一知识输出逐字节一致；gzip 头中的 OS 字节为 19。将生成器的这一字节统一为 [RFC 1952 定义的 255 / unknown](https://www.rfc-editor.org/rfc/rfc1952.html#section-2.3.1.2)，保留现有 gzip-base64 格式、压缩正文、无损解码及摘要强校验，不引入新的压缩算法或依赖。

修复与复验：

- 在实际 `encodeKnowledge` / `decodeKnowledge` 入口新增回归，修复前失败为 `expected 19 to be 255`，修复后通过；覆盖零时间戳及 Unix、Darwin、unknown 三种 OS 头的读取和重新编码。
- 再生成前后的压缩数据均为 181,644 bytes，仅偏移 9 的字节改变；解压内容 SHA256 始终为 `d6acfe0ac7a1d4a4e3cc6c1d70727a27fdfd8f262bb4de871233a5277179d11f`。Node 24.21.0 的编码器也与最终封装一致。
- 从 `pnpm test` 入口运行 tools、row-expansion、Skill 三份测试，77/77 通过；测试 TypeScript 检查通过。没有修改示例页面或浏览器行为，沿用此前浏览器验收。
- 正式再生成知识、清单和 MC 摘要夹具；导出一致性、MC 内容检查及 6,107 项 Bundle 摘要检查通过。最终 Linux 交付结论以修复提交的 CI 为准。
- 复杂度沿用 `metriccanvas-ts-ast/1` / TypeScript 5.9.3 / selfCC：`encodeKnowledge` 为 1 → 1；新增回归回调为 2，无新增超限项。前文两项存量超限保持原结论。

此修复只消除平台标记差异，不声称任意历史 zlib 版本的 DEFLATE 正文都逐字节一致；未来压缩算法变化仍由导出一致性检查发现。

推送修复前，main 并行合入 `e1a33e5d98d68b9e9a465f4e4381e6e7ee8db6ed`（Schema 6.66）。修复已迁移到该基线，并从最新产品真源重新生成全部受影响知识与 MC 摘要。新基线复验：77/77 定向测试、测试 TypeScript、1/1 宽窄屏浏览器场景、1,249 product / 4 authoring / 1 interface 导出一致性、MC 覆盖与 30 项单测均通过，Bundle 6,116 项摘要检查通过；保持已合入的并行功能完整。上方 6.65、181,644 bytes 与摘要记录属于首次故障复现输入，未改写为新版本测量值。
