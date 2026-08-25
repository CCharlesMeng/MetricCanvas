---
status: proposed
---

# GraphQL 查询分支以结构化谓词表达，不透传 WHERE 模板

[ADR-0034](./0034-graphql-rest-as-data-gateway-adapters.md) 已裁决 GraphQL 作为数据网关的执行适配器接入、`query.language` 升级为判别联合，但明确把分支形状留给真实需求：「表服务路径同样按本决策接入，本 ADR 不为它单列分支,待真实需求出现时再定形状。」IOC 作战地图是这个真实需求——三个页面的全部数据源都是 GraphQL，没有一条走 DQE。

代码侧的脚手架已经就位，`pageQueryZ` 是只有一支的判别联合，注释指向 `../query` 的协议闭集。缺的是这一支长什么样。

难点不在于「怎么发 GraphQL 请求」，而在于**来源实现把筛选条件表达成了字符串模板**：

```
mtime = '{{externalObject_opportunity_outline_end}}'
{{externalObject_is_key_poffice === 1 ? ' and is_key_poffice = ' + externalObject_is_key_poffice : ''}}
{{externalObject_cloud_class_code != '' ? externalObject_cloud_class_code : ''}}
{{externalObject_area_sql}}
```

这一段里混了三样性质不同的东西：值插值、JS 三元条件片段、以及上游代码预先拼好的 SQL 片段（`area_sql` 由区域筛选器按当前层级拼成 ` and region_dept_code_fin in ('R01','R02')`）。排序同样是模板条件：

```json
{ "name": "bidding_amount",
  "orderDesc": { "condition": "{{externalObject_is_asc === false && externalObject_sorting_field === 'bidding_amount'}}", "priority": "1" } }
```

把这些原样搬进页面文档，[ADR-0003](./0003-strict-declarative-spec.md) 的「禁表达式与脚本」会当场失守，而 ADR-0003 是 [ADR-0001](./0001-domain-dsl-over-a2ui.md)、[ADR-0002](./0002-svelte-runtime.md)、[ADR-0005](./0005-build-over-open-source-bi.md) 的共同前提——协议封闭可控，AI 生成结果才可控、可自动修复。字符串 WHERE 里的筛选条件对校验器完全不透明：无法判定某个筛选器是否真的影响了查询，无法判定绑定的字段是否存在，也无法在 AI 写错时定位到具体位置。

## 决策

**`pageQueryZ` 新增 `graphql` 分支，判别键仍是 `language`。** `dqe` 分支形状一字不动，存量页面不迁移。`filterBindings` 与 `initial` 的顶层语义按 ADR-0034 保持不变。

**筛选条件以结构化谓词声明，不以字符串表达。** 查询定义声明一个谓词列表，每条谓词由四部分组成：目标字段、算子、值来源、空值行为。算子是封闭闭集（`eq`/`ne`/`in`/`notIn`/`gt`/`gte`/`lt`/`lte`/`between`/`like`），值来源只有两种——字面量，或绑定到一个页面筛选器（[ADR-0050](./0050-filter-type-closure-and-hierarchical-dimensions.md)）或页面参数（[ADR-0047](./0047-first-class-page-parameters.md)）。适配器负责把谓词列表编译成该 GraphQL 服务所需的 WHERE 形态；编译规则属于适配器，不属于页面文档。

**条件片段由空值行为承担，不引入条件表达式。** 谓词可声明 `omitWhenEmpty`：绑定值为空时整条谓词消失。来源实现里那三处 JS 三元判断的全部语义都落在这一个布尔上——「仅看重点国代」未勾选即空值即省略，产业未选即空值即省略。**不提供 `when` 条件、不提供分支、不提供任何形式的求值。** 一旦发现某个真实场景需要 `omitWhenEmpty` 之外的条件语义，正确的动作是回来修订本决策，而不是在页面文档里长出表达式。

**层级维度的谓词字段由绑定值的当前层级决定。** 区域筛选选到地区部时字段是 `region_dept_code_fin`，选到代表处时是 `rep_office_code_fin`，选到责任中心时是 `geo_pc_code`。谓词因此可声明一张层级到字段的映射表，适配器按绑定值携带的层级取字段。这取代了来源实现中 `area_sql` 那段由前端代码拼装 SQL 的做法，层级语义的真源是筛选器（ADR-0050），不是散落在每个查询里的字符串。

**排序以结构化排序绑定表达。** 查询定义声明哪些字段可排序及其在 GraphQL 侧的排序位置；表格当前排序列与方向作为生效查询的一部分进入，由适配器编译成 `orderAsc`/`orderDesc` 与优先级。页面文档里不出现「当前排序字段等于 X 时降序」这类条件。这同时是 [ADR-0049](./0049-table-server-side-and-presentation-capabilities.md) 解除「查询分页不支持排序」限制的前置条件。

**总条数由计数声明承担，谓词不重复书写。** GraphQL 没有 DQE 的 `total_count`，来源实现是另起一个数据源查 `cnt` 且 WHERE 与主查询逐字相同。页面因此可在查询定义上声明计数查询的对象与计数字段，**由适配器复用主查询的同一组谓词**发起第二次请求。不允许页面声明两份谓词：两份谓词必然漂移，而漂移的表现是「总条数与实际结果不一致」这种极难归因的错误。

**端点、凭据与响应摊平按 ADR-0034 原样执行。** 端点与凭据不进页面文档；从响应到行集的取值路径必须显式声明，不按样例推断。

**本决策不做的事。** 不提供 GraphQL 查询原文透传（那只是把字符串换了个位置）；不提供任意 JSON 路径转换（摊平路径是声明，不是转换语言）；不提供跨对象 join（那是 [ADR-0046](./0046-controlled-computation-with-named-operators.md) 的 `joinAggregate` 要回答的问题，且属于第二批）；不交付 ADR-0034 要求的 GraphQL 发现描述。

## Consequences

- `QUERY_LANGUAGES` 闭集与 `pageQueryZ` 同批扩展，`PAGE-METADATA.md` 与生成的 JSON Schema 同步。判别联合新增分支属纯增量变更，随本批进入 `schemaVersion` 5.1（[ADR-0051](./0051-additive-minor-versions-for-page-schema.md)），`language: 'dqe'` 的存量页面不迁移。
- 需要一个与 `tools/dqe-sim` 对位的 GraphQL 仿真服务，同样遵守「未知查询失败关闭、不伪造成功」的约定。
- 维度筛选器的候选值端口目前只有 DQE 实现，GraphQL 路径需要补一份；按现有约定，不支持候选值的数据源如实呈现不可用，不以空数组伪装。
- **ADR-0034 要求的「发现层第二种形状」不随本决策交付，代价是 GraphQL 路径上的 AI 建页能力退化为人工建页。** ADR-0034 原文已把这一点写为「有意的下限，不视为缺陷」，但当时的假设是 GraphQL 只承载 DQE 表达不了的少数场景。IOC 作战地图让 GraphQL 成为某个完整应用的唯一取数协议，这条下限的实际代价随之放大。补齐发现描述需要另一份决策，在那之前不应宣称该应用可由 AI 生成。
- 谓词算子闭集是一处新的开放面：AI 可能选错算子或绑错字段。控制手段是闭集本身加校验器——绑定的筛选器必须存在、类型必须与算子相容、层级映射必须覆盖该筛选器声明的全部层级。
- 计数声明使每次翻页产生两次远程请求。可接受，因为来源实现本就是两个数据源；但适配器应在谓词未变时复用上一次计数结果。

## Considered Options

- **透传 GraphQL 查询原文加变量。** 接入最快，且与来源实现形状最接近。但 WHERE 仍是字符串：校验器无法判定筛选绑定是否生效，AI 无法可靠生成与自动修复，ADR-0003 失守。不采用。
- **保留模板插值但禁止 JS 三元。** 只解决三分之一的问题——`area_sql` 那类由上游拼好的片段仍然是不透明字符串，而它恰好是最复杂的一处（层级决定字段）。不采用。
- **为 GraphQL 新建独立的页面数据源类型。** ADR-0034 已否决：会把 `inline`/`query` 的二分变成 N 分，组件侧数据槽消费逻辑随协议增长。不采用。
- **主查询与计数查询各自声明完整谓词。** 页面文档更直白，无需适配器复用逻辑。但两份谓词必然漂移，且漂移症状隐蔽。不采用。
- **把层级到字段的映射放在数据网关配置里。** 页面文档更干净，但同一个 GraphQL 对象在不同页面可能按不同层级取数，映射并非全局常量；且这会让「这个筛选器到底打到哪个字段」在页面上不可见，违反 [ADR-0018](./0018-keep-page-metadata-locally-explicit.md) 的局部显式。不采用。
