---
stage: sql-bindings-ready
activity: act.sql-bindings
skill: sql-generator
card: 03d-sql-bindings-ready.md
produces: [sql-source-bindings.yaml, table-schema.json]
requires_gates: [clouddevops_review]
next: sql-generate
---

# 03d · SQL Bindings Ready(源绑定就绪)

## 目的
确定 SQL 生成的源表绑定,产出绑定契约。

## 产出(CTR-BIND-*)
- `sql-source-bindings.yaml` — 每个绑定含 source_table / target_table / filter / engine
- `table-schema.json` — 从 clouddp-cli 列信息构建(`build_table_schema.py`)

## Definition of Done
- [ ] 来源分层满足 KW-AX8(ADS 禁止消费 SDI/ODS)
- [ ] 领域模式必选过滤齐全(KW-AX5 / PAT-DOM-*)
- [ ] 列信息来自磁盘证据(CORE-AX3)
- [ ] `sql_bindings_ready = pass` → 放行 `sql-generate`
