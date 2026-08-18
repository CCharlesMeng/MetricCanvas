---
stage: subject-sql-bindings-ready
activity: act.subject-sql-bindings
skill: sql-generator
card: 03h-subject-sql-bindings-ready.md
produces: [sql-source-bindings.yaml, table-schema.json]
next: sql-generate
---

# 03h · Subject SQL Bindings Ready(专题源绑定就绪)

## 目的
专题 SQL 的源表绑定(与 data 路径的 03d 规则一致)。

## 产出(CTR-BIND-*)
- `sql-source-bindings.yaml`
- `table-schema.json`

## Definition of Done
- [ ] KW-AX8 / KW-AX5 / PAT-DOM-* 合规
- [ ] `sql_bindings_ready = pass` → 进入共享阶段 `sql-generate`(卡片 06)
