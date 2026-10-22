# B3证据账本

## AC ↔ 证据映射

| AT | 状态 | 执行环境 | 证据记录 | 新鲜度 | 说明 |
| --- | --- | --- | --- | --- | --- |
| AT31 | PROVEN | contract | BE-32；targeted | 当前依赖哈希 | Schema6.34、静态USD、required封闭枚举穷尽/全部一致组合、直接格式币种校验；不扫描不透明业务数据 |
| AT32 | PROVEN | contract | BE-31、BE-32；targeted；browser | 当前依赖哈希 | 非负/有限/严格/单边、显示比例仅换算一次、URL基本单位、旧相等兼容及非法整组拒绝 |
| AT33 | PROVEN | contract | BE-31、BE-32；targeted；browser | 当前依赖哈希 | metricByFilter隐式依赖及静态币种契约；切币清金额一次提交，显式确认后执行，无关查询继续 |
| AT34 | PROVEN | contract | BE-31、BE-32；targeted；static；installed | 当前依赖哈希 | 元数据/表格/图表/两组同币种计算与静态视图/XLSX同case；异步导出冻结；私有详情后绑定；保留业务标签 |
| AT35 | PROVEN | contract | BE-31、BE-34；browser；browser-regression；restore-report-green.json | 当前依赖哈希 | 实际pages草稿/取消/全部/单边/严格/换币与390面板，页头overflow=0；code=1fe02a2761bb5f97141e16c76f21bbf1ce0f3206e049e4cac32128629ccdddeb |
| AT36 | PROVEN | contract | BE-33；python；authoring；bundle；installed；authoring-distribution | 当前依赖哈希 | 协议/受控金额创建更新/保存重开/字段选择列编辑/六包仓外8页17浏览器；独立Skill知识/校验器/导出隔离46项通过 |

contract为本地合成HTTP契约环境；真实DQE、CloudIOC、Relay、DS模型、门户、CI、部署和真实USD业务数据未运行，不作为本批已证实声明。本地USD取自独立静态字段，不进行前端汇率换算。B0/B1/B2历史证据不改写。

## 计划外承接

| 文件 | Task | 原因 |
| --- | --- | --- |
| RuntimeSurface.svelte、detail-view.ts、ExportView.svelte | T1/T4 | 统一投影闭合候选、详情私有值后绑定及已有静态导出消费，阻止未选择币种的等待占位导出 |
| table-session.ts、table-controller.ts、orchestrator.ts、SourceProgram及queryFilterIds消费者 | T2 | 隐式metric选择器参与同一查询门禁，切case清旧列排序/搜索/表头状态 |
| version.ts及旧断言、flow-analysis-report.test.ts | T1 | 新联合类型与6.34能力门槛；能力探测限声明位置，保留旧业务同名键 |
| field_bindings.py、range_editing.py、受控编辑Interface与独立分发生成物 | T4 | 金额声明和所有字段选择叶子可编辑、回滚并重开，使用产品校验真源 |

## 人工验收记录

无本批必须由人工完成的项目。

## Deferred

B4–B6及待审Condition/displayInputs保持唯一主计划；生产USD字段/真实服务验收另行开展，不以本地合成结果标全量业务完成。
