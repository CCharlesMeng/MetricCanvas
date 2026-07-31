# DQE Sim

DQE Sim 是独立的本地 DQE 执行仿真，使用真实 HTTP 接口验证浏览器、数据网关、
批量请求、响应归一化与页面渲染的完整链路。

完整联调：

```bash
pnpm dev:dqe
```

命令先监听 `127.0.0.1:18228`，再启动 Canvas，并把
`VITE_DQE_ENDPOINT` 注入为：

```text
http://127.0.0.1:18228/rest/cdi/cdinl2databuilderservice/v1/dsl/execute
```

页面地址：

```text
http://127.0.0.1:5173/pages/customer-activity-risk-briefing
```

只启动接口服务：

```bash
pnpm sim:dqe
```

可通过 `DQE_SIM_PORT` 修改端口。服务还提供 `GET /__health`。

直接调用：

```bash
curl 'http://127.0.0.1:18228/rest/cdi/cdinl2databuilderservice/v1/dsl/execute' \
  -H 'content-type: application/json' \
  --data-binary '{
    "dsl_list": [{
      "output_metrics": ["NA客户数"],
      "output_dims": ["客户级别"],
      "filter": {
        "time": {
          "period": "month",
          "is_aggregate": true,
          "start": "2026-07",
          "end": "2026-07"
        },
        "dims": [
          {"dim_name": "地区部", "dim_value_list": ["中国地区部"]},
          {"dim_name": "客户级别", "dim_value_list": ["卓越NA", "战略NA", "核心NA"]}
        ],
        "metrics": []
      },
      "order": {}
    }]
  }'
```

场景数据位于：

- `fixtures/customer-activity-risk.json`：NA 客户概况 15/12/9。
- `fixtures/customer-activity-risk-top100.json`：TOP100 项目客户概况 12/36/39。
- `fixtures/sales-analytics.json`：销售概览、趋势、区域、渠道、地图和明细页面。

两条逻辑查询会被数据网关放进同一个 HTTP 请求的 `dsl_list`，DQE Sim 保持
查询项与 `results` 对位。不匹配场景的查询项返回
`DQE_SIM_UNSUPPORTED_QUERY`，不会自动生成看似成功的数据。
