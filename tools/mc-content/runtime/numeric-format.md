# 数值、完整性与展示尺度

query_data 字段证据中的可信单位、币种、原始尺度与来源 defaultFormat 显示建议分别核对。程序从完整执行结果选择统一固定格式：同一字段和同查询相同单位共用原单位、万或亿，图表轴/标签/Tooltip/表格继承。紧凑格式固定一位小数；任一非零值会舍入为零时退回较小单位，必要时 number 保留原值。组件显式格式优先，已按万元/亿元计量不重复缩放。

金额身份不能从“收入”等名称猜测；未知单位不补人民币，不混合单位。结果不完整时不推断万/亿尺度；已确认的百分数刻度仍默认 percent-2，不因覆盖缺口丢失百分号。来源普通数值格式建议与可信 percent 刻度冲突时工具返回 PRESENTATION_FORMAT_ADJUSTED；用户组件显式格式仍优先。fraction/unknown 不自动乘100。微小百分比在两位小数下舍入为零时保留单位与原值并返回 PRESENTATION_PRECISION_LIMIT，可用原值明细核对。显示缩放不改变 query 与原始数值；结构通过不证明单位/业务关系验收。

stored output_dims 数值只有显式 number/money + measure 才作为图表度量，保持 output_dims 投影与行粒度；可加总性需独立依据。unknown、零、空集和失败保持区分。
