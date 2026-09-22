# 页面参数正交化：讨论记录与后续计划

- 日期：2026-09-21
- 形状规格在 `docs/plan/2026-09-21-page-params-orthogonal-shape.md`（提案 A / B 的字段形状、校验逐条、改动面清单、spike 结果）。**本文记录来龙去脉、已拍板的结论、当前工作区状态与剩余计划**，两份配套读。
- **状态更新（2026-09-21 晚）**：提案 A 与提案 B 都已落地，决策记进 [ADR-0088](../adr/0088-orthogonal-page-parameters-window-on-the-reference-and-layers-by-purpose.md)。第 4 节阶段一 A1–A8 全部完成，阶段三（提案 B）随同一次改动完成。**剩余的是阶段二（旧页处置）与 IOC 四张页的公共 params**，后者卡在一个协议缺口上，见第 6 节末尾。
- 本文写作时**工作区里已有未提交的 spike 改动**，清单见第 3 节。

---

## 1. 来龙去脉

### 1.1 起点：把示例页迁到 6.6

`8621f10f`（2026-09-20）把 `params` 从数组改成分组对象 `{dimensions, times, scalars}`，并引入查询内原位引用。任务是把 `pages/flow-analysis-report-params.json` 跟上这个改动，并检查其他页面有没有同类场景。

第一次迁移按字面做了：`schemaVersion` 6.4 → 6.6，删掉 12 处 `paramBindings`，把原来由 `report-month` 派生的 5 种窗口按保存值 2026-02 展开成 5 个独立时间参数。`pnpm validate` 12/12 通过，按保存值逐查询比对起止完全等价。

### 1.2 撞上的分叉

但引擎里 `packages/engine/runtime/tests/time-param-initialization.test.ts` 的 3 个用例全红——那个测试正是拿这个页面当夹具在守派生窗口。

原因不是测试写得不好，是能力真的丢了：分组 times 解析出来是 `timeRange` 类型，旧的 `paramBindings.target="time"` 只接 `time` 类型，两者在一个页面里不能混用。所以这个页一旦用分组参数，就必然失去「一个基准月驱动全报告」——`?report-month=2026-03` 不再自动推出全年 / 上月 / 近12月，得传 5 个键。

而且仓里两份自己的文档在这儿反着说：`docs/plan/2026-09-20-grouped-page-params.md` 说派生窗口仍由旧 time+window 承接，`docs/archive/page-params-inline-spec/tasks.md` P7 说保留不能安全迁移的页面。

### 1.3 对 times 设计的评估

用最小页面跑 `validate` 实测了三条边界：

| 想写的东西 | 实测结果 |
|---|---|
| 分组 `dimensions` + 旧 `time`+window 绑定 | 报错「时间绑定必须引用必需的time参数」 |
| 旧数组 params + 原位维度引用 | 报错「原位引用需要 6.6 分组参数声明」 |
| 分组 times 只写 `start`（想表达一个基准点） | 报错「实际值不符合参数类型 timeRange」 |

结论分三层：

**一、6.6 真正新增的只有「区间」，不是「多个时间参数」。** 旧 `paramBindings` 按查询声明，校验只管「每个查询只允许一个时间来源」，所以「报告期 + 对比期」在旧数组里本来就写得出来。旧 window 是闭集，里面没有任意区间，「2026-01 至 2026-06」确实表达不了——这个洞是真的，补得对。

**二、配置角度要分场景。** 对两个真独立的期间（`customer-activity-risk-briefing.json` 那种）明显更简单；对一个基准月派生多窗口（flow 报告）明显更复杂：当时实测声明的输入 2 → 6 个，params 段 229 → 645 字节，整页 +2534 字节。

但变长不是重点，**约束消失了**才是。原来「上月 = 报告月 -1」是机器能算的规则，换月自动跟；展开成五个独立字面量之后，把 `report-month` 改成 2026-03 而忘了改 `last-12-months`，页面照样合法，只是静默地错了。旧设计让这类错误不可表达，6.6 让它可表达且不可检测。

**三、实现角度运行态确实简单了，但总量没减。** `resolveQueryParamReferences` 二十来行纯替换不碰日历；可日历算术没消失，只是搬到了创作层（AI / 宿主）。而 `time-param.ts` 的 `resolveTimeWindow` / `timeWindowCompatible` 一行没删，`paramBindings` 也还在——6.5 及更早的页面永远要能读。净结果是两套机制长期并存且互不兼容，不是替换。

还有一处：`pageParamDeclarations` 一上来就把分组拍平，`parsePage` 最后把 `page.params` 整个换成扁平数组。**分组只存在于保存的文档里，运行态从来看不到它。** 这不算错，但要清楚它买到的是 schema 形状，不是语义。

### 1.4 对 scalars 的评估

`scalars` 是旧 params 数组减掉 dimension 和 time 剩下的那部分。关键区别在消费位置：查询里只有两处允许 `{param}`，其余位置一律被判「此查询位置不允许页面参数引用」，所以 scalars 只能被文本取值和导航消费，是纯展示输入。

那三组用的不是一个轴：dimensions vs times 分的是「落到 DQE filter 的哪个位置」，scalars 分的是「哪儿也不落」。按消费位置分它是异类；按数据类型分，dimension / time / string / number / boolean 本该是五个平级成员——那正是旧数组 `type` 字段干的事。所以它更像拆分时没地方放的残余，顺手开了第三个键。

可观察到的代价：跨组顺序丢了（固定按 dimensions → times → scalars 拼接，表达不了填写顺序）；以后新增一类展示输入要加第四个顶层键而不是给闭集加成员；三组共享同一个 ID 空间，分组没换来命名隔离（这一点是对的，不该改）。

### 1.5 正交化提案

问题被定位成：**「点 / 区间」与「派生 / 原样用」是两条轴，6.6 把它们做成了互斥的一条。**

| | 原样用 | 按 window 派生 |
|---|---|---|
| 输入是点 | —（点必然要派生） | 旧数组 `time` + `paramBindings` |
| 输入是区间 | 6.6 分组 `times` + 两端点引用 | **表达不了** |

提案 A 把 window 从 `paramBindings` 挪到查询侧的时间引用上：`times` 声明形状一个字不改（点就是 `start === end` 的退化区间），消费侧写 `{period, is_aggregate?, param, window?}`——有 window 就以参数值为基准点派生，没有就原样用。两种写法在同一个页面里自然共存。

提案 B 把 `params` 按用途分层为 `params.query.{dimensions,times}` + `params.display[]`，替掉 scalars 这个残余分组。

### 1.6 最小 spike

范围刻意收窄到「只验形状」：改 `packages/page` 的时间引用校验与解析、运行态 URL 取值、目标页面和两个测试；不碰契约导出、不碰 Python 侧、不删两端点写法。

结果见第 3 节。一句话：**那个 12 数据源的集成用例一字未改就通过了**，页面回到单个 `report-month`，同时用上了分组维度。

---

## 2. 已拍板的结论

1. **正交化方向成立。** window 挪到时间引用上，「点 / 区间」与「派生 / 原样用」做成正交两层，不是互斥分支。
2. **A.7：不加 `form` 字段。** 「声明 window 时基准必须是单点」这条，声明期已填值的直接判，未填值模板留到取值代入时抛。曾考虑加 `times[].form: 'point'|'range'` 换早报错，否决——window 是否合法本来就依赖取值，加字段又和「点就是退化区间」的前提冲突。
3. **版本路线：把 6.6 当未发布，直接改 6.6 的定义**，不把两端点写法留成可读旧形状。依据：分组参数的手写源只有 3 处（两份 `contract-valid` 夹具 + `export-authoring-contracts.ts` 里的 `groupedCase` 块），其余全是导出副本；`@metriccanvas/page` 还是 `1.0.0-rc.4`，6.6 是 2026-09-20 落的，仓里没有对应发布标签；而且 **6.7 和 6.8 已被别的在途改动占了**（6.7 = 层级筛选绑定逐级谓词字段，6.8 = ADR-0084 的收紧）。
4. **URL 形状同步改成纯文本**：点写 `?report-month=2026-03`，区间写 `?report-period=2026-01..2026-06`，不再是编码后的 JSON 块。

**未决**：提案 B（按用途分层）尚未批准，见第 6 节。

---

## 3. 当前工作区状态

### 已改动（未提交）

| 文件 | 改动 |
|---|---|
| `packages/page/src/query-param-references.ts` | 新增 `filter.time = {period, is_aggregate?, param, window?}` 分支：4 条新判定 + 3 条沿用；`resolveQueryParamReferences` 增 12 行派生分支；`hasQueryParamReferences` 认新形状。**两端点写法原样保留**，两条路并存 |
| `packages/engine/runtime/src/page-params.ts` | timeRange 的 URL 取值从 `JSON.parse` 改成 `..` 切分，`serializePageParam` 对称输出点 / 区间 |
| `pages/flow-analysis-report-params.json` | 5 个时间参数收回 1 个 `report-month`；12 个查询各自声明 window，与 `HEAD` 版 `paramBindings` 的窗口逐一对应；描述与页头副标题跟着改 |
| `packages/engine/runtime/tests/time-param-initialization.test.ts` | 保存值断言改成区间；补 URL 点 / 区间往返，补「区间喂给带 window 的引用会抛」 |
| `packages/engine/runtime/tests/grouped-params.test.ts` | URL 取值从 JSON 形改成 `..` 形 |
| `docs/plan/2026-09-21-page-params-orthogonal-shape.md` | 形状规格（新建） |
| `docs/plan/2026-09-21-page-params-orthogonal-plan.md` | 本文（新建） |

### 形状成立的量化证据

| 指标 | HEAD（旧数组 + paramBindings） | 6.6 现行方案迁移后 | 提案 A spike 后 |
|---|---|---|---|
| 声明的输入个数 | 2 | 6 | **2** |
| params 段字节 | 229 | 645 | **227** |
| 整页字节 | 67097 | 69631 | **66938** |
| `time-param-initialization.test.ts` | 基准 | 3 个用例全废 | **集成用例一字未改通过，只改 1 行保存值断言** |

### 验证结果

- `pnpm validate`：12 个页面文档，12 通过。
- `packages/page` + `packages/engine`：812 个用例，参数相关全绿。
- `tools/dqe-sim/tests/flow-analysis-report.test.ts`（也读这个页）：10/10。
- `tsc --noEmit -p packages/page/tsconfig.json` 干净；lint 干净。
- `pnpm authoring:contracts:check` 的 drift 只列 manifest / lock 四个哈希文件，**没有 `page/schema.json` 或 `page/conformance/**`**——印证新形状对导出契约中性（查询体在 `dsl_list` 内是 `z.record(unknown)`，不进 zod）。
- 全量 `vitest run`：1447 个用例 8 个红，逐个追过**没有一个来自本次改动**——2 个是 playground 的百万格式（`flow-kpis.annual-total`，本次之前就红着），1 个是 vite 端口 5174 vs 443，1 个是版本区间，其余是契约导出哈希漂移。

### 并发风险（必须知道）

写这一轮时**另一个会话正在同一个工作区里干活**：半小时内它把 `version.ts` 的 `CURRENT_MINOR` 从 6 推到 8、重生成了整个 `contracts/metriccanvas/page/**`、改了 `version-error.test.ts`，并且把 `query-param-references.ts` 的 filterBindings 判定换成了 `bindingQueryFields`。本次所有编辑都是对着磁盘现状做的精确替换，没有覆盖它的改动，但两边在同一份工作区上，提交前要重新核对。

---

## 4. 剩余计划

### 阶段一：收尾提案 A（可立即做）

| # | 任务 | 完成标准 |
|---|---|---|
| A1 | 删掉两端点写法：`query-param-references.ts` 去掉 `else if` 那一支及其 2 条判定（「时间端点必须为 {param, part}」「同一查询起止必须引用同一个时间参数」） | 该分支及判定在源码中不存在 |
| A2 | 改两份夹具：`packages/page/fixtures/contract-valid/grouped-params-page.json` 两端点 → 单引用，并让其中一个查询用「点 + window」，把两种用法都摆进正例；`grouped-scalar-params-page.json` 同步 | `pnpm validate` 与夹具校验通过 |
| A3 | 改 `tools/scripts/export-authoring-contracts.ts:127–148` 的 `groupedCase` 块：`mixed-time-sources` 反例随两端点写法消失，新增「window 与精度不相容」「window 用在非点区间上」「`param` 与字面量 start 并存」三例 | 反例覆盖与判定条数一一对应 |
| A4 | 重跑契约导出：`pnpm authoring:contracts` | `pnpm authoring:contracts:check` 无 drift |
| A5 | Python 侧 `metriccanvas-authoring/tool/.../domain/grouped_params.py` 的 `query_reference_issues()` 与 TS 判定逐条对齐 | `pnpm authoring:test` 通过，共同向量两侧一致 |
| A6 | 顺路拉齐两侧字段名：TS 放 `value`、Python 放 `default`，统一到 `value` | 共同向量字段名一致 |
| A7 | 文档：`PAGE-PARAMETERS.md`、`contracts/.../reference/params-and-text-values.md`、`.../queries-and-bindings.md`、`docs/page-metadata/reference-map.json` | 文档描述与实现一致 |
| A8 | 写 ADR：正交化的取舍、为什么改 6.6 定义而不另开次版本、URL 纯文本形状 | ADR 入 `docs/adr/`，`pnpm adr:index` 通过 |

### 阶段二：旧页处置（阶段一之后）

提案 A 之后旧页迁移是**无损改写**，有机器化规则：

```
{id, type:'time', granularity, required, default}
  → times: [{id, granularity, start: default, end: default, required}]

paramBindings[id] = {target:'time', window}   （在查询 Q 上）
  → Q.filter.time = {period, is_aggregate, param: id, window}
```

`page-parameter-inlining/tasks.md` P7 说的「保留不能安全迁移的页面」，在提案 A 下不再有这类页面。

按价值排序的候选（12 个页面全扫过）：

| 页面 | 现状 | 建议 |
|---|---|---|
| `customer-activity-risk-briefing.json` | 6.1、零参数；硬编码 `地区部=中国地区部`（4 个查询）、`代表处=北京代表处`（1 个）；恰好有两个真独立期间：当期 2026-07（3 个查询）与考察进展期 2026-01→2026-06（2 个） | **最值得改**，是「两个真独立区间」的天然演示。顺带会暴露一个现存毛病：`inspection-progress` 写 `period: "month"` 却配日期形 `2026-01-01 / 2026-06-01`，粒度不一致，改成分组参数会被校验逼着修正 |
| `flow-analysis-report.json` | 6.5、零参数、期间全硬编码 | 有个独立于参数改造的 bug：`customer-decline-top` 写的是 `"start": "202606", "end": "202606"`——既缺连字符又是 6 月，而同页另外 8 个查询都是 `2026-02`；参数版里那张卡的 `metricLabel` 也还写着「6月流水变化」，同一处复制漂移 |
| `ioc-project-detail.json` | 6.1、8 个旧数组参数全是 `type: string`，只给文本用不进查询 | 优先级最低，纯换写法无功能收益。小疑点：`mtime` 默认 `"202604"` 其实是个月份，哪天它要驱动查询就得改成 times |
| `demo.json` / `sales-detail.json` / `region-map.json` | 硬编码整年日区间、无参数、展示用 | 倾向不动 |

### 阶段三：提案 B（已批准，已随阶段一落地）

`params` 改成 `{query:{dimensions,times}, display}`，`scalars` 退役。「能不能进查询」从类型判定加了一条位置判定（`/params/query/` 前缀），错误信息从「类型不对」变成「引用的参数不在 params.query 下」；类型判定本身没有消失。两份夹具、`groupedCase` 向量、Python `declarations()` 与文档同批改完。

---

## 5. 验收标准

1. 同一个页面里能同时写「区间原样用」和「点 + window 派生」，校验通过，实际请求的起止与手算一致。
2. `pages/flow-analysis-report-params.json` 保持单个 `report-month`，`?report-month=2026-03` 一个键驱动全报告，12 个查询窗口与 `HEAD` 版逐一等价（跨年、闰月、边界年份都要覆盖）。
3. 任一 6.5 及更早的页面按第 4 节的机器化规则改写后，逐查询窗口语义不变。
4. 两端点写法在源码、夹具、向量、文档中都不存在。
5. TS 与 Python 两侧在共同向量上给出逐条相同的 `type/path/message`。
6. `pnpm validate`、`pnpm test`、`pnpm authoring:check`、`pnpm authoring:contracts:check` 全绿（扣除与本主题无关的在途失败）。

---

## 6. 风险与未决

- **提案 B 未批。** scalars 是残余这一点已达成共识，但改成 `params.query` / `params.display` 是形状变更，收益（分类学一致、display 顺序、未来加展示输入是闭集加成员）偏整容，成本是多一层嵌套和一次迁移。
- **「改 6.6 定义」依赖一个前提**：6.6 确实没有外部消费者。仓内已核实（无 Java 侧、无生产页面、无发布标签），仓外需要你确认。
- **带 window 的引用配非点区间，未填值模板要到取值期才报。** 这是结论 2 的明牌代价。
- **并发会话。** 见第 3 节末尾。
- ~~**能力探测的一个缺口**：`named-to-date-windows` 能力按 `paramBindings` 里的 window 探测，新形状把 window 放到了 `filter.time`，那条探测不会命中。~~ 已补第二个落点。

### IOC 四张页上公共 params：已按路线 2 做完

四张页共用的关键输入是 `mtime`（数据月份）与 `as-of-date`（日期），两者都是 `timePoint` 筛选器、带字面量默认值。曾有三条路：删掉筛选器改成 `params.query.dimensions`（改产品行为，还丢掉 `valueFormat: "compact"` 的 `2026-04 → 202604` 转换）、扩 `initialParam` 到非维度筛选器、或只迁 `ioc-project-detail`。

**选的是第二条，见 [ADR-0089](../adr/0089-page-parameters-can-seed-time-point-and-hierarchical-filters.md)**：6.11 把 `initialParam` 扩到时间点筛选器与层级维度筛选器，页内那两个控件照旧可改，口径日期同时有了声明形态。概览页声明 `report-month` 与 `report-as-of-date`，清单页声明前者，分析页声明后者；`ioc-project-detail` 的 8 个旧数组参数一并迁进 `params.display`。

注意它的 `mtime` 与前三张页同名但不是同一个东西——那个值来自清单页 navigate 的 `source: "row"`，是行数据里的紧凑月份串，不是页面口径输入。

---

## 7. 相关文件索引

- 形状规格：`docs/plan/2026-09-21-page-params-orthogonal-shape.md`
- 6.6 落地的改动：`8621f10f feat(page): add grouped dimensions and independent time parameters`
- 前序计划：`docs/plan/2026-09-20-grouped-page-params.md`、`docs/archive/page-params-inline-spec/{tasks,acceptance}.md`、`docs/archive/page-params-inline-spec/2026-09-17-page-template-inputs-spec.md`
- 协议核心：`packages/page/src/{query-param-references,page-param,param-bindings,time-param,version,validate}.ts`、`packages/page/src/schema/{primitives,page,data-source}.ts`
- 运行态：`packages/engine/runtime/src/page-params.ts`
- Python 镜像：`metriccanvas-authoring/tool/metriccanvas_authoring/domain/{grouped_params,page_validation}.py`
- 夹具与向量源：`packages/page/fixtures/contract-valid/grouped-*.json`、`tools/scripts/export-authoring-contracts.ts:127–148`
