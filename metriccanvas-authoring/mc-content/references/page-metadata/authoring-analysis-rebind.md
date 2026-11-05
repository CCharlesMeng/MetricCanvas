# 创作分析关联与受控换源

`page.analyze` 和 `page.rebind` 是独立创作操作，不新增 `PageDocument` 字段。二者只读取显式输入，在本地 Node 程序或产品纯核心执行；不发起查询、不读取 Relay 私有存储、不授权、不保存。返回始终标记 `execution: "not-run"`，换源候选另标记 `saveStatus: "not_requested"`。

## 完整基线和关联报告

调用方提供完整 `documentJson` 与其 UTF-8 原始字节 SHA-256；空白变化也视为不同基线。产品解析并校验完整页面，报告同时记录页面 ID、来源是文件还是工作副本、工作副本版本及绑定、材料摘要和产品页面 Schema 摘要。Schema 摘要明确采用 `JSON.stringify(product-page-schema)` 序列化，与原始页面文件摘要分别解释。工作副本必须有版本和绑定；相同页面 ID 不代表相同内容。

`page.analyze` 输出 `metriccanvas-analysis/1` 报告。`uses` 保留组件、数据源、数据槽、字段和行明细上下文的语义身份，同时携带当前 JSON pointer。组件或列重排可保留 `useId`，当前位置仍须重新读取。相同字段的合法多处引用合并为一个语义用数位置，保留全部 pointer、角色和标签；重复组件 ID 形成歧义并报告，不用数组序号掩盖。

报告通过 `requirementId → dataRequestId → resultRef → useId` 显式关联需求、现有取数单元、结果记录和页面位置，并生成反向索引。`dataRequests` 复用现有 `DataRequest` 契约。材料引用必须对上原材料的行号和原文，不从标签或相似名称猜测关联。未关联、未提供结果证据的位置列为缺口。

`componentIds` 仅限定阅读视图。报告仍扫描完整页面，保留共享消费者、独立消费者及依赖闭包；它不产生权限范围，也不缩小完整校验。结果记录由调用方显式提供并核对当前绑定、数据上下文版本、校验政策、状态、请求和字段契约。报告不复制结果业务行、`initial` 或结果记录查询正文，不建立行缓存。

## 受控换源

`page.rebind` 接收报告、原数据源 ID、显式结果引用和完整字段映射。每个原字段必须有唯一输出字段，且保持角色、类型、单位、币种、可空性。程序从当前完整文档重新构建报告，核对原始基线、Schema、材料、语义用数身份与当前位置，重新获取全部消费者，拒绝陈旧或篡改的报告。

首个切片支持普通 `inline` 或单分支 DQE `query` 来源替换为普通 `query` 来源。它核对可观察的分组粒度、时间窗口、时间聚合、静态筛选、参数/筛选/结果绑定与结果范围。原 `inline` 无法观察的粒度须由显式 `baselineScope` 事实补足，包含同一原始字节摘要、数据源 ID 和事实引用；此事实不能覆盖已可观察的查询范围。

所有按行键对齐的数据槽均须提供完整结果行与明确总数，以核对行键非空和唯一。独立置顶汇总单独核对完整零或一行，不要求主表行键。结果记录中的业务行只用于本次核对，不进入报告或页面候选的 `initial`。按父行执行的展开查询、计算、成员、查询分页或无法证明等价的动态分支拒绝本次换源，并保留原文档。

成功候选保留原数据源 ID、字段 ID、分组字段声明、组件 ID、列标题、列宽、格式、布局、交互和无关配置，只替换目标查询及字段到输出列的映射。目标及受影响依赖的旧 `initial` 被清除；无关来源保持。候选经过同一页面解析与全量校验。失败返回 `document: null`，不产生半改文档。产品未获得等价证据时拒绝，不将未知解释为通过。

Relay 负责真实结果查找及可信 `queryRef`、权限、当前工作副本、CAS、Java 保存和未知保存状态恢复。传入一致的字符串只证明本次输入自洽，不能替代这些边界。

## 本地入口与合成验收

独立 Skill 分发脚本为 `scripts/associate-data.mjs`，仅需 Node 22 或更高版本：

```sh
node scripts/associate-data.mjs page.analyze --page page.json --input association.json
node scripts/associate-data.mjs page.rebind --page page.json --input rebind.json
```

本地包装器直接读取完整原文件并计算原始字节摘要，结果写入 stdout，不覆盖页面。产品拒绝退出码为 2，包装器参数或文件错误为 3。`page.presentation` 也复用此文件入口，输入仍按该独立操作的契约处理。

可观察 Dashboard 场景：`/pages/authoring-analysis-rebind`。场景说明提供完整命令、候选与重复行键拒绝步骤。页面协议字段增减为零；关联、证据核对、范围比较及原子换源均由创作核心承接。


页面协议 6.85。结构真源为本册[schema.json](schema.json)，SHA256 `b0ba03bf1cfbdc0914e6b9ab5dc05d015b3b63dadf9d545217e08eb0f999e751`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

## 语义规则与反例（生成）


## 示例与溯源（生成）

- [authoring-analysis-rebind](examples/authoring-analysis-rebind.json)：完整合法页面；查询仅为静态契约证据。

## 联合分支见证（生成）
