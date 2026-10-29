# 复杂度测量

口径：metriccanvas-ts-ast/1，TypeScript 5.9.3；每个函数及闭包单独计算 selfCC，不将外层工厂代替内部方法。原始逐函数记录见 complexity-before.json、complexity-after.json 和 svelte-script-complexity.json。

| 函数 | 修改前 | 修改后 |
| --- | --- | --- |
| filterExtensionErrors | 28 | 28 |
| candidateDependencyIds | 新增 | 4 |
| candidateConstraints | 新增 | 10 |
| calendarWindow | 新增 | 8 |
| filterCandidatesRequest | 22 | 5 |
| createDimensionValuesLoader/loadFilter | 1 | 2 |
| createFilterState/invalidate | 12 | 12 |
| createFilterState/reconcileCandidates | 新增 | 8 |
| createFilterState/candidate | 11 | 5 |

新增宿主桥各函数 selfCC 为 1–8；合成 Adapter、测试回调及夹具生成脚本均不超过 15。Svelte 提取 script 后使用同一测量器：writeBoolean 3→5，Playground loadPage 13→14；新增 recordSharedFilters 不超过 15。模板新增确认按钮的 onclick 回调仅一个调用，selfCC=1，模板条件另行人工核对，未宣称 TypeScript 扫描覆盖模板。

保留项：filterExtensionErrors 28→28，修改仅扩大一个允许类型集合并同步诊断文案，保留依赖校验顺序；本批不同时重构其完整校验职责。RuntimeSurface 的 run 及已有筛选订阅回调只增加确认状态投影，相关自身分支不增加。其他未修改的 blocked/commit/validFilterCandidates 等存量超限仅列入原始测量，不纳入本批重构。


IOC Region 收紧复测：完整范围见 complete-complexity-before.json 与 complete-complexity-after.json，沿用同一 AST 口径和 TypeScript 版本；覆盖修改文件、新增文件、测试回调及 Svelte script。模板另行复核，Region 的清空确认沿用树内操作，不增加第二个页头按钮。

| 函数 | 修改前 | 修改后 |
| --- | --- | --- |
| iocHeaderErrors | 7 | 7 |
| iocRegionErrors / duplicatedRegionLevel | 新增 | 12 / 2 |
| IOC preview candidates | 20 | 6 |
| calendarCandidates / modelCandidates | 新增 | 4 / 13 |
| pageExternalInputs | 13 | 15 |
| embedded HTTP handler | 15 | 14 |
| respondCandidates | 新增 | 4 |

新增函数及新增测试回调均不超过 15。IOC overview 测试中另有未修改回调 CC=22、17；本次修改的候选门禁测试、异步数据测试均不超限。RuntimeSurface run=48、筛选订阅回调=20 均不增长；修改只投影确认状态，保持原生命周期与回执顺序。exporter buildSkillProjections=52 不增长，仅调整已有产物版本/示例清单。本批未拆这些存量职责，后续入口为 docs/plan/2026-10-22-code-complexity.md；其他扫描中超限函数的可执行分支未修改。
