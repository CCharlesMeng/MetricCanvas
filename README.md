# MetricCanvas(指标画布)

以业务指标为核心的 AI 原生数据应用平台。项目背景见 `origin.md`,整体方案见 `docs/solution.md`,领域词汇表见 `CONTEXT.md`。

## 开发

```bash
pnpm install
pnpm dev            # 启动应用壳(SvelteKit),访问 http://localhost:5173
pnpm test           # Vitest 全量测试
pnpm check          # packages tsc --noEmit + 应用壳 svelte-check
pnpm validate       # 页面文档全量校验:结构 + 语义(对元数据快照)+ 文件名一致性 + N-1 升版警告
pnpm migrate        # 历史版本页面文档批量升至当前版本(幂等,git diff 评审)
pnpm sync-catalog --base-url <数据服务地址>   # 重新生成元数据快照(catalog/snapshot.json)
pnpm sim            # 启动数据服务仿真(localhost:18226,协议保真、种子表真执行)
VITE_DATA_GATEWAY=sim pnpm dev   # 壳走真实适配器连仿真(默认走 mock)
```

改动 `pages/*.json` 页面文档,浏览器秒级热刷新。

## 结构(四层,依赖箭头全部指向领域层)

| 目录 | 层 | 职责 |
|---|---|---|
| `packages/page` | 领域层 | 聚合根"看板页面":DSL 类型 + 校验不变式(SCHEMA_ERROR / METRIC_GAP) |
| `packages/data-gateway` | 基础设施层 | `DataGateway` 端口的适配器集:数据服务(真实)+ mock |
| `packages/runtime` | 应用层 | `PageRepository` / `DataGateway` 端口、查询编排器、筛选状态 |
| `packages/widgets` | 表现层 | 纯渲染组件集(props 进、事件出) |
| `apps/canvas` | 表现层(壳) | 路由、组装、依赖注入、索引页 |
| `pages/` | 领域资产 | 看板页面文档 JSON |
| `catalog/` | 领域资产 | 元数据快照(供给侧清单,语义校验的确定性参照;不放 `pages/` 是因为应用壳按 glob 把该目录所有 JSON 当页面加载) |
| `tools/data-service-sim` | 开发工具(不属四层) | 数据服务仿真:按《中间层分析.md》协议供数,种子表真执行;协议假设的可执行文档,#3 联调时核对 |
