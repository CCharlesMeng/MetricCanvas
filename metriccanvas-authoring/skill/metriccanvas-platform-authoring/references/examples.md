# v2 调用示例

context_ref、resultRef 和 artifactRef 均来自当前可信上下文/工具；示例引用为占位值，不可直接复用。

纯文本创建不取数：

```json
{"tool":"compose_page","arguments":{"context_ref":"current-context","expected_version":0,"request":{"title":"说明","sources":{},"sections":[{"id":"main","title":"说明","pattern":"custom","blocks":[{"id":"note","type":"text","body":"本页说明操作流程。"}]}]}}}
```

读取已取得的有界证据，不重复查询：

```json
{"tool":"query_data","arguments":{"context_ref":"current-context","result_ref":"result-from-this-turn"}}
```

纯标题修改不发现、不取数；版本先从 read_page_context 读取：

```json
{"tool":"edit_page","arguments":{"context_ref":"current-context","expected_version":1,"request":{"operations":[{"id":"rename","type":"set_title","componentId":"table","title":"区域明细"}]}}}
```

保存成功后只准备匹配产物的预览：

```json
{"tool":"page_metadata_emit_preview","arguments":{"context_ref":"current-context","artifact_ref":"artifact-from-save-result"}}
```

首批足够就 compose；需要补查时 query_data(request) 的 reason 说明缺口和改变的条件。若辅助查询失败，结构中保留缺失说明并报告 partial；核心证据不足不生成核心结论。保存未知停止，不能换参数重复 compose。
