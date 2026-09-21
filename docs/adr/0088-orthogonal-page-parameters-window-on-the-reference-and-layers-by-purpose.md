---
status: accepted
date: 2026-09-21
note: 就地改写 6.6 的 params 形状——window 挪到查询侧时间引用，params 按消费位置分层；不另开次版本
---

# 页面参数正交化：窗口挂在引用上，参数按消费位置分层

[ADR-0047](./0047-page-parameters-as-immutable-initialization-inputs.md) 定下页面参数是"打开时确定、此后不可变"的具名输入。6.6（`8621f10f`，2026-09-20）把 `params` 从数组改成分组对象并引入查询内原位引用，补上了"任意区间"这个真实存在的洞——旧 window 是闭集，`2026-01 至 2026-06` 这种半年窗口确实表达不了。

**但它把两件不在一个维度上的事切成了互斥的一条路。**「输入是点还是区间」和「按 window 派生还是原样用」是两条轴，现状只覆盖了对角线上的两格：

| | 原样用 | 按 window 派生 |
|---|---|---|
| 输入是点 | —（点必然要派生） | 旧数组 `time` + `paramBindings` |
| 输入是区间 | 6.6 分组 `times` + 两端点引用 | **表达不了** |

三条边界都用最小页面跑 `validate` 实测过：分组 `dimensions` 配旧 `time`+window 报「时间绑定必须引用必需的time参数」；旧数组 params 配原位维度引用报「原位引用需要 6.6 分组参数声明」；分组 `times` 只写 `start` 报「实际值不符合参数类型 timeRange」。**一个页面只能整体二选一。**

代价落在 `pages/flow-analysis-report-params.json` 上：它是「一个基准月驱动全报告」那类页，迁到 6.6 后一个 `report-month` 被展开成五个独立时间参数，声明的输入从 2 个变 6 个。变长不是重点，**约束消失了**才是——「上月 = 报告月 -1」原本是机器能算的规则，换月自动跟；展开成五个字面量之后，改了 `report-month` 而忘了改 `last-12-months`，页面照样合法，只是静默地错了。旧设计让这类错误不可表达，6.6 让它可表达且不可检测。

`scalars` 是另一处分类学问题。它是旧数组减掉 dimension 和 time 剩下的那部分：`dimensions` 与 `times` 分的是「落到 DQE filter 的哪个位置」，`scalars` 分的是「哪儿也不落」——按消费位置分它是异类，按数据类型分这五者本该平级。它更像拆分时没地方放的残余，顺手开的第三个键。

## 决策

### 一、window 从 `paramBindings` 挪到查询侧的时间引用上

声明形状一个字不改：**点就是 `start === end` 的退化区间**。要改的只有消费侧：

```json
"time": { "period": "month", "is_aggregate": false, "param": "report-period" }

"time": { "period": "month", "is_aggregate": true, "param": "report-month",
          "window": { "kind": "lastN", "unit": "month", "n": 12 } }
```

不写 `window` 原样取起止，写了就以参数值为基准点派生。两种写法在同一个页面里自然共存——它们只是同一个引用的两种用法，不再是两条互斥的路。基准点取 `end`：点的两端相同时无差别，将来若放宽到「区间也能带 window」，语义也自然是「以区间末端为基准」。

`resolveTimeWindow` / `timeWindowCompatible` 一行未改，从只服务旧路径变成两条路共用——日历算术不必在创作层再写一遍。现行 6.6 把它推给了 AI 与宿主。

**两端点写法 `{param, part}` 就此退役**，不留成可读旧形状。它本身就是这次要修的形状错误，留着违背本决策的初衷；它出现的每一处都在仓内（见「版本」一节）。退役后这种写法落进 `visit()` 的兜底判定，报「此查询位置不允许页面参数引用」。

**「声明 window 时基准必须是单点」分两段判，不加 `form` 字段。** 声明期：`times` 项已填值时直接判 `start !== end` 并在 `/…/time/window` 上报错。取值期：未填值模板走到 `resolveQueryParamReferences`，代入的值不是单点就抛。曾考虑加 `times[].form: 'point' | 'range'` 换取早报错，否决——window 是否合法本来就依赖取值（`timeWindowCompatible` 只判了精度那一半），加字段又和「点就是退化区间」的前提冲突。代价是明牌的：模板页把区间值填进带 window 的引用，要到取值时才报，与「参数缺失或类型错误」同属一类运行期错误，不新增一类。

### 二、`params` 按消费位置分两层

```json
"params": {
  "query": {
    "dimensions": [ { "id": "region", "dim_name": "地区部", "dim_value_list": ["中国地区部"] } ],
    "times":      [ { "id": "report-month", "granularity": "month", "start": "2026-02", "end": "2026-02" } ]
  },
  "display": [ { "id": "heading", "type": "string", "value": "半年对比报告" } ]
}
```

分层依据是**消费位置**，不是数据类型：`params.query` 下的输入落进 DQE 请求体，`params.display` 下的只被文本取值和导航消费。两层共享同一个 ID 空间，引用处只写 id 不写层——命名隔离本来就不该按组来做。

这让「能不能进查询」从类型判定变成位置判定。诚实说明：类型判定并没有消失（维度引用仍必须落在 dimension 上，时间引用仍必须落在 times 上），**变的是错误信息更贴近原因**——引用了一个展示输入时，现在报「类型不对」，改后报「引用的参数不在 params.query 下」。

顺带拿回两件事：`display` 是数组，声明顺序即填写顺序（原先固定按 dimensions → times → scalars 拼接，表达不了「标题、地区、期间」这种顺序）；以后新增一类展示输入是给闭集加成员，不是加第四个顶层键。

### 三、URL 里时间是纯文本

```
?report-month=2026-03                 点（start === end）
?report-period=2026-01..2026-06       区间
```

替掉编码后的 `{start,end}` JSON 块。旧数组的 `?report-month=2026-03` 本来就是纯文本，这条把可读性拿回来，同时多了区间写法。`JSON.parse` 不保留为回退分支：6.6 没有已发布的链接可兼容，留着只会让两种写法长期并存。

### 四、版本：把 6.6 当未发布，就地改定义

不另开次版本。判据是**手写源只有三处**：`packages/page/fixtures/contract-valid/` 下的 `grouped-params-page.json` 与 `grouped-scalar-params-page.json`，以及 `tools/scripts/export-authoring-contracts.ts` 的 `groupedCase` 块；`contracts/metriccanvas/**` 与 `metriccanvas-authoring/**` 下的命中全是这三处的导出副本。加上工作区里刚迁的 `pages/flow-analysis-report-params.json`，就是全部。没有 Java 侧或生产页面在用，`@metriccanvas/page` 还是 `1.0.0-rc.4`，6.6 是前一天落的，仓里没有对应发布标签。

这不是行使 [ADR-0051](./0051-additive-minor-versions-for-page-schema.md) 的零使用例外——例外针对的是「已发布的次版本要收紧」。6.6 从未出仓，改的是一个还没交付出去的定义。另一条路（发新次版本、两端点写法保留为可读旧形状）被否决：除上述理由外，**6.7 与 6.8 已被别的在途改动占了**（6.7 层级筛选绑定逐级谓词字段、6.8 [ADR-0084](./0084-hierarchical-filter-bindings-declare-a-query-field-per-level.md) 的收紧），本决策若另开次版本，号还得往后排，而它要改的恰恰是 6.6 自己引入的形状。

## Consequences

- **`flow-analysis-report-params.json` 回到单个 `report-month`**，12 个查询各自声明 window，与旧 `paramBindings` 的窗口逐一对应。`packages/engine/runtime/tests/time-param-initialization.test.ts` 那个 12 数据源的集成用例——断言 2026-03 / 2027-01 / 2099-12 三个报告月下各窗口派生正确、跨年不回退、2099-12 因三个窗口重合去重成 10 个查询——**一字未改就通过**。现行 6.6 方案会让这 3 个用例全废。
- **旧页迁移从此无损。** 5.x—6.5 的 `{id, type:'time', granularity, required, default}` + `paramBindings[id] = {target:'time', window}` 可机器化改写成 `times: [{id, granularity, start: default, end: default}]` + `filter.time = {period, is_aggregate, param: id, window}`。`docs/archive/page-params-inline-spec/tasks.md` P7 说的「保留不能安全迁移的页面」，在本决策下不再有这类页面。旧路径本身一行不改——`time-param.ts` 与 `param-bindings.ts` 原样保留，[ADR-0081](./0081-read-schema-5-x-with-6-x-runtime.md) 要求 5.x 永远可读。
- **`named-to-date-windows` 能力探测补了第二个落点。** 它原先只按 `paramBindings` 里的 window 探测，新形状把 window 放到 `filter.time` 上，那条探测不会命中。当前无害（用新形状必然是分层参数，floor 已是 6.6 ≥ 6.4），但按 minor 推算版本下限时会算低，因此一并处理。
- **反例向量随判定条数同步。** `mixed-time-sources` 与两端点写法一起消失，新增 `retired-endpoint-form`、`reference-with-literal-range`、`window-precision-mismatch`、`window-on-range`、`display-input-in-query`、`legacy-flat-groups` 六例。Java 侧校验器按这些向量逐条对齐 `type/path`，TS 与 Python 两侧在全部 17 个向量上路径逐条相同。
- **两侧字段名拉齐到 `value`。** TS 的 `pageParamDeclarations` 把分层声明的实际值放进 `value`，Python 的 `declarations()` 原先放进 `default`；两侧各自的校验都能跑通，但共同向量的字段名对不上，`resolvePageParams` 读的是 `value`，Python 侧若被拿去做同样的取值解析会读空。
- **级联约束仍然到不了上游**，与本决策无关但影响同一批页面：`createDqeGateway` 的 `fetchDimensionValues` 丢掉了 `DimensionValuesRequest.constraints`。

## Considered Options

- **保留 6.6 现状，让「一个基准月驱动多窗口」的页面继续用旧数组。** 零成本。但这等于承认协议有两套互不兼容的时间机制长期并存，而且新页面一旦需要区间就必须放弃派生。不采用。
- **给 `times` 项加 `window` 字段（窗口挂在声明上而不是引用上）。** 声明侧一眼可见。但同一个基准月在不同查询里要派生出不同窗口（当月、所在全年、近 12 个月），窗口挂在声明上就得为每个窗口声明一个参数——正是 6.6 现状的毛病。不采用。
- **`params` 维持三组平铺，只把 `scalars` 改名。** 成本最低。但异类的是它的分类轴，不是它的名字：改名之后「按消费位置分」和「按数据类型分」仍然混在同一层。不采用。
- **提案 B 单独走一次次版本。** 收益（分类学一致、`display` 顺序、未来加展示输入是闭集加成员）偏整容，单独看不值一次形状变更。但它动的是同一批文件和同一批夹具，搭本决策的车边际成本接近零；分开走要再付一次迁移。不采用。
- **保留两端点写法作为可读旧形状。** 迁移成本为零。但它在本决策下没有任何表达力——`{param}` 整段引用是它的严格超集——留着只是让同一件事有两种写法，且其中一种写不出派生。不采用。
