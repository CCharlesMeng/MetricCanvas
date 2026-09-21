# 场景参考与结构计划

完整报告使用 create_content_page(context_ref, title, layout, request={plan: ...})。
plan.version="1"；scene 是 business-report / usage-report / custom。以工具实际 Schema 为准。

## 从阅读问题开始

经营分析报告：总览 → 业务板块 → 重点对象 → 明细。总览可以同章放本月/累计卡片和月度趋势；业务板块可重复，客户/赛道等视角只在数据与需求成立时出现。不要按分组维度或时间差异机械拆章节。

资源用量报告：概况与趋势 → 区域/模型分布 → 重点对象。不是每份报告都需要所有视角；读者关心某个对象时可将其提前。

概况章优先用少量关键指标卡建立主次，再接通栏趋势；完整明细放在后面供核对。若来源包含多个对象，已发现的总量/指定对象可由唯一行选择支撑卡片，其他对象留在排名或明细；没有可证明的唯一对象时才退回表格。不要因为源含多行就放弃概况，也不要假定第一行就是总量。

组合示意（语义占位，字段和对象值须先发现，不直接照抄）：概况章 = 当前值卡（third）+ 累计值卡（third）+ 已有比率卡（third）+ 月度趋势（full）+ 口径正文。用量报告也可只保留两张卡和趋势。业务板块章 = 排名（half）+ 分布（half）+ 明细（full）；无分母或数据不完整时省略分布，不能强行补满。

用户明确结构优先。参考提供阅读路径，允许裁剪、重复、重排；没有合适组合时用 custom，在支持面内受控组合。缺指标/维度时说明缺口，场景参考不提供业务事实。

## 结构与取数分开

plan 包含 question、dataContextVersion、dataRequests、sections。
dataRequests 沿受治理取数单元填写 dataSourceId、businessDomain、metrics、groupBy、filters、time；此处没有 intent、pinnedComponent 或组件 JSON。一个源可被多个内容块复用。新结构路径仅接受已治理指标，不接受自由公式。

页面、源、章节和组件 id 使用小写字母、数字和连字符；页头章 header 与组件 page-header 由程序保留。
section 包含稳定 id、业务 title、pattern、blocks，可选 container（plain/panel/card）。
pattern 可选 overview-with-trend、comparison、distribution、focus-objects、detail、explanation、custom。它们决定默认占位，不固定章节数或强加内容插槽。

数据块：id、type="data"、source（dataSourceId）、component（实际枚举）、fields（已发现字段名或可信字段 ID）、title；可选 width、intent。宽度为 full/half/third/two-thirds；文字默认通栏，趋势和表格默认通栏，概况卡默认三等分。顺序由数组表达。
metricCard 可用 match={field, equals} 选择已验证行；只支持能证明唯一匹配的完整结果，工具拒绝无法证明的选择。fields 仅选择该卡的度量字段。多行源的卡片必须先用已发现的维度值做 match；不选择行时应使用表格，不能把多行默认当总量。
文字块：id、type="text"、body，可选 title。数字或结论必须有可信依据，首期优先写用途、口径和局限。模型不接收业务行，不能据元数据生成经营结论。

金额与百分比拆图或用独立格式表格；同章展示不代表可以合计。程序会补可见口径，实际/预测还需通过对应字段与标题清楚区分。样例/局限说明要用文字块，不能仅放 meta。

```json
{
  "plan": {
    "version": "1",
    "scene": "custom",
    "question": "新建操作指引",
    "dataContextVersion": "not-used-static",
    "dataRequests": [],
    "sections": [{
      "id": "instructions", "title": "使用说明", "pattern": "explanation",
      "blocks": [{"id": "intro", "type": "text", "body": "本页说明操作流程。"}]
    }]
  }
}
```

字段无法解析、单轴混合单位、截断数据做占比、组件形状不适用会返回精确问题。修正真实错误，不通过反复换词检索参考文档；read_page_context 只读页面配置。

已有页按当前结构局部修改。新增章节用 add_section（含至少一个初始 blocks），set_section 改标题/容器，move_section 改顺序；add_source_component 复用当前候选数据。remove_section 必须用 componentIds 明确列出当前章全部组件，原子移除；列表不符拒绝，页头章受保护。重排不需要重新执行数据查询。
