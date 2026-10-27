# DSL-20261027-contract-maturity-period-linkage：期间切换与 KPI、表头列组联动

- 来源与日期：2026-10-27，用户提供成熟度得分页面的两个 JSON 片段，要求落盘并检查时间组件切换能否联动 KPI 卡片和表头列。
- 操作与场景：保存、分析、配置预览；Dashboard 期间筛选 `mtime`、12 张 KPI、地区部/代表处表的四组期间列。
- 输入：`pages/temporary/contract-maturity-score-20261027/contract-maturity-score.json`，Schema 6.51；两片段仅拼接，原始字节保留。
- 版本与环境：当前主工作区 HEAD `ea40f6641`，包含大量并行修改，页面能力为 6.52；本地 `origin/main=cf87633ab` 为 6.66，未实时 fetch。`period-query-policy` 工作树 HEAD `cc2ae9155` 另有未提交的期间策略/模式条件实现及生成的 6.66 校验器；其 Playground 在 5198。本次原始页使用当前工作区新启的 5196，未改引擎。

## 已验证事实

1. 原始页未配置 KPI/列组显隐条件，12 张卡片与四套期间列同时显示。浏览器切换四种期间仅改变控件值及导航参数，内容不变。
2. 原始页 Schema 6.51 不具备 6.62 引入的表格列条件显隐。当前工作区及本地 `origin/main` 的 `ConditionRef` 也没有 `part:mode`；期间筛选的 `part:value` 不能用于显隐条件，语义校验拒绝。
3. 开发中工作树已经支持 `part:mode` 读取已应用 `selection.mode`，且校验版本门槛为 6.66。该规则已在该工作树 local-authoring 的 `references/page-metadata/conditions.md` 中明确，不需重新实现。
4. 对照最小合法页，开发中校验器接受 Schema 6.66 的 mode 条件，而本地 main 对应的 6.66 校验器拒绝。版本号相同不能证明包内能力一致。
5. 联动副本添加 12 个组件条件及 8 个列组条件，四种期间浏览器实测各显示 3 张对应 KPI、两张表各一个对应期间列组。数据源与筛选器保持相等。
6. 得分数据源为 inline；切换具体年份、季度或月份不会重新取数。唯一查询 `region-score-chart` 仅绑定 `region-scope`，没有 `mtime` 时间绑定。原页页头关于驱动全页查询的文字不能作为接数证据。

## 最小规则与定位

```json
{"visibleWhen":{"filter":"mtime","part":"mode","op":"eq","value":"month"}}
```

以上只适用于已包含期间模式条件能力的运行时及校验器，且引用的筛选器须为 `timeRange + display:period`。分别声明在 KPI 与对应列组上；列组条件覆盖后代。不要改用 `part:value`、从起止字符串猜模式，或添加与时间控件脱离的第二个模式筛选器。

排查顺序：检查源是否 inline/有无 `filterBindings` → 检查组件/列组消费条件 → 比对目标运行时与随包校验器的实际能力 → 用独立最小页复验 → 再验目标页四种模式。日期变化、模式显隐与真实取数分别报告。

## 修复、回灌与验证

- 原始页保留；联动副本位于 `pages/temporary/contract-maturity-score-20261027/linked-runtime-6.66/contract-maturity-score-linked.json`，并同步到开发中工作树供精确预览。
- 证据目录 `docs/evidence/contract-maturity-period-linkage-20261027/`，使用 `baseline-probe-v2`、`value-probe-v2`、`mode-probe-v2`、`mode-probe-666` 的原始回执，以及两套校验器的对照结果；浏览器回执 `linkage-browser-results.json` 与 `linked-*.ax.txt`，截图 `linked-year.png`。
- 原始页与副本完整校验通过，快照哈希通过，四模式交互通过。真实业务查询、导出、部署未验收。
- 已有通用规则的位置：local-authoring `references/data-analysis.md` 的版本与校验器核对、`references/local-workflow.md` 的 inline 不自动筛选说明；开发中 local-authoring `references/page-metadata/conditions.md` 已包含 mode 的适用条件。通用规则均已有，不重复追加 Skill 内容或生成分发包。
- 状态：已核验无需回灌。页面配置验证完成；期间能力交付状态与业务查询接入仍以其原有开发任务及实际服务证据为准，本次没有合并或推送。

## 后续发生与复验：内部环境报告未定义字段

2026-10-27，用户反馈内部运行持续报错，提供首个 KPI 的如下错误序列：

```text
SCHEMA_ERROR /sections/1/components/0/data 存在未定义字段 data(拼写错误?)
SCHEMA_ERROR /sections/1/components/0/visibleWhen/all 缺少必填字段 all
SCHEMA_ERROR /sections/1/components/0/visibleWhen/filter 存在未定义字段 filter(拼写错误?)
SCHEMA_ERROR /sections/1/components/0/visibleWhen/part 存在未定义字段 part(拼写错误?)
SCHEMA_ERROR /sections/1/components/0/visibleWhen/op 存在未定义字段 op(拼写错误?)
SCHEMA_ERROR /sections/1/components/0/visibleWhen/value 存在未定义字段 value(拼写错误?)
SCHEMA_ERROR /sections/1/components/0/visibleWhen/any 缺少必填字段 any
```

再次使用相同文件进行三套校验器对照：原始页均为零错误；联动副本在当前 6.52 校验器失败，在 main 对应的 `dqe-sort-contract` 6.66 校验器失败，在 `period-query-policy` 开发中校验器零错误。main 对应校验器复现了用户提供的上述 11 条错误的路径、消息及顺序（含 any 后重复的 filter/part/op/value）。完整回执存于原证据目录 `internal-error-*.json`。

单变量诊断：仅从联动副本删除 12 个 KPI 条件、8 个列组条件，保留 data、全部数据、组件类型与其他属性，main 对应的 6.66 校验器变为零错误。诊断副本位于证据目录 `diagnostic-without-conditions/`，不是正式修复或联动交付。由此确认 data 本身并非此错误簇的根因；all/any 和其他组件候选产生的报错属于联合 Schema 分支匹配失败的派生错误，不能逐条据此改页面。

修复方向：目标环境须同步期间模式条件能力及与之匹配的 Schema/校验器、运行时；仅将 schemaVersion 改为 6.66 无法补齐实现，删除合法 data 或将期间条件改为 part:value 均不成立。内部实际部署版本及包内容仍未取得，因此以相同报错序列的本地对照确定兼容性根因，未宣称内部环境已修复。既有 local-authoring 版本先验与 inline 边界规则继续适用，无新增 Skill 规则。

诊断入口说明：本仓 repair-page-metadata 的 inspect 脚本因依赖已不存在的 fileNameErrors 导出而无法启动，本次使用独立 local-authoring 校验器完成对照，没有将脚本启动失败当成页面错误。未修改可执行函数，复杂度测量不适用。


## 2026-10-27 正式集成补充

期间模式与查询期间策略正式使用 Schema 6.67（B1提交0297ca393）；显式字段时间下推迁为6.68。旧开发副本的6.66/6.67仅记录历史，不代表内部实际已安装。集成中修复记录源自动多字段排序与main单字段DQE规则冲突，保留显式排序、缺省仅关联键排序。验证和发行状态见[本次集成记录](../local-capability-integration-20261027/b2.md)，真实内部服务仍待验。
