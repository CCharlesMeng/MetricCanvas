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


## 合入 main 前的整合验证

交付整合以 `7d06bea02657c18f820e5b60d689de61ab1d8e02` 为第二父提交，保留其重点国代默认覆盖 Region、业务页及其他已有变更。生成冲突全部回到双方真源重建；页面作者版本仍为6.86，local-authoring在远端1.25.0基础上升至1.26.0。

整合后重跑产品263文件2,412项测试、迁移兼容输入6文件81项测试、local-authoring与产品参考5文件207项测试，全部通过；全仓 `pnpm check`、本功能Playground宽窄屏浏览器、24项embed浏览器（含ES/global、复制目录、Webpack、原生高级选项及最新重点国代语义）、embed构建及1MB门禁、复杂度门禁、契约生成一致性均通过。源截图及机器报告仍记载实施时旧基线，不冒充当前整合树结果。

整合时发现main的799a297ad迁移并修改了业务页，但六组旧计分/HTTP Sim回归仍引用已不存在的临时路径。它们验证的旧计分契约现按原字节置于 `tests/fixtures/partner-health/page-20261102.json`，来源、摘要及验收边界见同目录README；断言保持，最新业务页内容不变。原始JSON新增但未新增可执行分支；本批函数复杂度结果保持。

提交、远端SHA、CI与清理结论由交付聊天中的最终远端核验记录提供，不把本地通过视为远端CI或部署通过。


最终交付基线再次前进到 `95e045533c75b255db43c22a77875c8f3393ea19`：其已发布的季度查询保留Schema6.86，本批系列条件能力顺延为Schema6.87，local-authoring为1.26.0。两个能力下限分别登记，不将本批条件放进旧6.86页面。相应示例、拒绝旧版测试、语义主题与独立校验器从合并后的真源重新生成。此前各节的6.86与1.24.0记录属于实施和第一次整合的历史输入，当前正式版本以产品 `versionPolicy` 与 Skill 元数据为准。

Schema6.87整合树的复验：产品263文件2,420项通过，local-authoring及产品参考5文件208项通过；全仓类型检查、本功能Playground浏览器、24项embed浏览器、构建分包和复杂度门禁通过。

最终 main 基线继续前进到 `01d4ca6d2aeaaec8a919f93c8a2e2082f0ff7344`：同比格式保留Schema6.87，本批系列条件顺延为Schema6.88，Skill继续为本批尚未正式合入的1.26.0。图表运行逻辑未变；合并仅保留双方能力、调整版本声明并从真源重建分发。按用户最小必要验证要求，只追加版本/系列条件/同比格式3文件33项直接回归与生成一致性检查，原功能浏览器及分包验证不重复。版本字面量和夹具调整没有增加可执行分支，复杂度沿用前述AST/1结果。

Schema6.88最小复核：上述33项通过；产品契约1482项、authoring 5项、interface 1项生成一致，MC诊断夹具一致。AST/1 TypeScript5.9.3复测版本文件最大selfCC14、系列条件测试最大4、反例声明文件最大7，均未增加决策分支。

远端CI发现Relay正式消费仍固定6.85，打包按原规则返回needs_migration。为交付6.88补齐独立0.4.0消费基线，保留所有旧文件及41条原请求，由实际候选采集46条完整结果并审查15条版本/Schema摘要差异；没有修改兼容算法或放宽实际current迁移。只复核26项adoption/consumer定向测试与失败的pack链路。Radon6.0.1：新增688审查测试CC4；修改的三个测试函数CC分别4→4、5→5、1→1。机器及人工差异记录见tools/relay-reference/fixtures/schema688-*。

打包修复复核通过：0.4.0四项归档实际生成并回读校验，正式46条全通过；历史23条按原审查保持needs_migration，current迁移拒绝的实际CLI测试通过。该本地产物回执标记脏整合树，最终远端来源与CI另行核对。

整合main金额格式提交44adb1df22bfdcf9eb4630cecf74820669ac3318后，正式金额能力保留6.88，本批系列条件顺延6.89，Skill1.28.0。上文6.88及其本地pack属前一整合输入的证据；正式发行基线改为0.4.0/6.89，旧6.85样本保持。最新版本、系列条件与金额协议3文件25项通过，不重复图表浏览器与全量产品回归。

最终6.89正式消费保留41条原请求并由真实CLI采集46条；15项差异审查成立，26项定向adoption/consumer测试通过（包含实际current拒绝）。产品生成1492/5/1及MC夹具一致。为遵循最小必要验证，6.89本地不重复pack，最终归档由必需CI核验。原复杂度测量口径沿用；新增审查测试CC4，其余4→4、5→5、1→1。

最终整合CI全量产品测试4,391项通过、2项失败、5项跳过。两个失败均为门禁维护：main既有filterOverrideTargets/moneyFormatCurrency/moneyFormatMatchesCurrency导出漏同步快照；中立性扫描把能力登记键误判为页面分支。本批用官方UPDATE_PUBLIC_API入口更新快照，AST仅屏蔽版本登记对象的属性键，保留谓词与其他源码分支扫描，并覆盖普通声明/satisfies声明。11项定向回归通过，AST/1新函数自身CC最大6，原扫描函数分支不变。此补丁仅修改测试、快照和本记录，产品源码、Schema、生成物、Skill及正式消费基线未改。
