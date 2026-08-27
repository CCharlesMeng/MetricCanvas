# api.md — 怎么跟后端说话?

**最重要的一条结论:本仓没有一个统一的 HTTP 客户端实例,但取数有唯一出口。** 这两句必须一起读,否则会得出相反的检视判据。见 `PATTERN-API-1`。

## 出口

<!-- 覆盖:全仓源码的底层 HTTP 调用点(fetch / XMLHttpRequest / EventSource / axios 全量 grep),其中 packages/*/src/ 与 apps/canvas/src/ 逐文件确认;apps/platform/src/ 只确认了调用点位置与用途,未逐文件展开(2026-08-24) -->

| ID | 指路 | 是什么、何时用 | 被引用 |
| --- | --- | --- | --- |
| `API-1` | `DataGateway`(`packages/runtime/src/ports.ts`) | **取数端口**:一条生效查询进、标准化数据行与可选总条数出。运行时只认这个接口,按意图命名而不按实现方命名。任何「页面数据从哪来」的问题从这里进 | 编排器、维度候选值加载器;三个宿主各自注入 |
| `API-2` | `createDqeGateway`(`packages/data-gateway/src/dqe.ts`,经包出口导出) | `API-1` 的**直连实现**:浏览器直接打远程查询端点。批量信封、并发额度、超时、取消传递、结算幂等、错误分类、诊断落点全部隐藏在里面。canvas 与 embed 用它;改取数行为改这里,不要在调用侧绕 | canvas 与 embed 的服务装配处 |
| `API-9` | `createPlatformDataGateway` + `PLATFORM_DATA_QUERY_PATH` / `PLATFORM_DIMENSION_VALUES_PATH`(`apps/platform/src/lib/platform-data-gateway.ts`) | `API-1` 的**第二个实现**:经平台服务端代理取数,浏览器只知道相对路径,端点与凭据只存在服务端。失败响应还原成与 `API-2` 同构的错误对象。判断「端口有几个实现」时不能漏掉它 | platform 的服务装配处 |
| `API-3` | `DimensionValuesGateway` + `DimensionValuesResult`(`packages/runtime/src/ports.ts`),实现在 `API-2` 内 | 维度候选值的**独立**端口。能力可缺席——不支持时返回显式 `unavailable`,**不是空数组**。空数组只表示查询成功且候选为空,两者不能混 | 筛选控件、表格表头筛选 |
| `API-4` | `PageRepository`(`packages/runtime/src/ports.ts`),实现 `createStaticPageRepository` / `createPlatformPageRepository`(`apps/canvas/src/lib/`) | 页面文档的取件端口。两个实现:静态文件(`STRUCT-7`)与平台 API。**`load` 返回 `unknown`**——加载与校验是两步,拿到的是不可信文档 | 目录页与查看器路由 |
| `API-5` | `packages/runtime-ui/src/ai-summary/pangu-sse.ts` | AI 总结的 SSE 出口。它**不经 `API-1`**,因为它是流式对话而不是查询;配置缺席时组件局部报配置错误,不影响页面其余部分 | `COMP-7` |
| `API-6` | `QueryErrorCode` / `queryErrorDisposition`(`packages/page/src/query-error.ts`,经 `STRUCT-1` 导出) | 查询错误分类的**封闭集合**与它的处理语义(重试 / 重登 / 失败)。错误分类只有这一份定义,数据网关与呈现层都引它 | `API-2`、`COMP-12`、编排器 |
| `API-7` | `DqeDiagnosticRecord` / `createInMemoryDqeDiagnostics`(`packages/data-gateway/src/dqe.ts`)、`DqeDevDetail`(`.../dev-detail.ts`) | 查询诊断:生产态只留标识与标量(形状封闭),开发期明细走独立通道且必须显式注入。**排查查询问题看这里,不要往错误消息里加信息** | `API-2`;platform 的开发者视图 |
| `API-8` | `tools/dqe-sim`(`sim:dqe` / `dev:dqe` script,出口 `src/server.ts` 与 `src/execute.ts`) | 本仓的 mock 约定:一个仿真 DQE 服务,`RUN-3` 会自动起它并把端点注入给两个 app。**要 mock 取数就起它,不要在测试里 stub `fetch`** | `RUN-3`、`packages/data-gateway` 的开发依赖 |

## 规范

#### `PATTERN-API-1` · 取数有唯一出口,其余 HTTP 无统一做法

| 项 | 内容 |
| --- | --- |
| 规则 | **取数**必须经 `API-1` / `API-3` 这两个端口,实现只有 `API-2` 与 `API-9` 两个适配器。**其余 HTTP 没有统一实例**:页面文档取件、AI 总结 SSE、platform 自身的 `/api/*` 调用各自裸 `fetch`,各处手写错误处理。检视**不得**按「绕过统一 HTTP 实例」判违规;能判的只有「取数绕过了 `API-1`」这一种 |
| 依据清单 | `API-1`、`API-2`、`API-4`、`API-5`、`API-9` |
| 依据样本 | 全仓底层 HTTP 调用点共 25 处:`API-2` 内 2 处(取数与候选值)、`API-9` 内 2 处、`API-4` 的平台实现 2 处、`API-5` 1 处、platform 自身 `/api/*` 与模型调用 18 处;`packages/runtime`、`packages/runtime-ui`(除 `API-5`)、`packages/widgets` 内零命中 |
| 违例判定 | 出现新的取数路径而没经 `API-1`(即 `fetch(` 直连查询端点),或在 `packages/runtime*` / `packages/widgets` 内新增底层 HTTP 调用 |

#### `PATTERN-API-2` · 网关由宿主注入,运行时只依赖端口

| 项 | 内容 |
| --- | --- |
| 规则 | 适配器(`API-2` / `API-9`)的构造只发生在宿主装配处;`packages/runtime`、`packages/runtime-ui`、`packages/widgets` 不得导入 `@metriccanvas/data-gateway`,也不得出现端点字面量。**第二形态(嵌入)下网关由第三方宿主经 `mount` 传入**,所以在运行时包里搜不到出口是设计结果,不是缺失 |
| 依据清单 | `API-1`、`API-2`、`API-9`、`STRUCT-3`、`STRUCT-6` |
| 依据样本 | `apps/canvas/src/lib/services.ts` 是 canvas 唯一构造点;`packages/embed/src/index.ts` 把 `dataGateway` 作为挂载选项透传;`packages/runtime/src/ports.ts` 的注释写明「适配器在 data-gateway,应用壳注入」;`packages/runtime*/package.json` 的 dependencies 不含 data-gateway |
| 违例判定 | `packages/runtime*` 或 `packages/widgets` 的 `package.json` 或源码出现 `@metriccanvas/data-gateway`;或运行时内出现 `/rest/...` 之类端点字面量 |

#### `PATTERN-API-3` · 错误对象只带结构化事实

| 项 | 内容 |
| --- | --- |
| 规则 | 抛给上层的错误必须带 `API-6` 封闭集里的 `code`;`message` 与 `detail` 只允许结构化事实(类型名、数量、字段名、上游返回码),**不得**包含上游响应正文、数据行、字段值、筛选值或 Secret。未带分类的异常在编排层兜底为 `UNKNOWN` |
| 依据清单 | `API-2`、`API-6`、`API-7` |
| 依据样本 | `DqeGatewayError` 构造函数注释与它的 5 类抛出点(`retDesc` 被显式排除);`DqeDiagnosticRecord` 的字段全为标量或标识列表;`COMP-12` 的 `queryErrorView` 按分类选标题而不解析字符串 |
| 违例判定 | 错误消息里出现上游响应体、行数据或筛选值;或呈现层按错误字符串做分支 |

#### `PATTERN-API-4` · 无鉴权头,靠同源 cookie

| 项 | 内容 |
| --- | --- |
| 规则 | 取数请求不带任何鉴权头,身份靠 `credentials: 'same-origin'` 的 cookie 随请求携带;自定义头只有内容类型与调用方显式传入的 `headers`。计划期据此**不要**发明 token 注入或刷新逻辑 |
| 依据清单 | `API-2` |
| 依据样本 | `createDqeGateway` 的默认 `credentials` 与两处 `fetchImpl` 调用的 headers 构造;`API-4` 的平台实现连 credentials 都没设 |
| 违例判定 | 出现 Authorization 头拼装、token 存取或刷新流程而本条未更新 |

#### `PATTERN-API-5` · 无埋点与前端错误上报出口

| 项 | 内容 |
| --- | --- |
| 规则 | 跨进程边界的上报出口只有 `API-7` 一类,且它是**查询诊断**(进程内收集,由宿主决定怎么用),不是埋点或错误上报 SDK。仓内没有把用户行为或前端异常送往外部服务的通道。检视**不得**判「漏了埋点上报」 |
| 依据清单 | `API-7`、`PATTERN-STRUCT-5` |
| 依据样本 | `createInMemoryDqeDiagnostics` 只在内存留最近 N 条并支持订阅,无出网调用;全仓无监控 SDK(见 `PATTERN-STRUCT-5` 的样本) |
| 违例判定 | 新增出网上报调用而本条未更新 |
