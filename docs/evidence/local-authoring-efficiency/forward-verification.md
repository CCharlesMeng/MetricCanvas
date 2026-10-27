# local-authoring 独立使用验证

## 结果

已在 `page.json` 的 `review-table` 末尾补入“伙伴声音闭环率”。直接深拷贝 `region-table` 的已确认列配置：

```json
{"field":{"data":"main","field":"rate","format":"percent-1"},"title":"伙伴声音闭环率","width":180,"sortable":true}
```

两表原本均通过 `main` 绑定 `voice-closure`，未新增或修改数据源、查询、业务口径或百分刻度。修改脚本移除新增列后与修改前的完整 JSON 深度比较相等，并验证写回后解析结果一致；其他 JSON 内容保持不变。Schema 为 6.65，升级检查为 `unchanged`。

## 完整页面校验

1. 对指定工作文件直接执行完整校验，退出码 1，仅有输入原有的文件命名问题：
   - type: `SCHEMA_ERROR`
   - path: `/id`
   - message: `页面文件名(page)与 Page.id(local-authoring-scoped-data-demo)不一致:同一性由 id 承载,须重命名文件或修改 id`
2. 为遵守“保留其他内容”和继续交付 `page.json`，未修改页面 ID、未放宽规则。将最终文件原始字节复制到系统临时目录中的 `local-authoring-scoped-data-demo.json`，断言字节一致后调用同一个完整校验器，结果为 `{"ok":true,"errors":[]}`，退出码 0。临时目录自动清理。

因此，完整页面内容在符合原 ID 的文件名下校验通过；指定工作文件 `page.json` 本身仍有上述文件名与 ID 不一致的问题，不能声称该路径直接校验通过。没有可用的目标运行时；未做浏览器或真实查询验收。

## 实际读取

- `metriccanvas-local-authoring/SKILL.md`：完整读取一次。
- `page.json`：程序解析并提取两个目标表，仅输出页面标识与相关组件，不打印全部数据行。
- `read-knowledge.mjs show` 返回的 `table.columns`、`fields.format` 两个主题：读取局部约束和语义。未沿返回引用进一步打开完整协议文档或示例。
- `metriccanvas-local-authoring/references/local-workflow.md`：一次 `rg` 定向检索，仅读取文件名、校验、快照等匹配上下文。
- 未查看原仓库、`input.json`、压缩脚本源码或其他材料；未联网、未调用真实模型；未修改 Skill。

## 命令与工具次数

总计 9 次 `functions.exec` 编排，内含 10 次 `exec_command`；第 2 次编排并发执行下列第 2、3 条命令，其余顺序执行。无其他工具调用。下列 Python stdin 脚本按实际职责记录，没有另存辅助脚本。

1. `cat metriccanvas-local-authoring/SKILL.md`
2. `node metriccanvas-local-authoring/scripts/upgrade-page.mjs page.json`
3. `python3 -`（stdin 脚本）：解析页面，输出根键、版本和形态，并递归提取 `region-table`、`review-table`。
4. `node metriccanvas-local-authoring/scripts/read-knowledge.mjs show --topic table.columns --topic fields.format`
5. `python3 -`（stdin 脚本）：确认两表数据槽相同，深拷贝来源列，断言除此列外完整 JSON 不变，写回并读回验证。
6. `node metriccanvas-local-authoring/scripts/validate-page.mjs --expected-layout dashboard page.json`
7. `node metriccanvas-local-authoring/scripts/validate-page.mjs --help`
8. `rg -n -C 3 '文件名|stdin|validate-page|expected-layout|校验' metriccanvas-local-authoring/references/local-workflow.md`
9. `python3 -`（stdin 脚本）：创建临时目录与同字节规范命名副本，通过 subprocess 调用 `node <绝对 Skill 路径>/scripts/validate-page.mjs --expected-layout dashboard <临时目录>/local-authoring-scoped-data-demo.json`，记录退出码，自动清理临时目录。此内部 Node 调用计入实际执行过程，但不另外计作工具调用。
10. `python3 -`（stdin 脚本）：写入本 `verification.md`；计数包含本次写入。

第 7 条按 Skill 的“接口疑问先用 --help”执行，但校验器不支持该参数，将 `--help` 识别成文件名，返回 ENOENT，退出码 2。随后只额外检索一次 Skill 内的 `local-workflow.md`，未进行外部检索。这两次属于原始文件名问题引起的附加开销。

## 报告与额外产物

仅按任务要求创建本 `verification.md`；未创建数据分析报告、指标匹配报告、设计报告或持久快照。最终持久修改为 `page.json` 和新增 `verification.md`。校验使用的规范文件名副本只存在于自动清理的系统临时目录。
