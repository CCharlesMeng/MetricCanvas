# MetricCanvas（指标画布）

MetricCanvas 是一套以业务需求为起点的 AI 原生数据分析与可视化平台：AI 在受控的数据上下文中生成查询定义，声明式看板页面描述应用，统一运行时执行查询并渲染页面。

领域概念以 [CONTEXT.md](./CONTEXT.md) 为准。当前页面协议见 [看板页面文档说明](./PAGE-METADATA.md)，Schema 元数据规则与示例见 [数据上下文中的 Schema 元数据](./docs/schema-metadata.md)，整体架构见 [解决方案](./docs/solution.md)。

## 当前协议

领域 DSL 当前版本为 `schemaVersion: "3.0"`，一次性取代 1.0/2.0，不保留旧结构化查询兼容层。

页面支持两类页面数据源：

- `inline`：静态数据行随看板页面固化，完整声明结果字段契约，不经过数据网关；
- `query`：动态数据由统一运行时经数据网关取得，当前实现 DQE 查询定义，完整声明结果字段契约和查询字段映射。

同一页面可以同时使用两类页面数据源，形成 `mixed` 页面。DQE 是当前已实现的动态查询场景，不是平台唯一的数据形态；静态页面仍是正式支持的一等场景。

v3 已删除：

- `query.metrics`、`query.dimensions`、`aggregation` 等旧结构化查询；
- `CatalogSnapshot`、`catalog/snapshot.json` 和运行时元数据目录；
- `fieldOverrides` 和页面字段旧 `format`；
- 页面字段角色 `metric`，统一改为 `measure`；
- `METRIC_GAP`、指标目录、指标候选与指标履约流程；
- 1.0/2.0 页面运行时兼容。

历史 ADR 保留原文，并由 [ADR-0017](./docs/adr/0017-page-schema-v3-hard-cutover.md) 记录取代关系。

## 快速开始

安装依赖并启动 Canvas 与平台：

```bash
pnpm install
pnpm dev
```

常用命令：

```bash
pnpm dev:offline  # 零外部依赖：页面生命周期 + fixture gateway
pnpm dev:dqe      # DQE 仿真 + Canvas 完整 HTTP 链路
pnpm validate     # 校验 pages/ 中的 v3 看板页面
pnpm test         # 全量自动化测试
pnpm typecheck    # TypeScript 契约检查
pnpm check        # 类型与 Svelte 检查
pnpm build        # 构建嵌入产物、Canvas 与平台
```

DQE 仿真默认监听：

```text
http://127.0.0.1:18228/rest/cdi/cdinl2databuilderservice/v1/dsl/execute
```

完整说明见 [tools/dqe-sim/README.md](./tools/dqe-sim/README.md)。

## 最小静态页面

下面是一个合法的 v3 `inline` 页面：

```json
{
  "schemaVersion": "3.0",
  "id": "hello-revenue",
  "dataSources": {
    "overview": {
      "fields": {
        "revenue": {
          "type": "number",
          "role": "measure",
          "label": "成交总额",
          "unit": "元",
          "defaultFormat": "number-grouped",
          "nullable": false
        }
      },
      "source": {
        "type": "inline",
        "rows": [
          { "revenue": 128600 }
        ]
      }
    }
  },
  "sections": [
    {
      "id": "main",
      "layout": {
        "type": "grid",
        "columns": 12
      },
      "components": [
        {
          "id": "page-header",
          "type": "reportHeader",
          "layout": {
            "span": 12
          },
          "props": {
            "title": "经营概览"
          }
        },
        {
          "id": "revenue-card",
          "type": "metricCard",
          "layout": {
            "span": 4
          },
          "data": {
            "main": "overview"
          },
          "props": {
            "rows": [
              {
                "label": "成交总额",
                "valueField": {
                  "data": "main",
                  "field": "revenue",
                  "format": "number-grouped"
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

`metricCard` 是既有组件类型标识，不表示旧模型中的指标资产。页面字段角色使用 `measure`。

新增正式页面：

1. 将页面保存为 `pages/<id>.json`；
2. 保证文件名与页面 `id` 一致；
3. 运行 `pnpm validate`；
4. 在 Canvas 或 `/preview` 检查布局、数据状态和交互；
5. 提交页面及相应 fixture、测试或查询说明。

动态 DQE 页面示例见 [PAGE-METADATA.md](./PAGE-METADATA.md#dqe-query-页面数据源)。

## 核心架构

```text
创作期
业务需求
  → 数据上下文快照（Schema、字段语义、关系、约束、已验证查询）
  → NL2DQE 查询候选
  → 校验、真实执行和结果验真
  → 查询定义 + 结果字段契约
  → v3 看板页面

运行态
已发布页面修订
  → 统一运行时
  ├─ inline → 终态数据快照
  └─ query  → 筛选绑定 → 数据网关 → DQE → 显式字段归一
  → 按组件命名数据槽分发数据快照
  → 纯渲染组件
```

关键边界：

- **看板页面**是核心领域资产，声明页面数据源、筛选状态、内容分区、组件数据槽和有限交互；
- **结果字段契约**是页面与运行时之间的稳定数据边界，不从某次返回行推断；
- **查询字段映射**把稳定页面字段 id 显式映射到 DQE 响应字段，禁止同名猜测；
- **数据上下文快照**只服务创作期，不进入页面文档或运行时；
- **数据网关**只负责执行查询定义并返回标准化数据行，不感知组件；
- **纯渲染组件**只消费数据快照和展示属性，不发请求、不访问全局状态；
- **统一运行时**不执行 NL2DQE，不生成或改写查询定义。

完整流程见 [页面构建过程](./docs/dashboard-page-building-process.md) 和 [运行态架构](./docs/dashboard-runtime-architecture.md)。

## 目录

- `packages/page/`：v3 页面类型、JSON Schema、字段契约和校验器；
- `packages/runtime/`：页面数据源编排、筛选状态、能力推导和数据快照；
- `packages/data-gateway/`：DQE 执行适配器、批量传输和响应归一化；
- `packages/widgets/`：纯渲染组件；
- `packages/runtime-ui/`：统一运行时 UI 组合层；
- `packages/embed/`：可嵌入普通 HTML 的统一运行时产物；
- `packages/mcp/`：页面搭建 Prompt、Resources 和 MCP 工具；
- `apps/canvas/`：页面目录、正式渲染、预览与依赖注入；
- `apps/platform/`：页面搭建、页面修订和发布管理；
- `tools/dqe-sim/`：DQE HTTP 仿真；
- `pages/`：正式 v3 看板页面；
- `docs/adr/`：关键决策记录；
- `docs/schema-metadata.md`：创作期 Schema 元数据规则和示例。

## 页面作者与 AI

页面搭建遵循：

1. 明确业务目标、受众、分析问题、时间范围和验收标准；
2. 静态报告选择 `inline`，动态查询选择当前支持的 DQE `query`；
3. DQE 查询先检索最小数据上下文，不猜测字段或执行约束；
4. 对查询候选执行语法、安全、权限、资源和真实结果验真；
5. 页面完整声明结果字段契约及查询字段映射；
6. 组件只绑定稳定页面字段 id；
7. 通过校验后保存不可变页面修订；
8. 完成精确修订预览和人工确认发布。

数据上下文不足属于 `DATA_CONTEXT_ERROR`，应补充 Schema 元数据或缩小需求范围，不再进入指标缺口流程。

## 校验规则摘要

- 页面只接受 `schemaVersion: "3.0"`；
- 页面、分区、组件和页面数据源 id 使用小写字母、数字和连字符；
- 字段角色只允许 `dimension` 或 `measure`；
- `inline` 每行必须完整匹配字段契约；
- DQE `query.body.dsl_list` 恰好包含一个查询项；
- DQE 输出字段和公式别名必须被 `fields[].queryField` 一一覆盖；
- 同一页面数据源内 `queryField` 不得重复；
- 筛选器必须通过显式 `filterBindings` 影响查询；
- 页面禁止脚本、HTML、任意样式、JSONPath、字符串模板和页面层计算；
- 纯 `inline` 页面禁止筛选器、组件 action 和远程分页；
- `pnpm validate` 同时检查结构、引用、字段契约、能力不变式和跨页导航。

## 延伸阅读

- [领域词汇表](./CONTEXT.md)
- [看板页面文档说明](./PAGE-METADATA.md)
- [Schema 元数据规则与示例](./docs/schema-metadata.md)
- [整体解决方案](./docs/solution.md)
- [页面构建过程](./docs/dashboard-page-building-process.md)
- [运行态架构](./docs/dashboard-runtime-architecture.md)
- [Schema v3 全面迁移设计](./docs/superpowers/specs/2026-07-31-page-schema-v3-complete-migration-design.md)
- [ADR 决策记录](./docs/adr/)
