# IOC 四张页面：本地起服务与手工验收

四张 IOC 页面现在全部跑在受控查询上（inline 静态行只作为 `source.initial` 的首屏）。本文记录怎么把它们在本地跑起来，以及每项能力该看到什么数字——**每条都挑了一个能区分「做对了」和「看起来像做对了」的取值**。

## 起服务

```bash
cd <仓库根>
pnpm --filter @metriccanvas/embed build      # 改过引擎代码才需要
pnpm --filter @metriccanvas/embed preview:examples
```

启动后终端会打印监听地址、DQE 端点和全部可打开的页面 URL。打不开时先看这几行有没有出现——服务没起来和页面出错是两件事。

| 页面 | 地址 |
| --- | --- |
| 项目概览 | http://127.0.0.1:4175/pages/ioc-project-overview |
| 机会点清单 | http://127.0.0.1:4175/pages/ioc-opportunity-list |
| 机会点分析 | http://127.0.0.1:4175/pages/ioc-opportunity-analysis |
| 项目详情 | http://127.0.0.1:4175/pages/ioc-project-detail |

这个宿主用的是**真实的** `createDqeGateway`，不是抓的假网关；数据由同源的 DQE 端点应答，行来自 `tools/dqe-sim/fixtures/ioc-*.json`（页面内嵌初始行的同源副本）。它按 ADR-0074 的隔离约束写成纯 node，不引工作区包。

需要完整仿真（问数语义面、AI 总结流式）时另起 `pnpm sim:dqe`，那是 `tools/dqe-sim` 的独立服务。

## 验收清单

### 机会点清单（每页 5 行、共 2 页）

| 做什么 | 该看到什么 | 做错了会怎样 |
| --- | --- | --- |
| 点列头「预签金额」升序 | 第一行是 `OPP202604010` | 它金额最小、**原本在第二页**；本地排序只排当前页，排不出它 |
| 再点一次转降序 | 第一行是 `OPP202604004` | |
| 「更多筛选」→ 云行业选「零售」 | 云子行业候选从 10 项收到 2 项 | 级联约束没下推的话仍是 10 项 |
| `?mtime=2026-05` | 0 行 | 数据只有 `202604`；格式声明错则 `?mtime=2026-04` 也会变 0 行 |
| `?key-office=true` | 5 行且页码器消失 | 取反的实现会给出**另外** 5 行 |
| `?bidding-amount.from=50000000` | 4 行 | |

### 项目概览

| 做什么 | 该看到什么 |
| --- | --- |
| 下方 tab 切到「丢单项目」，点机会点名称 | 右侧滑出抽屉，七个字段含「丢单原因」，**地址栏不变**，Esc 关闭 |
| 「概览」tab 里点某个代表处 | 跳清单页并带 `region.level=office`，清单只剩那个代表处的行 |
| 点地图下钻切层 | 七个数据源会真的重算（此前全是 inline，点了等于没点） |

## 对应的协议改动

| ADR | 交付 | 缺口原本长什么样 |
| --- | --- | --- |
| [0084](adr/0084-hierarchical-filter-bindings-declare-a-query-field-per-level.md) | 层级维度筛选绑定逐级声明谓词字段（6.7 新增分支 / 6.8 收紧） | 切到代表处层选值，发出去的仍是上层字段的谓词，上游照常返回、没有任何一处报错 |
| [0085](adr/0085-query-binding-targets-for-the-non-dimension-filter-types.md) | timePoint / boolean / numberRange 的绑定目标（6.9） | 这三类在协议上无处可绑，拉了完全不动数 |
| [0086](adr/0086-server-side-sorting-and-header-filters-under-query-pagination.md) | 查询分页下由上游排序与表头筛选 | 分页与排序二选一；本地排序在分页下是错的语义 |
| [0087](adr/0087-in-page-detail-overlay-as-a-third-component-action.md) | 页内详情浮层（6.10） | 动作闭集只有 `writeFilter` 与 `navigate`，看一行详情只能跳页 |

级联约束下推（`createDqeGateway` 此前丢掉 `DimensionValuesRequest.constraints`）不构成协议变更，随 0085 一批落地。

## 已知剩余缺口

- **`search` 筛选器仍无绑定目标**，继续走客户端 `inline-search`；在分页下它只筛当前页。
- **排序的 DQE 请求编码未在真实环境复验**。编码沿用 `docs/evidence/中间层分析.md` §2.3.5 的 `@order(type, priority)` 语义，与 `dimensionValuesDqeItem` 同批归 issue #3。
- **`pnpm compatibility:check` 尚未跑过**：嵌入宿主的 DQE 端点是按隔离约束写的、拷贝清单也补了，但这条标未验证。
