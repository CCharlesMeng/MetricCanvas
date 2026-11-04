# 需求关联与保留意图换源

全页接数需要需求到结果的双向覆盖，或普通 inline/query 数据源需要更换时，使用本页；标题、列宽等局部任务沿用已有来源。原 `analyze-data.mjs draft/check` 的 Markdown 匹配报告与 `metriccanvas-analysis/1` 是不同输入格式，按各自入口使用。

先按[数据识别与接数](data-analysis.md)确定可信上下文与真实执行入口；精确规则按需读取：

```sh
node "<skill-dir>/scripts/read-knowledge.mjs" show --topic authoring.analysis --topic authoring.rebind
```

以完整原文件和空对象输入起草，再按回执补充需求、现有 DataRequest、显式结果记录和 links：

```sh
node "<skill-dir>/scripts/associate-data.mjs" page.analyze --page page.json --input association.json
```

包装器计算原始文件字节摘要。使用返回的稳定 useId 建立 requirementId → dataRequestId → resultRef → useId 关联，证据引用原材料行号和原文。componentIds 只限制阅读，报告仍覆盖全页和共享消费者。`execution:not-run` 不是已执行证明，缺口保持明确，业务结果行不写入报告。

保留页面意图的普通换源输入包括原报告、sourceId、resultRef、完整 fieldMap、resultRecords 和 context；原 inline 无可观察粒度时补同一基线的 baselineScope 事实。按实际结果契约逐字段核对角色、类型、单位、币种、可空性，以及所有共享消费者、键、分组、期间、筛选和参数。随后调用：

```sh
node "<skill-dir>/scripts/associate-data.mjs" page.rebind --page page.json --input rebind.json
```

成功候选仍需取得项目真实执行证据，再决定写回。失败 `document:null` 时保留原页，不能绕过未知范围或半应用。新字节、工作版本、材料、Schema 或位置变化后重新生成关联。报告及候选保存在页面扫描目录外，不加入页面协议或安装资源。复杂依赖模式不在本次普通换源范围时，按明确诊断保留缺口。

回执只写 stdout：产品拒绝退出 2，调用或文件错误退出 3。候选不等于保存。最后按[本地验收](local-workflow.md)冻结原件、完整校验并预览受影响交互。
