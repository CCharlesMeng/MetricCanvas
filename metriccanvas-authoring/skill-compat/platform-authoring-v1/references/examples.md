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

“新建销售趋势页”：先发现受治理指标、时间和维度，消歧后用其版本构建 Page Build Spec 并调用 compose_page，显式传 layout。反例：把未验证字段或样例数据塞入页面 JSON。
