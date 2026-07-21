# MetricCanvas(指标画布)

以业务指标为核心的 AI 原生数据应用平台。项目背景见 `origin.md`,整体方案见 `docs/solution.md`,领域词汇表见 `CONTEXT.md`。

## 开发

```bash
pnpm install
cp apps/platform/.env.example apps/platform/.env
cp apps/canvas/.env.example apps/canvas/.env
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

## 结构(四层,依赖箭头全部指向领域层)

| 目录 | 层 | 职责 |
|---|---|---|
| `packages/page` | 领域层 | 聚合根"看板页面":DSL 类型 + 校验不变式(SCHEMA_ERROR / METRIC_GAP) |
| `packages/page-lifecycle` | 领域/基础设施 | 不可变页面修订、发布租约与 PostgreSQL adapter |
| `packages/catalog-discovery` | 应用层 | 指标/维度目录发现 |
| `packages/agent-runner` | 应用层 | 模型无关 Agent 循环、scripted fake 与 DeepSeek adapter |
| `packages/mcp` | 接口层 | MCP 工具/Prompt/Resource 及同进程 transport |
| `packages/data-gateway` | 基础设施层 | `DataGateway` 端口的适配器集:数据服务(真实)+ mock |
| `packages/runtime` | 应用层 | `PageRepository` / `DataGateway` 端口、查询编排器、筛选状态 |
| `packages/widgets` | 表现层 | 纯渲染组件集(props 进、事件出) |
| `apps/canvas` | 表现层(统一运行时) | 静态/平台 `PageRepository` adapter、路由与渲染 |
| `apps/platform` | Node 全栈平台 | 页面搭建工作台、Agent/MCP 组装、预览 API 与人工发布确认 |
| `pages/` | 领域资产 | 看板页面文档 JSON |
| `catalog/` | 领域资产 | 元数据快照(供给侧清单,语义校验的确定性参照;不放 `pages/` 是因为应用壳按 glob 把该目录所有 JSON 当页面加载) |
| `tools/data-service-sim` | 开发工具(不属四层) | 数据服务仿真:按《中间层分析.md》协议供数,种子表真执行;协议假设的可执行文档,#3 联调时核对 |
