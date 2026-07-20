# MetricCanvas(指标画布)

以业务指标为核心的 AI 原生数据应用平台。项目背景见 `origin.md`,整体方案见 `docs/solution.md`,领域词汇表见 `CONTEXT.md`。

## 开发

```bash
pnpm install
pnpm dev     # 启动应用壳(SvelteKit),访问 http://localhost:5173
pnpm test    # Vitest 全量测试
pnpm check   # packages tsc --noEmit + 应用壳 svelte-check
```

改动 `specs/*.json` 页面规格,浏览器秒级热刷新。

## 结构(四层,依赖箭头全部指向领域层)

| 目录 | 层 | 职责 |
|---|---|---|
| `packages/page` | 领域层 | 聚合根"看板页面":DSL 类型 + 校验不变式(SCHEMA_ERROR / METRIC_GAP) |
| `packages/data-gateway` | 基础设施层 | `DataGateway` 端口的适配器集:数据服务(真实)+ mock |
| `packages/runtime` | 应用层 | `SpecProvider` / `DataGateway` 端口、查询编排器、筛选状态 |
| `packages/widgets` | 表现层 | 纯渲染组件集(props 进、事件出) |
| `apps/canvas` | 表现层(壳) | 路由、组装、依赖注入、索引页 |
| `specs/` | 领域资产 | 页面规格 JSON + 元数据快照 |
