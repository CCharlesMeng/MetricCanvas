# IOC 四张页面：本地起服务与手工验收

四张 IOC 页面现在全部跑在受控查询上（inline 静态行只作为 `source.initial` 的首屏）。本文记录怎么把它们在本地跑起来，以及每项能力该看到什么数字——**每条都挑了一个能区分「做对了」和「看起来像做对了」的取值**。

## 三个进程分别是什么

| 部件 | 起法 | 端口 | 是什么 |
| --- | --- | --- | --- |
| **页面试验场**（preview） | `pnpm dev:playground` | 5173 | 开发期看页面的地方（ADR-0075），路由 `/pages/<id>`。dev 下自动注入本机运行配置，DQE 指向 18228 |
| **DQE 仿真** | `pnpm sim:dqe` | 18228 | 数据来源。IOC 四张页面的行在 `tools/dqe-sim/fixtures/ioc-*.json` |
| **平台** | `pnpm dev:platform` | 见 `apps/platform/vite.config.ts` | 创作工作台，不是看页面用的 |

`pnpm dev` 是平台 + DQE 仿真，**不含试验场**。要手工验收 IOC 页面，起的是前两个：

```bash
pnpm sim:dqe          # 一个终端
pnpm dev:playground   # 另一个终端
```

四张页面全部是 query 数据源，**不起 DQE 仿真就只能看到内嵌初始行的首屏，动筛选会报网关错**。

试验场的 vite 只监听 IPv6 回环，**要用 `localhost` 不能用 `127.0.0.1`**——后者会直接连不上，看起来和「服务没起」一模一样。分不清时先 `lsof -nP -iTCP:5173 -sTCP:LISTEN` 看它到底绑在哪。

| 页面 | 地址 |
| --- | --- |
| 项目概览 | http://localhost:5173/pages/ioc-project-overview |
| 机会点清单 | http://localhost:5173/pages/ioc-opportunity-list |
| 机会点分析 | http://localhost:5173/pages/ioc-opportunity-analysis |
| 项目详情 | http://localhost:5173/pages/ioc-project-detail |

### 页面参数：口径日期从哪来

6.11 起口径日期不再是筛选器里的字面量默认值，而是**声明出来的页面参数**（ADR-0089）：

| 页面 | 参数 | 保存值 | 驱动的筛选器 |
| --- | --- | --- | --- |
| 概览 | `report-month` / `report-as-of-date` | `2026-04` / `2026-03-26` | `mtime` / `as-of-date` |
| 清单 | `report-month` | `2026-04` | `mtime` |
| 分析 | `report-as-of-date` | `2026-03-26` | `as-of-date` |

参数只决定**打开那一刻**的选中值，页内两个控件照旧可改。所以同一个月份现在有两个 URL 入口，语义不同：

```
…/ioc-opportunity-list?report-month=2026-05    # 换一个页面实例（参数）
…/ioc-opportunity-list?mtime=2026-05           # 同一个实例里换筛选值（筛选器）
```

两者都该得到 0 行（数据只有 `202604`）。**不传任何键时清单必须是 10 行**——如果是 0 行，说明参数没写进筛选初值，`mtime` 谓词发的是空值。

`ioc-project-detail` 的 8 个输入也迁到了 `params.display`（`?page-title=…&opportunity-code=…`）。它那个 `mtime` 与前三张页同名但不是同一个东西：值来自清单页点行时带的行数据，不是页面口径输入。

### 另一条路：嵌入示例宿主

```bash
pnpm --filter @metriccanvas/embed build      # 改过引擎代码才需要
pnpm --filter @metriccanvas/embed preview:examples   # 4175
```

它是浏览器证据用的**测试宿主**，页面同样在 `/pages/<id>`，好处是单进程、DQE 端点同源内置、启动时会把全部页面 URL 打印出来。按 ADR-0074 的隔离约束写成纯 node，不引工作区包，因此数据只覆盖夹具里有的那些查询。日常验收用试验场，要复现浏览器用例时用它。

## 验收清单

### 机会点清单（每页 5 行、共 2 页）

| 做什么 | 该看到什么 | 做错了会怎样 |
| --- | --- | --- |
| 点列头「预签金额」升序 | 第一行是 `OPP202604010` | 它金额最小、**原本在第二页**；本地排序只排当前页，排不出它 |
| 再点一次转降序 | 第一行是 `OPP202604004` | |
| 「更多筛选」→ 云行业选「零售」 | 云子行业候选从 10 项收到 2 项 | 级联约束没下推的话仍是 10 项 |
| `…/ioc-opportunity-list?mtime=2026-05` | 0 行 | 数据只有 `202604`；格式声明错则 `?mtime=2026-04` 也会变 0 行 |
| `…?key-office=true` | 5 行且页码器消失 | 取反的实现会给出**另外** 5 行 |
| `…?bidding-amount.from=50000000` | 4 行 | |

### 项目概览

| 做什么 | 该看到什么 |
| --- | --- |
| 下方 tab 切到「丢单项目」，点机会点名称 | 右侧滑出抽屉，七个字段含「丢单原因」，**地址栏不变**，Esc 关闭 |
| 「概览」tab 里点某个代表处 | 跳清单页并带 `region.level=office`，清单只剩那个代表处的行 |
| 点地图下钻切层 | 七个数据源会真的重算（此前全是 inline，点了等于没点） |

## 对应的协议改动

| ADR | 交付 | 缺口原本长什么样 |
| --- | --- | --- |
| [0089](adr/0089-page-parameters-can-seed-time-point-and-hierarchical-filters.md) | 页面参数可给时间点与层级维度筛选器做初值（6.11） | 口径日期只能当常量写死在筛选器 `default` 上，跨页传递靠两边筛选器 id 恰好同名 |
| [0088](adr/0088-orthogonal-page-parameters-window-on-the-reference-and-layers-by-purpose.md) | window 挂到查询侧时间引用、params 按消费位置分层（就地改 6.6） | 「点 / 区间」与「派生 / 原样用」被切成互斥一条路，一个基准月驱动多窗口的页面必须展开成多个字面量 |
| [0084](adr/0084-hierarchical-filter-bindings-declare-a-query-field-per-level.md) | 层级维度筛选绑定逐级声明谓词字段（6.7 新增分支 / 6.8 收紧） | 切到代表处层选值，发出去的仍是上层字段的谓词，上游照常返回、没有任何一处报错 |
| [0085](adr/0085-query-binding-targets-for-the-non-dimension-filter-types.md) | timePoint / boolean / numberRange 的绑定目标（6.9） | 这三类在协议上无处可绑，拉了完全不动数 |
| [0086](adr/0086-server-side-sorting-and-header-filters-under-query-pagination.md) | 查询分页下由上游排序与表头筛选 | 分页与排序二选一；本地排序在分页下是错的语义 |
| [0087](adr/0087-in-page-detail-overlay-as-a-third-component-action.md) | 页内详情浮层（6.10） | 动作闭集只有 `writeFilter` 与 `navigate`，看一行详情只能跳页 |

级联约束下推（`createDqeGateway` 此前丢掉 `DimensionValuesRequest.constraints`）不构成协议变更，随 0085 一批落地。

## 已知剩余缺口

- **`search` 筛选器仍无绑定目标**，继续走客户端 `inline-search`；在分页下它只筛当前页。
- **排序的 DQE 请求编码未在真实环境复验**。编码沿用 `docs/evidence/中间层分析.md` §2.3.5 的 `@order(type, priority)` 语义，与 `dimensionValuesDqeItem` 同批归 issue #3。
- **`pnpm compatibility:check` 尚未跑过**：嵌入宿主的 DQE 端点是按隔离约束写的、拷贝清单也补了，但这条标未验证。
