---
status: accepted
date: 2026-10-26
note: 用户确认配置项可从字段或常量取值，覆盖全部图表及仪表，空态策略为图表级，并授权实施
---

# 组件取值支持字段来源与常量来源

固定基线只是一个消费场景。页面协议 6.59 在图表配置项增加常量来源，`series[].field` / `series[].value` 互斥；原来使用 `valueField` 的饼图、地图和仪表以同级 `value` 表达常量。常量保持直接标量，不在 field 下嵌套 value，不新增参考线组件、数据源类型或表达式。

保留 FieldBinding、FieldReference 的真实字段语义。组件取值的协议归 page，解析和展示由 engine 共享模块负责；常量不创建结果字段契约，不写入数据快照。多行消费沿已有行集重复取值，单值消费直接取值。结构身份字段、匹配、下钻及查询输入继续要求字段。

常量可就地声明 format、unit、currency、missingText，缺省不猜测其他字段的格式。金额格式要求显式兼容币种；混合图保留同轴单位/币种约束，常量系列声明自己的单位。预测常量仍受实际/预测边界检查。此项扩展 [0013](0013-format-belongs-to-component-field-binding.md) 的展示所有权，字段分支行为保持。

图表级 emptyBehavior 缺省/default 保持原空态，showConstants 只允许成功空结果呈现有必要上下文的常量；它不掩盖 loading/error，不伪造横轴类别或地域。没有横轴的空折线仍为空图。纯常量仪表允许省略 data，其值不依赖虚构的 inline 数据源。

所有 ChartComponent 和仪表的数值入口适配该能力，地图附加 tooltip 和固定摘要同样支持常量。常量沿真实行展开时保留该点的行交互；没有真实行时不制造行身份。echartsOption 的数据和结构保护继续遵循 [0110](0110-hidden-echarts-presentation-options.md)。

代价是协议联合分支、组件目录、运行态投影、纯渲染组件和创作工具必须共同适配；共享取值模块集中这一差异。实施和分层验收见[设计与架构影响](../evidence/chart-constant-values/design.md)，不得将决策接受等同全部验收已通过。
