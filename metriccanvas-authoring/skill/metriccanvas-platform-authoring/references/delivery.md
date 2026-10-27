# 保存、预览与标记

平台 v2 只把 modelSummary 送入模型；完整 document、previewJson、query、原始响应与凭据留在 structured_content 程序通道。query_data 可提供经授权的有界证据。artifactEnvelope 的 kind 为 metriccanvas.platform-artifact、formatVersion 为 2.0；完整形状与回执见 authoring/authored/platform-v2-protocol。

saveStatus=saved 且有可信 ref/draftId 才证明保存。page_metadata_emit_preview 接收对应 artifact_ref，Adapter 必须精确核对 artifact/ref/binding；ready 只表示接收成功，不证明用户已看到。预览失败只处理交接，不重新保存。

既有标记为：

```text
{{RESPONSE_START}}
{{PAGE_METADATA_PREVIEW_JSON}}
```

模型原样输出，不填 JSON。保存成功但预览失败时只保留响应标记与准确状态，暂不输出预览标记。Relay 拥有最终替换、卡片注入和实际可见性验收。MC 不新增标记格式或保存准入。

共享页面刷新保持已有 query/fields/compute/组件；execute(metadata) 的 initial 成败、清理与完整产物交接见 runtime/page-data-execution。执行不负责保存。

## 精确产物检查的程序接线

`compose_page` / `edit_page` 的程序通道 `artifactEnvelope.artifact` 已含 document，检查不依赖 preview。集成程序在 mutation 完成时按精确 artifactRef 留存产物与原样 inspectionSpec、compileInput、requestId 的关联；不能让模型重建证明，也不能读取“最近一次产物”。

可调用 `mc_content.inspect_artifact(artifact, specification, artifact_ref=..., binding=..., association=..., root=...)`。association 必须由可信程序保留，含 artifactRef、requestId、compileInput、documentSha256、inspectionSpecSha256。函数核对 artifactRef 内容摘要、binding 和原样 spec 关联后调用检查器；跨轮次、换产物、篡改或陈旧 spec 返回 not_run，不隐式保存或 preview。摘要只证明所给程序对象的一致性，不是授权证明；集成方仍负责可信引用解析和当前轮次检查。

检查状态、correlation 状态、保存状态和预览状态分别消费。`ok` 不证明业务意图、真实查询或视觉质量。外围 `tool_mc_inspect` 的部署采用需以实际回执验收。
