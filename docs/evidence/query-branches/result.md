# 固定单选跨表查询分支验收

日期：2026-10-22。基线：`3541d5d69d71c0fd81ab05307dbb35183bd3e7d2`。实现位于独立工作区 `/Users/moon/.codex/worktrees/query-branches/DataDashboard`，保留原工作区的并行改动。Git交付按用户要求推送main，提交使用 `[skip ci]`，CI按跳过报告。

## 可查看的结果

- Playground：<http://127.0.0.1:5174/pages/query-mode-chart-demo>；目录：<http://127.0.0.1:5174/>，文件夹 `capabilities/filters`。
- 页面真源：`pages/capabilities/filters/query-mode-chart-demo.json`，显式 Dashboard，复用现有 `filterGroup`、组合卡、折线图、指标卡与表格，无新增控件或样式。
- 同一张 Chart 始终消费 `amount-trend`。签约/商机分别读取 Sim 中两张独立合成表 `sales_contracts` / `sales_opportunities`，并统一返回月份、人民币金额；区域谓词分别使用签约区域、商机区域。
- 同一个口径筛选同时更新趋势与合计两个查询，明细共享趋势数据快照。真实浏览器实际发出的 HTTP 请求见 `browser-dqe-exchanges.txt` 及提取后的 `browser-requests.json`。

| 已应用业务口径 | 区域 | 一月金额（元） | 上半年合计（元） |
|---|---|---:|---:|
| 签约 | 华东 | 110,000 | 810,000 |
| 商机 | 华东 | 330,000 | 2,430,000 |
| 商机 | 华南 | 240,000 | 1,890,000 |
| 签约 | 华南 | 80,000 | 630,000 |

浏览器通过目录进入示例并验证上述四种组合、切换后保留区域、URL刷新恢复、非法URL恢复默认选择、390px窄屏切换。观察记录为 `browser.json`；截图 `demo.jpg`、`contracts-south.jpg`、`mobile-opportunities-south.jpg`。最终已恢复浏览器默认尺寸并保留演示入口。

## 实现与协议

新增 Schema 6.50 `query.queryModes:{filterId,cases}`，与根 body、timeModes 互斥。控制筛选来自固定单选 filterGroup 或 required 单选封闭枚举；case穷尽合法值，各自声明完整 body/filterBindings，输出统一结果字段契约。首版不嵌套时间模式或引入任意条件匹配。

时间模式与普通查询分支复用 query-selection；联合查询/字段选择使用同一筛选赋值，联合校验上限4096。静态依赖覆盖全部分支，候选门禁只核验当前分支及其祖先。SourceProgram 继续负责执行，QueryRunner 继续负责缓存、去重与取消；捕获查询校验分支，initial/seeds 不冒充已证明的分支数据。旧 timeModes 的错误路径、消息和顺序保持；原有 time conformance 向量无额外差异。

实施前分别识别了查询选择、静态叶子枚举、筛选依赖、候选门禁、旧回执复用和页面呈现的职责。没有给 Chart 增加取数逻辑，也没有在页面加入数据库端点或脚本。

文档同步：`PAGE-METADATA.md`、`docs/page-metadata/queries-and-bindings.md`、`components/filterGroup.md`、reference-map、主题目录 README；合法夹具、反例向量、公开导出快照及 local-authoring 的知识/独立校验器由产品真源生成。精确知识主题为 `query.modes`。

## 检查结果

- 功能与相关回归：6个文件59项通过，其中本次新增页面协议、执行、HTTP和运行时用例28项；覆盖缺失/额外分支、输出不一致、旧版本、非法/多值选择、当前分支失败、缓存隔离、未激活分支候选、迟到响应、未证明初始行、捕获查询及导出。见 `focused-tests.txt`。
- 产品范围回归：166个文件，1361项通过、19项失败。19项均为既有指标卡示例相关失败，在未修改基线副本中独立复现同样19项（`baseline-tests.txt`）；本批不修改相关页面或用例。见 `product-tests.txt`。
- local-authoring、协议参考、公开导出：58项通过；本地 Skill 生成隔离相关8项通过，其他15项历史场景未追加验收。见 `local-authoring-tests.txt`、`local-authoring-isolation.txt`。
- `pnpm authoring:contracts`、`pnpm authoring:contracts:check` 通过；独立复制 Skill 到仓库外后，版本6.50、新页面Dashboard校验及 `query.modes` 精确读取通过。见 `independent-skill-*.json`。
- page / data-execution / engine 类型检查通过；engine 的 Svelte 检查0错误0警告，工具与Sim测试类型检查通过。见各 `*-check.txt`。
- 产品包构建通过；最后对修改的 page/data-execution 重新构建通过，见 `build.txt`、`final-build.txt`。`git diff --check` 通过。

## 复杂度

口径：仓内 `metriccanvas-ts-ast/1`、TypeScript 5.9.3，逐函数自身 selfCC，独立统计闭包/回调，不以外层工厂替代内部方法。31个修改或新增可执行文件均测量；同版本原始源码作为基线。完整逐函数前后结果见 `complexity-before.json` / `complexity-after.json`。

| 函数 | 原 selfCC | 现 selfCC |
|---|---:|---:|
| timeExtensionErrors | 97 | 61 |
| parsePage | 32 | 31 |
| initializeQueryParams | 21 | 6 |
| resolveQueryParamReferences | 16 | 10 |
| queryFilterIds | 4 | 4 |
| executeDqeItem | 15 | 9 |
| initializeTimeParam（新增） | — | 8 |
| initializeDimensionParam（新增） | — | 9 |
| resolveTimeReference（新增） | — | 7 |
| executeLocalDemo（新增） | — | 3 |
| appliedQueryLeaves（新增） | — | 2 |

全部新增函数及辅助函数自身CC≤15；新增文件中100个函数/闭包的最大selfCC为14。存量超限中本次涉及的查询枚举/消费判断保持不增：queryParamReferenceErrors 30→30、presentationPolicyErrors 29→29、orchestrator.start 26→26。timeExtensionErrors和parsePage虽下降仍超限，未进一步重写无关日期/通用校验逻辑，以控制行为风险；后续治理入口为仓库代码复杂度计划。扫描中未修改的候选/呈现/Sim业务函数和版本测试回调仍有存量超限，完整列表保留于测量结果，不宣称全仓达标。

## 证据边界

这是业务场景的正式页面协议与运行时实现，取数经过本地 HTTP DQE 仿真。演示数据明确为合成数据，不能据此宣称真实 DQE、数据库物理表、权限、Relay、生产业务数值或真实模型验收通过。不同分支的真实业务口径、行粒度、单位及表路由仍由接入时的真实查询与响应验真。
