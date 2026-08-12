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

同时把 `VITE_AI_SUMMARY_ENDPOINT` 注入为：

```text
http://127.0.0.1:18228/api/ai/conversations/
```

该开发端点按字符、按时间间隔返回 SSE，用于本地验收 AI Summary
的请求组装、流式状态与页面渲染。

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

## 组合式语义面

在全部精确匹配分支之后，`executeDqeItem` 有一个组合式语义面兜底分支，
面向自由生成的查询（问数 / NL2DQE）。语义面声明两个业务域
（`运营分析`、`客户经营`）的中文指标名（带可加性与时间聚合方式）、
维度名、维度取值域和支持的时间粒度，唯一真源是
`src/semantic-surface.ts`：

- 任意合法组合按维度分组、按指标确定性合成数值。数值种子取自
  「业务域 + 指标 + 维度坐标 + 时间桶」的稳定哈希，不用随机数与系统
  时间，同一查询体多次执行逐字节一致，且分组求和与总计保持一致。
- 面外组合（未知名称、跨域组合、取值域外取值、不支持的时间粒度）
  仍返回 `DQE_SIM_UNSUPPORTED_QUERY`，不编造行。
- 两个业务域各有一个口径不同的「客户数」（在用调用口径 / 期末在册
  口径），仅凭指标名无法唯一路由时拒答并列出候选域，供消歧使用。
- `docs/examples/schema-metadata.example.json` 中两个业务域 schema 的
  字段与取值域由 `src/semantic-surface-metadata.ts` 从同一份声明投影，
  同面守卫测试（`tests/semantic-surface-guard.test.ts`）保证二者一致。
- 存量正式页面依赖的精确匹配分支保持原样，语义面只在它们全部落空
  之后生效。
