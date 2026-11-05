# 图表系列条件显隐：本地验收

2026-11-05，在独立工作树 `chart-series-visibility` 基于 `09a7815c965bce921c2ef50202fa727ba9a8e705` 实现。当前为未提交的本地源码；未推送、未运行远端 CI、未部署。

用户选择“规则不满足时，指定折线及图例一起消失”。本批为柱状图（含柱线组合）和折线图复用 `props.series[].visibleWhen`，不增加脚本、查询条件或另一套条件语法。Schema 从6.85增量到6.86，新增1个复用的可选字段，在2类系列声明中开放，删除0字段；旧页面省略时保持原行为。

## 声明、入口和可观察行为

完整合法页面：[chart-series-visibility.json](../../../pages/capabilities/chart/chart-series-visibility.json)。启动 `pnpm --filter playground dev --host 127.0.0.1 --port 5191 --strictPort`，打开 `/pages/chart-series-visibility`。数据为 inline 合成数据，无真实 DQE 或外部事实输入；页头为首分区首组件 `iocHeader`。

默认“代表处”且勾选“显示达成率”。取消勾选或选择“全球”后，达成率系列、图例、提示项与无使用者的副轴同步消失；恢复条件时还原。销售额柱和目标额线的数值、配色槽位、虚线样式保持。右侧单线对照全部隐藏时保留标题、容器和类别轴。没有被条件允许的系列可由原生图例恢复。

截图、示例原字节摘要、分发摘要与逐函数机器报告仅保存在本地同目录，不随 Git 交付：`series-visible.png`、`series-hidden.png`、`series-narrow.png`、`acceptance.json`、`complexity.json`。清理工作树前另存原始附件。

引擎保持声明与页面数据源不变，通过纯展示投影生成可见系列；补丁仍以原声明序对应，堆叠合计按可见系列重算。内部轴索引保留，无使用者的轴不呈现；仅副轴仍有使用者时独立绘制刻度和网格线。ECharts 宿主原有完整快照替换已能清除旧系列，无需引入页面级 `replaceMerge` 开关。

## 最终检查

| 范围 | 实际结果 |
| --- | --- |
| `pnpm test packages/page/tests packages/engine/runtime/tests packages/engine/widgets/tests --maxWorkers=2` | 1,961项通过；包括新条件、错误路径、旧版本拒绝、恢复、常量、全隐藏、轴归属、配色、补丁和可见堆叠合计 |
| 新 Playground 浏览器测试 | 1项通过；读取实际 ECharts 实例，检查系列/图例/副轴，真实 hover 检查提示；1440及390px |
| Embed 完整浏览器回归 | 首跑272通过、1项既有表格像素测试在 `page.goto` 处30秒超时；该项独立以60秒预算复跑通过，未修改测试或产品断言 |
| 新 Embed 场景 | global、ES两项通过；来自同一页面文件，验证发布产物中的筛选显隐和真实提示 |
| page、engine、Playground、embed及根 tests 类型检查 | 通过；新增 embed 测试另以 `tsc --noEmit -p tsconfig.test.json` 校验 |
| `pnpm authoring:contracts` / 最终 `authoring:contracts:check` | 从真源生成后无漂移；1480 product、5 authoring、1 interface文件 |
| `pnpm mc:content:coverage` / MC Python回归 | 来源覆盖通过；52项Python回归通过 |
| `mc-content-fixtures.py --check` | 升版夹具由产品工具重建后通过；无手改摘要 |
| local-authoring | Skill1.24.0；3个核心文件79项通过；升级与产品参考128项通过；repair/release16项通过 |
| 仓外独立安装 | 完整复制Skill，版本、合法Dashboard、非法row条件拒绝、`chart.series-visibility`知识读取均通过 |
| Embed build / check:dist / check | 通过；16个JS，最大929,901字节；ES/global、完整复制目录和Webpack development/production浏览器场景通过 |
| 实际归档 | `/tmp/chart-series-embed.tar.gz`回读全部16个JS，逐文件均不超过1,000,000字节 |
| `pnpm complexity:check` / `git diff --check` | 通过 |

首轮组合 `skills:check` 发现升级展示页仍为6.85及产品参考测试5秒超时。前者由产品升级器重新生成，仅版本升为6.86；后者独立以30秒测试预算复跑通过。该组合命令还包含历史Bundle隔离回归，依AGENTS默认验收范围停止，不把中止的组合命令记为全绿；最终以上述local-authoring定向结果收口，历史Bundle隔离不作验收结论。

首轮 `mc:content:check` 在诊断夹具漂移处退出。生成器更新MC源身份后，再用产品夹具工具刷新诊断摘要并复核；52项Python回归、来源覆盖、最终生成一致性及最终夹具检查分别取实际通过结果，不把最初组合命令的退出码标成通过。

## 复杂度

同一口径为 `metriccanvas-ts-ast/1`、TypeScript5.9.3，计数各函数自身selfCC；Svelte只测真实script，闭包独立列出。编码前定位了条件遍历/纯展示投影、原声明索引、图表翻译和高级补丁四项职责。完整逐函数前后记录与全部新增辅助函数、闭包、测试回调记录在本地 `complexity.json`，不作为版本管理附件。

| 相关函数 | 前 → 后 selfCC |
| --- | --- |
| `compilePresentation/evaluate/component` | 11 → 13 |
| `presentationPolicies/component` | 12 → 14 |
| `barOption` | 17 → 17 |
| `barOption`系列翻译回调 | 26 → 24 |
| `mixedOption` / 其系列回调 | 3 → 3 / 7 → 6 |
| `lineOption` / 其系列回调 | 7 → 7 / 9 → 7 |
| 新 `projectChartSeries` / `chartSeriesAxis` | — → 2 / 6 |
| 新 `cartesianChartSource` / `reconcileChartSeries` | — → 4 / 13 |
| 新 `barAxisIndex` / `chartSeriesConditionPaths` | — → 3 / 1 |

全部新增函数及辅助函数含匿名回调最大13。全仓维护TS/JS平均值2.220366554603622，Python为Radon6.0.1，维护代码平均值4.216541353383459，均小于5。门禁保留存量台账，不宣称全仓所有函数均≤15。

未关闭的本批触及存量项是 `barOption`17和其既有系列翻译回调24：本次将显隐与索引职责置于独立纯函数，原函数不增复杂度，回调下降2；进一步拆分会扩张到既有预测、标签和堆叠绘制，留作专门渲染重构，并继续受复杂度台账约束。

## 证据边界

本批验证静态协议、单元/集成、源运行时浏览器、原生ES/global分发及独立Skill安装。没有真实DQE/Relay、真实权限事实、真实DS模型、远端CI或部署验收。PDF/PNG继续消费共享条件投影；本批未新增该示例的PDF/PNG下载专项证据。

保留独立工作树供审阅，主工作区的并行修改未纳入本批。生成文件数量主要来自Schema、参考和完整Skill分发同步。
