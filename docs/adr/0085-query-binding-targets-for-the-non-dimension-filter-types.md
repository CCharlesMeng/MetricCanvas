---
status: accepted
date: 2026-09-21
note: 补齐 ADR-0050 闭集里三类筛选器在查询侧的绑定目标；交付页面协议 6.9
---

# timePoint / boolean / numberRange 各有自己的查询绑定目标

[ADR-0050](./0050-filter-type-closure-and-hierarchical-dimensions.md) 把筛选器收成六类闭集，但 `filterBindings` 只接住了两类：`dimension` 和 `time`，而 `time` 被 `validate.ts` 硬限定必须对应 **timeRange** 筛选器。于是另外三类在协议上**无处可绑**——不是"绑了不生效"，是压根写不出绑定。

代价在 `pages/ioc-opportunity-list.json` 上很具体：十一个筛选器里，`mtime`（数据月份）、`key-office`（仅看重点国代）、`bidding-amount`（预签金额）三个拉了完全不动数。`mtime` 尤其要紧，四张 IOC 页面都有它，它是这套看板的基本口径。

`search` 是第四个没有绑定目标的，但它不在本决策范围内：全文检索的谓词语义与上面三类不同构，而且它今天有一条能用的路（客户端 `inline-search` 过滤当前快照行）。

## 决策

**三类各新增一支绑定目标，目标名即筛选器类型。** 它们各自的谓词形状本就不同，共用一个 `queryField` 字段名并不能让它们变成一回事：

```json
"mtime":          { "target": "timePoint",   "queryField": "mtime", "valueFormat": "compact" },
"key-office":     { "target": "boolean",     "queryField": "is_key_office", "whenTrue": ["true"] },
"bidding-amount": { "target": "numberRange", "metric": "bidding_amount" }
```

**`timePoint` 的取值格式必须显式声明。** 筛选状态里写的是 `YYYY-MM`，而数据列常常是 `YYYYMM`（IOC 的 `mtime` 就是）。让运行时去猜是哪种，等于把 [ADR-0084](./0084-hierarchical-filter-bindings-declare-a-query-field-per-level.md) 刚关掉的那类静默错数据换个地方重开：格式猜错不会报错，只会一行都取不到，或者更糟——取到一批不相干的行。`valueFormat` 是封闭二选一，`iso` 原样送、`compact` 去掉分隔符，缺省为 `iso`。

**`boolean` 的勾选与否不对称，`whenFalse` 不由运行时取反。** 勾上时下推 `whenTrue`；不勾时，声明了 `whenFalse` 就下推它，没声明就是无条件。这与筛选状态里 false 是显式值（不被默认 true 覆盖）的既有语义一致。取反是错的：「仅看重点国代」不勾选意味着**全都看**，而不是「只看非重点国代」。

**`numberRange` 落在 `filter.metrics` 上，两端各自可缺席。** 每个端点是一条独立的比较谓词（`>=` / `<=`），端点缺席即那一侧无界。谓词形状沿用仓内既有用法，不是新发明的：`tools/dqe-sim/fixtures/flow-analysis-report.json` 里已经有 `{"metric_name": …, "metric_value_list": [0], "operator": "<"}`。

**生效查询只多一支。** `timePoint` 与 `boolean` 在编排层就化成维度谓词，因此 `EffectiveQuery.filterValues` 只新增 `metricRange` 一支。绑定声明的是**意图**，生效查询携带的是**已解析的谓词**——数据网关不需要知道某条维度谓词原本来自哪类筛选器。

**本次交付页面协议 6.9。** 三支都是判别联合新增分支，满足 ADR-0051 的增量四条判据。

## Consequences

- `ioc-opportunity-list` 的下推覆盖率从 7/11 到 10/11，只剩 `search`。这是本决策的第一个行使者。
- 浏览器证据钉的是行为：`mtime=2026-04` 得 10 行、`2026-05` 得 0 行（格式声明错就是前者变 0）；`key-office=true` 得 5 行、不带参得 10 行（取反的实现会得到另外 5 行）；金额下界 5000 万得 4 行。
- `search` 仍无绑定目标，继续走客户端 `inline-search`。它在分页开启后会退化成「只筛当前页」，这条与 [P2 查询分页与排序共存](../plan/2026-09-21-ioc-live-data-gaps.md) 一起收。
- `paramBindings` 没有跟着扩。它服务的是页面实例化时的固定取值，与页内可交互筛选是两件事；真需要时按同样的形状各加一支即可。

## Considered Options

- **让三类都复用 `dimension` 目标，运行时按筛选器类型自己转换。** 写起来最省。但 `numberRange` 根本不是维度谓词（它落在 `filter.metrics`），而 `timePoint` 的格式与 `boolean` 的真假语义都是**声明方才知道**的信息，运行时没有第二个来源可查，只能猜。不采用。
- **`timePoint` 复用 `time` 目标，退化成 start=end 的区间。** 语义上讲得通，`filter.time` 还带 period/is_aggregate。但 IOC 的 `mtime` 在数据里就是一个普通维度列，不是时间窗口；把它塞进 `filter.time` 会连带改变查询的聚合粒度声明，那是查询定义自己的事，绑定不该动它。不采用。
- **`boolean` 只声明 `queryField`，true 下推 `["true"]`、false 下推 `["false"]`。** 省掉两个字段。但数据里的真假写法不统一（`true` / `Y` / `1` / `是`），而且「不勾选」与「勾选为假」必须能区分开——固定映射把三态压成两态。不采用。
- **`numberRange` 也走 `filter.dims`，把区间编码成字符串。** 不需要碰 `EffectiveQuery`。但维度谓词是集合包含，不是比较；编码成字符串等于把比较语义推给上游去解析约定，属于用错结构。不采用。
