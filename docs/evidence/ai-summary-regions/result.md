# AI Summary 容器组合与顶部规则验收

2026-10-23。初始实现基线 db88ab94；交付基线 c82f29db，Schema 6.58（避开远端已发布的 6.56 / 6.57）。设计见 [已确认方案](design.md)。当前变更在本聊天附属独立工作区，不含原主工作区的并行改动；用户已授权提交并推送 main，交付复验记录见下文。

## 结果与范围

同一 aiSummary 支持独立正文顶部、内容分区、组合卡及 Tab 页签；组合卡只增加 aiSummary 准入，其余准入、嵌套和布局规则不变。`scope: "container"` 显式绑定直接所属区域；未声明时保留原范围语义。正文非空仍直接展示，文字和标题不加入数据请求或分析输入。

6.58 对摘要置顶、占满所属列轨和非铺底层执行结构校验；多个摘要可连续置顶，页头及区域标题仍在之前。旧版顺序继续可读；升级写出时若位置不合规，normalizePageDocument 返回精确错误，要求作者调整，不在运行时重排。

生成输入附加可选 region 身份；任务、缓存、节流、重试、降级和导出仍走现有链路。查询分页所有权与执行依赖均使用同一范围解析并传入摘要身份。区域从显隐投影消失时停止组装新生成输入，已启动任务仍按原逻辑继续。

## 功能映射

| 功能 | 真实页面入口 / 声明 | 文档与分发 |
| --- | --- | --- |
| 页面摘要与整行区域 | `/pages/report-ai-summary-regions`，page-ai / section-ai | aiSummary.md 的“容器组合与顶部位置（6.58）” |
| 并排组合卡 | left-card / right-card，各自首个子项为摘要 | compositeCard.md；组合卡 Schema |
| Tab 所在区域 | analysis-tabs 的两个页签，各自摘要在表格前 | scope: container；沿用活动 Tab 与保活 |
| 顶部/占满列轨/范围互斥 | 5 份合法/非法契约向量及 page 测试 | 新能力下限 6.58；独立校验器同版生成 |
| 文字与区域隔离 | 两份合成 inline 数据、未引用来源与说明文字 | runtime 输入测试；没有新增 AI 数据网关方法 |

## 已执行验证

- 产品测试：`pnpm exec vitest run packages/page/tests packages/data-execution/tests packages/engine/runtime-ui/tests tests/public-api.test.ts`，139 文件 / 1202 项通过；随后补充区域消失保护并定向复验，区域测试共 17 项。详见 product-tests.log。
- 静态检查：`pnpm check` 通过，各 Svelte 包 0 errors / 0 warnings。后续只调整测试导入并再次执行 page 类型检查与 16 项 object-query 测试通过。详见 typecheck.log。
- 页面：`pnpm validate`，88/88 通过。原有 report-ai-summary 与 tab-mixed-content-report 的摘要已移至顶部；forecast-page 兼容示例也调整源顺序以提供合法新版 Skill 示例。
- Playground：实际 5183 服务属于本工作区；`pnpm --filter playground exec playwright test tests/ai-summary-regions.browser.ts --reporter=json`，1 项通过。1440 宽并排、640 宽回流、顶部位置、左右数据隔离、Tab 切换、文字排除与零 pageerror。机器结果 playground-browser.json；已人工查看两张截图。
- Embed：`pnpm --filter @metriccanvas/embed build` 通过；`playwright test tests/browser/ai-summary-regions.spec.ts tests/browser/report-ai-summary.spec.ts`，4 项通过。包含原有日期切换/后台缓存/正文直显/SDT 样式一致，以及新增嵌套摘要导出及返回缓存。
- 导出：export.png 为真实 PNG 下载结果（3600 × 5684），已人工查看。组合卡与已访问页签使用完整正文；未访问页签显示尚未生成占位。导出前后请求数保持 5，首次访问另一个页签变为 6，再返回仍为 6。
- 包：`pnpm build:packages` 通过，page、data-execution、engine、ui、metric-canvas 构建完成。
- 契约：`pnpm authoring:contracts` 与 `pnpm authoring:contracts:check` 通过（1128 product / 4 authoring / 1 interface 输出）；派生 Schema、契约向量、文档、知识、独立校验器与锁均由导出器生成。新语义章节可经 read-knowledge 的 aiSummary 模块发现。
- local-authoring：最终执行 `vitest run tests/local-authoring-tools.test.ts tests/local-authoring-skill.test.ts tests/page-reference.test.ts`，3 文件 / 52 项通过；包含仓外安装、顶部反例、链接闭合、全部合法/非法契约向量有序错误一致性。完整 authoring:check 初次为 74 通过 / 1 失败：参考索引新增 apps 路径导致“无旧链”隔离前置断言失败；已改为 packages/embed 证据定位，重新生成并定向复验该场景通过（1 通过 / 22 未重复运行；这 22 项在首次运行均通过）。原始及最终日志分别保留，不把首次完整命令标记为绿色。
- 收尾保护：区域从投影中消失后不调度空分析；最终 24 项输入/任务测试、engine 类型检查，以及新增 Embed 导出浏览器场景再次通过。

## 复杂度

工具 metriccanvas-ts-ast/1，TypeScript 5.9.3；修改文件中每个函数独立测 selfCC，包含匿名回调、闭包及测试，排除嵌套函数体；无 Svelte 源码修改。完整前后快照覆盖 25 个代码文件 / 修改后 1503 个函数（交付基线重新测量，含组合卡准入测试）。匿名函数 qualifiedName 含行号，移动产生的未匹配项不等同新增函数。

| 函数 / 职责 | 前 | 后 |
| --- | ---: | ---: |
| aiSummaryRelatedData | 5 | 6 |
| assembleGenerationInput | 9 | 13 |
| normalizePageDocument | 4 | 5 |
| queryPaginationErrors/addSummaryReferences | 6 | 7 |
| visibleSourceIds / activeSourceIds | 4 / 4 | 4 / 4 |
| automaticQueryTableSources | 6 | 6 |
| consumesSource | 4 | 4 |
| 新区域遍历及位置校验：全部函数/闭包 | — | 1–7 |
| 新辅助 regionSections / regionIdentity / containerScopeErrors | — | 2 / 2 / 6 |

新增生产及测试函数全部 selfCC ≤ 7，未新增超限。修改的存量超限 parsePage 为 31→31：本次区域位置职责独立到 ai-summary-region，仅加入校验调用，不扩大已有分支；通用解析器的其他流程不在本次重构范围。扫描同文件发现未修改 buildSkillProjections 53→53，单列为既有问题。前后原始数据见 complexity-before.json / complexity-after.json；差异索引和新增审计见 complexity-delta.json。

## 证据边界

新页面使用合成 inline 数据与明确标识的本地 Mock。浏览器、导出、包构建、独立安装和契约一致性不代表真实云宝、DQE/Relay 或内网身份接入验收；本次不改 Adapter 协议；代码推送不代表生产部署。

## 默认摘要外观修订

用户最初提出减少层次，随后澄清 SDT 原本就是“渐变背景＋白色＋紫色内容区”。精简尝试已撤回，当前默认 AI Summary 恢复完整 SDT 三层呈现；[恢复记录](presentation/sdt-restored.md)记录当前结果。

## main 交付复验（2026-10-23）

- 从 c82f29db 合入远端 6.56 数值度量与 6.57 查询分支映射；本能力登记为 6.58，位置收紧仅从 6.58 起生效。原主工作区保持原状。
- 契约重新生成，1150 product / 4 authoring / 1 interface；一致性检查通过。同步 main 新增的查询导出名快照、当前版升级示例和组合卡准入组件证据清单。
- `pnpm check`、`pnpm build:packages`、Embed 构建均通过；`pnpm validate` 90/90。
- Embed 摘要回归 4/4，Playground 区域摘要浏览器回归 1/1（1440 / 640 宽、范围隔离、Tab、导出与 SDT 呈现）。
- 组合卡、升级工具、语言协调器定向测试 162/162；语言协调器在首次并行全仓运行出现一次时序断言失败，定向复验通过，未改其实现。
- 复杂度以交付基线重新测量，25 个修改代码文件 / 1503 个函数；新增函数最大 7。parsePage 31→31，未改的 buildSkillProjections 53→53，存量问题按上述边界保留。
- 最终非隔离全仓复跑 `pnpm test --exclude tests/authoring-export-isolation.test.ts`：326 文件，2935 通过 / 4 跳过；隔离检查继续使用首次全仓进程完成的结果，不把已修复前的首次完整命令标记为通过。
