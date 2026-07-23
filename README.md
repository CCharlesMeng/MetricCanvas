# MetricCanvas（指标画布）

MetricCanvas 是数据服务之上的治理化消费层：以业务指标为核心，用声明式的**看板页面**描述数据应用，由**统一运行时**校验、取数并渲染。页面文档适合由开发者编写或由 AI 生成，能够进入 Git 做 diff、评审和审计，而不是让 AI 直接生成不可控的生产页面代码。

领域概念以 [CONTEXT.md](./CONTEXT.md) 为准。当前统一运行时直接消费的协议见 [看板页面元数据描述](./PAGE-METADATA.md)，文档按“静态页面 → 动态页面 → 有交互关联的动态页面”三个维度给出可渲染示例。完整方案与设计取舍分别见 [docs/solution.md](./docs/solution.md) 和 [docs/adr/](./docs/adr/)。

## 当前能力与边界

当前仓库包含统一运行时地基和二期最小页面搭建闭环：

- `schemaVersion: "1.0"` 的领域 DSL，以及结构、引用、能力、元数据语义和跨页导航校验。
- Git 中的页面文档、静态页面仓储和 Canvas 页面目录。
- `inline`、`query`、`mixed` 三种页面数据形态。
- 统一运行时的数据源编排、数据快照、筛选状态、URL 状态恢复、页内联动、跨页下钻、表格远程分页/排序/表头筛选。
- 封闭的纯渲染组件集：报告头、指标卡、柱状图、折线图、饼图、表格、地图、排行卡和文本；另有维度与时间范围筛选器。
- 数据网关的默认 mock 适配器、数据服务适配器，以及本地数据服务仿真。
- SvelteKit 静态 SPA、正式页面路由和 Page JSON 即时预览。
- 页面搭建工作台、模型无关 Agent 循环、MCP 页面工具、不可变页面修订、发布租约与人工发布确认。
- 页面模板、不可变模板修订、人工模板发布确认与 `search_templates`；模板修订只引用精确的已发布页面修订。
- 页面修订结构化编辑器：组件选择、标题/说明、网格跨度与顺序、撤销/重做，以及校验后保存新页面修订。

仓库文件仍是可评审的页面资产，平台通过 PostgreSQL 保存不可变页面修订并向统一运行时提供已发布版本。当前工作台是最小 AI 搭建闭环，并提供受约束的结构化人工编辑，但仍不是通用拖拽式可视化搭建器，也不包含 A2UI 第二渲染通道。真实数据服务鉴权、SSO 和部署由接入环境提供；仓库内的仿真头仅用于本地开发，不能当作生产配置。

## 快速开始

先准备 Node.js 和 pnpm，然后在仓库根目录执行：

```bash
pnpm install
cp apps/platform/.env.example apps/platform/.env
cp apps/canvas/.env.example apps/canvas/.env
pnpm dev:offline     # 零外部依赖:进程内页面生命周期 + 仓库元数据 + mock 数据网关
pnpm db:up          # 启动 PostgreSQL
pnpm sim            # 启动数据服务仿真(localhost:18226)
pnpm dev            # 统一运行时 localhost:5173 + 页面搭建工作台 localhost:5174
pnpm test           # Vitest 全量测试
pnpm check          # packages tsc --noEmit + 应用壳 svelte-check
pnpm validate       # 页面文档全量校验:结构 + 语义(对元数据快照)+ 文件名一致性 + N-1 升版警告
pnpm migrate        # 历史版本页面文档批量升至当前版本(幂等,git diff 评审)
pnpm sync-catalog --base-url <数据服务地址>   # 重新生成元数据快照(catalog/snapshot.json)
```

页面搭建工作台默认使用确定性的 scripted fake。手工 DeepSeek 验收时,只在本地
`apps/platform/.env` 把 `AGENT_MODEL_PROVIDER` 改为 `deepseek` 并填写
`DEEPSEEK_API_KEY`;Key 不进入浏览器、仓库、数据库或日志。

### 零外部依赖启动

新电脑只安装 Node.js、pnpm 并执行 `pnpm install` 后，可以直接运行：

```bash
pnpm dev:offline
```

该指令使用 Node 子进程注入环境变量，可直接在 macOS、Linux、Windows PowerShell 和 `cmd.exe` 中运行。

该命令同时启动统一运行时和页面搭建工作台，但不连接 PostgreSQL 或数据服务仿真：

- 页面修订、发布租约与审计使用进程内页面生命周期；服务重启后清空，不作为持久化存储。
- 启动时自动导入并发布仓库内的 `pages/*.json`，统一运行时首页会直接列出这些看板页面。
- 启动时自动发布 `templates/*.json` 声明的页面模板；模板种子只写来源页面 id，不复制页面文档。
- 元数据目录读取仓库内 `catalog/snapshot.json`。
- 统一运行时的结构化查询使用 mock 数据网关。
- AI 对话继续使用默认的确定性 scripted fake，不需要模型 Key。

需要验证持久化、并发治理或真实数据服务 HTTP 协议时，仍使用 `pnpm db:up`、`pnpm sim` 和 `pnpm dev`。

### 使用页面模板

页面模板管理入口是 `http://localhost:5174/manage/templates`。模板管理员从一个已发布页面修订创建模板修订，维护名称、说明、标签和模板 ACL，再通过独立确认页发布。

在页面搭建工作台中描述“使用销售经营概览模板创建新的区域经营页面”，Agent 会调用 `search_templates`，以选定模板引用的精确页面修订形成新的未保存工作副本，并按当前元数据重新校验。来源看板页面后续变化不会改变已经发布的模板修订。

Canvas 默认使用 mock 数据网关，不依赖本地或远程数据服务。统一运行时默认地址为 `http://localhost:5173`：

- `/`：看板目录。
- `/pages/demo`：query 页面与筛选、下钻演示。
- `/pages/tokens-report`：纯 inline 固定报告。
- `/pages/<page-id>`：打开 `pages/<page-id>.json`。
- `/preview`：Page JSON 即时预览。

修改 `pages/*.json` 后，开发服务器会通过 Vite 重新加载页面。

### 使用 `/preview`

打开 `http://localhost:5173/preview`。左侧粘贴或编辑完整页面文档，右侧会复用正式页面的校验、数据编排和组件渲染路径：

1. JSON 语法或契约不合法时，左侧显示带 JSON Pointer 的错误。
2. 校验通过后，右侧自动渲染。
3. “恢复示例”可还原内置 inline 示例。
4. 预览只存在于浏览器内，不会写入 `pages/`；确认后需手动保存为页面文件。

### 连接数据服务仿真

数据服务仿真不是 mock：mock 直接实现数据网关端口；仿真则让真实数据服务适配器经过 HTTP 协议、请求信封、方言翻译和响应归一化。

在两个终端分别运行：

```bash
# 终端 1：启动数据服务仿真，默认监听 http://localhost:18226
pnpm sim
```

```bash
# 终端 2：让 Canvas 通过真实适配器连接仿真
pnpm dev:sim
```

如需改地址：

```bash
pnpm dev:sim -- --data-service-url http://localhost:18226
```

inline 数据不经过数据网关；因此无论选择 mock 还是仿真，纯 inline 页面都会使用文档中固化的数据行。

## 核心架构与数据流

```text
pages/*.json
  │ 看板页面：schemaVersion / dataSources / filters / sections
  ▼
packages/page
  │ 领域 DSL + 结构/引用/能力/元数据语义校验
  ▼
packages/runtime
  │ PageRepository 加载 → 筛选状态 → inline/query/mixed 编排
  │ query：结构化查询 × 筛选状态 × 组件局部视图 = 生效查询
  ▼
DataGateway 端口 ── mock 适配器
  │
  └────────────── 数据服务适配器 ── 数据服务 / 数据服务仿真
  │
  ▼
按组件命名数据槽分发数据快照（loading / ready / empty / error）
  ▼
packages/widgets 纯渲染组件（props 进、事件出）
  ▼
apps/canvas：路由、依赖注入、页面目录、正式渲染与 /preview
```

各层边界：

- **看板页面 / `packages/page`**：核心领域资产。`schemaVersion` 标识协议；`dataSources` 声明命名页面数据源；每个数据源由 `fields` 输出契约和 `source` 组成；内容位于 `sections[].components`。
- **页面数据源**：`source.type: "inline"` 携带固定 `rows`；`source.type: "query"` 携带结构化查询。查询和数据行只出现在页面数据源，不进入组件。
- **组件数据槽**：组件用 `data` 把 `main`、`compare`、`target` 等命名槽绑定到页面数据源；字段字符串简写引用 `main`，多源字段可显式写 `{ "data": "target", "field": "value" }`。
- **组件 props**：只描述展示和有限 action。组件不发请求、不访问全局状态，也不管理加载、错误和空态。
- **统一运行时**：直接消费看板页面，校验后生成数据快照；query 数据源经数据网关取数，inline 数据源同步生成终态快照。
- **数据网关**：只接收生效查询并返回标准化数据行，不感知页面和组件。数据服务是一期唯一真实数据入口。
- **Canvas**：SvelteKit 应用壳，组装静态页面仓储、元数据快照、数据网关、统一运行时和纯渲染组件。

### inline、query 与 mixed

- **inline**：所有页面数据源都携带 `rows`。页面是静态页面，数据随文档固化，不自动刷新；禁止声明页面筛选器、组件 actions 和远程分页，适合固定时点报告、离线交付和视觉验收。
- **query**：页面数据源携带结构化查询。统一运行时把它与订阅的筛选状态、表格局部视图合成生效查询，再经数据网关取数；可具备实时取数、筛选联动、action 和远程分页能力。
- **mixed**：同一页面同时存在 inline 和 query 数据源。页面整体不是静态页面，但能力按组件实际绑定的数据源推导：只绑定 inline 的组件仍是静态的，不会因为页面上另有 query 数据源而获得筛选、action 或远程分页能力。

字段契约与组件绑定不依赖来源类型，因此同一页面数据源可在 inline 与 query 之间切换而不修改组件。

## 最小可渲染页面

下面是一个简短、合法的 inline 页面：

```json
{
  "schemaVersion": "1.0",
  "id": "hello-metric",
  "dataSources": {
    "overview": {
      "fields": {
        "value": {
          "type": "number",
          "role": "metric",
          "label": "成交总额",
          "format": "number-grouped"
        }
      },
      "source": {
        "type": "inline",
        "rows": [{ "value": 128600 }]
      }
    }
  },
  "sections": [
    {
      "id": "main",
      "layout": { "type": "grid", "columns": 12 },
      "components": [
        {
          "id": "page-header",
          "type": "reportHeader",
          "layout": { "span": 12 },
          "props": { "title": "经营概览" }
        },
        {
          "id": "total-card",
          "type": "metricCard",
          "layout": { "span": 4 },
          "data": { "main": "overview" },
          "props": {
            "rows": [{ "label": "成交总额", "valueField": "value" }]
          }
        }
      ]
    }
  ]
}
```

新增正式页面：

1. 将文档保存为 `pages/hello-metric.json`。文件名必须与页面 `id` 一致。
2. 运行 `pnpm validate`。
3. 保持 `pnpm dev` 运行，访问 `http://localhost:5173/pages/hello-metric`。
4. 检查页面目录、目标路由、数据状态、布局和交互，再提交页面文档及必要的测试。

可以从 `/preview` 内置示例开始，也可以参考：

- `pages/tokens-report.json`：inline 固定报告。
- `pages/demo.json`：query、筛选状态、页内联动与跨页下钻。
- `pages/sales-detail.json`：从 URL 恢复筛选状态。
- `pages/region-map.json`：地图页面。

## 不同角色如何工作

### 页面作者 / AI

- **输入**：业务需求、指标与维度 code、`catalog/snapshot.json`、现有页面和领域 DSL 约束。
- **工作流**：选择 inline/query/mixed → 声明 `fields` 与 `source` → 在 `sections` 中组合组件和数据槽 → 用 `/preview` 快速修正 → 保存到 `pages/` → `pnpm validate`。
- **启动**：通常使用默认 mock 的 `pnpm dev`；检查真实协议时改用仿真模式。
- **验收**：文档可校验、文件名与 id 一致、指标口径来自数据服务、页面可渲染；query 页的筛选、URL 恢复和 action 符合预期，inline 页没有假交互。

### 数据服务 / 数据工程

- **输入**：指标需求、数据服务中的指标/维度/聚合能力，以及 `METRIC_GAP`。
- **工作流**：在数据服务治理指标口径；联调真实查询；需要更新供给侧清单时同步元数据快照并评审 diff：

```bash
pnpm sync-catalog --base-url <数据服务地址>
```

- **启动**：本地协议验证运行 `pnpm sim`，另一个终端运行 `pnpm dev:sim`。
- **验收**：元数据 code 与可用维度/聚合准确；请求信封、鉴权、方言和返回行可由数据服务适配器正确处理；真实服务与仿真的差异回写仿真实现，而不是绕过数据网关。

### 组件 / 前端开发

- **输入**：`packages/page` 中的组件 props 与数据槽契约、统一运行时提供的数据快照、交互事件要求。
- **工作流**：在 `packages/widgets` 实现纯渲染组件，在 Canvas 中完成组件类型映射，并补充组件与运行时测试。
- **启动**：`pnpm dev` 做视觉和交互调试；用 `pnpm test`、`pnpm check` 验证。
- **验收**：组件只消费解析后的数据与字段契约，只上抛事件；没有网络请求、全局筛选状态或加载态编排；inline/query 使用同一组件实现。

### 应用集成者

- **输入**：页面资产、数据网关模式、真实数据服务地址与鉴权头、宿主路由/SSO/部署要求。
- **工作流**：在 `apps/canvas/src/lib/services.ts` 的依赖注入点接入环境配置；确保 SPA fallback 能承接 `/pages/<id>`；构建静态站点。
- **启动与构建预览**：

```bash
pnpm build
pnpm --filter canvas preview
```

- **验收**：首页和深链接可访问，静态产物位于 `apps/canvas/build/`，真实凭据不进入页面文档或仓库，所有业务取数仍通过数据网关。

### 评审 / 测试人员

- **输入**：页面文档与代码 diff、需求验收点、校验输出。
- **工作流**：先评审页面 id、字段契约、指标/维度引用和交互，再运行质量命令；对页面用默认 mock 做确定性验收，必要时用仿真检查协议链路。
- **验收**：`SCHEMA_ERROR` 必须修正文档；`METRIC_GAP` 表示数据服务尚未供给所需指标，应进入指标缺口流程，不应伪造页面计算绕过。

## 目录与关键入口

- `packages/page/`：看板页面领域 DSL、JSON Schema、版本策略、能力推导和校验器；`src/page.ts`、`src/schema.ts`、`src/validate.ts` 是主要入口。
- `packages/page-lifecycle/`：不可变页面修订、发布租约与 PostgreSQL adapter。
- `packages/template-library/`：页面模板、模板修订、模板 ACL、发布确认与内存/PostgreSQL adapters。
- `packages/catalog-discovery/`：供 Agent 使用的指标与维度目录发现。
- `packages/agent-runner/`：模型无关 Agent 循环、scripted fake 与 DeepSeek adapter。
- `packages/mcp/`：页面工具、Prompt、Resource 与同进程 transport。
- `packages/runtime/`：`PageRepository` / `DataGateway` 端口、筛选状态、导航和数据源编排；核心入口是 `src/orchestrator.ts`。
- `packages/data-gateway/`：mock 与数据服务适配器、查询翻译、元数据同步；真实适配器入口是 `src/data-service.ts`。
- `packages/widgets/`：纯渲染组件、字段解析、值格式化和表格视图逻辑；公共导出在 `src/index.ts`。
- `apps/canvas/`：SvelteKit 统一运行时；组装静态/平台 `PageRepository` adapter、数据网关、正式页面和即时预览。
- `apps/platform/`：Node 全栈页面搭建工作台；组装 Agent/MCP、预览 API、页面修订与人工发布确认。
- `pages/`：正式看板页面文档。Canvas 只从这里建立页面目录。
- `templates/`：离线页面模板种子，只声明发现元数据、模板 ACL 和来源页面 id。
- `catalog/snapshot.json`：入库的元数据快照，是 query 页面语义校验的确定性参照，不含业务数据行。
- `tools/data-service-sim/`：数据服务仿真和种子表，用于真实 HTTP 适配链路的本地联调。

## 校验、测试与构建

```bash
pnpm validate   # 校验 pages/：结构、引用、能力、元数据语义、文件名和跨页导航
pnpm test       # 运行 apps、packages、tools 下的 Vitest 测试
pnpm check      # packages/tools TypeScript 检查 + Canvas/Platform svelte-check
pnpm build      # 构建 Canvas 与 Platform
```

其他仓库脚本：

```bash
pnpm migrate    # 按版本策略迁移历史页面文档；执行后评审 git diff
pnpm sync-catalog --base-url <数据服务地址> [--out <输出路径>]
pnpm sim
```

当前协议的重要约束：

- 当前只支持 `schemaVersion: "1.0"`。顶层只允许 `schemaVersion`、`id`、`meta`、`dataSources`、`filters`、`sections`。
- 页面、分区、组件和数据源 id 使用小写字母、数字和连字符；页面文件名必须等于页面 id。
- 页面数据源必须声明至少一个字段；字段有封闭的 `type`、`role` 和 `format` 预设。inline 每行必须完整匹配字段契约，不能多字段或少字段。
- query 至少声明一个指标；`fields` 必须与 query 的指标/维度输出一致。指标、维度和聚合能力由 `catalog/snapshot.json` 校验。
- 分区固定为 12 列自动流网格，组件 `layout.span` 为 1–12。
- 组件类型与 props 是封闭协议；页面禁止表达式、脚本、HTML、自定义样式和绕过数据网关的远程请求。衍生指标和计算逻辑属于数据服务。
- 纯 inline 页面禁止筛选器、actions 和远程分页；actions 只允许绑定 query 数据源的组件。
- 筛选联动只通过页面级筛选状态；跨页下钻通过 URL 携带筛选条件。`pnpm validate` 会检查目标页面和筛选器引用。
- 校验错误分为 `SCHEMA_ERROR`（页面文档错误）和 `METRIC_GAP`（需求与数据服务供给的缺口）。

## 延伸阅读

- [CONTEXT.md](./CONTEXT.md)：领域词汇表，术语唯一来源。
- [PAGE-METADATA.md](./PAGE-METADATA.md)：当前看板页面协议及静态、动态、交互关联动态三个递进维度。
- [docs/solution.md](./docs/solution.md)：整体架构、职责边界和演进路线。
- [docs/adr/](./docs/adr/)：关键决策；数据源协议重点见 [ADR-0008](./docs/adr/0008-page-data-sources.md)。
