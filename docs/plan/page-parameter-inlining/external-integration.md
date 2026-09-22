# 页面参数程序接入（6.5）

本仓提供同构 Page、确定性提取/解析、工作台确认与既有单次保存接缝。Java 资产服务、外部召回/自然语言规范化、临时渲染编排属于提供方；以下不是这些生产服务已接通的声明。

## 稳定消费入口

安装构建后的 `@metriccanvas/page`，从主入口导入 `resolvePageParams`。它不依赖 Svelte、Relay、浏览器或网络。输入为完整 Page 及可选的 ID→规范值对象；无值模板和已填 value 的页面走同一入口。

```ts
import { resolvePageParams } from '@metriccanvas/page';
const first = resolvePageParams(template, {
  region: '中国区',
  'report-period': { start: '2026-01', end: '2026-06', granularity: 'month' }
});
if (!first.ok) return first.issues; // code/path/param?/message；此时不能执行
const second = resolvePageParams(first.document); // value 已在文档中，结果相同
// first.document 保留引用；first.resolvedPage 查询已解析，只供本次执行。
```

可直接运行 [双方式完整示例](../../../packages/page/examples/resolve-page-params.ts)：

```sh
node --import tsx packages/page/examples/resolve-page-params.ts
```

输入原对象不变。成功输出的 effectiveInputs 是只读 Map；跨进程示例将其转为 JSON 对象。所选模板与填值原稿仅 params.value 不同；不要把已解析查询、返回行或 effectiveInputs 写回模板。

| 原文取值位置 | 输入 | 执行副本 |
|---|---|---|
| dim_value_list: `{param:"region"}` | `"中国区"` | `["中国区"]` |
| start: `{param:"report-period",part:"start"}` | 月区间 | `"2026-01"` |
| end: `{param:"report-period",part:"end"}` | 同一区间 | `"2026-06"` |

区间 granularity 与声明一致，月为 YYYY-MM、日为 YYYY-MM-DD，闭区间且真实日历合法。查询 period 月为 month、日为 day。新查询参数必填；空数组、重复维度值、非法显式输入不回退。ID 只用小写字母、数字、连字符且精确匹配；DQE 字段原拼写不改。timeRange 暂无 URL 编码，必须程序传值。

完整输入：[最小模板](../../../packages/page/fixtures/contract-valid/inline-params-page.json)、[完整填值页面](../../../packages/page/fixtures/contract-valid/inline-params-values-page.json)、[Tokens 五查询具体页面](../../../packages/page/fixtures/parameter-extraction/tokens-parameter-source.json)。共同反例在 `contracts/metriccanvas/page/conformance/inline-params.json`，TS/Python 同消费；发布关系向量在 `contracts/metriccanvas/authoring/publication-conformance.json`。

## 创作期可信程序交接

1. 提供方固定最终经 DQE 验真的完整页面、精确修订/身份范围以及受治理维度身份。相同字段显示名不是跨源身份依据。
2. 调用 `extractPageParams(document,{baseline,dimensionIdentities,previousCandidates?})`。程序返回 sourceKey、候选 ID、原值、覆盖/未覆盖查询和默认勾选建议。baseline 是调用方证明过的来源，不是任意字符串就能获得信任。
3. 人工修改选择；`applyPageParamSelection` 生成完整无值文档并用原值解析，逐查询等价失败即拒绝。复合文本必须通过 textReplacements 的精确 JSON Pointer 显式审阅，不能全文替换。
4. `PageAuthoringWorkbench.parameterSourcePort` 从可信程序读取上述基线；该基线须匹配工作台的 synchronizedRef + scope。界面显示候选、输入、文本修正与预览，修改来源/选择/输入后旧确认失效。
5. 用户明确确认后调用既有 coordinator.publishTemplate / 持久保存队列，选择参数无值、无旧 query initial。queued 表示进入队列；只有提供方回执经现有单次保存校验才能说成功，unknown 不重发。没有该可信源端口时不展示此能力。

跨语言示例 [parameter-program.ts](../../../packages/page/examples/parameter-program.ts) 接收 stdin JSON，返回 stdout JSON；action=prepare 携带完整 document/context/selectedIds?/textReplacements?，action=resolve 携带 document/suppliedValues?。Python 的 `application.parameter_preparation.prepare_page_parameters` 调用部署方注入的 ParameterProgram，完整 artifact 仅返回程序，relay_summary 仅带基线、候选数量、所选 ID 和待人工确认状态。测试确实启动 Node 子进程，不是另写 Python 提取算法。

统一 `metriccanvas-platform-content` 已注册三个独立 MCP 工具：`extract_page_parameters`、`apply_page_parameter_selection`、`resolve_page_parameters`。它们复用确定性程序，不接受模型传入 baseline、维度身份或完整页面。旧 publish_mcp / PublicationServicePort 为强协议兼容面，不作为当前 Java 缺失 lookup/lease 的替代。

## MCP 部署与工作台临时运行

部署组合入口接收 `parameter_dependencies=ParameterDependencies(...)`，须由宿主注入：

- `program`：`SubprocessParameterProgram`，命令及 cwd 只能来自宿主配置，不接受模型输入。开发环境可运行上述 TS stdin/stdout 示例；生产安装构建后的 `@metriccanvas/page`，驱动调用 `@metriccanvas/page/internal` 的 `runPageParameterProgram`。Python 包不包含 Node 运行时，部署者需锁定两端产物版本。适配器限制输入/输出大小和超时。
- `store`：`SqliteParameterRecords` 或满足相同契约的持久存储。SQLite 使用宿主配置的绝对路径、私有目录（0700）与私有文件（0600）；存储不可变提取记录和实例记录。默认 TTL 30 分钟，最大 24 小时；到期拒绝消费，宿主负责定期清理、备份与加密。记录绑定当前身份、工作区、轮次、页面及来源，不能跨轮次复用。
- `verified_context`：实现 `VerifiedParameterContext.verify`，从真实 DQE 验真记录确认精确页面，并返回 `sourceSha256`、baseline、受治理维度身份。hash 或任意 baseline 字符串不是验真证明；提取及应用选择均重新核对。缺提供方时提取明确不可用，不能使用测试替身上线。
- 既有可信 current-turn 与候选存储：应用选择需写权限；提取和赋值可在只读上下文调用，不授予保存权限。

模型先提取获得 `extraction_ref`、`choice-N` 候选和 `text-N` 槽位，再提交选择。候选 ID 与 Page 的参数 ID 不同；文本选择只接受已返回的槽位，不能提交任意 JSON Pointer。工具摘要不展示原始参数值。

`apply_page_parameter_selection` 返回 `metriccanvas.parameter-template` 信封和同轮 candidate_ref，模板及其后续编辑都被禁止自动保存，必须经过现有人工发布。`resolve_page_parameters` 返回 `metriccanvas.parameter-instance` 信封和 instance_ref，不进入候选存储、不执行 DQE、不保存资产。

工作台宿主提供 `parameterInstancePort`、`parameterContextRef`，通过 `onParameterInstanceReady` 获得临时会话控制器，再调用 `open(instance_ref)`。端口须调用服务端 `PageParameters.read_instance`（或同等可信协议），重新验证授权、轮次、有效期及来源，不能直接信任 Relay 的 JSON。浏览器再核对当前身份、页面、来源及引用，使用 RuntimeView 渲染填值后的 document；来源改变、关闭、到期或迟到返回均使实例失效。它不写 coordinator、不进入保存队列。真实模板召回、Relay 路由和服务端到浏览器的端口桥接由提供方接入，当前仓库测试不构成生产部署证据。

详细信封与存储约束见[参数协议](../../../metriccanvas-authoring/contracts/authored/page-parameters-protocol.md)，模型调用顺序见[参数工作流](../../../metriccanvas-authoring/skill/metriccanvas-platform-authoring/workflows/parameters.md)。

## E1：提供方仍需完成

- Java 接受并回读 6.5 原文、value 和引用对象；按真实单次提交回执验收，不能用当前 GET 推测原写入成功。
- 外部服务召回无值模板，规范化维度/时间，缺值追问，然后调用 TS 包或部署的程序适配。Python sdist 不自带 Node/TS 服务，非 TS 消费者须明确部署方式和版本。
- 外部已确认输入优先；关闭叠加的 global_params/filter-history 注入。最终 DQE 无 param 对象，不用 initial 或其他期间数据兜底。
- 用共同向量和 Tokens 全链路对接真实身份、保存、召回、执行。本文的本地 HTTP 替身与浏览器证据不等价于生产联调。
