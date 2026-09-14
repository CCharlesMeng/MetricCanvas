# T03 / #129：6.1 布局协议兼容契约

S2；基线 `057703b1604f4937601f99534c713a4f72995c08`。依据 ADR-0051，新字段按增量 6.1 引入，不更改 6.0 字段语义、不提升主版本。主版本内继续接受旧字段，因此最新读取语法仍是 6.0 的超集；新增写出路径只写 6.1 `layout`。组件的 `layout` 对象不受影响。

## 接收与写出

下表中的值均须为 `report` 或 `dashboard`；完整页面仍须通过结构和语义校验。

| 声明版本 | 顶层布局声明 | 接受结果 | 规范写出 |
|---|---|---|---|
| 6.0 | 仅 layoutForm | 接受 | 6.1，layout 为原值，删除 layoutForm |
| 6.1 | 仅 layout | 接受 | 6.1，layout 为原值 |
| 6.1 | 仅 layoutForm | 兼容接受 | 6.1，layout 为原值，删除 layoutForm |
| 6.0 / 6.1 | 均未声明 | 接受，缺省 report | 6.1，显式 layout: report |
| 6.0 | 仅 layout | 拒绝能力越级 | SCHEMA_ERROR /layout |
| 6.1 | 两字段同值或异值 | 拒绝双真源 | SCHEMA_ERROR /layoutForm |
| 6.0 | 两字段同值或异值 | 拒绝能力越级及双真源 | SCHEMA_ERROR /layout 和 /layoutForm |
| 6.0 / 6.1 | 非法字段值 | 拒绝结构错误 | SCHEMA_ERROR /layout 或 /layoutForm |
| 6.2 / 7.0 / 其他不支持版本 | 任意 | 拒绝，不猜测迁移 | SCHEMA_ERROR /schemaVersion；保留其他结构错误 |

合法版本字符串是 Schema 枚举中的 `6.0`、`6.1`。`06.1` 等非规范拼写也拒绝。6.0+layout 与任意双字段从未属于已支持文档，不构成对旧合法输入的收紧。6.1+layoutForm 是持续读取承诺，不能在 #133 因迁移完毕而删除。

## 公开入口与数据保护

`@metriccanvas/page` 导出 `normalizePageDocument(document: unknown)`：成功为 `{ok:true, document:PageDocument, errors:[]}`，失败为 `{ok:false, errors:TypedError[]}`。

它先通过完整公开校验，再复制原始 JSON 树，只替换版本和顶层布局字段。参数文本引用、DQE 查询、分组字段、queryField、原始 initial 行与 capturedAt 均保留，不把物化结果写回；支持响应式 Proxy，不修改输入。再次规范化结果相同。

`parsePage` 同时接受新旧文档，输出运行态 `Page`：6.1 + layout，无 layoutForm；其既有参数物化、字段展开和查询初始行映射继续存在。不能将 parsePage 的运行态结果作为持久化文档使用。`validate` 继续只返回错误，不修改输入。`pageSchema` 是结构契约；能力下限与双字段互斥和其他既有跨字段规则一样由公开语义校验及共享 conformance 约束，不能仅用裸 JSON Schema 宣称完整校验通过。

## T04 对齐

精确读取必须先验证原始持久化文档与 contentHash/ref 的一致性，再规范化为工作副本或运行态。原 hash 不可拿规范化后文档比较。不得原地修改不可变旧修订、模板来源引用或冻结报告；保存升级结果产生新修订，幂等重试沿用原请求内容与操作键，不因重试再做不同版本转换。hash 算法及提供方字段仍待外部确认。

执行响应必须匹配精确 target、operationId、每个源归属及有效条件。queryField 映射、成功内嵌行条件匹配、既有 DataSnapshot error 隔离、缺源拒绝和筛选后不重初始化方向均与 T04 一致。当前仅对齐语义；#143 参数绑定、#144 执行 DTO/适配不在 #129 实现，权限与参数提取权威仍归 Java。

## 作者源与黄金向量

- 版本：packages/page/src/version.ts；结构：packages/page/src/schema/page.ts。
- 互斥与纯转换：packages/page/src/layout-compatibility.ts；受控公开入口：validate.ts。
- conformance 定义：tools/scripts/page-conformance-vectors.ts；生成器：tools/scripts/export-authoring-contracts.ts。
- 完整 32 项版本×字段矩阵：contracts/metriccanvas/page/conformance/layout-compatibility.json；expected 包含规范化后的完整文档或完整错误数组。
- 新正例：layout-6-1-report.json、layout-6-1-dashboard.json；旧 inline-report/query-dashboard 等正例仍保持6.0。
- 新反例：layout-before-6.1.json、layout-dual-equal.json、layout-dual-conflict.json、layout-invalid-value.json。
- 产品契约单向复制到 metriccanvas-authoring/contract-snapshot，manifest/contract-lock/bundle.lock 由生成器统一写出。无需新增 Python 运行时资产；读取支持范围来自 schemaVersion 枚举，当前写出版本来自 contract-lock。

## 升级顺序与回退

1. #129 先交付公开双读、唯一规范化写出、统一运行时接入与共享向量，S0 验收进入共同基线。
2. #131 浏览器生产构造/读取/示例与 #132 Python 并行迁移。工作台文件由 S1 唯一修改，S3 不手改产品生成快照。
3. 两票验收集成后 #133 删除过渡内部别名，检查所有生产写出、四交付物、支持版本和 Bundle；不等待 M0，不移除旧输入读取承诺。
4. 6.0 消费者无法读取6.1，应先升级读取方再开启新写出；不向旧消费者降级伪造版本。旧存储可保持原样，触发编辑保存时产生新版本修订，批量迁移也必须追加而非覆盖原修订。

回退本票采用逆向提交或回到原基线；在产生6.1文档前可整体回退读取方。已有6.1文档后不得把读取方退回仅支持6.0的版本；旧文档原文仍完整保存。
