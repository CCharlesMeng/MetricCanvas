# MetricCanvas（指标画布）

MetricCanvas 是以看板页面为核心资产的 AI 原生数据分析与可视化平台。页面使用领域 DSL 声明数据源、筛选状态、内容分区、组件和交互，统一运行时负责查询执行、状态管理与渲染。

## 核心模型

```text
页面创作
业务需求
  → 数据上下文
  → DQE 查询定义或 inline 静态数据
  → 看板页面
  → 校验与预览
  → 页面修订
  → 人工确认发布

页面运行
发布修订
  → 统一运行时
  ├─ inline → 数据快照
  └─ query  → 数据网关 → DQE → 数据快照
  ├─ 数据快照 → 组件数据槽 → 纯渲染组件
  └─ 数据快照 → AI 总结组件 → AI 总结快照 → 纯渲染 View
```

页面协议版本为 `4.0`。页面顶层结构为：

```json
{
  "schemaVersion": "4.0",
  "id": "page-id",
  "meta": {},
  "dataSources": {},
  "filters": [],
  "sections": []
}
```

## 数据模式

| 模式 | 说明 |
|---|---|
| `inline` | 静态数据行保存在页面文档中 |
| `query` | 统一运行时通过数据网关执行 DQE 查询 |
| `mixed` | 同一页面包含静态数据源和查询数据源 |

两类页面数据源都声明完整结果字段契约。查询数据源使用 `queryField` 把稳定页面字段映射到 DQE 输出字段。

## 快速开始

安装依赖：

```bash
pnpm install
```

启动 Canvas、Platform 与 DQE Sim：

```bash
pnpm dev
```

启动离线开发环境：

```bash
pnpm dev:offline
```

仅启动 DQE Sim 与 Canvas（静态页面联调）：

```bash
pnpm dev:dqe
```

默认地址：

| 服务 | 地址 |
|---|---|
| Canvas | `http://127.0.0.1:5173` |
| Platform | `http://127.0.0.1:5174` |
| DQE Sim | `http://127.0.0.1:18228/rest/cdi/cdinl2databuilderservice/v1/dsl/execute` |

## 常用命令

```bash
pnpm validate     # 校验 pages/*.json
pnpm test         # 自动化测试
pnpm check        # 各包 TypeScript 与 Svelte 检查(pnpm -r check)
pnpm build        # 构建 Embed、Canvas 和 Platform
pnpm test:embed   # 嵌入运行时浏览器测试
```

## 最小静态页面

```json
{
  "schemaVersion": "4.0",
  "id": "hello-revenue",
  "dataSources": {
    "overview": {
      "fields": {
        "revenue": {
          "type": "number",
          "role": "measure",
          "label": "成交总额",
          "unit": "元",
          "nullable": false,
          "defaultFormat": "number-grouped"
        }
      },
      "source": {
        "type": "inline",
        "rows": [
          {
            "revenue": 128600
          }
        ]
      }
    }
  },
  "sections": [
    {
      "id": "overview",
      "layout": {
        "type": "grid",
        "columns": 12
      },
      "components": [
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
                "valueField": "revenue"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

完整页面协议见 [PAGE-METADATA.md](./PAGE-METADATA.md)。

## 仓库结构

| 路径 | 职责 |
|---|---|
| `packages/page/` | 页面类型、JSON Schema、校验器和能力推导 |
| `packages/data-gateway/` | DQE 数据网关 |
| `packages/runtime/` | 页面数据编排和筛选状态 |
| `packages/widgets/` | 纯渲染组件 |
| `packages/runtime-ui/` | 统一运行时 UI |
| `packages/runtime-ui/src/ai-summary/` | AI 总结垂直组件 Module 与私有 SSE Adapter |
| `packages/embed/` | 浏览器嵌入产物 |
| `packages/page-lifecycle/` | 页面修订与发布 |
| `packages/template-library/` | 页面模板 |
| `packages/mcp/` | 页面搭建 MCP、数据上下文类型与检索 |
| `apps/canvas/` | 页面目录、渲染和预览 |
| `apps/platform/` | 页面搭建与管理 |
| `tools/dqe-sim/` | DQE HTTP 仿真 |
| `pages/` | 看板页面 |

## 文档入口

| 文档 | 内容 |
|---|---|
| [产品目标与边界](./origin.md) | 产品定位、能力和非目标 |
| [领域词汇表](./CONTEXT.md) | 当前领域术语 |
| [看板页面协议](./PAGE-METADATA.md) | `dataSources`、`filters`、`sections` 及组件规则 |
| [数据上下文 Schema 元数据](./docs/schema-metadata.md) | 创作期 Schema 元数据规则 |
| [整体解决方案](./docs/solution.md) | 当前架构和模块职责 |
| [页面构建流程](./docs/dashboard-page-building-process.md) | 从需求到发布的业务工作流 |
| [运行态架构](./docs/dashboard-runtime-architecture.md) | 页面加载、查询和渲染 |
| [嵌入运行时](./packages/embed/README.md) | 浏览器接入契约 |
| [架构决策记录](./docs/adr/README.md) | 24 份 ADR 按主题聚合的当前生效结论(基线);原始决策记录见 `docs/adr/000N-*.md` |
