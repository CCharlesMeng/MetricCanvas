# IOC 看板接真数据：七个缺口的收口计划

目标一句话：**让 IOC 四张页面的筛选器拉完之后数字真的换。** 引擎侧的筛选、级联、层级、URL 往返早就实做并跑通，缺的是页面自己接的是静态 inline 数据，以及协议上几处真空白。

ADR-0084 已经补上层级维度在查询侧的绑定形状（6.7 新增分支 / 6.8 收紧），`ioc-opportunity-list` 已接真数据。本计划收掉其余七个缺口。

## 执行顺序与依赖

```
P0 级联 constraints ──────────────┐
P1 三类筛选器的绑定目标 ───────────┼──→ P3 三张页面转 query
P2 查询分页与排序共存 ─────────────┘
P4 页内详情动作（独立）
P5 隔离基线验证（独立，随时可跑）
P6 存量失败（独立）
```

P3 放在最后，因为概览页有 2 个 timePoint 和 1 个 boolean 筛选器，没有 P1 就只能转一半。

---

## P0 · 级联约束下推到上游

**现状。** `packages/engine/data-gateway/src/dqe.ts:465` 的 `fetchDimensionValues(dimension, options)` 只透传 `options?.signal`，`DimensionValuesRequest.constraints` 被整个丢掉；`dimensionValuesDqeItem` 固定发 `filter.dims: []`。于是级联的「清空下游 + 重拉候选」通了，「按上游当前值收窄」在空转——拉回来的仍是全量候选值。

**改动。** `dimensionValuesDqeItem(dimension, constraints)` 把上游当前值编成 `filter.dims`；`createDqeGateway` 透传 `options?.constraints`。批处理合并的缓存键要把约束算进去，否则不同约束会互相串。

**验证。** data-gateway 单测断言请求体带上约束；dqe-sim 的候选值分支接受约束并收窄（它现在硬要求 `filter.dims=[]`）；`ioc-opportunity-list` 的 `industry-l1 → industry-l2` 是仓内唯一一处 `dependsOn`，拿它做端到端证据。

## P1 · timePoint / boolean / numberRange 的绑定目标

**现状。** `filterBindings` 只认 `dimension` 和 `time`，而 `time` 被 `validate.ts` 硬限定必须对应 **timeRange** 筛选器。于是 `mtime`(timePoint)、`key-office`(boolean)、`bidding-amount`(numberRange) 协议上无处可绑。`mtime`（数据月份）四张页面都有，是业务上最重要的筛选之一。

**要定的事。** 三类各自的谓词形状：timePoint 是时间等值（`filter.time` 的 start=end），boolean 是「勾选才加条件」的单值维度谓词，numberRange 落在 `filter.metrics` 上并带比较算子。boolean 尤其要想清楚「未勾选」与「勾选为假」的区别——筛选状态里 false 是显式值。

**产出。** 新 ADR + schema/validate/orchestrator + conformance 正反例。

## P2 · 查询分页与排序共存

**现状。** `packages/page/src/validate.ts:1642/1645` 在 `pagination.mode: "query"` 下直接拒绝 `sortable` 与 `filterable`。`ioc-opportunity-list` 有 15 列金额排序 + 5 列表头筛选，所以只能退到 `mode: "none"`——现在才 10 行无所谓，接上真库就是全表拉取。

**要定的事。** 排序进生效查询（DQE 的 `orders`），表头筛选进 `filter.dims`。要区分「服务端排序」与「当前页本地排序」，后者在分页下是错的语义，不能留着。

## P3 · 三张页面转 query

`ioc-project-overview` 7 个 inline、`ioc-opportunity-analysis` 3 个、`ioc-project-detail` 4 个，合计 13 个数据源、13 个未绑筛选器。概览页的 `region` 声明了和清单页同一套三层（geo/region-dept/office），地图下钻靠它——**地图一点就能切层，但七个 inline 数据源一个都不会重算**，层级绑定这条刚修好的路在概览页上还用不上。

每个数据源都要配 dqe-sim 夹具，口径沿用 `tools/dqe-sim/fixtures/ioc-opportunity-list.json`：行是页面内嵌初始行的同源副本，另带谓词专用列，返回只投影声明的输出字段。

## P4 · 页内详情动作

`componentAction` 闭集只有 `writeFilter` 和 `navigate`，没有弹窗、抽屉、页内展开。要协议新增一支动作、运行时新增一层浮层，外加浏览器证据。独立于前面几项，可以并行。

## P5 · 隔离基线验证

`pnpm compatibility:check --svelte=5.56.6`。嵌入宿主的 DQE 端点是按 ADR-0074 的隔离约束写的（纯 node、不引工作区包），拷贝清单也补了，但这条标未验证。

## P6 · 存量失败

四个文件五个用例，都不是本轮引入的：

- `apps/playground/tests/flow-analysis-report.test.ts`：`cny-adaptive` vs `compact-million-2`，属未提交的 million-formats 在制品。
- `tests/dev-server-contract.test.ts`：platform 端口 443 vs 契约要求的 5174。
- `tests/page-reference.test.ts`：一份**未被修改过**的 `docs/page-metadata/actions-and-navigation.md` 与冻结清单对不上哈希。
- `tests/authoring-export-isolation.test.ts`：断言的是一条已不再出现的 broken-link 报错。

前两条牵涉在制品的意图，动之前要确认。
