# 页面元数据模块参考手册方案

状态：2026-09-14 用户已确认，纳入 GitHub #126 交付范围；按协议与功能落地阶段实施。仅规划文档、示例与同步门禁，不修改页面协议或 Authoring 行为。

## 1. 结论与现状

建立「总览入口 + 模块参考 + 可验证示例 + 按需检索索引」四层文档。`PAGE-METADATA.md` 保留概念关系、最短上手流程和导航，详细字段规范迁移到模块参考，不继续维护两份完整字段表。

现有基础可以复用：

- `packages/page/src/schema/` 已按页面、数据源、筛选器、通用绑定和组件拆分 Zod 定义；字段类型、必填性、枚举与结构约束应从这里的导出结果生成。
- `packages/page/src/component-catalog.ts` 已生成组件用途、数据形状和选型信息，但目录不是完整的字段参考。例如必填属性提取对部分联合类型只取常见分支，不能替代所有分支的文档。
- `contracts/metriccanvas/` 是产品契约导出物；`metriccanvas-authoring/contract-snapshot/` 是单向复制的只读快照；现有导出脚本已有摘要和漂移检查。
- `PAGE-METADATA.md` 已有不少模块说明，但深度不一致。例如 `gauge` 章节未列出 Schema 中已支持的 `variant: "mini"`，缺少逐字段完整性保障。
- Authoring 当前由模型形成页面构建规格，确定性 Tool 派生查询、组件和页面文档。增加参考手册不等于改成让模型手写整页 JSON。

当前可执行基线是页面协议 **6.0**。`docs/archive/unified-authoring/2026-09-14-metadata-structure.md` 中根级 `layout` 改名、参数多值与目标绑定属于未来设计，不能混入当前合法字段。未来设计使用独立迁移文档，待契约实施后再更新现行参考。

## 2. 服务对象与范围

| 读者 | 需要回答的问题 |
|---|---|
| Authoring 模型 | 需求可由哪些能力表达？组件怎么选？哪个约束导致请求不可答？ |
| 确定性 Tool 开发者 | 生成什么结构？全部字段、分支、枚举、引用约束是什么？ |
| 页面搭建与集成开发者 | 修改字段后如何呈现？缺省行为是什么？如何校验？ |

主册只描述页面元数据。Schema 元数据另以 `docs/schema-metadata.md` 为入口；页面构建规格、工具输入输出、页面构建产物继续归 Authoring Interface。索引说明三者关系，不把数据上下文、会话或修订管理字段放进页面规范。

需要特别区分「页面协议能表达」「确定性装配已支持」「外部服务已接通」。组件被 Schema 接受，不自动证明 Tool 已能为所有需求生成它。

## 3. 模块划分与目录

建议作者文档置于 `docs/page-metadata/`，随产品契约导出到 `contracts/metriccanvas/page/reference/`，再进入 Bundle 的 `contract-snapshot/page/reference/`。后两者均为生成物，禁止手工修改。

```text
PAGE-METADATA.md                      总览、关系、快速开始、模块导航
docs/page-metadata/
  README.md                          按任务与 JSON 路径查阅
  page.md                            顶层、身份、meta、版本、布局形态
  params-and-text-values.md           页面参数、文本取值、初始化语义
  data-sources.md                     inline/query、初始行、查询分页
  fields.md                          结果字段契约、queryField、嵌套明细
  queries-and-bindings.md             DQE 查询定义、筛选绑定及边界
  compute.md                         每种具名算子的输入、输出和约束
  filters.md                         各筛选类型、显示方式、初值、层级
  sections-and-layout.md             内容分区、容器、列轨、占位、铺底层
  field-bindings-and-formats.md       数据槽、字段引用、match、展示格式
  actions-and-navigation.md          writeFilter、URL、选择与文本链接
  semantic-html.md                   允许标签、语义类、内嵌值、失败行为
  components/
    README.md                        选型矩阵、能力范围
    <componentType>.md               每种组件一份，当前共 17 类
  validation.md                      校验层次、错误定位与修复路径
  examples/README.md                 完整示例索引、用途、前置条件
```

17 类组件逐一覆盖：`reportHeader`、`metricCard`、`barChart`、`lineChart`、`pieChart`、`mapChart`、`gauge`、`table`、`rankingCard`、`rankingDetailCard`、`keyValuePanel`、`fieldText`、`categoryBreakdown`、`text`、`aiSummary`、`tabContainer`、`compositeCard`。完整性以实际组件目录为准，不把数量写死在检查器中。

不为每个标量属性单独建文件。复杂的 `table`、`mapChart` 在单页中按子结构设锚点；只有篇幅确实影响检索时才进一步拆分。共享类型集中维护，并在使用处直接列出关键限制和链接，避免读者需要跨多个文件才能知道一个属性是否合法。

## 4. 每个模块的固定内容

1. **用途与边界**：它解决什么问题，与相邻概念如何区分。
2. **所在位置**：JSON 路径、Schema 标识、所属协议版本。
3. **结构与分支**：通用结构、判别字段、每个分支的独立字段表。
4. **字段参考**：完整递归覆盖，不能只列常用属性。
5. **语义约束**：引用目标、字段角色、互斥/依赖、跨组件规则、执行与呈现行为。
6. **示例与反例**：最小用法、典型组合、常见错误及修复。
7. **溯源**：结构定义、相关语义校验、运行时行为与校验向量位置。

字段表至少包含：

| 列 | 要求 |
|---|---|
| 路径 | 含父对象及数组项，如 `props.series[].role` |
| 类型 | 包括联合类型、数组项、允许 null 与否 |
| 必填性 | 区分无条件必填、分支必填、条件依赖 |
| 允许值 | 枚举完整展开，literal/const 同样列出；开放字符串明确写格式和边界 |
| 缺省行为 | 区分 Schema 默认值、装配默认值、渲染默认值和没有默认值 |
| 约束 | 长度、范围、正则、唯一性、互斥、引用与字段角色 |
| 含义与示例 | 用业务语言解释每个枚举的效果和使用条件 |

例如当前 `gauge` 的参考至少应明确：`props.variant` 可选、唯一显式值为 `mini`；`props.max` 可选但必须大于 0；`props.valueField` 必填且绑定度量字段；`data.main` 必填且引用已有页面数据源。Schema 没声明的默认值必须查运行时，不能由 optional 推断。

枚举还要说明组合限制，不能把所有枚举做成一张与上下文无关的表。对于来自数据上下文的维度取值，不枚举具体业务值，而是说明发现来源及约束，避免把协议枚举与业务数据混淆。

## 5. 示例体系

- **局部示例**：字段绑定、筛选绑定、单个组件等短片段；明确插入路径及依赖，标注不可独立作为页面校验。
- **完整页面**：从现有 `packages/page/fixtures/contract-valid/` 复用、补齐，在最小必要数据源和字段契约下展示组件或模块。JSON 文件是示例真源，Markdown 片段由文件路径及 JSON Pointer 提取，避免重复手抄。
- **错误示例**：复用并扩展 `tools/scripts/page-conformance-vectors.ts` 的单点破坏向量，展示错误类型、路径、原因与修复方向，不硬编码可能变化的消息全文。
- **组合示例**：覆盖参数与文本、query 与初始行、筛选联动、导航、具名算子、容器组合、嵌套明细与受控语义 HTML。

覆盖标准：每个组件至少一个最小完整合法页面；每种判别分支、具名算子和有实质行为差异的 variant 有对应示例；所有 enum/const 有字段参考记录，关键语义约束有正反例。无需为每个布尔值机械复制整页。

涉及 DQE 的静态夹具应注明用于结构/语义校验，不能声称已经通过真实 DQE 执行。另列真实验真所需环境及证据入口。

## 6. 真源与生成机制

采用「结构自动生成，语义人工编写并关联证据」。

| 信息 | 真源与维护方式 |
|---|---|
| 字段类型、必填、枚举、数值范围、正则、联合分支 | 从现有 Zod 导出的 Page JSON Schema 自动提取 |
| 组件用途、选型、数据形状 | 复用组件目录导出 |
| 跨字段/跨组件限制 | 对照语义校验与 conformance，编写中文解释及稳定规则关联 |
| 缺省呈现、交互行为 | 对照运行时实现与现有测试，记录来源；不能仅凭 Schema 生成 |
| 业务解释、使用建议 | 作者 Markdown；不重复声明结构事实 |
| 合法示例、错误向量 | 复用现有夹具/向量链路，新增示例纳入同一验证体系 |

作者 Markdown 可包含受控生成区或插入标记；生成器填入字段表、枚举与示例。导出时渲染成普通 Markdown，独立 Bundle 无需运行 TypeScript 或文档生成器即可阅读。

解析器必须处理 `$ref`、`anyOf/oneOf`、`const`、`additionalProperties`、数组项和递归引用。不能把联合分支的必填字段简单合并；用 Schema 标识加分支路径定位字段，访问过的类型通过链接处理，避免展开容器时无限递归。

建议另生成 `reference/index.json`：记录协议版本、来源契约摘要、模块路径、关键词、组件类型、字段路径和规则关联，用于确定性查阅及覆盖检查。首版不建设搜索服务或新增 MCP 工具。

## 7. Authoring Bundle 如何消费

沿用已有单向链路：

```text
Zod / 组件目录 / 语义说明 / 示例
  → 产品契约及参考手册
  → contract-snapshot/page/reference
  → manifest + contract-lock + bundle.lock
```

模型入口只保留阅读顺序与模块索引：正常构建按页面构建规格工作；选型或解释限制时按需查组件与规则；确定性 Tool 不读取 Markdown，仍只消费机器契约。

分发要验证两条路径：整体复制 Bundle 后相对链接可用；按现有流程只安装 Skill 到 Relay 时，所需参考资料也必须随 Skill 一起投影到 `references/`，不能引用 Relay 安装目录之外的仓库文件。该 Skill 参考副本也由导出器生成并进入锁文件，不作为第二份作者真源。只有整体 Bundle 自包含，不能证明单独安装 Skill 后仍能查阅。

文档无需全部塞进 Python sdist；sdist 保持确定性工具所需机器契约。文档与 Skill 的交付检查单独明确，避免把「工具可运行」误当成「模型可查阅文档」。

## 8. 实施顺序与验收

| 阶段 | 交付 | 完成标准 |
|---|---|---|
| 1. 盘点与骨架 | 模块索引、Schema 路径覆盖清单、现有文档差异清单 | 全部组件及顶层模块有归属；现行与未来设计分离 |
| 2. 打通样板 | 字段表生成器；`gauge`、`table`、数据源三份样板 | 简单组件、复杂联合、跨引用均能完整表达；示例通过校验 |
| 3. 全量内容 | 通用模块、所有组件、枚举解释、示例与反例 | 所有可达字段和分支有文档；无未解释的枚举；关键规则有证据 |
| 4. Bundle 分发 | 契约导出、快照、Skill references、摘要锁定 | 独立复制及 Skill 安装两条路径没有断链或仓根依赖 |
| 5. 收口入口与门禁 | 精简 `PAGE-METADATA.md`、迁移旧锚点、CI 检查 | 总览不再重复维护字段表；生成漂移、漏字段和坏示例会失败 |

检查优先并入现有 `pnpm authoring:contracts:check` 与 Bundle 检查链，必要时增加内部文档检查步骤。门禁应覆盖：

- 可达 Schema 字段与分支覆盖率、enum/const 一致性、组件目录覆盖率。
- 所有完整示例通过 TypeScript 页面语义校验；纳入跨语言契约的新增向量也通过 Python 预检。
- 反例命中预期错误类型与路径，避免因无关错误被误算为通过。
- 生成产物无漂移，链接及 JSON Pointer 均有效，Bundle 摘要一致。
- 结构校验通过不能替代呈现证据：涉及显示语义的例子引用已有渲染测试；若没有证据，明确列为待验证，按风险补验证。

首版以 Markdown 与 JSON 完成，不建设独立文档站。未来若需要在线检索，可直接消费同一份模块文档和索引，不再维护一套内容。

## 9. 相关依据

- [现有页面元数据规范](../../../PAGE-METADATA.md)
- [Authoring Bundle](../../../metriccanvas-authoring/README.md)
- [产品契约导出规则](../../../contracts/README.md)
- [单向导出决策 ADR-0061](../../adr/0061-self-contained-authoring-bundle-and-neutral-contract-export.md)
- [当前 Schema 实现](../../../packages/page/src/schema)
- [契约导出脚本](../../../tools/scripts/export-authoring-contracts.ts)
- [新版元数据结构，尚待实现](2026-09-14-metadata-structure.md)
