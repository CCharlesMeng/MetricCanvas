# 报告页头 reportHeader

表达页面标题、说明、时间点与标签；副标题可显式使用受控语义 HTML。适用于任何完整页面的开头。数据形状：不绑定页面数据源。

页面内容页头；title为必需文本取值，可引用必需页面参数或当前已应用筛选；6.23 起可用 `{parts:[{filter:"report-month",format:"period"}," 经营分析报告"]}` 组合动态期间与固定名称，规则见[文本片段组合](../params-and-text-values.md#文本片段组合623)。页面meta.title是另一个页面级声明，不替代该组件必填title。

dashboard 的筛选器由统一工具栏呈现，reportHeader 禁止配置 filterIds；下述日期工具带只用于 report。

filterIds（6.13）按序引用页面 timePoint/timeRange 筛选器，采用封面上方独立工具带；宽容器右对齐，窄容器换行。控件使用运行时筛选状态，不拥有查询。6.15 起 filterIds 仅决定控件位置，不自动创建或覆盖 asOf。期间文字使用 asOf.value: {filter: 筛选器id, format: "period"} 显式引用当前已应用值；字面量保持静态，param 引用保持打开时的参数值。6.13/6.14 继续按旧的期间派生规则读取。导出保留捕获时已经解析的静态文字。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。
