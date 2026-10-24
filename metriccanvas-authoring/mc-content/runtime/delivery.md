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
