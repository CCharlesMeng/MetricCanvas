# 页面参数正交化形状提案

- 日期：2026-09-21
- 状态：**提案 A 已做最小 spike 并跑通**（范围见第 7 节），提案 B 仍为纸面提案。两个原待定项已拍板，见 A.7 与第 5 节。
- 起因：`8621f10f`（2026-09-20，Page 6.6 分组参数）落地后复盘发现——「多个独立期间」与「由基准点派生窗口」被切成了互斥的两条路，而这两件事本不在一个维度上。
- 本文两个提案彼此独立，可分开采纳：
  - **提案 A**：window 从 `paramBindings` 挪到查询侧的时间引用上，使「点 / 区间」与「派生 / 原样用」正交。
  - **提案 B**：`params` 按用途分层为 `params.query.{dimensions,times}` + `params.display[]`，替掉 `scalars` 这个残余分组。

---

## 0. 现状：两条互斥的路（已实测）

三条边界在本仓用最小页面跑 `validate` 实测过，不是读代码推的：

| 想写的东西 | 实测结果 |
|---|---|
| 分组 `dimensions` + 旧 `time` + window 绑定 | 报错 `时间绑定必须引用必需的time参数`（分组 times 归一化成 `timeRange`，旧绑定只认 `time`） |
| 旧数组 params + 原位维度引用 | 报错 `原位引用需要 6.6 分组参数声明` |
| 分组 times 只写 `start`（想表达一个基准点） | 报错 `实际值不符合参数类型 timeRange`（start/end 必须成对） |

结论：**一个页面只能整体二选一。** 而 `pages/flow-analysis-report-params.json` 恰好是「维度想用新写法、时间想留派生」那类页——两个都要，结果一个都拿不到。

把两条轴拆开看，现状只覆盖了对角线上的两格：

| | 原样用 | 按 window 派生 |
|---|---|---|
| **输入是点** | —（点必然要派生） | 旧数组 `time` + `paramBindings` |
| **输入是区间** | 6.6 分组 `times` + 两端点引用 | **表达不了** |

真正缺的不是「多个时间参数」——旧 `paramBindings` 是按查询声明的，校验只管「每个查询只允许一个时间来源」（`param-bindings.ts:25`），所以「报告期 + 对比期」在旧数组里本来就写得出来。6.6 真正新增的只有一件事：**输入从一个点变成一个区间**。旧 window 是闭集（`period/lastN/yearToDate/monthToDate/toDate`，`time-param.ts:3`），里面没有任意区间，「2026-01 至 2026-06」这种半年窗口确实表达不了。这个洞是真的，补得对；错在补的方式把派生挤掉了。

---

## 提案 A：window 挪到时间引用上

### A.1 声明形状一个字都不用改

点就是 `start === end` 的退化区间。`groupedPageParamsZ.times`（`schema/primitives.ts:105`）保持原样：

```json
"times": [
  { "id": "report-month",   "granularity": "month", "start": "2026-02", "end": "2026-02" },
  { "id": "report-period",  "granularity": "month", "start": "2026-01", "end": "2026-06" }
]
```

要改的只有消费侧。

### A.2 消费形状

```json
// 区间原样用
"time": { "period": "month", "is_aggregate": false, "param": "report-period" }

// 基准点按 window 派生
"time": { "period": "month", "is_aggregate": true,
          "param": "report-month",
          "window": { "kind": "lastN", "unit": "month", "n": 12 } }
```

两种写法在同一个页面里自然共存——它们只是同一个引用的两种用法，不再是两条互斥的路。

**顺带退役现行的两端点写法。** 同一个 `flow-kpis` 查询，现行要写：

```json
"time": { "period": "month", "is_aggregate": true,
          "start": { "param": "report-month", "part": "start" },
          "end":   { "param": "report-month", "part": "end" } }
```

提案后是一行：

```json
"time": { "period": "month", "is_aggregate": true, "param": "report-month" }
```

**基准点取哪一端**：取 `end`。点的两端相同时无差别；将来若放宽到「区间也能带 window」，语义也自然是「以区间末端为基准派生」。

### A.3 校验怎么判

改动全部落在 `query-param-references.ts` 的时间分支（当前 `:38–52`）。

**删掉 2 条**（不是放宽，是结构上不可表达）：

| 现行判定 | 为什么消失 |
|---|---|
| `时间端点必须为 {param, part}，part 与端点一致` | 没有端点了 |
| `同一查询起止必须引用同一个时间参数` | 只有一个引用，无从不一致 |

**保留 3 条**（措辞按新形状调整）：

| 判定 | 说明 |
|---|---|
| 引用必须指向**必需的** `times` 参数 | 同 `:49`；非必需参数缺值时查询会变成开放条件 |
| 查询 `period` 与参数 `granularity` 必须相容 | 同 `:50`；`month → period=month`，否则 `day` |
| 时间引用不得与 `filterBindings` / `paramBindings` 的 `time` 目标共同控制 | 同 `:51` |

**新增 4 条**：

| 判定 | 依据 |
|---|---|
| 引用对象的键集合只能是 `{param}` 或 `{param, window}` | 与维度引用「只能声明 param」同构 |
| 声明了 `window` 时，`timeWindowCompatible(granularity, window)` 必须成立 | 直接复用 `time-param.ts:19`，与旧路判定同一函数 |
| 声明了 `window` 时，被引用的 times 项必须是**点**（`start === end`） | 否则 window 会静默忽略写下的 `start`。**判定时机待定，见 A.7** |
| `filter.time` 里有 `param` 时，不得另有字面量 `start` / `end` | 与旧路的「时间绑定不得另有查询体起止默认值」（`param-bindings.ts:33`）同构 |

维度侧的 5 条判定（`:24–37`）一条不动。

`hasQueryParamReferences`（`:66`）的探测条件从「`time.start.param` 存在」改成「`time.param` 存在」。

### A.4 解析怎么改

`resolveQueryParamReferences`（`:73`）时间段落，约 6 行：

```ts
const time = record(filter.time);
if (time && typeof time.param === 'string') {
  const value = record(values.get(time.param));
  if (typeof value?.start !== 'string' || typeof value?.end !== 'string') throw new Error(`时间参数缺失或类型错误:${time.param}`);
  const window = time.window as TimeWindow | undefined;
  if (window && value.start !== value.end) throw new Error(`窗口派生要求基准时间参数为单点:${time.param}`);
  const range = window ? resolveTimeWindow(value.end, window) : { start: value.start, end: value.end };
  delete time.param; delete time.window;
  time.start = range.start; time.end = range.end;
}
```

关键收获：`resolveTimeWindow` / `timeWindowCompatible` **一行不用改**，从「只服务旧路径」变成两条路共用。日历算术不必在创作层再写一遍——现行 6.6 把它推给了 AI / 宿主。

### A.5 URL 形状顺带修好

现行 timeRange 走 `JSON.stringify`（`engine/runtime/src/page-params.ts:74`），URL 里是编码后的 JSON 块；`flow-analysis-report-params.json` 迁到 6.6 后要传五个这样的块。

建议改成纯文本，两种写法：

```
?report-month=2026-03                 点（start === end）
?report-period=2026-01..2026-06       区间
```

- 序列化：`serializePageParam` 对 timeRange 返回 `start === end ? start : `${start}..${end}``。
- 解析：`resolvePageParams` 的 timeRange 分支（`:29`）从 `JSON.parse` 改成按 `..` 切分；两段都走 `matchesTimeValue`，非法输入照旧进 `missing`，不回退到另一份报告。
- 兼容：`JSON.parse` 可保留为回退分支，历史链接继续可用。

这比 6.6 现状和旧数组都好：旧数组的 `?report-month=2026-03` 本来就是纯文本，提案把这个可读性拿回来了，同时多了区间写法。

### A.6 旧页怎么落

**5.x / 6.0–6.5（数组 params + paramBindings）**：只读兼容不变。`param-bindings.ts` 与 `time-param.ts` 原样保留——ADR-0081 要求 5.x 永远可读。

但提案 A 之后，它们**可以按机器化规则升到新形状，且无信息损失**：

```
{id, type:'time', granularity, required, default}
  → times: [{id, granularity, start: default, end: default, required}]

paramBindings[id] = {target:'time', window}   （在查询 Q 上）
  → Q.filter.time = {period, is_aggregate, param: id, window}
```

这正是提案 A 相对现行 6.6 的关键差别：**现行 6.6 无法表达 window，所以旧页迁移必然丢派生**；提案 A 下迁移是纯改写。`docs/archive/page-params-inline-spec/tasks.md` P7 说的「保留不能安全迁移的页面」，在提案 A 下不再有这类页面。

**6.6 现有文档（仓内 4 份 + 1 组向量）**：两端点写法一次性改写。清单见第 4 节。

**`pages/flow-analysis-report-params.json`**：回到单个 `report-month`（点），12 个查询各自声明 window，同时用上分组维度的 `dim_name` 收拢——既不丢「一个基准月驱动全报告」，又拿到新写法。`packages/engine/runtime/tests/time-param-initialization.test.ts` 那 3 个用例不用拆，只有 URL 取值写法跟着改。现行方案会让它们全废。

### A.7 结论：不加字段，值域判定留到取值期

「声明 window 时被引用的 times 项必须 `start === end`」这条，在**未填值模板**上判不了——`start` / `end` 都是可选的（`primitives.ts:107`），模板里压根没有值。曾考虑在声明上加 `times[].form: 'point' | 'range'` 换取早报错，**已否决**：window 是否合法本来就依赖取值（`timeWindowCompatible` 只判了精度那一半），加字段又和「点就是退化区间」的前提冲突。

落地成两段，spike 里就是这么实现的：

- **声明期**：`times` 项已填值时，直接判 `start !== end` 并在 `/…/time/window` 上报「窗口派生要求基准时间参数为单点」。填了值的页面仍然早报错。
- **取值期**：未填值模板走到 `resolveQueryParamReferences`，代入的值不是单点就抛 `窗口派生要求基准时间参数为单点:<id>`。

代价是显式的：模板页把区间值填进带 window 的引用，要到取值时才报。这与「参数缺失或类型错误」同属一类运行期错误，不新增一类。

---

## 提案 B：params 按用途分层

### B.1 现状：scalars 是残余，不是一个设计出来的组

`scalars` 就是旧 params 数组减掉 dimension 和 time 剩下的那部分。关键区别是**消费位置**：查询里只有两处允许 `{param}`——`filter.dims[].dim_value_list`（必须是 dimension）和 `filter.time.*`（必须是 timeRange），`visit()`（`query-param-references.ts:57`）把其他任何位置的 `param` 键判成「此查询位置不允许页面参数引用」。所以 scalars 只能被文本取值和导航消费，是**纯展示输入**。

那三组用的就不是一个轴：

- dimensions vs times 分的是「落到 DQE filter 的哪个位置」；
- scalars 分的是「哪儿也不落」。

按「消费位置」分，scalars 是异类；按「数据类型」分，dimension / time / string / number / boolean 本该是五个平级成员——那正是旧数组 `type` 字段干的事。

可观察到的代价：

- **跨组顺序丢了**：`pageParamDeclarations`（`page-param.ts:22`）固定按 dimensions → times → scalars 拼接，页面没法表达「标题、地区、期间」这种填写顺序。做填参表单时这是会疼的。
- **以后新增一类展示输入**，是加第四个顶层键（schema 形状变更），而不是给闭集加成员——后者按 ADR-0051 本来就是次版本能干的事。
- 分组**没换来命名隔离**：三组共享同一个 ID 空间（引用只写 id，不写组）。这一点是对的，不应改。

### B.2 形状

```json
"params": {
  "query": {
    "dimensions": [ { "id": "region", "dim_name": "地区部", "dim_value_list": ["中国地区部"] } ],
    "times":      [ { "id": "report-month", "granularity": "month", "start": "2026-02", "end": "2026-02" } ]
  },
  "display": [
    { "id": "heading", "type": "string", "value": "半年对比报告" },
    { "id": "target",  "type": "number", "value": 1200 }
  ]
}
```

### B.3 校验和拍平怎么变

**拍平**（`pageParamDeclarations`）：三段拼接变两段——`[...query.dimensions, ...query.times, ...display]`；`path` 前缀变成 `/params/query/dimensions/{i}`、`/params/query/times/{i}`、`/params/display/{i}`。运行态仍然只看扁平数组，`Page.params` 的类型（`page.ts:206`）不变。

**「能不能进查询」从类型判定变成路径判定**：现行写的是 `p?.type !== 'dimension'` / `p?.type !== 'timeRange'`。提案后，声明已带 `path`，加一条 `p.path?.startsWith('/params/query/')` 就够，措辞也从「必须使用必需的分组维度参数」变成「引用的参数不在 params.query 下」。

诚实说明：类型判定**不会消失**（维度引用仍必须落在 dimension 上，时间引用仍必须落在 times 上），所以这不是少一条判断，是**错误信息更贴近原因**——引用了一个展示输入时，现在报的是「类型不对」，提案后报的是「它不是查询输入」。

**顺序保住**：`display` 是数组，声明顺序即填写顺序。`query` 下 dimensions → times 的固定顺序对表单是合理分组，不构成损失。

**其他接线**：`validate.ts:96` 的「分组参数至少声明一个参数」判定改按新路径取空；`page-document.ts:69` 与 `materialize.ts:39` 的类型联合跟着改；Python `grouped_params.declarations()` 里 `for group, entries in params.items()` 改成两段遍历。

### B.4 值不值

收益是分类学一致 + `display` 顺序 + 未来加展示输入是闭集加成员。成本是一次形状变更和多一层嵌套。单独看偏整容；**搭提案 A 的版车最省**——两者动的是同一批文件和同一批夹具。

---

## 4. 改哪几个文件

### 协议核心 `packages/page/src/`

| 文件 | A | B | 改什么 |
|---|---|---|---|
| `query-param-references.ts` | ● | ○ | A 的主战场：时间分支校验（删 2 保 3 增 4）、`resolveQueryParamReferences`、`hasQueryParamReferences`；B 只改路径判定一行 |
| `schema/primitives.ts` | — | ● | `groupedPageParamsZ` 形状 |
| `schema/page.ts:107` | — | ● | `params` 联合 |
| `schema/data-source.ts` | ○ | — | `timeWindowZ` 已存在可直接复用；查询体在 `dsl_list` 内是 `z.record(unknown)`，引用形状由手写校验兜，schema 不用动 |
| `page-param.ts` | — | ● | `pageParamDeclarations` 拼接与 `path` 前缀 |
| `version.ts` | ● | ● | `CURRENT_MINOR`，新增能力条目（探测 `filter.time.param` / `params.query`） |
| `validate.ts` | — | ● | `:96` 空组判定路径 |
| `page-document.ts` / `materialize.ts` / `query.ts` | ○ | ● | 类型联合 |
| `time-param.ts` / `param-bindings.ts` | — | — | **一行不改**，旧页只读兼容照旧 |

### 运行态

- `packages/engine/runtime/src/page-params.ts`：`serializePageParam` 与 `resolvePageParams` 的 timeRange 分支（A.5 的 `..` 写法）。

### Python 镜像 `metriccanvas-authoring/tool/metriccanvas_authoring/domain/`

- `grouped_params.py`：`query_reference_issues()` 的时间分支（与 TS 逐条对齐）、`declarations()`（B）。
- `page_validation.py`：接线，判定条数变化时同步。

### 夹具与向量

要手改的只有两处源；`contracts/metriccanvas/**`、`metriccanvas-authoring/skill/**`、`metriccanvas-authoring/contracts/exported/**` 全是 `pnpm authoring:contracts` 的产物，改完源重跑即可，不要手改。

| 源 | 改什么 |
|---|---|
| `packages/page/fixtures/contract-valid/grouped-params-page.json` | 两端点 → 单引用；建议其中一个查询改成「点 + window」，把两种用法都摆进正例 |
| `packages/page/fixtures/contract-valid/grouped-scalar-params-page.json` | B 的分层形状 |
| `tools/scripts/export-authoring-contracts.ts:127–148`（`groupedCase` 块） | `mixed-time-sources` 反例随两端点写法一起消失；新增「window 与精度不相容」「window 用在非点区间上」「`param` 与字面量 start 并存」三例 |

反例向量定义就在上面这段脚本里（不在 `tools/scripts/page-conformance-vectors.ts`——那份管的是另一批不变式）。Java 侧校验器按这些向量逐条对齐 `type/path/message`，所以判定条数一变，向量必须同步。

### 文档

`PAGE-PARAMETERS.md`、`contracts/metriccanvas/page/reference/params-and-text-values.md`、`.../queries-and-bindings.md`、`docs/page-metadata/reference-map.json`，以及一份新 ADR（正交化的取舍与版本判断）。

### 重新生成 / 验证

```
pnpm validate            # 全部 pages/
pnpm test                # 含 time-param-initialization、grouped-params 向量
pnpm authoring:contracts # 重出契约快照与 skill 引用
pnpm authoring:test
pnpm adr:index
```

---

## 5. 版本与时机

**时机窗口就在现在。** 扫过全仓（排除 `contract-snapshot`），分组参数的**手写源只有 3 处**：两份 `contract-valid` 夹具，和 `export-authoring-contracts.ts` 里的 `groupedCase` 块。`contracts/metriccanvas/**` 下 7 个命中、`metriccanvas-authoring/`（除快照）下 4 个命中，全是这 3 处的导出副本（`conformance/valid/grouped-params-page.json` 与夹具逐字节相同，已核对）；`conformance/layout-compatibility.json` 里的 `6.6` 只是版本兼容矩阵的版本串，没用分组参数。再加上工作区里刚迁的 `pages/flow-analysis-report-params.json`，就是全部。

**没有任何 Java 侧或生产页面在用**；`@metriccanvas/page` 还是 `1.0.0-rc.4`，6.6 是昨天（`8621f10f`，2026-09-20）落的，仓里没有对应发布标签。现在改形状代价接近于零，出仓之后就不是了。

**结论：把 6.6 当未发布，直接改 6.6 的定义**，不把两端点写法留成可读旧形状。理由是它本身就是这次要修的形状错误，留成兼容包袱违背提案初衷；而且它出现的四处全在仓内，一次性改写即可。

另一条路（发新次版本、两端点写法保留为可读旧形状）被否决，除了上面的理由，还有一个当下的事实：**6.7 与 6.8 已经被别的在途改动占了**。工作区里 `packages/page/src/version.ts` 的 `CURRENT_MINOR` 已从 6 推到 8——6.7 是「层级维度筛选绑定逐级声明谓词字段」，6.8 是 ADR-0084 那次按 ADR-0051 例外行使的收紧。本提案若另开次版本，号还得往后排，而它要改的恰恰是 6.6 自己引入的形状。

---

## 6. 最小 spike 的结果

只验形状，范围刻意收窄：**只动 `packages/page` 的时间引用校验与解析、运行态 URL 取值、目标页面和两个测试；没碰契约导出、没碰 Python 侧、没删两端点写法**（删了夹具会连带契约产物，不属于本次验证）。

改了什么：

| 文件 | 改动 |
|---|---|
| `packages/page/src/query-param-references.ts` | 新增 `filter.time = {period, is_aggregate?, param, window?}` 分支：4 条新判定 + 3 条沿用；`resolveQueryParamReferences` 增 12 行派生分支；`hasQueryParamReferences` 认新形状 |
| `packages/engine/runtime/src/page-params.ts` | timeRange 的 URL 取值从 JSON 改为纯文本 `2026-03` / `2026-01..2026-06`，`serializePageParam` 对称 |
| `pages/flow-analysis-report-params.json` | 5 个时间参数收回 1 个 `report-month`；12 个查询各自声明 window（与 `HEAD` 版 `paramBindings` 的窗口逐一对应） |
| `packages/engine/runtime/tests/time-param-initialization.test.ts` | 保存值断言改成区间；补 URL 点/区间往返与「区间喂给带 window 的引用会抛」 |
| `packages/engine/runtime/tests/grouped-params.test.ts` | URL 取值从 JSON 形改成 `..` 形 |

形状成立的证据：

- **`time-param-initialization.test.ts` 那个 12 数据源的集成用例一字未改就通过了。** 它断言 2026-03 / 2027-01 / 2099-12 三个报告月下，7 个查询取当月、2 个取所在全年、上月 / 近12个月 / 年初至今各自派生正确，跨年不回退，2099-12 因三个窗口重合去重成 10 个查询。现行 6.6 方案会让这 3 个用例全废，提案 A 下只有一行保存值断言要改（`'2026-02'` → `{start,end}`）。
- 页面输入从 6 个收回 2 个，URL 从五个编码 JSON 块收回一个 `?report-month=2026-03`。
- `pnpm validate` 12/12；`packages/page` 与 `packages/engine` 共 812 个用例，参数相关全绿。
- `pnpm authoring:contracts:check` 的 drift 只列出 manifest / lock 四个哈希文件，**没有 `page/schema.json` 或 `page/conformance/**`**——印证了这个形状对导出契约是中性的：查询体在 `dsl_list` 内是 `z.record(unknown)`，新引用形状不进 zod。

下一步（未做）：删两端点写法并改两份夹具与 `groupedCase` 块、Python 侧 `grouped_params.py` 对齐、文档与 ADR。

## 7. 顺带发现的两侧不一致

TS 的 `pageParamDeclarations` 把分组的实际值放进 `value`（`page-param.ts:29/33/36`），Python 的 `declarations()` 放进 `default`（`grouped_params.py:14/18/21`）。两侧各自的校验都能跑通，但共同向量的字段名对不上——`resolvePageParams` 对带 `path` 的声明读的是 `declaration.value`（`page-params.ts:23`），Python 侧若被拿去做同样的取值解析会读空。建议随本次改动拉齐到 `value`。
