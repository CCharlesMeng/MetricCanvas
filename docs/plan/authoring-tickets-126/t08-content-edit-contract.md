# T08 / #134 内容 MCP 契约

原实施基线 `e65b012c0a93d5c9a1ac9c0e51e320133e97a0f1`，S3；最终按S0要求消费已验收#143基线 `be73806a0120d0826fd57a0edf62745760d5561a`（页面6.2/产品rc.3），版本规则由S2唯一维护。新增独立入口 `metriccanvas-content`，沿现有Bundle安装；普通问数 compatibility/relay 入口保持原语义。

## 工具入口与可信通道

| 工具 | 模型输入 | 程序结果 |
|---|---|---|
| discover_data_context | query、limit | 复用既有受控发现，不另建数据源 |
| compose_page | page_id、Page Build Spec、layout（report默认/dashboard） | 复用既有DQE验真与十类数据组件/reportHeader装配，page-build-artifact；只按受控形态切换顶层布局并重算产物摘要 |
| edit_page | baseline_token、request.operations | 精确基线上的合法成功子集，page-edit-artifact |

本票不新增模型决策调用、保存/发布工具、Java算法或最新修订猜测。模型不得填写完整页面或数据行。模型可见text为摘要；完整structuredContent交给可信Relay适配器截取，不能直接暴露给模型。注册为普通直通MCP并不能满足此通道要求。

`ContentBaselinePort.read(token)` 返回 `ContentBaseline(ref, document, document_sha256)`。ref为三个独立不透明字符串：pageId、revisionId、resourceId，与#128 DraftRef一致。调用方拥有真实授权和精确读取，先验证提供方原文，再建立本工具SHA256。MCP检查document.id等于ref.pageId，并在规范化前核验 `sha256(canonical_json(document))`；该摘要不是已确认的Java hash wire。

默认文件适配器为只读程序交接点：`METRICCANVAS_CONTENT_BASELINES_DIR` 指向每个身份/工作区独立目录，可信程序以不可变token写入同名JSON（`{ref,document,documentSha256}`）；模型工具只接收16–128位字母数字/下划线/连字符token，不能提交路径。禁止符号链接，限制普通文件和20MiB，未配置/不存在/损坏/摘要不符明确失败。不把目录隔离当成真实身份认证实现；没有可信提供方接线时生产能力保持未完成。

## 请求与操作边界

机器作者源：`metriccanvas-authoring/contracts/authored/page-edit-request.schema.json`。根仅operations（1–50项），每项具有唯一id、type、可选dependsOn。模型只表达受控意图；没有任意JSON路径、查询文本、结果行或数据绑定改写入口。

| 操作 | 受控输入 | 保留与失败边界 |
|---|---|---|
| set_title | componentId、title | 精确id命中，支持既有容器子树；最终Schema裁决此组件是否有title及必填 |
| set_component_layout | componentId、changes | 仅span/connectPrevious/layer，保留未指定占位字段；非法铺底/跨度整操作回滚 |
| move_component | componentId、sectionId、可选beforeId | 本票仅现有顶层组件移动；空源分区、非法铺底、未知目标等整页不合法即回滚，不重排其余内容 |
| change_component_type | componentId、componentType | 十类现有数据组件间，单main数据槽，已有行证据且满足既有目录机器形状门槛；复用构造器，不改源/query/initial；计算源、多槽等不能确定转换时明确失败 |
| set_properties | componentId、properties | reportHeader subtitle/badge/tags；metricCard showTrendArrows；barChart horizontal/stacked/rounded/showSegmentLabels/showStackTotalLabels；lineChart smooth/areaGradient/showPointLabels/hideYAxis；pieChart ring/labelLine；table subtitle/fit |
| set_series_label | componentId、index、label | bar/line系列仅改label，字段与forecast角色保留 |
| set_metric_row | componentId、index、可选rows、properties | rows/secondaryRows行label/context/unit；valueField、changes等保持 |
| set_table_column | componentId、fieldId、可选slot、properties | 递归找到唯一字段列，只改title/width/fixed/align；分页、排序、筛选、链接仍由各自专用任务治理 |
| set_page_layout | layout | report/dashboard显式转换，保留标题、容器、业务内容及手工设置；不把dashboard强制改plain或report强制改panel |

普通操作保留页面布局形态。类型切换是显式触及目标组件props，复用同义属性/字段格式，输出被去掉的props键摘要；不能兼容的组合整操作失败。没有为了转换成功而删除action或调整其他组件。容器添加/删除、子树构造及其他新组件分别归#135/#136；筛选/绑定/表格下钻归#137。本票不以整页重建模拟局部编辑。

## 部分成功与错误

先规范化合法完整基线，然后按请求顺序对每个操作独立复制当前成功文档。操作成功且整页校验通过才提交该副本；失败仅丢弃该操作副本。dependsOn必须引用此前applied或unchanged操作，未知/未来/失败依赖均skipped，因此成功子集依赖闭合。重复或非法操作id使整批invalid_request，以免无法判断依赖；操作自身规格错误只使该操作failed，独立后项继续。

每项结果为 `{id,status,issues,adjustments}`，status为applied/unchanged/failed/skipped。issues只含稳定code/path，不回显输入值、数据行或Schema原文。整个结果的status：

- changed：净内容变化且无失败；partial：净内容变化且含失败/跳过。
- unchanged：净内容无变化，包括相互抵消的修改或仅版本规范化；即使部分失败也可用逐项状态解释。
- failed：全部失败/跳过；invalid_request/invalid_baseline：批结构或基线前置不成立。

只有changed/partial返回artifactEnvelope。全失败/无变化没有“新页面”产物，生命周期调用方不得保存；本工具从来不自行保存，包括合法部分成功。最终完整校验再次守住注册扩展的边界。

## 程序产物与下游交接

结果顶层 `{ok, artifactEnvelope, modelSummary}`。创建信封kind为 `metriccanvas.page-build-artifact`，artifact复用现有PageBuildArtifact；编辑信封kind为 `metriccanvas.page-edit-artifact`，formatVersion为1.0：

```json
{
  "baseRef": {"pageId": "opaque-page", "revisionId": "opaque-revision", "resourceId": "opaque-resource"},
  "baseDocumentSha256": "64 lowercase hex characters",
  "document": {},
  "documentSha256": "64 lowercase hex characters",
  "bundleVersion": "0.2.0"
}
```

上例document仅作DTO形状示意，不是合法页面夹具。可信程序读取artifact后，按生命周期契约将基线ref、原文摘要、候选文档和操作关联交保存工具；本票不定义外部保存wire/idempotency或替代S4。保存成功后的draftId通知与#128协调读取由#146闭环，本票产物不冒充已保存引用。

## 扩展与发布

新增操作须在请求作者契约增加封闭分支，在component_editing的OPERATION_HANDLERS注册确定性handler（后续可从独占组件模块导入），由page_editing统一处理复制/依赖/校验/结果。handler只能改候选页面，返回必要调整键摘要或抛EditFailure，不访问保存/发布/模型端口。

S3维护内容作者源与stdio/反例测试；S2维护生成manifest/锁，不手改快照。新请求schema随sdist内置；既有源码入口由main延迟初始化，独立content导入不创建兼容保存MCP。真实Relay/模型行为评测与外部身份/产物通道仍须另行验收，本仓替身不能替代。
