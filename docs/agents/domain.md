# 领域文档

工程 skills 在探索本仓库时,应按以下方式消费领域文档。

## 探索前先读

- 根目录 **`CONTEXT.md`**(领域词汇表)
- **`docs/adr/README.md`**(ADR 基线入口)—— 两张由 `pnpm adr:index` 生成的表:速查表给出每份 ADR 今天的状态,主题索引指向 `docs/adr/topics/*.md`。**按主题定位,不要通读 83 份原文**:先在主题索引找到相关主题页读现行结论,再按它引用的编号打开 ADR 原文读背景和取舍

## 探索时默认不读

- **`docs/archive/`** ——已收口批次的过程件,只读不更新。需要「当时为什么这么定」时,从对应批次的 `README.md` 结论页导航进去,不要直接翻里面的票据与交接
- **`docs/plan/`** 只放**还在做**的计划;它和 `docs/evidence/`、`docs/archive/` 的分工判据写在 [`docs/plan/README.md`](../plan/README.md)
- **`docs/evidence/`** 是被 ADR 正文或代码当论据引用的报告,按需从引用处点进去,不必通读

若文件不存在,静默继续,不要主动建议创建——`/domain-modeling` skill(经由 `/grill-with-docs` 等触发)会在术语或决策真正落定时惰性创建它们。

## 文件布局

本仓库为单上下文布局:

```
/
├── CONTEXT.md
├── PAGE-METADATA.md
├── docs/adr/
│   ├── README.md          # 基线入口:速查表 + 主题索引（均为生成）
│   ├── topics/            # 按主题聚合的当前生效结论（人写）
│   ├── 0001-domain-dsl-over-a2ui.md
│   └── ...
├── docs/plan/             # 在执行中的计划
├── docs/evidence/         # 被 ADR 正文或代码当论据引用的报告与基线
├── docs/archive/          # 已收口批次，每个批次一页结论页；探索时默认不读
├── docs/schema-metadata.md
├── packages/
├── apps/
└── tools/
```

`CONTEXT.md` 是当前领域术语真源；`PAGE-METADATA.md` 和
`docs/schema-metadata.md` 分别说明页面协议与创作期 Schema 元数据。ADR 记录决策
背景和取舍，不作为当前协议说明；`docs/adr/README.md` 与 `docs/adr/topics/` 是这些
决策记录的聚合基线，不是新的协议说明来源，只用于快速定位"当前哪份 ADR 说了算"。

## 使用词汇表术语

输出中涉及领域概念时(issue 标题、重构提案、假设、测试名),必须使用 `CONTEXT.md` 定义的术语,不要漂移到词汇表明确标注 _Avoid_ 的同义词。

需要的概念不在词汇表中时,这本身是个信号:要么你在发明项目不用的语言(重新考虑),要么存在真实缺口(记下来交给 `/domain-modeling`)。

## 与 ADR 冲突时要显式指出

输出若与现有 ADR 矛盾,必须显式指出而不是静默覆盖:

> _与 ADR-0001(自研领域 DSL)矛盾——但值得重新讨论,因为……_
