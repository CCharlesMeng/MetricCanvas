# 场景与页面结构计划

新报告在工具公布支持时使用 plan.version="3"；工具 Schema 与 structureCapabilities 是可执行能力真源。旧 v1/v2 与 operations 保持兼容，已有候选修订沿用其版本，不要求历史人工页面迁移。

结构计划版本属于创作期，不是最终页面的 schemaVersion。发现能力摘要用于选版本与呈现族，完整输入以 create/edit 当前发布的 Schema 为准；不因渲染器有某属性就假定结构计划已开放。

| 路径 | 版本与说明 |
| --- | --- |
| 新建完整页面 | 支持时选 v3：一个 purpose 表达数据块用途，可选分区标题及受控呈现，业务说明显式创作 |
| 修改既有结构候选 | planVersion 与候选一致；不把 v3 属性写入 v2 补丁，不自动升级候选 |
| v1/v2、普通操作与快速装配 | 保留各自的旧行为；下面的 v3 选项不追溯适用 |

## 业务大纲

每章声明 businessQuestion（回答什么问题）、businessObject（分析谁）、distinctFrom（为何需要此章、与其它章有何区别）。v3 的分区 title 在协议上可选，不代表创作时默认省略；可见标题按[模块标题与组件标题](reading-design.md#module-titles)选择，业务大纲字段不能替代它。数据块只用 purpose 表达用途，不提交旧版 intent；具体枚举以工具为准。

从用户需求决定内容，不按数据源数量造章节。一个章节可以用多个源，一个源也可以服务多块。保持业务阅读顺序：先让读者知道关注对象当前如何，再呈现能回答后续问题的内容；没有信息增量的章节可省略。

## 受控组合

dataRequests 声明 dataSourceId、businessDomain、metrics、groupBy、filters、time。保留指标预算；同数据可多卡复用。sections 用稳定小写连字符 id、pattern、blocks 和上述大纲语义。pattern 提供默认占位，显式 width 优先；它不是整页模板，也不负责自动选组件。分区保持平面组合，不推断任意嵌套能力。

数据块声明 id/type=data/source/component/fields/title/purpose；可用 match={field,equals} 选唯一对象，width 表达语义宽度。fields 使用已发现指标名、标签或可信字段 ID。

对象概况卡用 component=metricCard，presentation={kind:"metric-summary",metrics:[{field:"主值字段",changes:[{field:"变化字段",label:"同比或环比",evidenceRef:"发现返回的精确引用"}]}]}。metrics 允许多行；主值与变化值都须在 fields 中，同卡共享唯一对象选择。v3 可按需要指定 variant=compactStrip；缺省为 compactSummary。字段格式来自可信契约，金额与百分比可同卡，单轴混合量纲仍不合法。

比较图可用 barChart + presentation.kind=bar-comparison，声明 horizontal/stacked；可查阅对象用 table + presentation.kind=record-list，选择 density、subtitle 和已有显示字段的列对齐/符号表达。fields 决定显示字段与顺序，不要求展示查询中的全部字段。宽表核对时保留必要列并用 full，精简名单才考虑 half；具体选型读[阅读层级与表达](reading-design.md)。

受信关系包括所属主值、变化字段、适用对象和期间。严格消费这些限制；名称相似不证明关系。模型提交的是关系引用，可信来源由程序提供，不能自己声明 trustedRelations。没有关系入口时，仍可用无 changes 的对象概况卡或独立展示，明确该限制。

文字块 type=text，含 body/purpose，可选 title。v3 不自动生成查询范围正文；业务期间、必要的对象范围与实际/推演、入选名单/全量总体的区别由标题、副标题或简短正文显式表达，具体遵循[面向读者的文案](reading-design.md)。查询与筛选的完整事实仍在查询定义和程序审计中，不能把查询期间等同于各指标的统计期间。v1/v2 保留原口径说明行为。

## 按需场景

- 经营阅读任务：读取 [经营场景](scenarios/business-report.md)。
- 用量阅读任务：读取 [用量场景](scenarios/usage-report.md)。

只使用需求相关场景；不要求固定章数、卡数或必有明细表。
