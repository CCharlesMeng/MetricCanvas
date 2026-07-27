# DP 仿真

DP 仿真用于公司网络不可达时验证指标发现与发布状态查询。它只模拟已经确认的最小事实:

- DP 的核心对象是指标,不模拟需求、任务或开发流程。
- 指标创建后立即有稳定 `id`。
- 指标状态只包含 `draft` 与 `published`。
- 发布时返回最终指标 `code` 和目标数据服务目录。
- 不提供负责人、预计时间、阻塞原因或通知推送。

启动:

```bash
pnpm sim:dp
```

默认地址为 `http://localhost:18227`,可通过 `DP_SIM_PORT` 修改。

## MetricCanvas 使用的查询契约

### 查询候选

`POST /v1/metric-candidates/search`

```json
{
  "query": "tokens消耗",
  "requiredDimensions": ["office", "model"],
  "requiredAggregations": ["day", "month"],
  "statuses": ["draft", "published"]
}
```

接口返回全部名称、code 或定义匹配的指标,并分别列出缺失维度与聚合。调用方必须交给需求提出方确认,不能自动选择最高匹配项。

### 查询指标状态

`GET /v1/metrics/{id}`

创建与发布期间使用同一个稳定 `id`。只有状态为 `published` 且数据服务目录能够发现最终 `code` 时,MetricCanvas 才能将对应原子指标需求标记为已履约。

## 仅供测试人员使用的管理入口

- `POST /__admin/metrics`:模拟数据开发在 DP 创建指标。
- `POST /__admin/metrics/{id}/publish`:模拟发布指标。

管理入口不是 MetricCanvas 的生产集成契约。仿真使用进程内存,重启后恢复种子指标。
