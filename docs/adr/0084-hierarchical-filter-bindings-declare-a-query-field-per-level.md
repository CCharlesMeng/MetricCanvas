---
status: accepted
date: 2026-09-21
note: 补齐 ADR-0050 层级维度筛选器在查询侧的绑定形状；6.7 新增分支，6.8 按 ADR-0051 例外收紧
---

# 层级维度筛选绑定逐级声明谓词字段

[ADR-0050](./0050-filter-type-closure-and-hierarchical-dimensions.md) 让维度筛选器可以声明 `hierarchy`：取值同时携带选中值与所在层级，层级是查询谓词选字段与地图当前视角的唯一来源。筛选状态确实按层级带上了 `level`（`DimensionFilterValue.level`），级联、地图下钻、URL 往返都在用它。

**但查询侧没有接住它。** `filterBindings` 的 dimension 目标只有一个恒定的 `queryField`，`composeEffectiveQuery` 读的也只是这一个字段，`value.level` 在编排层被整个丢掉。后果不是"层级不起作用"，而是更糟的一种：用户切到代表处层选了几个代表处，发出去的谓词仍然是 `geo_pc_code IN (代表处编码)`——字段是上层的，取值是下层的，上游照常返回结果，页面照常渲染，**没有任何一处会报错**。

这就是 `pages/ioc-opportunity-list.json` 的 `region` 当初宁可整个不绑的原因：在"不筛"和"静默错数据"之间只能选前者。本仓其余两处行使过这个开放面的样例（`packages/page/fixtures/contract-valid/` 下的 `filters-page` 与 `map-page`）都把 `queryField` 写成了第一层的维度，也就是说它们在默认层正确、在其它层错——只是没人切过层。

    20|## 决策

**`filterBindings` 的 dimension 目标新增一支 `levelQueryFields`：键是层级 id，值是该层的谓词字段。**

```json
"region": {
  "target": "dimension",
  "levelQueryFields": {
    "geo": "geo_pc_code",
    "region-dept": "region_dept_code",
    "office": "rep_office_code"
  }
}
```

**它与恒定 `queryField` 互斥，是判别联合的并列分支，不是可选附加字段。** 一个绑定要么声明"这个筛选器只有一个谓词字段"，要么声明"每一层各有自己的谓词字段"，没有第三种读法，也不存在"写了 `levelQueryFields` 但某一层回落到 `queryField`"的混合语义。

    30|**层级绑定必须逐级写全。** 校验期要求 `levelQueryFields` 的键集合与筛选器 `hierarchy` 的层级 id 集合完全相等：缺一级是那一层悄悄不筛，多一级是引用了不存在的层级，两者都拒绝。`levelQueryFields` 只能落在声明了 `hierarchy` 的维度筛选器上。

**运行时按当前层级取字段，取不到就整条不下推。** `composeEffectiveQuery` 用 `value.level` 查 `levelQueryFields`；查不到时该筛选器这一轮不产生任何谓词，而不是退回某个别的字段。校验已经挡住了缺级，这条是运行时侧的失败安全——宁可不筛，也不换个字段去接收本层取值。

**6.7 交付新分支，6.8 收紧恒定 `queryField`。** 新分支满足 [ADR-0051](./0051-additive-minor-versions-for-page-schema.md) 的增量四条判据（判别联合新增分支），落 6.7。

"层级筛选器不许写恒定 `queryField`"是加严既有约束，按 ADR-0051 的零使用例外行使，落 6.8。三条判据逐条对应：

1. **零使用。** 行使过这个开放面的只有 `filters-page` 与 `map-page` 两份校验样例，本决策先把它们迁到 `levelQueryFields`；迁完之后 `pages/` 与 `packages/*/fixtures/` 下没有任何一处再写恒定 `queryField` 绑层级筛选器。仓内还没有独立的修订存档，模板引用与冻结报告指向的已发布修订也由这些文档承载。
2. **可证。** `packages/page/tests/hierarchy-binding-zero-usage.test.ts` 随收紧一并落地：它按上述口径扫描全部文档并断言零命中，另有一条用例证明扫描口径确实找得出这种写法（否则"零命中"可能只是扫描器坏了），再有一条证明收紧真的生效。
3. **形式超集让位于实际超集。** 6.8 的 schema 严格说不再是 6.1 的语法超集，但在真实存在的文档集合上仍然是超集。

两份被迁走的样例值得单独一提，因为它们恰好说明这个开放面为什么必须关：`filters-page` 的 `region` 声明 `defaultLevel: "city-level"`，绑定却写 `queryField: "region"`——**它在默认层就是错的**，拿城市取值去筛区域字段；`map-page` 则是默认层对、其它层错。两份都从没被切层点过，所以一直没人看见。

## Consequences

- `pages/ioc-opportunity-list.json` 的 `region` 从"故意不绑"变成三层各自绑定，页面随之声明 6.7。这是本决策的第一个、也是目前唯一的行使者。
    40|- 浏览器证据钉住了行为而不只是结构：`packages/embed/tests/browser/navigation.spec.ts` 用同一个筛选器在 geo / region-dept / office 三层各取一个值，断言行数分别是 9 / 3 / 1。忽略 `level` 的实现会让三个数字塌成一个，或让其中两次取到空集。
- 6.8 是一个只含收紧、不含新能力的次版本，因此 `version.ts` 的能力表里没有 minor=8 的条目。能力下限计算不受影响：用了 `levelQueryFields` 的文档要求的仍是 6.7。
- 开放面就此关闭，代价是 ADR-0051 的零使用例外在本仓第二次被行使（第一次是 5.2 给组件 `layout` 补 `.strict()`）。这条例外每用一次都在消耗它自身的约束力，所以判据二的扫描测试必须留在仓里——它不是一次性的证明，而是防止开放面重新长出来的守卫。
- `paramBindings` 没有跟着扩。参数初始化筛选本来就只支持平面维度（`param-bindings.ts` 显式拒绝 `hierarchy`），没有层级可选，扩了也没有取值来源。
- 级联约束仍然到不了上游：`createDqeGateway` 的 `fetchDimensionValues` 丢掉了 `DimensionValuesRequest.constraints`，候选值查询固定发 `filter.dims=[]`。这与本决策无关，但它意味着层级与级联这两条链路中，只有层级这一条现在是端到端通的。

## Considered Options

- **让运行时按 `value.dimension` 去查询体里找同名维度。** 不需要改协议。但它要求页面字段名与 DQE 维度 code 恰好同名，而 `queryField` 存在的全部理由就是这两者不同名；一旦不同名就悄悄退化成不筛，等于把一个显式声明换成一次命名巧合。不采用。
    50|- **恒定 `queryField` 保留，另加一张可选的 `levelOverrides` 覆盖表（未覆盖的层回落到 `queryField`）。** 迁移成本最低，既有文档一个字不用改。但"回落"正是要消灭的那个语义：作者漏写一层，得到的仍然是静默错数据，只是从"默认写错"变成"默认漏写"。不采用。
- **走 7.0 主版本来做这次收紧。** 最保守。但 ADR-0051 要求主版本递增论证"为什么无法增量表达"，而这里既能增量表达（新分支），又符合零使用例外（迁完两份仓内样例后确实零使用）；为此让全部已发布修订、模板引用与冻结报告失效，代价与收益完全不成比例。不采用。
- **只加新分支、不收紧，把开放面留着。** 迁移成本为零。但作者仍然写得出在非默认层错的绑定，而这正是本决策要消灭的那一类失败——留着它等于承认"协议提供了一个正确写法，也提供了一个静默出错的写法，靠人选对"。不采用。
- **按文档声明的次版本切换校验严格度**（≥6.7 要求逐级声明，更低版本放行）。能同时拿到兼容与收紧。但它推翻了 ADR-0051 "单份 schema 校验全部次版本"的前提，校验器从此要维护随版本分叉的规则表。为一处开放面付这个结构代价不值。不采用。
