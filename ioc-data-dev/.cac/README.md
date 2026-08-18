# .cac/ — 原体系 Hook 目录的 DSH 落地说明

原《IOC 数据开发全流程》的 `.cac/hooks/`(14 个 Hook 脚本)在 DSH 中由插件的
**行为守卫**实现,见 `dsh/guards.js`(host 半,挂载于 `tools/pre-execute` /
`tools/post-execute` 扩展点):

| 原 Hook | DSH 落地 |
|---------|----------|
| sdd_pre_write.py(模板格式约束 → deny) | guards.js `pre-execute`:约束文件写入前校验,违反 → deny |
| sdd_post_write.py(结构守卫自动触发 → guard-report.md) | guards.js `post-execute`:写后运行 validate_*.py,FAIL → 追加 guard-report.md |
| sdd_pre_read.py(evidence 注入) | 由 `ioc-vertical` / 各 skill 的 required_reads 指导 |
| sdd_pre_sql_generator.py / sdd_pre_stage_switch.py | 由 `sql-generator` / `ioc-stage-gate` skill 覆盖 |
| sdd_session_init.py / sdd_skill_invocation_log.py / sdd_clarification_*.py 等 | 由 `ioc-vertical` / `ioc-clarification` skill 覆盖(打点、澄清采集为人工流程) |
| sdd_guard_lib.py | guards.js 内联守卫逻辑(纯 Node 内置模块) |

结构校验器本体仍为 Python(`harness/tools/validate_*.py`,零依赖),由守卫与
`ioc_validate` 工具经 `python3` 调用,保证与原体系单一事实源一致。
