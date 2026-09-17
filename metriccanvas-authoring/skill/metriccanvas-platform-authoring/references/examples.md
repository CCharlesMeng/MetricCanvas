# 最小受控例子

仅在参数结构需要例子时读取。以下 contextRef/组件 ID 都必须替换为当前可信上下文值。

## 修改已知组件标题

```json
{
  "context_ref": "trusted-context",
  "request": {
    "operations": [
      {"id": "rename", "type": "set_title", "componentId": "sales", "title": "销售概览"}
    ]
  }
}
```

只影响该标题。反例：为改标题先发现业务数据，或 compose_page 重建当前页。

## 新建静态说明

```json
{
  "context_ref": "trusted-new-context",
  "title": "说明",
  "layout": "report",
  "request": {
    "operations": [
      {"id": "intro", "type": "add_text", "componentId": "intro", "sectionId": "main", "body": "本页说明统计口径。"}
    ]
  }
}
```

使用 create_content_page；静态正文不需数据发现。反例：因为标题有“AI”就创建运行时流式摘要。

## 配置问答与数据创建

“这张图怎么配置”：用 read_page_context(context_ref, target_component_id) 按本轮目标稳定 ID 读取并回答绑定、格式及布局；省略项通过同修订cursor补读，不调用编辑或数据发现。

“快速展示销售趋势”：先发现受治理指标、时间和维度，消歧后可用 Page Build Spec 调用 compose_page，显式传 layout。“新建完整销售报告”则按创建流程使用 create_content_page 的结构计划组织内容。两者都不能把未验证字段或样例数据塞入请求。

## v3 呈现块示例

以下是 plan.sections[].blocks[] 的两个独立示例，不是完整工具请求，也不要求一起出现。source 和 fields 必须替换为当前 dataRequests 与已发现字段；创建入口仍需 title、可信 context_ref 及完整 plan。呈现设置不新增查询或计算指标。

同量纲类别比较：

```json
{
  "id": "target-comparison",
  "type": "data",
  "source": "targets",
  "component": "barChart",
  "fields": ["赛道", "年目标", "年推演流水"],
  "title": "年度目标与推演",
  "purpose": "comparison",
  "width": "full",
  "presentation": {"kind": "bar-comparison", "horizontal": true, "stacked": false}
}
```

入选对象查阅：

```json
{
  "id": "customer-observation",
  "type": "data",
  "source": "customers",
  "component": "table",
  "fields": ["客户名称", "本月流水", "环比"],
  "title": "客户观察",
  "purpose": "reconciliation",
  "width": "half",
  "presentation": {
    "kind": "record-list",
    "density": "compact",
    "subtitle": "仅含入选客户，不代表整体增长贡献。",
    "columns": [{"field": "环比", "align": "right", "visual": "signed"}]
  }
}
```

只有来源确为入选名单时才用该副标题。精确核对需要更多列时改用通栏、保留必要字段，不照抄三列结构；没有年度目标时也不补造第一个块。
