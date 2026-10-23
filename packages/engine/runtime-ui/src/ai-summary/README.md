# AI Summary

Report 专用摘要 Module。从 `AiSummary.svelte` 看页面生命周期，从 `runtime/session.ts` 看后台任务生命周期；接入云宝只改 `adapters/yunbao-assistant.ts`。

云宝接入开发请直接阅读下方的[云宝助手开发交接](#云宝助手开发交接)。

```text
ai-summary/
├─ index.ts                    # 引擎内部统一入口
├─ AiSummary.svelte            # 组件入口：已有正文 / 生成任务订阅
├─ types.ts                    # 生成 Interface、上下文与共享结果状态
├─ runtime/
│  ├─ input.ts                 # 页面上下文、范围与提示词、确定性输入键
│  └─ session.ts               # 节流、并发、去重、缓存、后台完成
├─ view/
│  ├─ AiSummaryView.svelte     # 加载、正文、错误和重试
│  └─ content.ts               # HTML 校验、文字降级、导出正文
└─ adapters/
   └─ yunbao-assistant.ts       # 唯一云宝实现，当前为本地 Mock
```

## 引用与接入

模块外的引擎代码从 index.ts 引用，不直接定位内部文件。集成应用沿用 @metriccanvas/engine/ui 的类型与公开能力；云宝从 @metriccanvas/engine/ui/ai-summary/yunbao-assistant 单独导入。Adapter 不从主入口自动加载，替换实现仍通过 generate(question, contextInfo): Promise<string> 注入。

runtime/input 收集当前可见区域的数据源与实际查询，等待关联查询退出 loading 后组装完整输入。runtime/session 持有应用会话；AiSummary 卸载只退订，已经启动的任务继续完成并缓存。任务不能放回组件的局部生命周期。

view/content 是组件容错的唯一实现，生成结果和后端正文共用。View 使用 widgets/shared/ReportSummary.svelte 与 SDT 报告摘要共享外观；显式 reportInline 使用既有 TextBlock。页面 Schema 与范围校验继续归 page 包，不在这里重复定义。

## 验证入口

- 页面：/pages/report-ai-summary（双模式、双区域、时间切换、文字降级和导出）
- 输入与任务：runtime-ui/tests/ai-summary-input.test.ts、ai-summary-tasks.test.ts
- 浏览器：embed/tests/browser/report-ai-summary.spec.ts，含 SDT 宽窄外观对比
- 产品协议：docs/page-metadata/components/aiSummary.md

## 云宝助手开发交接

### 交付目标与修改位置

将 [adapters/yunbao-assistant.ts](adapters/yunbao-assistant.ts) 中的本地 Mock 替换为真实云宝 SSE 调用。本仓当前等待约 1.2 秒并返回带“本地 Mock 分析”的正文，尚未连接真实云宝服务。

开发范围集中在这个文件：替换 `generate` 函数体，需要的请求构建、事件解析、内容累积辅助函数也放在同文件。保留 `generate` 和 `aiSummary` 两个命名导出，以及既有的两参数 Interface。页面、查询执行器、任务队列和摘要样式已经接好，无需为云宝另建一条页面渲染链路。

```ts
import type { AiSummaryConfig, AiSummaryContextInfo } from '../types';

export async function generate(
  question: string,
  contextInfo: AiSummaryContextInfo
): Promise<string> {
  // 在这里实现真实云宝请求，消费 SSE，返回完整正文。
  // 此处仅展示 Interface；真实实现不能保留这个占位错误。
  throw new Error('请按内网云宝协议实现');
}

// 保留模块级对象身份；不在每次渲染或 generate 调用中重新创建。
export const aiSummary: AiSummaryConfig = {
  generate,
  throttleMs: 1000,
  concurrency: 2
};
```

这段是替换位置示意，不是可直接交付的 SSE 实现。真实端点、请求字段、鉴权和事件结构以下文的内网协议核对表为准。

### 两个输入参数怎么使用

`question` 是完整分析指令，由页面业务提示词和引擎固定输出约束拼成。固定约束包括只依据所给数据分析，以及受控 HTML 的标签和语义类要求。将完整字符串传给云宝，不要像当前 Mock 的展示文案那样只取第一行，也不要用固定提示词覆盖它。

`contextInfo` 是本次分析已经冻结的数据上下文。类型真源在 [types.ts](types.ts)，内容按以下语义传给云宝：

| 字段 | 含义与处理方式 |
| --- | --- |
| `pageId` | 当前 Report 页面标识。 |
| `pageRevision` | 页面修订信息，可能为空字符串；不是鉴权凭据。 |
| `componentId` | 当前摘要标识，用于区分一个页面中的多个分析区域。 |
| `sectionIds` | 通过分区推导范围时的分区标识；显式声明数据源时可以为空。 |
| `timeFilters` | Report 页头生效的时间筛选，按筛选 id 索引；值有 `timePoint` / `timeRange` 判别类型。 |
| `dataSources` | 本摘要范围内的数据源数组，已经按显式字段白名单或可见分区投影。 |
| `dataSources[].id / description` | 数据源标识与业务说明。 |
| `dataSources[].fields` | 字段类型、角色、业务标签等元信息；保留实际传入的完整字段信息。 |
| `dataSources[].query` | 可选的生效查询，包含实际查询体及可能的筛选、分页、排序等信息；有值时保留原意传入，静态来源可能没有此项。 |
| `dataSources[].resultScope` | `complete` 表示来源声明的完整结果；`window` 表示窗口结果，不能据此声称是全部数据。 |
| `dataSources[].result` | 数据快照，含状态及对应的数据或错误信息。 |

以下是简化输入示例，不是云宝 HTTP 请求体规范；示例使用静态来源，因此省略 `query`：

```json
{
  "pageId": "report-ai-summary",
  "pageRevision": "",
  "componentId": "usage-summary",
  "sectionIds": ["usage-region"],
  "timeFilters": {
    "month": {
      "type": "timeRange",
      "from": "2026-09",
      "to": "2026-09"
    }
  },
  "dataSources": [
    {
      "id": "usage",
      "description": "用量分析",
      "fields": {
        "month": { "type": "string", "role": "dimension", "label": "月份" },
        "tokens": { "type": "number", "role": "measure", "label": "Tokens 消耗" }
      },
      "resultScope": "complete",
      "result": {
        "status": "ready",
        "rows": [{ "month": "2026-09", "tokens": 93801742 }],
        "totalCount": 1
      }
    }
  ]
}
```

数据快照可能为以下状态，处理时按 `status` 区分：

| 状态 | 内容 | 传给分析方的含义 |
| --- | --- | --- |
| `ready` | `rows`，可选 `totalCount` | 本次实际查到的数据；保留空值与行信息。 |
| `empty` | 可选 `totalCount` | 明确的空结果，不能当成数值零。 |
| `error` | 结构化 `error` | 查询失败，不能当成空结果或成功数据。 |
| `loading` | 无完成结果 | 类型允许，但正常生成链路会等待关联来源退出此状态再调用。 |

查询空或失败是否仍能产出业务分析，由云宝专门分析处理。Adapter 保留事实并完成传输，不自行补造数据、扩大范围、发起 DQE 查询或推断业务结论。上下文可能同时包含多份数据源，不能只发送第一份，也不能只发送行数或只发送字段名。无需修改传入对象。

如果云宝支持独立上下文字段，将 `contextInfo` 按其协议序列化；如果只接受单一消息，将完整 `question` 与标识清楚的上下文 JSON 一并送入。具体请求字段名由云宝协议决定，不要求服务端恰好也叫 `question` / `contextInfo`。若触发服务输入长度限制，应明确报错或先确定业务处理方案，不能静默截断数据。

### SSE 实现步骤

函数内部按以下顺序实现，所有累积状态都属于本次调用：

1. 读取宿主已有的云宝地址与鉴权配置，构造符合真实协议的请求，将完整指令和上下文映射到对应字段。端点与凭据不写进页面 JSON；浏览器中不要嵌入长期服务密钥。
2. 发起请求，检查 HTTP 状态、响应类型与可用响应流。若协议需要 POST、自定义请求头或请求体，可使用宿主 SDK 或 `fetch` 流式读取；具体方式由内网接口决定。
3. 使用流式 UTF-8 解码，保留跨网络 chunk 的字节与未完成文本；按完整 SSE 事件帧解析，再解读业务 JSON。不要对每次网络读取直接 `JSON.parse`。
4. 按真实事件映射区分正文、元信息、业务错误和完成事件。元信息、心跳、会话 id 等不得拼进正文。
5. 确认正文事件是增量片段还是累计全文：增量使用追加，累计全文使用替换；若最终事件另带完整结果，按协议选择最终正文，不能把它再追加一次造成重复。
6. 收到协议认可的完成信号，校验正文非空后 `return` 完整字符串。连接关闭是否代表成功，必须以云宝协议为准；不能仅因读流结束就把半截正文作为成功结果。
7. 请求失败、业务错误、超时或异常断流时抛出 `Error`，由现有组件展示局部错误与重试。成功或失败后释放本次 reader、监听器与定时器，避免重复完成 Promise。

SSE 的 UTF-8、分行与事件帧规则参见 [WHATWG HTML Standard：Parsing an event stream](https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream)。实现需覆盖跨 chunk、CRLF/LF/CR、多行 `data:` 和注释心跳；SSE 帧结束与云宝业务生成完成是两层概念，具体业务事件名不能从 SSE 标准推断。

不要直接套用未经确认的 `choices[0].delta.content`、`[DONE]`、`message_end` 等字段或标记。它们不是本项目已确认的云宝协议。

### 返回什么内容

成功只返回 `string`，包括完整纯文本或受控 semantic HTML。不要返回响应对象、SSE 原文、JSON 包装、Markdown 代码围栏、异步迭代器或分片回调；组件当前只接收完整结果，不逐字展示。

纯文本示例：

```text
本期用量为 93801742。当前数据仅覆盖一个期间，无法据此判断环比趋势。
```

受控 HTML 示例：

```html
<p><strong class="detail-title">用量概况：</strong><span class="detail-description">本期用量为 </span><span class="detail-value">93801742</span>。</p>
<p><span class="detail-meta">当前数据仅覆盖一个期间，无法据此判断环比趋势。</span></p>
```

HTML 只表达结构与内容语义。允许的标签、语义类和数值规则以 [受控语义 HTML 实现](../../../widgets/src/shared/semantic-html.ts) 与 [产品协议](../../../../../docs/page-metadata/semantic-html.md) 为准；`question` 已附带相同输出约束。不要生成自定义 CSS、内联样式、事件、脚本、图片或完整 HTML 页面。涨跌业务含义需要明确后才能使用 `tone-positive` / `tone-negative`，不要仅按数字正负猜测好坏。

引擎会复用 SDT 的报告摘要样式。合规 HTML 按语义渲染；结构不合规时提取可读文字，保留换行；空响应或没有可展示文字时显示错误。Adapter 无需自行清洗或解析 HTML，也不要重复拼接“报告摘要”标题和外框。合法的纯文本是成功结果；网络或业务错误不能用错误提示字符串假装成功返回，否则会被当作分析结论缓存。

### 并发、后台保留与重试约定

- 一次 `generate` 对应一份独立请求。正文缓冲、完成状态、超时、reader 和云宝请求/会话标识按调用隔离；不要用模块级“当前流”或“最后一份结果”覆盖其他请求。云宝有会话机制时，必须确认并发隔离方式，不能假设一个可变会话可供所有区域共用。
- 用户切换时间、切换页面或组件卸载时，已经启动的请求必须继续完成。不要接入组件卸载、页面内路由变化或筛选变化的 abort 信号，也不要为了新请求主动中断旧请求。
- 应用会话已经负责每区域节流、全局并发、相同输入去重和缓存；同一份 `aiSummary` 对象跨挂载复用。不要在 Adapter 内另建与页面绑定的队列或重复缓存。
- 默认每区域启动间隔 1000ms、同一应用会话并发 2；待启动队列只保留该区域最新输入，已经运行的任务继续完成。错误与成功结果由现有会话管理，用户点击重试后可重新发起。
- 超时与网络错误可以结束本次失败请求，但不能影响其他正在执行的请求。超时时间按云宝实际规范设置；不默认加入无限重连或隐藏自动重试，以免重复生成、重复追加或额外计费。若确需协议重试，应先明确幂等、续传与去重规则。
- “后台保留”指当前应用仍运行时，离开 Report 后的保留。关闭标签页、浏览器刷新或进程退出不保证请求与缓存保留，当前没有持久化恢复能力。

### 内网开发前需要补齐的协议资料

下表是待云宝开发确认的输入，不是本仓已经实现的事实：

| 项目 | 交接时需明确 |
| --- | --- |
| 端点与方法 | 实际 URL、GET/POST、网关或宿主 SDK，以及跨域/代理方式。 |
| 鉴权 | 复用哪个宿主登录态或取凭据入口，凭据有效期与刷新方式。 |
| 请求映射 | 分析指令和上下文 JSON 分别放在哪些字段，是否需要助手/场景参数。 |
| 事件样例 | 脱敏的原始成功流、业务失败流、心跳/元信息事件；保留真实事件名与字段结构。 |
| 正文语义 | 哪个字段是正文，是 delta 还是累计全文，最终事件是否再次携带全文。 |
| 成功结束 | 完成标记是什么，EOF 是否允许成功，结束事件是否有业务成功码。 |
| 错误语义 | HTTP 成功但业务失败的识别方式，鉴权失效、限流与超时错误的映射。 |
| 并发会话 | 每次调用的请求/会话隔离方式、并发限制，以及是否存在自动重连。 |
| 容量与超时 | 输入长度、输出限制、服务超时；超过限制时明确处理，不静默少传数据。 |

有这些资料后，在同一 Adapter 文件完成映射即可；不要把云宝 wire 协议字段扩散进页面 Schema 或任务运行逻辑。

### 应用接线与最小联调步骤

Playground 与 Platform 已导入同一个 Adapter 配置。替换真实实现后，保持以下独立入口不变：

```ts
import { aiSummary } from '@metriccanvas/engine/ui/ai-summary/yunbao-assistant';

// 集成应用把同一个 aiSummary 对象传给 RuntimeView 或 Embed mount。
```

本地功能页面为 `/pages/report-ai-summary`。当前页面数据来自 DQE Sim，云宝来自 Mock；替换云宝后，只能证明真实云宝调用，不会自动变成真实 DQE/Relay 联调。启动方式见 [示例 README](../../../../../pages/capabilities/ai-summary/README.md)，端口以服务实际输出为准；本批工作区预览使用 5177。

联调按以下顺序验收：

1. **单次成功**：切换一个期间，检查云宝实际收到完整指令、时间条件、字段与查询结果；分别验证纯文本和受控 HTML 最终正文。
2. **多区域**：两个摘要同时生成，确认各自只使用自己的数据源与字段，结果没有相互覆盖。
3. **频繁切换**：期间 A 已开始生成后切到 B，先后让两份请求完成；B 保持自己的结果，返回 A 能看到 A 已完成的结果，不能因切换中断 A。缓存仍有效且输入完全相同时不重复请求。
4. **离开再返回**：请求开始后切到其他页面，等待完成后返回；保持同一注入对象时复用后台结果。刷新浏览器不属于此验收项。
5. **分片与错误**：用固定 SSE 夹具覆盖中文跨 chunk、事件跨 chunk、多行 data、心跳、增量/累计正文、最终正文重复、业务失败、异常断流、超时和空正文；失败后重试能够重新调用。夹具替换的是传输层，不是直接绕过解析器返回最终文字。
6. **内容降级与导出**：结构不合规但有文字时仍显示文字；导出使用当前条件的完整结果，未完成区域为占位，不能额外调用云宝。

在仓库根目录执行基础回归：

```sh
pnpm --filter @metriccanvas/engine check
pnpm --filter platform check
pnpm --filter playground check
pnpm exec vitest run packages/engine/runtime-ui/tests/ai-summary-input.test.ts packages/engine/runtime-ui/tests/ai-summary-tasks.test.ts
pnpm --filter @metriccanvas/embed build
pnpm --filter @metriccanvas/embed exec playwright test tests/browser/report-ai-summary.spec.ts
```

以上确定性测试使用注入实现，不会调用真实云宝。新增 SSE 解析测试应使用脱敏固定事件流，覆盖实际 Adapter 的解析过程；浏览器使用真实云宝的成功、失败与并发切换仍需在内网实际验收。修改实现后按 [代码复杂度规则](../../../../../docs/agents/code-complexity.md) 测量修改函数及全部新增辅助函数，不能只测外层 generate。

交付时附：实际协议映射说明、脱敏 SSE 夹具与解析测试、上述检查结果、真实云宝联调记录，以及未覆盖的边界。当前 README 是开发交接说明，不代表真实云宝已完成验收。
