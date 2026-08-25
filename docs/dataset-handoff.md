# AI Native 数据分析 / Data App 项目 Handoff Context

## 1. 项目背景

当前项目来源于企业内部的数据大屏 / IOC 指标看板体系。

现状技术与数据链路大致为：

```
指标
→ 指标关联数据资产
→ ADS / DWS / DWD / ODS
→ 表服务 / GraphQL / API / DQE
→ 前端 Angular 大屏

```

已有能力包括：

* 指标与数据资产体系
* 数据寻源能力
* GraphQL / API / DQE 等数据访问方式
* 一套统一的 Query DSL
* 存量 Angular 数据看板
* 已有低代码 JSON / 页面配置能力
* Svelte 实践，未来倾向更轻量 Runtime
* Data Agent，即自然语言问数 Agent
* AI 总结 / Insight 能力

Query DSL 已经是统一数据访问协议：

```
Query DSL
   ↓
DQE / API / GraphQL / 表服务

```

因此后续不需要再重新设计一套统一查询语言。

---

# 2. 项目最终目标

目标不是简单的：

> AI 自动写一个大屏。

也不只是：

> 对话生成 Data App。

更准确的目标是构建一个：

> **AI Native 数据分析与应用体系，让用户从一个业务问题出发，通过 AI 完成问数、探索分析、呈现，并将高价值分析沉淀为持续运行的数据应用。**

用户理想体验：

```
一句自然语言业务问题
        ↓
数据能力发现
        ↓
自动查询 / 计算
        ↓
直接得到分析结果
        ↓
允许通过自然语言进行几轮：
- 数据校准
- 筛选调整
- 展示调整
        ↓
必要时沉淀为 Data App

```

因此产品形态并不只有 Dashboard。

当前认为至少存在：

```
Ask
问数 / Data Agent

Explore
连续探索分析

Report
一次性分析报告

App
长期运行的 Data App

Monitor
未来可能的主动洞察 / 异常发现

```

一个重要产品原则是：

> **不是所有问题都值得做成 Data App。**

更合理的模式是：

```
先问
→ 持续探索
→ 发现是高频、高价值问题
→ 再沉淀成 Data App

```

即：

> 从“需求驱动开发报表”，转向“分析过程中自然长出应用”。

---

# 3. Data Agent 与 Data App 的关系

Data Agent 和 Data App 不应该建设成两套独立的数据能力。

例如用户：

> 中国区哪些代表处 NA 客户公司考察风险最高？

Data Agent：

```
需求理解
→ 数据发现
→ Query DSL
→ 数据获取
→ 数据计算
→ 分析
→ Answer

```

之后用户可能继续：

> 看最近半年变化。

然后：

> 这个分析以后每月都要看，帮我做成页面。

才进入：

```
当前 Analysis
→ App Spec
→ Runtime
→ Data App

```

因此：

> **Data Agent 负责探索，Data App 负责固化高价值分析。**

二者应该共享同一套底层数据计算能力。

---

# 4. 当前已经确定的关键架构决策

## 4.1 输入

目标态入口是：

> 用户的一个自然语言业务需求 / 痛点。

当前不希望为了架构完整，再额外设计一个重量级 Intent DSL / Analysis Intent 中间协议。

Agent 内部可以存在 transient plan，但暂时不作为正式平台协议。

---

## 4.2 Query

Query DSL 已经存在，而且统一封装：

* DQE
* API
* GraphQL
* 表服务等

所以 Query DSL 定位已经明确：

> **Agent 与数据能力之间的统一数据访问协议。**

当前真正需要增强的是：

> Capability Discovery

即 Agent 如何知道：

```
有什么指标？
有什么维度？
有什么 API / 表服务？
哪些数据能组合？
什么 grain？
有哪些查询能力？

```

---

## 4.3 UI

长期目标明确为：

```
App Spec
+
UI Runtime

```

而不是让 AI 大量生成 Svelte / Angular 页面源码。

Svelte 更可能承担：

> 实现稳定 Data App Runtime

而不是：

> 让 AI 更方便生成大量 Svelte 业务代码。

短期仍然允许特殊场景开发代码。

建议未来形成：

```
Level 1
App Spec + Standard Runtime

Level 2
App Spec + Extension / Custom Component

Level 3
Custom Code

```

Custom Code 是 Escape Hatch，而不是默认实现方式。

---

# 5. 当前最大的新增问题：数据不能总是直接展示

实际存量看板中，大量后端返回数据不能直接交给 UI。

例如：

```
突破率 =
突破客户数 / NA客户数

活动完成率 =
活动完成客户数 / NA客户数

同比 =
(current - lastYear) / lastYear

环比 =
(current - previous) / previous

CAGR =
power(end / begin, 1 / periods) - 1

```

甚至存在：

```
数据源 A
+
数据源 B
+
数据源 C
→ 聚合 / Join / 计算
→ 最终指标

```

过去这些大量写在：

```
*.datasource.ts
*.component.ts
fitFunction
calculatePop()
IndicatorCalculate

```

因此最初产生了一个问题：

> 如果 App Spec 只能配置数据源和 UI，那么复杂数据计算是不是只能重新生成业务代码？

当前讨论结论：

> **不是。**

这里应该增加一层统一的数据计算与 Transformation 能力。

---

# 6. 从 Calculation Runtime 演进到 Dataset Runtime

最开始考虑的是：

```
Query DSL
→ Calculation Runtime
→ Analysis Dataset
→ Data Agent / Data App

```

结合存量代码扫描后，结论进一步演进为：

> 单纯 Calculation Runtime 太窄。

因为除了公式，还大量存在：

* 多数据源 Join
* Group
* Aggregate
* Filter
* Lookup
* 时间序列补齐
* 不同 Grain 对齐
* Sort / Rank

因此当前更推荐的模型是：

# Dataset Runtime

```
Dataset Runtime
│
├─ Query
│   └─ Query DSL
│
├─ Transform
│   ├─ filter
│   ├─ join
│   ├─ lookup
│   ├─ group
│   ├─ aggregate
│   ├─ timeAlign
│   ├─ sort
│   └─ rank
│
└─ Compute
    ├─ arithmetic
    ├─ ratio
    ├─ delta
    ├─ pctChange
    └─ cagr

```

最终产出：

> **Computed Dataset / Virtual Dataset**

然后由上层统一消费：

```
Computed Dataset
       │
   ┌───┼────────┐
   ↓   ↓        ↓
Answer Report  App Spec
                ↓
             UI Runtime

```

因此目前一个非常重要的判断是：

> **Computed Dataset 很可能是 Data Agent 与 Data App 两条业务线真正的汇合点。**

---

# 7. Computed Dataset 应该是什么

它不能只是一张 Query 返回的数据表。

应该同时具备：

```
dimensions

atomic measures

derived measures

grain / key

calculation semantics

null / zero semantics

```

例如：

```
Dataset: customer_breakthrough

grain:
  month + repOffice

dimensions:
  month
  region
  repOffice

atomicMeasures:
  na_customer_count
  breakthrough_customer_count
  growth_customer_count

derivedMeasures:
  breakthrough_rate
  growth_rate
  yoy
  mom

```

其中：

```
breakthrough_rate =
safeDivide(
  breakthrough_customer_count,
  na_customer_count
)

```

---

# 8. 一个非常重要的原则：Calculation 与 Presentation 分离

存量前端现在经常混在一起：

```
业务计算
+
×100
+
万元转换
+
toFixed
+
%
+
箭头

```

未来必须拆开。

例如突破率真实数据：

```
0.123456

```

Calculation 层保持：

```
0.123456

```

Presentation 层才负责：

```
12.35%

```

同样：

```
12345678 RMB

```

真实 Dataset 不应该因为页面显示“万元”而变成：

```
1234.5678

```

App Spec 负责描述：

```
currency: RMB
scale: 10000
unit: 万元
precision: 2

```

这样：

* Data Agent
* 排序
* 再计算
* Report
* Data App

都消费真实值。

---

# 9. 存量前端计算规则扫描结果

已经执行过一次仓库扫描。

扫描范围：

`CDIOperationMapWebsite/website-src`

约扫描 80 个 TypeScript 文件，共收集到：

> **149 个前端数据计算 / 转换场景。**

主要分布：

* 比率 / 占比 / 完成率：42
* 环比 PoP：22
* 同比 YoY：7
* 差值 / 增长：10
* CAGR：3
* 多数据源合并 / 组装：10
* 单位换算 / 格式化：22
* 排序 / 分组：8
* 空值判断：4
* SQL 层预计算：4
* 时间序列 / 月份补全：6
* 图表格式化：8
* 代码 / 值映射：5

重要发现：

1. 存在 `IndicatorCalculate`，已经实现安全的 ADD / SUBTRACT / MULTIPLY / DIVIDE，但复用范围有限。
2. 空值语义非常不统一，至少存在四种判断：

   * 0 被视为 null
   * 0 不被视为 null
   * null / undefined / NaN
   * 字符串 `'null'`
     这是 Dataset Runtime 必须治理的问题。
3. 大量相同计算在地区部 / 全球 / 代表处等层级复制。
4. 至少多个场景需要前端合并 2～3 个 GraphQL 数据源。
5. 月份补全存在至少 4 套独立实现。
6. SQL 层和前端层的计算边界当前不统一，同一种同比 / 环比可能有的在 SQL 算、有的在前端算。

---

# 10. 149 个业务场景实际高度收敛

虽然有 149 个场景，但真正的计算模式并不多。

当前初步归纳为：

## Expression

```
ADD
SUBTRACT
MULTIPLY
SAFE_DIVIDE
POWER

```

上层可以提供更加语义化的：

```
RATIO(A, B)

DELTA(current, baseline)

PCT_CHANGE(current, baseline)

CAGR(begin, end, periods)

```

---

## Dataset Transformation

```
FILTER

JOIN / LOOKUP

GROUP

AGGREGATE

TIME_ALIGN

SORT

RANK

```

因此第一版 Dataset Runtime 没必要成为一个万能编程语言。

目标应该是：

> 用非常有限的标准操作覆盖绝大多数场景。

---

# 11. 当前发现的最复杂案例：管道支撑率

该案例非常重要，因为它用于验证 Dataset Runtime 是否真的可行。

业务计算大致为：

```
YTD Dataset
    ↓ filter + sum

Stock Forecast Dataset
    ↓ filter + sum

Target Dataset
    ↓ filter + sum

三份数据按 region / repOffice 对齐
        ↓

pipeline_support_amount
=
target
- ytd
- stock_forecast

        ↓

pipeline_support_rate
=
effective_opportunity
/
pipeline_support_amount

```

代码事实显示，该场景涉及三个数据源分别按地区过滤并 reduce 聚合，然后进行四则运算和比率计算。

代表处版本只是增加：

```
region + repOffice

```

两个关联条件，计算结构本身没有变化。

因此当前非常重要的判断：

> **连当前发现最复杂的核心业务指标，都仍然可以描述成标准 Dataset Transform + Compute，而不需要任意 TypeScript。**

目前没有发现强证据证明核心业务计算必须直接生成 Custom App Code。

---

# 12. Dataset Runtime 最重要的三个问题

## 12.1 Grain

这是目前认为最危险的问题。

必须明确每份 Dataset 的粒度：

```
region

region + repOffice

month + region

customer

customer + month

```

因为：

```
JOIN

```

语法正确，并不代表业务结果正确。

例如 ratio：

```
A区域：1 / 2 = 50%
B区域：9 / 90 = 10%

```

整体值应该是：

```
(1 + 9) / (2 + 90)

```

而不是：

```
AVG(50%, 10%)

```

因此 derived measure 不能只是保存：

```
A / B

```

还必须理解：

> aggregation semantic / grain。

---

## 12.2 Null / Zero Policy

当前存量实现差异非常大。

未来需要明确：

```
null
missing
zero
NaN
divide-by-zero

```

分别是什么语义。

例如：

```
SAFE_DIVIDE(A, B)

```

分母为 0 时到底：

```
null
0
--
error

```

不能继续由每个页面自己决定。

---

## 12.3 Calculation 与 Presentation 必须物理分离

当前存在 `_copy` workaround：

页面先将真实值格式化为字符串，又因为排序需要真实数值，只好保留：

```
field_copy

```

排序时使用副本。

未来 Dataset 应永远保留真实数值。

UI Runtime 只负责视觉格式。

---

# 13. 当前认为不应该进入 Dataset Runtime 的能力

以下属于 Presentation Runtime：

```
千分位

万元 / 亿

百分号

小数位

正负号

红绿箭头

tooltip HTML

Gauge formatter

图表圆角

图例文字

列标题展示

```

存量扫描也发现币种格式化、Tooltip、Gauge 等逻辑大量分散在页面代码中。

应该逐渐收敛到 UI / Presentation Runtime。

---

# 14. Custom Code 的定位

未来执行路径倾向于：

```
Query DSL
   ↓
Dataset Runtime
   ↓
标准能力能表达？
   │
   ├─ YES
   │    ↓
   │ Dataset Plan
   │
   └─ NO
        ↓
    Custom Transform / UDF
        ↓
    仍然不能满足
        ↓
    Custom App Code

```

即：

> **代码是最后一级 Escape Hatch。**

不是：

```
配置做不了
→ 直接写页面业务代码

```

---

# 15. 当前完整架构认知

目前讨论形成的整体结构为：

```
                     用户业务问题
                          ↓
                       Data Agent
                          ↓
                  Capability Discovery
                          ↓
                      Query DSL
                          ↓
                ┌──────────────────┐
                │ Dataset Runtime  │
                │                  │
                │ Query            │
                │ Transform        │
                │ Compute          │
                └────────┬─────────┘
                         ↓
                  Computed Dataset
                         │
          ┌──────────────┼───────────────┐
          ↓              ↓               ↓
       Answer          Report         App Spec
                                           ↓
                                       UI Runtime
                                           ↓
                                        Data App

```

长期还可能增加：

```
Monitor / Proactive Insight

```

复用同一 Data Intelligence 能力。

---

# 16. Human-in-the-loop 的目标

当前很多步骤都需要人工确认：

```
数据 / 指标匹配

Query DSL

表服务 / API 创建

页面 JSON / 代码

```

最终不希望用户确认实现细节。

目标从：

```
Agent 做一步
→ 人确认
→ Agent 做一步
→ 人确认

```

逐渐变成：

```
Agent 完整执行
      ↓
自检 / 校验
  ↙       ↘
通过      异常
 ↓         ↓
继续     人介入

```

即：

> **Human-in-the-loop → Human-on-exception**

用户应该确认的是：

> “这个分析结果是不是我要的？”

而不是：

> “这个 Query DSL / JSON 写得对不对？”

---

# 17. 当前尚未决定的问题

以下是新会话应该继续重点讨论的内容。

## A. Dataset Runtime v0.1 最小能力集

需要基于 149 个真实案例判断：

```
第一版到底需要哪些 Operator？

```

不要做万能表达式系统。

---

## B. Dataset Plan 应该长什么样

目前倾向：

> Agent 内部 Execution Plan / IR。

暂时：

* 不做用户协议
* 不做新的大型 DSL
* 可以不持久化
* 主要作为 Agent → Dataset Runtime 的执行描述

需要进一步设计最小结构。

---

## C. Grain 如何表达和校验

这是最大的正确性问题之一。

需要明确：

```
Dataset grain

JOIN key

aggregation semantic

ratio aggregation

```

以及 Agent 生成 Dataset Plan 时怎么做静态校验。

---

## D. Null Policy

需要确定统一语义。

尤其：

```
SAFE_DIVIDE

```

的 null / zero 策略。

---

## E. Execution Location

逻辑定义与物理执行位置应该分离。

例如同一个 Dataset Plan：

```
小数据
→ 浏览器 / JS Runtime

大数据
→ SQL / DQE pushdown

跨数据源
→ Compute Service

特殊场景
→ UDF

```

Dataset Plan 不应该绑定具体执行引擎。

---

# 18. 建议下一步

不要继续扫描更多仓库，也不要马上设计完整平台。

直接用三个真实案例验证 Dataset Runtime v0.1。

## Case 1：简单

NA 客户突破率：

```
突破率 =
突破客户数 / NA客户数

```

验证：

```
Derived Measure
Null Policy
动态筛选

```

---

## Case 2：中等

12 个月趋势：

```
Query
→ 月份补全
→ 比率
→ 环比
→ Sort / Time Align

```

验证：

```
Time Series
Time Align
Derived Measure Chain

```

---

## Case 3：复杂

管道支撑率：

```
3 Dataset
→ Filter
→ Aggregate
→ Join
→ 多阶段 Derived Measure

```

验证：

```
Multi Dataset
Grain
Join
Aggregate
Calculation dependency

```

如果这三个案例能用一个很小的 Dataset Plan 描述清楚，再扩展 Runtime。

---

# 19. 下一会话建议直接从这里开始

请继续帮助我设计：

> **Dataset Runtime v0.1**

要求：

1. 基于上述真实存量场景，不做理想化的大而全架构；
2. 先给出最小 Operator 集；
3. 用“NA突破率 / 12月趋势 / 管道支撑率”三个案例逐个验证；
4. 特别关注：

   * Grain
   * Join
   * Aggregate
   * Null Policy
   * Derived Measure dependency
5. Dataset Plan 暂定为 Agent 内部 IR，不设计成对外正式 DSL；
6. Calculation 与 Presentation 严格分离；
7. Custom Code 作为最后 Escape Hatch；
8. 最终判断 Dataset Runtime 是否真的能覆盖当前大部分 Data Agent + Data App 场景。

核心问题不是：

> “Schema 应该怎么写？”

而是：

> **“为了让 AI 从业务问题稳定地产出正确的 Computed Dataset，最少需要哪些数据计算与变换原语？”**
