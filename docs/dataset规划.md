我继续推演后，会把整个方案收敛成一句话：

> **Dataset Runtime 本质上不是“计算引擎”，而是一套 Typed Dataset Algebra：Agent 生成带业务语义的 Dataset DAG，Compiler/Validator 证明 Grain、聚合和 Join 合法，再交给不同执行引擎执行。**

这会比“设计一个越来越强的 Dataset DSL”更稳，也更适合你们现在 **Data Agent → Explore → Data App** 的产品路径。文档里已经明确，Computed Dataset 是 Agent 与 App 的汇合点，而 Dataset Plan 只是内部执行描述。 

---

# 一、我认为最优雅的完整方案

整体不是一个 Runtime，而是下面这五块：

```text
                         用户业务问题
                              ↓
                         Data Agent
                              ↓
                    Capability Discovery
                              ↓
                 ┌────────────────────────┐
                 │   Capability Catalog   │
                 │ 指标 / 维度 / Grain   │
                 │ 聚合语义 / 数据关系   │
                 └───────────┬────────────┘
                             ↓
                    Logical Dataset Plan
                    （Typed Dataset DAG）
                             ↓
                 ┌────────────────────────┐
                 │ Validator / Compiler   │
                 │                        │
                 │ Type                   │
                 │ Grain                  │
                 │ Aggregation            │
                 │ Join Cardinality       │
                 │ Null / Time            │
                 │ Dependency             │
                 └───────────┬────────────┘
                             ↓
                      Physical Planner
                             ↓
            ┌────────────────┼─────────────────┐
            ↓                ↓                 ↓
         DQE / SQL       Compute Service     Browser
        Pushdown
            └────────────────┼─────────────────┘
                             ↓
                     Computed Dataset
                     + Semantic Metadata
                     + Lineage
                             │
                ┌────────────┼──────────────┐
                ↓            ↓              ↓
             Answer        Report        App Spec
                                             ↓
                                         UI Runtime
```

**逻辑语义和物理执行完全分开。**

这正好接上你们已经确定的 Execution Location 原则。

---

# 二、真正的核心：Dataset 是一个“带类型的数据对象”

我不会只定义：

```text
Dataset = rows[]
```

而会定义为：

```text
Dataset
├── schema
│   ├── dimensions
│   └── measures
│
├── grain
│
├── keys
│
├── time
│
├── relationships
│
└── lineage
```

其中最关键的是前三个。

---

## 2.1 Grain 和 Key 必须分开

比如：

```text
grain:
  month + repOffice
```

表达的是：

> 一行数据在业务上代表“某月 × 某代表处”。

而：

```text
uniqueKey:
  month + repOffice
```

只是当前碰巧和 Grain 相同。

未来可能出现：

```text
grain:
  customer

uniqueKey:
  customerId
```

或者：

```text
grain:
  customer + month

uniqueKey:
  snapshotId
```

**Grain 是业务语义，Key 是数据约束。**

不要把两者合并成一个概念。

---

# 三、Measure 必须拥有“聚合语义”

我认为这会成为 Dataset Runtime 最重要的数据模型。

以前可能只是：

```text
na_customer_count: number
```

未来应该至少知道：

```text
na_customer_count
type: number
semanticType: count
rollup: SUM
```

另一个指标：

```text
breakthrough_rate
type: number
semanticType: ratio
rollup: RECOMPUTE
formula:
  breakthrough_customer_count
  /
  na_customer_count
```

这样当 Grain 从：

```text
month + repOffice
```

变成：

```text
month + region
```

Runtime 才知道：

### `na_customer_count`

可以：

```text
SUM()
```

### `breakthrough_rate`

绝对不能：

```text
AVG()
```

而必须：

```text
SUM(breakthrough_customer_count)
/
SUM(na_customer_count)
```

这就是你们文档里“50%、10% 不能直接平均”的问题真正应该落地的地方。

---

# 四、我会把 Rollup Semantic 设计成四种

这是我推荐的长期模型：

```text
SUM
RECOMPUTE
REQUERY
FORBID
```

### 1. SUM

普通可加指标：

```text
revenue
customer_count
pipeline_amount
```

可以安全：

```text
month + repOffice
    ↓ aggregate
month + region
```

---

### 2. RECOMPUTE

派生指标：

```text
breakthrough_rate
growth_rate
profit_margin
pipeline_support_rate
```

Grain 改变时不能聚合结果列，而是重新执行公式。

---

### 3. REQUERY

这个非常重要。

比如：

```text
COUNT(DISTINCT customer_id)
```

假设：

```text
北京 = 100
上海 = 100
```

不能保证：

```text
中国 = 200
```

因为客户可能重复。

所以它不能：

```text
SUM
```

也不能：

```text
RECOMPUTE
```

必须：

```text
重新在新的 Grain 查询
```

即：

```text
rollup = REQUERY
```

这一类如果不建模，Dataset Runtime 很容易产生**看起来正确、实际错误**的数据。

---

### 4. FORBID

一些东西根本没有合法的上卷含义：

```text
某客户名称
某次活动状态
某个文本备注
```

则：

```text
rollup = FORBID
```

Validator 直接拒绝。

---

# 五、这样 Operator 本身反而可以非常少

我现在会把 v0.1 定成：

```text
QUERY

FILTER

AGGREGATE

JOIN

DERIVE

TIME_ALIGN

TIME_SHIFT

SORT
```

只有 **8 个**。

与现有 149 个场景归纳出的模式基本吻合。现有扫描本身已经显示大量场景最终收敛到 Filter、Join、Aggregate、时间补齐、排序和少量表达式操作。

---

# 六、为什么我把 LAG 改成 TIME_SHIFT

上一轮我提出：

```text
LAG
```

继续想下来，我认为：

```text
TIME_SHIFT
```

更优雅。

因为你们业务需要的是：

```text
上月
去年同期
前 3 月
前 12 月
```

而不是：

```text
第 N 行之前
```

所以：

```text
TIME_SHIFT
  field: breakthrough_rate
  offset: -1
  unit: month
```

或者：

```text
TIME_SHIFT
  field: breakthrough_rate
  offset: -12
  unit: month
```

这比：

```text
LAG(field, 12)
```

更具有业务语义。

而且 Runtime 可以检查：

```text
Dataset 有没有 timeDimension？
time grain 是不是 month？
数据是否已经 TIME_ALIGN？
partition grain 是否一致？
```

这样就没必要把 SQL Window Functions 整头怪兽搬进来。🐙

---

# 七、Expression 层也只需要很小

底层：

```text
ADD
SUBTRACT
MULTIPLY
SAFE_DIVIDE
POWER
COALESCE
```

上层语义函数：

```text
RATIO
DELTA
PCT_CHANGE
CAGR
```

其中：

```text
RATIO
PCT_CHANGE
CAGR
```

本质上只是 Macro。

例如：

```text
PCT_CHANGE(current, baseline)
```

Compiler 展开成：

```text
SAFE_DIVIDE(
    SUBTRACT(current, baseline),
    baseline
)
```

所以以后 Agent 可以说：

```text
PCT_CHANGE
```

Executor 根本不需要理解“环比”这个业务词。

---

# 八、Plan 不应该是“Schema”，应该是 DAG

比如管道支撑率：

```text
                 query:ytd
                     ↓
                   filter
                     ↓
                  aggregate
                     │
                     │
 query:stock → aggregate
                     │
                     ├──── join ────┐
                     │              │
 query:target → aggregate           │
                                    ↓
                                  derive
                          pipeline_support_amount
                                    ↓
                                  derive
                          pipeline_support_rate
```

Agent 实际生成：

```text
n1 QUERY
n2 FILTER(n1)
n3 AGGREGATE(n2)

n4 QUERY
n5 AGGREGATE(n4)

n6 QUERY
n7 AGGREGATE(n6)

n8 JOIN(n3,n5)
n9 JOIN(n8,n7)

n10 DERIVE(n9)
n11 DERIVE(n10)
```

这样天生解决：

```text
多数据源
依赖关系
执行顺序
公共子表达式
并行执行
血缘
```

也天然适配 Agent。

---

# 九、但 Agent 不应该自己声明输出 Grain

这是我认为非常重要的设计变化。

不要让 Agent写：

```json
{
  "op": "aggregate",
  "outputGrain": ["region"]
}
```

然后 Runtime 相信它。

正确模式应该是：

```text
Agent 给操作

         ↓

Compiler 推导 Output Contract
```

比如：

```text
Input Grain
=
month + region + repOffice
```

Agent：

```text
AGGREGATE groupBy=[month, region]
```

Compiler 推导：

```text
Output Grain
=
month + region
```

所以：

> **Dataset Contract 是 Compiler 推导出来的事实，而不是 Agent 声明的愿望。**

这会极大减少 Agent hallucination 造成的数据错误。

---

# 十、Validator 应该像一个编译器

我甚至不会把它叫“校验器”。

长期我更倾向叫：

> **Dataset Compiler**

因为它做的事情已经很像编译：

```text
Agent Plan
    ↓
Parse
    ↓
Resolve Fields
    ↓
Type Check
    ↓
Grain Inference
    ↓
Aggregation Check
    ↓
Join Check
    ↓
Dependency Check
    ↓
Optimization
    ↓
Physical Plan
```

---

# 十一、Validator 至少应该做 7 类检查

## ① Schema

比如：

```text
breakthrough_count / foo
```

`foo` 不存在：

```text
UNKNOWN_FIELD
```

---

## ② Type

```text
customer_name / revenue
```

拒绝：

```text
TYPE_MISMATCH
```

---

## ③ Grain

```text
A:
month + region

B:
month + repOffice
```

直接按 month Join：

```text
UNSAFE_GRAIN_JOIN
```

---

## ④ Cardinality

v0.1：

```text
1:1     ✅

N:1     ✅ lookup

1:N     谨慎

N:N     ❌
```

我建议第一版直接禁止 N:N。

---

## ⑤ Aggregation Semantic

如果：

```text
COUNT_DISTINCT customer
```

是：

```text
REQUERY
```

Agent 却要求：

```text
SUM
```

直接：

```text
ILLEGAL_ROLLUP
```

---

## ⑥ Dependency

比如：

```text
A = B / C
B = A + D
```

直接：

```text
CYCLIC_DERIVED_MEASURE
```

---

## ⑦ Time

比如：

```text
TIME_SHIFT(-1 month)
```

但是：

```text
timeDimension = day
```

或者根本没 timeDimension：

```text
INVALID_TIME_OPERATION
```

---

# 十二、JOIN 的最优解不是靠 Agent 猜，而是 Relationship

Capability Catalog 应该提供：

```text
customer
    N:1
repOffice
```

或者：

```text
repOffice
    N:1
region
```

例如：

```text
relationship:
  from: repOffice
  to: region
  cardinality: N:1
```

于是 Agent 写：

```text
JOIN customerDataset regionDataset
```

Compiler 才能证明：

```text
customer → repOffice → region
```

是安全的。

所以：

> **Capability Discovery 不能只告诉 Agent“有什么字段”，还必须告诉它字段之间怎样关联。**

这是我认为目前架构需要补充的一块。

文档现在对 Capability Discovery 的关注已经包括指标、维度、数据组合、grain 和查询能力。

我建议正式扩成：

```text
Capability =
Data
+
Semantics
+
Relationships
```

---

# 十三、Null Policy，我还是建议保持极端简单

Dataset Runtime 内：

```text
missing row ≠ zero
null ≠ zero
0 = 0
```

### TIME_ALIGN

默认：

```text
missing month
→ null
```

不是：

```text
→ 0
```

### SAFE_DIVIDE

```text
null / X → null
X / null → null
X / 0 → null
0 / X → 0
```

### 真正需要 0

显式：

```text
COALESCE(field, 0)
```

这样每一个“null 变 0”的地方都会留下数据血缘。

而不是悄悄发生。

你们扫描发现至少四套 null / zero 判断，这正是需要统一治理的区域。

---

# 十四、Calculation / Presentation 边界还能再严格一点

你们已经确定：

```text
0.123456
```

Dataset 保存真实值。

UI 再：

```text
12.35%
```

这是正确的。

但我会再细分一下：

### Dataset semantic metadata

应该允许：

```text
semanticType: currency
currency: CNY
```

因为：

```text
CNY + customer_count
```

从计算语义上就是错的。

### Presentation metadata

才是：

```text
scale: 10000
precision: 2
suffix: 万元
```

所以严格来说：

```text
currency=CNY
```

不是 UI 属性。

它是数据语义。

而：

```text
万元
```

才是 Presentation。

这个边界以后会帮 Validator 做很多事情。

---

# 十五、还有一个很关键的能力：Parameter

如果只考虑 Agent 一次性问数，很容易忽略这个。

例如：

> 中国地区部 NA 客户突破率

Agent 可以直接生成：

```text
region = 中国地区部
```

但是一旦：

> 帮我做成 Data App

页面需要：

```text
地区部 Filter
```

那 Dataset Plan 就不能把：

```text
中国地区部
```

写死。

所以 Plan 应该支持：

```text
parameters:
  region
  month
  repOffice
```

Filter：

```text
region = $region
```

App Spec 只需要：

```text
UI Filter
    ↓ bind
Dataset Parameter
```

这样：

```text
Data Agent
```

阶段可以：

```text
$region = 中国地区部
```

到：

```text
Save as App
```

时，把它提升成页面 Filter。

这个机制非常重要，因为它能真正实现你文档里的：

> 从分析过程中自然长出应用。

---

# 十六、所以 Ask → App 的演进会非常漂亮

### Ask

```text
用户：
中国区 NA 突破率是多少？

↓
Ephemeral Dataset Plan

region = 中国
month = 当前月
```

---

### Explore

```text
看最近 12 月

↓

修改 Plan

month = last12Months
+ TIME_ALIGN
+ TIME_SHIFT
```

---

### Explore

```text
拆到代表处看看

↓

修改 Grain

month + repOffice
```

---

### App

```text
这个以后每个月都看

↓

Canonicalize Plan
Validate
Freeze Version
Bind Parameters
Persist
```

最后：

```text
Dataset Definition
+
App Spec
```

形成 Data App。

这其实把你们产品路线：

```text
Ask → Explore → App
```

直接映射到了技术架构。

---

# 十七、这里我会修改 handoff 中一个小判断

文档目前说 Dataset Plan：

> 可以不持久化。

我建议改成：

> **Dataset Plan 不需要成为公开 DSL，但必须天然可序列化、可版本化。**

因为：

### Ask / Explore

可以 ephemeral。

### Data App

必须：

```text
Persist
Version
Replay
Debug
Audit
```

否则半年后这个 App 怎么重新执行？

所以：

```text
Internal IR ≠ Temporary Object
```

而应该：

```text
Internal IR
    ├─ ephemeral mode
    └─ persisted mode
```

不需要为此再设计一个新 DSL。

**同一个 Plan 即可。**

---

# 十八、最终的核心数据结构其实只有三种

这是我认为整个设计最漂亮的地方。

## 1. Capability Contract

告诉 Agent：

```text
有什么
是什么意思
怎么关联
怎样聚合
```

---

## 2. Dataset Plan

告诉 Runtime：

```text
我要怎么得到结果
```

---

## 3. Computed Dataset

告诉消费者：

```text
结果是什么
什么 Grain
字段是什么意思
怎么算出来的
```

可以理解成：

```text
Capability
    ↓
  Plan
    ↓
 Result
```

整个 Data Intelligence 底座围绕这三个对象运转即可。

---

# 十九、那么 Dataset Runtime v0.1 最终应该长这样

```text
┌───────────────────────────────────────────────┐
│                Capability Catalog             │
│                                               │
│ Dimension                                     │
│ Measure                                       │
│ Grain                                         │
│ Rollup Semantic                               │
│ Relationship                                  │
│ Time                                          │
└─────────────────────┬─────────────────────────┘
                      ↓
┌───────────────────────────────────────────────┐
│              Logical Dataset Plan             │
│                                               │
│ QUERY                                         │
│ FILTER                                        │
│ AGGREGATE                                     │
│ JOIN                                          │
│ DERIVE                                        │
│ TIME_ALIGN                                    │
│ TIME_SHIFT                                    │
│ SORT                                          │
└─────────────────────┬─────────────────────────┘
                      ↓
┌───────────────────────────────────────────────┐
│               Dataset Compiler                │
│                                               │
│ Resolve                                       │
│ Type Check                                    │
│ Grain Inference                               │
│ Rollup Validation                             │
│ Join Validation                               │
│ Time Validation                               │
│ Dependency Validation                         │
└─────────────────────┬─────────────────────────┘
                      ↓
                Physical Plan
                      ↓
     SQL / DQE / Browser / Compute Service
                      ↓
┌───────────────────────────────────────────────┐
│               Computed Dataset                │
│                                               │
│ Data                                          │
│ Schema                                        │
│ Grain                                         │
│ Semantic Metadata                             │
│ Lineage                                       │
│ Diagnostics                                   │
└───────────────────────────────────────────────┘
```

---

# 二十、三个真实案例放进去，都成立

### NA 突破率

```text
QUERY
→ DERIVE
```

验证：

```text
Derived Measure
Null
```

---

### 12 月趋势

```text
QUERY
→ TIME_ALIGN
→ DERIVE rate
→ TIME_SHIFT
→ DERIVE mom/yoy
→ SORT
```

验证：

```text
Time
Derived Dependency
Missing Period
```

---

### 管道支撑率

```text
QUERY A → FILTER → AGGREGATE
QUERY B → FILTER → AGGREGATE
QUERY C → FILTER → AGGREGATE
                  ↓
                 JOIN
                  ↓
                DERIVE
                  ↓
                DERIVE
```

验证：

```text
Multi Source
Grain
Rollup
Join
Dependency
```

而你们扫描得到的最复杂案例本身就已经证明这一方向具有现实基础。

---

# 二十一、现在真正需要你决策的关键项

我会把它分成 **必须现在拍板的 8 项**，和可以以后再谈的东西。

| #     | 决策                    | 我的推荐                                              |
| ----- | --------------------- | ------------------------------------------------- |
| **1** | Dataset Runtime 本质定位  | **Typed Dataset Algebra + Compiler，而不是 DSL/脚本引擎** |
| **2** | Grain 谁说了算            | **Capability + Compiler 推导，Agent 不得自行声明事实**       |
| **3** | Measure 聚合语义          | **明确建模 `SUM / RECOMPUTE / REQUERY / FORBID`**     |
| **4** | Join v0.1 范围          | **只开放 Same-grain 1:1 和 N:1 Lookup，禁止 N:N**        |
| **5** | 时间能力                  | **TIME_ALIGN + TIME_SHIFT，不做通用 Window**           |
| **6** | Null Policy           | **平台统一语义；null→0 必须显式 COALESCE**                   |
| **7** | Plan 生命周期             | **内部 IR，但必须可序列化；Ask 临时，App 持久化并版本化**              |
| **8** | Capability Catalog 范围 | **不能只有字段发现，必须包含 Grain、Rollup、Relationship**       |

我认为这 **8 个就是架构骨架**。

其中前三个最重要。

---

# 二十二、第二优先级还有 5 个决策

这些需要设计，但不阻塞第一轮验证：

### 9. Parameter 模型

是否把：

```text
region
repOffice
timeRange
```

作为 Dataset Plan 一等公民。

我的答案：**是。**

否则 Explore 很难自然升级成 App。

---

### 10. Semantic Type

是否区分：

```text
count
currency
ratio
duration
plainNumber
```

我的答案：**建议有，但 v0.1 先非常轻。**

---

### 11. Error Policy

哪些错误：

```text
直接 Fail
```

哪些：

```text
Warning
```

建议：

```text
Grain / Join / Rollup / Type
→ FAIL

Data Quality / Performance
→ WARN
```

---

### 12. Pushdown

第一版是否做自动优化：

```text
FILTER
AGGREGATE
DERIVE
→ DQE / SQL
```

我的建议：

> **架构上预留，v0.1 不追求智能优化。**

先保证结果正确。

---

### 13. Lineage

Computed Dataset 是否记录：

```text
字段来自哪里
Query 是什么
执行了什么 Transform
Derived Measure 怎么算
```

我的建议也是：

> **从 v0.1 就保留。**

因为 Agent 后续解释：

> “这个 12.3% 怎么来的？”

直接需要它。

---

# 二十三、反而有一批事情我建议现在明确“不做”

这能防止架构长胖：

```text
❌ 通用 Expression DSL

❌ SQL Window 全能力

❌ N:N Join

❌ 任意 UDF

❌ 自定义 TypeScript Transform

❌ UI formatter

❌ 自动优化器大全

❌ 可视化 Dataset Designer

❌ Dataset Marketplace

❌ 新的 Query Language
```

你们已经有 Query DSL，就不要再造一层平行语言。

---

# 二十四、如果让我现在替你拍板

我会直接确定这五条顶层原则：

> **① Dataset Runtime 是一个带 Grain 与 Measure Semantic 的 Typed Dataset Algebra。**

> **② Agent 负责提出 Plan，Compiler 负责证明 Plan 正确，Agent 永远不是数据语义的最终权威。**

> **③ Grain 是第一等类型；任何 Aggregate / Join 都必须产生可证明的 Grain 变化。**

> **④ Derived Measure 保存公式与依赖关系，而不是把计算后的数字当成普通 Measure；Grain 改变后必须 RECOMPUTE。**

> **⑤ Data Agent 和 Data App 不共享页面代码，而共享同一个可验证、可执行、可持久化的 Dataset Plan。**

如果这五条确定下来，后面的 JSON Schema 其实都只是工程细节。

**下一步最值得做的不是 Schema，而是给这 8 个 Operator 写“类型签名 + Grain 变换规则 + 合法/非法案例”。** 做完以后，我们就能像设计一门很小的类型系统一样，把三个真实 Case 从头“编译”一遍。这一步很可能会暴露 Dataset Runtime v0.1 最后几个真正的缺口。
