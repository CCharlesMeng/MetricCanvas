# 知识与示例渐进读取

只补本次修改的知识缺口，不追求读完目录。维护一份已知事实：目标位置、采用片段、已读规则、未解决问题；同版同id/方面读过即复用。

## 定位与取片段

准确位置已知时直接 `find --document <target.json> --at <pointer>`；否则先用 `find --kind component --document <target.json> --query <标题或id>` 取安全目录。`resolved` 的id/owner直接续读，`needs-context/ambiguous`补实际判别条件；`not-found`先查返回父对象，不换全局同名key猜位置。目标可以尚未通过整页校验。目录read指向已有`analyze-data.mjs scan`的局部读取；当前配置用config，字段/槽关系用bindings，真实元数据用fields，实际共享影响用consumers。它们不是Schema定义，不需要MD或新增查询。精确at与--select配合，只读尚未知的方面；重复id用准确路径。大对象按返回位置继续收窄，样本须显式source/field/limit，见[目标事实局部读取](target-reading.md)。不要用打印整份dataSources的脚本替代这些读取。

复用用 `find --kind example --owner <组件类型> --query <能力词>` 选一个匹配例子；已知id就跳过find。`show --id <example-id> --select outline` 的对象path直接传 `--at`，用 `--select snippet` 取所需对象。card/outline已明确的形态、版本、sourceTypes不再逐层查Schema。

先核对片段的contextRules。完整内联的短规则直接使用；只对未解决的约束show对应rule，按available选方面，不假定所有rule支持text。相同结构沿用时不逐属性复查Schema。字段合并、换槽或交互关系改变才补对应约束。

## 关联契约

已定位的字段格式或展示单位变更，先按入口的 `resolve` 读取已登记关联；原文及结构保持产品真源，`next` 表示仍有内容未读取。`coverage:registered` 仅对返回的 scope 成立，不代表输入可信或任务验收通过。未登记目标、缺判别条件或部分关联按回执补缺口；保留来源事实与验证边界。同版相同Schema上下文与方面的原文可跨目标复用，但各目标配置与字段契约仍需独立核对；不同owner、条件分支或版本不能直接继承适用性。signed-number包含普通数值基础规则，不先重复读取numeric-format。

## 选择下一次读取

| 具体缺口 | 查什么；何时停止 |
|---|---|
| 行为、输入类型、格式或交互边界仍未知 | `find --kind semantic --example <example-id> --query <能力词>`，按标题选章节，再show其text；模块关联只限定范围，不保证每个结果适用。组件类型不等于语义文档owner。没有匹配例子才用全局或已确认的文档owner搜索。 |
| 实际差异没有合法例子覆盖 | 目标准确位置或 `find --kind schema --owner <实际所属类型> --query <属性>`；shape取合法值/分支，位置已在find给出就不再读placement。缺必需配套项才沿引用补查。 |
| 迁移适用性、边界或作者验收建议仍不清楚 | 例子guideCount非零时读guides目录，再直接show指南的boundary或expectations；不要先读默认card再读已知方面，不机械读四个方面。 |
| 当前配置、字段类型/defaultFormat或共享影响 | 直接scan对应config/fields/consumers；字段可按--field收窄。已有目标不需要为了获得事实再查示例依赖。 |
| 改变绑定、来源或运行关系 | 对实际移植对象取dependencies，补未解决引用。沿用目标原有可信绑定/数据源时核对其字段和类型即可，不读取整个示例运行依赖。 |

指南属于作者说明，`author-declared/current:not-assessed`不表示本轮已验；candidate/historical不自动成为推荐。原始需求已明确的验收期望不必再从指南重复获取。示例、指南、语义或Schema已完整解决某个问题后，另一入口只在出现冲突或新差异时使用。

## 分页与完整性

语义find的id是章节，focus是命中段落，preview仅选候选。未知行为边界要读章节连续text页至无next；已明确的局部疑点可读focus，但不能把局部段落当整章规则。发现目录已有合适候选就停止翻页；选定的正文或依赖确需完整时才续读。不要将未读完的正文称为完整。

续读保持原命令的id、owner、位置与分支，在命令追加 `--cursor "<next的值>"`；后续页替换cursor，不能换参数沿用游标。`needs-expand`收窄对象或选分支；部分结果、空目录、未知引用不证明能力不存在。`dependenciesResolved:not-assessed`表示CLI不追踪客户端阅读状态，没有next时不要重查目录。

## 停止与验收

目标位置、实际输入/绑定、本次行为与相关约束已经明确时，停止知识查询，做最小修改。仅剩执行操作时使用Skill入口已给的快照/校验命令，不为了运行命令额外读整篇工作流；未知参数才取help。大页和完整例子留在本地，不全量输出给模型。

完整校验并核对原始需求、非目标内容及受影响运行行为。显示与导出属于两个验收面；仅在所要求行为都明确后停止，不从界面默认值推断导出。片段合法不等于可独立运行；业务编码、口径和数据行有依据才采用。结构、浏览器、导出、Sim和真实服务分别报告，不能用功能降级换通过。
