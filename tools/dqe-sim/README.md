# DQE Sim

## 伙伴健康度 HTTP Mock

启动 `pnpm dev:dqe` 后访问 `/pages/partner-health-union-null-probe?state=zeroTotal`。
页面通过标准 execute HTTP 路径请求，附带开发场景选择器 `fixture=partner-health` 和 `state`。
服务端读取 `apps/playground/fixtures/organization-union/mock.json`，按页面中的查询签名返回独立原始行；未知查询拒绝执行。
1、10、13条返回由浏览器运行时合并为15个组织，覆盖null、真实0、缺项和零总数。
普通请求不携带选择器，继续使用原有DQE Sim路由。场景是HTTP链路验收，不代表内网真实DQE验收。
完整状态及操作见 `pages/temporary/partner-health-union-null-probe/README.md`。

## 商务驳回明细的原始元数据模拟验收

`/pages/business-rejection-details` 使用用户原始object元数据，通过标准HTTP网关运行。专用合成分支仅认领 `Business/Commercial Review Rejection Details` 和输出“商务ID、责任人名称、商务状态”的基本信息查询；不修改生产接口或写入initial。

合成表包含2026年9月1205条、10月8条审批，同一商务通常有初审与复审两条记录；补表提供“模拟”责任人及进行中/已关闭/已取消状态。`SIM-00000` 故意缺失补表匹配，仍保留两条审批并将补列置空。区域代码复用既有候选闭集，所有业务事实均为模拟。

运行 `pnpm dev:dqe` 后打开页面。默认每页10条、共1205条；下一页序号11—20。搜索 `SIM-BIZ-00001` 得两条审批，责任人为模拟李四、生命状态已关闭。生命状态筛选已关闭得402条，再叠加复审得201条；地区部选择华北得302条；期间改为10月得8条，11月为空。导出应覆盖全部匹配行：默认1205条，已关闭402条，均为11列，保留审批记录及补列。

代码验收由 `packages/engine/runtime-ui/tests/business-rejection-sim.test.ts` 从实际页面通过临时HTTP服务、正式编码器和Excel导出器执行。模拟验证不证明真实DQE字段、权限、计数或跨批稳定顺序。

DQE Sim 是独立的本地 DQE 执行仿真，使用真实 HTTP 接口验证浏览器、数据网关、
批量请求、响应归一化与页面渲染的完整链路。

完整联调：

```bash
pnpm dev:dqe
```

命令先监听 `0.0.0.0:18228`，再启动监听 `0.0.0.0:5173` 的页面试验场。
其他人可通过 `http://<启动机器IP>:5173` 访问。页面试验场通过共享运行配置模块使用同源 DQE 端点：

```text
/rest/cdi/cdinl2databuilderservice/v1/dsl/execute
```

Report AI 总结使用 [独立云宝助手实现](../../packages/engine/runtime-ui/src/ai-summary/adapters/yunbao-assistant.ts) 中的本地 mock，输出完整 HTML 或纯文字；内网通过替换 generate 函数体构建并消费真实 SSE。示例入口 `/pages/report-ai-summary`。

页面地址：

```text
http://127.0.0.1:5173/pages/customer-activity-risk-briefing
```

只启动接口服务：

```bash
pnpm sim:dqe
```

可通过 `DQE_SIM_PORT` 修改服务端口；`pnpm dev:dqe` 启动的页面试验场自动继承端口。
单独启动 Platform 或页面试验场时，也设置同一个 `DQE_SIM_PORT`，浏览器中的相对路径保持不变。
如需只允许本机访问 DQE Sim，可设置 `DQE_SIM_HOST=127.0.0.1`。
服务还提供 `GET /__health`，可通过 `http://<启动机器IP>:18228/__health` 检查。

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

商务 SDT 的 Top5 与阶段明细场景使用 `pages/business/report/sdt/business-sdt-cascade-example.json`，
仅支持夹具中的 2026 年 9、10 月，月份可写成 `2026-09` 或 `202609`。
非法月份、未知月份及不匹配的商务编号仍拒绝。本场景不覆盖业务月报全部查询，
也不代表真实 DQE 或业务数据验收。

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
  指标条目、字段与取值域由 `src/semantic-surface-metadata.ts` 从同一份声明
  投影，同面守卫测试（`tests/semantic-surface-guard.test.ts`）保证二者一致。
  自 Schema 元数据 `1.1`（ADR-0044）起指标投影为业务域级指标条目，
  可加性与时间聚合方式是结构化字段，不再拼进 `description`。
- 存量正式页面依赖的精确匹配分支保持原样，语义面只在它们全部落空
  之后生效。
