---
name: ioc-clarification
description: IOC 澄清闭环(捕获/注入/消费检查,CORE-AX8):维护 *-clarification-questions.md 澄清项(id/status/priority/owner),P0 open 时阻塞各阶段,answered/closed 只能由人类裁定。Use when 设计校验产生澄清项、需要回写澄清到设计(ads-clarification-apply / subject-clarification-apply)、或检查澄清是否闭环。
---

# ioc-clarification — 澄清闭环

## 澄清项格式(模板约束,违反即 deny)

| id | 问题 | status | priority | owner | closed_by | 消费位置 |
|----|------|--------|----------|-------|-----------|----------|
| CL-001 | {问题} | open | P0/P1/P2 | {人名} | — | {delta-design-ads.md 章节} |

- status ∈ {open, answered, closed}
- **closed 只能由人类裁定**(CORE-AX8);`closed_by` 必须是人类,AI 不得 closed P0
- 守卫(`ioc` 插件)会在写前拦截 AI 关闭 P0;`ioc_validate(validator=ads-clarification, ...)` 会复核

## 文件位置

- ads 澄清: `ads-clarification-questions.md`
- data-design 澄清: `data-design-clarification-questions.md`
- subject 澄清: `subject-clarification-questions.md`

## 流程

1. **捕获**: 校验失败/需求歧义 → 登记澄清项(owner 给人,priority 标 P0/P1/P2)
2. **注入**: 澄清项进入上下文,影响设计与 SQL 生成
3. **消费检查**: 设计回写处标注消费位置;未消费的 answered 项要复核
4. **闭环**: 人类裁定后置 closed(P0 全部 closed 后 `ads_clarification_applied = pass`)

## 门禁联动

- P0 open → `ads_clarification_applied` 不得 pass → 全局阻塞各阶段(POL-DESIGN-010)。
- 澄清回写由 ioc-ads-design / ioc-subject-design 执行(ads-clarification-apply 阶段)。
