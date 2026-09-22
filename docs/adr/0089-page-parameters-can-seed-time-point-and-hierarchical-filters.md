---
status: accepted
date: 2026-09-21
note: initialParam 从平面维度筛选器扩到时间点与层级维度筛选器；6.11 新增可选字段与放宽既有约束
---

# 页面参数可以给时间点与层级维度筛选器做初值

[ADR-0047](./0047-page-parameters-as-immutable-initialization-inputs.md) 把「打开后还能改」划给筛选器、「换一个取值就是另一个页面实例」划给页面参数。`initialParam` 是这条边界上的接缝：参数只负责打开那一刻的选中值，之后由筛选状态接管。

**但这条接缝只对平面维度筛选器开放。** `param-bindings.ts` 显式拒绝 `hierarchy`，也只在 `filter.type === 'dimension'` 时看 `initialParam`。后果在 IOC 那四张页上看得最清楚：它们共用的关键输入是「数据月份」和「数据截止日」，两个都是 `timePoint` 筛选器，于是这两个值只能以字面量默认值的形态写死在页面文档里——`"default": "2026-04"`、`"default": "2026-03-26"`。

这不是「少了个字段」，是**一整类页面输入没有声明形态**：口径日期本该是实例化时传进来的具名输入，可协议里它只能当成筛选器的一个常量。跨页传递也因此只能靠两边筛选器 id 恰好同名（概览 → 清单传 `mtime` / `region` / `key-office`），改一边名字另一边静默接不到，没有任何一处声明「这是这组页面的公共输入」。

绕开的办法只有两条，都更糟：把筛选器删掉改成 `params.query.dimensions`，等于为了拿到声明形态而拿走用户现在能点的月份选择器；或者继续写死，页面永远不是最终版本。

## 决策

**`initialParam` 扩到时间点筛选器与层级维度筛选器。** 这是两件事，规则各自独立。

### 时间点筛选器

```json
{ "id": "mtime", "type": "timePoint", "granularity": "month", "initialParam": "report-month" }
```

- **引用的必须是必需的 `times` 参数，且是单点**（`start === end`）。时间点的谓词是等值，区间没有唯一的点可取。这与 [ADR-0088](./0088-orthogonal-page-parameters-window-on-the-reference-and-layers-by-purpose.md) 的「点就是退化区间」是同一个模型，不为此新增一种参数类型。
- **精度必须与筛选器 `granularity` 一致**：`month` 参数配 `month` 筛选器，`date` 配 `date`。不隐式转换。
- **与 `default` 互斥**，与维度筛选器同一条口径：默认来源只能声明一次。
- **显式查询目标是那条 `timePoint` 筛选绑定本身**，不要求 `paramBindings` 里有对应条目——`paramBindings` 只有 `dimension` 与 `time` 两个目标，没有 `timePoint`。这里没有顺手去扩 `paramBindings`：维度那条之所以要求成对声明，是因为参数绑定会在初始化时把静态谓词写进查询体；时间点筛选器的值全程由筛选状态下推，多一份静态谓词只会制造第二个真源。

### 层级维度筛选器

原先的拒绝理由是「第一版参数初始化只支持平面维度筛选」——真实原因是层级筛选值由取值与层级两部分构成，而参数只给取值。现在这半边有确定答案了：**层级取 `defaultLevel`**（省略则取第一级），参数给取值。

[ADR-0084](./0084-hierarchical-filter-bindings-declare-a-query-field-per-level.md) 之后层级绑定是 `levelQueryFields`，所以「查询目标必须显式绑定同一参数」这条要落到**缺省层的那个字段**上：`paramBindings` 必须绑 `levelQueryFields[defaultLevel]`，绑别的层就不算显式绑定。这保持了原判定的意图——参数初始化的筛选器，它的初值必须真的落进查询——只是把「那个字段」从恒定字段改成按缺省层取。

### 版本

6.11。给 `timePointFilter` 加可选字段属增量；放宽「只支持平面维度筛选」属放宽既有约束，两者都在 [ADR-0051](./0051-additive-minor-versions-for-page-schema.md) 的次版本范围内。不需要行使任何例外。

## Consequences

- **IOC 四张页第一次有了声明出来的公共输入。** 概览页声明 `report-month`（月，单点 2026-04）与 `report-as-of-date`（日，单点 2026-03-26），清单页声明前者，分析页声明后者；三张页的 `mtime` / `as-of-date` 筛选器改写 `initialParam`，字面量默认值从文档里消失。页内那两个控件**照旧存在、照旧可改**——这正是选 `initialParam` 而不是把它们变成纯参数的原因。
- **初值不再写在筛选器上，意味着不实例化参数就没有初值。** `initialFilterValues(page.filters)` 直接读原始文档拿不到 `2026-04`，必须先走 `initializePageParams`。IOC 的两个运行态用例因此改成先实例化再断言，链条从「参数保存值 → 筛选初值 → 地图 navigate 带出的 URL」整条被钉住，比原先只断言筛选器上有个默认值强。
- **`ioc-project-detail` 顺带迁到分层参数**：8 个旧数组参数全是纯展示，整体搬进 `params.display`。它的 `mtime` 与前三张页的不是同一个东西——那个值来自清单页 navigate 的 `source: "row"`，是行数据的紧凑月份串，不是页面口径输入，所以留在 `display` 里当字符串。这一点值得写下来，因为两者同名，很容易被后来者合并成一个参数。
- **能力下限不受影响**：用了新写法的文档要求 6.11，`ioc-project-detail` 只用到 6.6 的分层参数，`requiredMinorVersion` 仍是 6，声明 6.11 只是「新文档写当前版本」。
- **URL 上同一件事现在有两个键**：筛选器自己的 `?mtime=2026-05` 和参数的 `?report-month=2026-05`。这与维度筛选器的既有情形一致（筛选器 URL 值覆盖参数给的初值），跨页导航仍走筛选器键，因此概览 → 清单的既有链路一个字没改。
- **Python 侧同步**：`_param_binding_issues` 的三条新判定与缺省层取字段逐条对齐，六个共同向量上两侧 `path/message` 完全相同。

## Considered Options

- **把 `mtime` / `as-of-date` 直接变成 `params.query.dimensions`，删掉筛选器。** 形状最干净，页面输入一眼可见。但它拿走了用户现在能点的月份与日期选择器，还丢掉 `valueFormat: "compact"` 那层 `2026-04 → 202604` 的转换——参数得直接保存 `202604`，一个对人不可读的串。为了协议整齐改产品行为，不采用。
- **给 `paramBindings` 加 `timePoint` 目标，与 6.9 的 `filterBindings` 对称。** 看起来更一致。但参数绑定的作用是在初始化时把静态谓词写进查询体，而时间点筛选器的值全程由筛选状态下推；两份并存就有两个真源，且它们在用户改动筛选器之后必然不一致。对称不是目的。不采用。
- **层级筛选器的初值连层级一起从参数取**（参数里存 `{value, level}`）。表达力最强。但这要求一种新的参数值形状，而 `defaultLevel` 本来就是「打开时在哪一层」的唯一真源，再引入第二个来源就要回答两者冲突时听谁的。不采用。
- **继续写死默认值，只在文档里注明「实例化时替换」。** 零改动。但「注明」不是机器判据，页面照样可以带着 2026-04 发布出去，这正是本决策要消灭的那类问题。不采用。
