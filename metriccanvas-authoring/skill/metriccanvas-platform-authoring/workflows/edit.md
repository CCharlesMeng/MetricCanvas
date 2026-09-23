# 修改页面

## 进入条件与读取

1. 由可信集成程序从 Java 当前页面建立本轮 context_ref，包含 pageId、resourceId、revisionId 和完整创作基线。用户只有页面名时先由平台定位；同名歧义先澄清。不能凭截图或对话摘要重建整页。
2. 调 read_page_context(context_ref)。工具会向 Java 核对当前资源；记录返回的 pageId、ref、workVersion。失败不进入修改。文字指定目标优先于选中目标。
3. 通过 target_component_id 读取目标配置；有 nextCursor 时用同一工作版本继续补读，直到已观察到本次操作需要的目标和依赖。省略字段不等于不存在。删除章节前必须取得完整 componentIds。

## 形成操作

- 样式、标题、列宽或重排：直接生成受控 operations，不调用发现或业务查询。
- 新增取数或改变口径：按[数据分析](data-analysis.md)完成计划审核和证据读取，再用 add_result_component 引用 resultRef。复用当前源使用 add_source_component，不重查。
- 用户只要求新增组件且已有章节语义匹配时，直接把 add_result_component 挂到该 sectionId；该操作会原子注册 resultRef 对应的新查询源并新增组件，不先用 add_section 声明这个源，也不另造章节。
- 新增章节用 add_section；移动用 move_section；删除用 remove_section。页头受保护。替换内容先增加新内容，再让删除操作通过 dependsOn 依赖新增成功，避免新增失败却丢失原内容。
- 每个操作后都会校验完整页面，分区至少保留一个组件。要把单组件分区并入已有分区时，不能先 move_component 留下空分区：若唯一组件是文字且已取得可信正文，先在目标分区用 add_text 和全页唯一的新 componentId 放入同一正文，再以 dependsOn 删除源分区并传入源分区原有的完整 componentIds；需要调整阅读位置时，最后在目标分区内 move_component。原组件尚存在时不能复用其 ID，否则 add_text 会因 COMPONENT_ID_EXISTS 失败。正文若被 read_page_context 省略，不能凭标题重写，须取得可信正文后再提交。多组件分区移动后若要删除，componentIds 只列删除时仍留在该分区的组件。
- 不用临时占位组件撑住源分区：操作可部分成功并保存，后续移动失败时占位会残留在页面上。
- `SCHEMA_ERROR` 指向源分区 `/sections/*/components` 时先检查是否产生空分区，再决定下一步操作；相同的跨分区移动重发仍会失败。预算或保存状态不允许继续时，报告已保存项与未完成项，不换创作轮次绕过预算。

提交 `edit_page` 前逐个检查跨分区 `move_component`：若源分区只有这一个组件，必须把该操作改成上面的复制正文、删除原分区、定位新组件三步；即使同批随后有 `remove_section`，直接移动也会先因源分区为空而失败。例如已可信取得正文且源分区只有 `old-note` 时：

```json
{"operations":[{"id":"copy-note","type":"add_text","componentId":"new-note","sectionId":"target-section","body":"可信原文","variant":"plain"},{"id":"remove-source","type":"remove_section","sectionId":"source-section","componentIds":["old-note"],"dependsOn":["copy-note"]},{"id":"place-note","type":"move_component","componentId":"new-note","sectionId":"target-section","beforeId":"target-chart","dependsOn":["remove-source"]}]}
```

新增查询结果到现有章节的最小形态：

```json
{"operations":[{"id":"add-filtered-table","type":"add_result_component","sectionId":"已读取的现有章节","resultRef":"本轮查询返回的引用","block":{"id":"filtered-table","type":"data","source":"查询结果的 dataSourceId","component":"table","fields":["实际字段 ID"],"title":"用户要求的标题","purpose":"reconciliation"}}]}
```

只有用户明确要求新章节或现有章节都不适合时才新增章节。add_section 的初始 blocks 只能引用页面已有源或文本；新结果源不能在同一批 add_section 中提前引用。确需新章节时，先用真实文本块建立章节，检查 changed 与新 workVersion，再在剩余修改预算内用 add_result_component 挂载结果。

## 执行与验收

4. 调 edit_page(context_ref, page_id=读取的pageId, expected_version=读取的workVersion, request={operations})。工具校验目标身份、Java 当前基线及工作版本，逐操作编辑、整页校验并内部保存有效变化。
5. 逐项检查 operations 的 applied/failed/skipped。changed 才表示变更，partial 必须说明未执行项；unchanged 或全失败不新增保存。独立成功项可以保存，不将整批都描述成成功。
6. 仅明确可修复的输入/页面错误允许一次定向修复；先重新读取当前 workVersion，再以相同 page_id 修改。CURRENT_PAGE_STALE、版本竞争、权限问题或未知保存不属于模型修复范围，不重建整页或自动重放。
7. saveStatus=saved 且含 ref/draftId/artifactRef 后，按主 Skill 准备精确预览并交付。保存未知由程序核对原冻结提交；预览失败只修交付，不再次保存。

完成条件：用户授权项有逐项结果，保存与预览状态分别有回执。页面有效不代表布局、业务关系与可见结论都正确；按[执行检查点](../references/execution.md)核对最终表达。
