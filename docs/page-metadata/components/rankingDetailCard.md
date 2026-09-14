# 详细排行卡 rankingDetailCard

按查询结果顺序展示对象、指标、变化、徽标与原因说明。适用于需要保留查询排序的增长/下降排行、排行项需要展示标签与原因说明。数据形状：名称 dimension + 数值 measure，可选变化 measure、最多两个徽标 dimension、普通说明 dimension、语义 HTML 说明 semanticHtml/detail，以及可展开 recordList/detail。

排行条目可通过显式recordList字段展开受控明细；内嵌语义HTML和行列表各走自己的字段契约，不能互换。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。
