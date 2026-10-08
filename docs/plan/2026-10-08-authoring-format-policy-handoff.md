# 创作期自动选择格式规则：实施 Handoff

状态：设计交接，尚未实施。用户已同意推进方向；下一轮先收口本文待决策项，再修改创作期规则。范围限 MetricCanvas；不改 Relay/DQE、不转换原始查询值、不改首屏取数策略。

## 目标与本次现场

用户要求 Tokens 消耗量明细按“百万”显示，希望以后生成页面自动选择合适格式。业务计量单位（Token、元、次）来自受信数据上下文；展示数量级（万、百万、亿）由用户意图和确定性格式策略决定。结果写入页面文档，渲染期不重新猜测。

本次页面有 5 个查询数据源，initial 行数/总数为 6/6、6/6、20/30、20/41、20/714。首屏已修改为复用非查询分页的部分 initial，并显示部分数据提示；这不证明结果完整，也不授权用样本推断全量分布。

明细原配置 defaultFormat=number，手动改为 compact-million-1。真实预览已显示 5931099.995 → 5.9百万；10950 → 0.0百万暴露了精度取舍，后续规则须明确。原始查询值未变化。当前页面已复制到 `apps/playground/src/lib/default-preview-page.json`，默认预览和恢复示例均使用它。文件含业务数据，不应未经审查直接作为公共测试夹具或分发素材；长期回归使用同结构合成数据。

## 已核实的现状（纠正前面对话中的判断）

**创作期自动格式选择已经存在，需要扩展，不是从零新增。**

| 位置 | 当前职责和缺口 |
|---|---|
| `metriccanvas-authoring/tool/metriccanvas_authoring/data/query.py` | 调用 apply_field_presentation；接续时沿真实入口确认执行结果和 source description 的传播 |
| `metriccanvas-authoring/tool/metriccanvas_authoring/data/field_presentation.py` | 对 number/money 度量选择 defaultFormat；已有格式直接保留；不完整/未知总数退回 number；自动候选有万、亿，没有百万；以最小非零绝对值避免舍入为零；同单位度量按保守尺度对齐 |
| `metriccanvas-authoring/tool/metriccanvas_authoring/data/source_mapping.py` | 核对受信 source description 的查询和上下文身份；校验 scale 与 format 相容；投影 unit/currency/defaultFormat，不转换值 |
| `metriccanvas-authoring/contracts/authored/source-description.schema.json` | scale/unit 等来源字段的合同；先核实 enum 和真实 Adapter 返回能力，不能臆造新值 |
| `metriccanvas-authoring/tool/metriccanvas_authoring/pages/composition/page_building.py` | 装配数据源与组件，适合接续检查用户呈现意图如何落到字段绑定 |
| `metriccanvas-authoring/tool/metriccanvas_authoring/pages/components/section_presentation.py` | 已有把 defaultFormat 投影为绑定 format 的逻辑；需核对覆盖顺序，避免自动值覆盖显式值 |
| `packages/page/src/field.ts` | 既有 unit、defaultFormat 和格式闭集，已支持 compact-million-0/1/2 |
| `packages/engine/widgets/src/shared/value-format.ts` | 百万格式除以 1e6 并追加“百万”；纯展示，原值不变 |
| `metriccanvas-authoring/test-harness/tests/test_field_presentation.py` | 已覆盖显式格式、部分结果、未知 scale、非零保护、同单位对齐；扩展此测试入口 |

不能据此断言用户 JSON 一定由当前本地版本生成：尚无该产物的部署指纹或真实模型调用证据。它的 number 配置与部分结果回退规则相符，仅能作为可能成因。

所有权遵循 [页面文档结构主题](../adr/topics/page-document-structure.md) 和 [ADR-0013](../adr/0013-format-belongs-to-component-field-binding.md)：最终 format 属于组件字段绑定，数据源 defaultFormat 是可覆盖建议。用户只要求“明细用百万”时，在表格该列字段引用写 format，不能改变同源趋势图或指标卡。

## 规则设计建议

### 输入与优先级

输入包括受信字段类型/单位/scale、来源默认格式、已有组件绑定、已解析的用户呈现意图、执行结果与完整性，以及组件/数值轴范围。先盘点现有请求契约如何承载呈现意图；新增工具参数或协议结构须先确认设计，不能把自由文本当作单位事实。

所有候选先满足 scale 安全约束，再依次采用：本轮用户明确要求 > 已有人工组件 format > 来源显式 defaultFormat > 自动策略 > 原值 number。用户未要求更改时，编辑页面保留已有显式格式；跨字段对齐仅调整自动选择项。策略推导值与人工/来源显式值的出处保留在创作期内部，不能仅凭已有 defaultFormat 非空就永久锁死上轮自动值。

示例：表格列 `field` 从字符串改为对象引用 `{ "data": "main", "field": "稳定页面字段id", "format": "compact-million-1" }`，遵循当前绑定 Schema。数据源仍可给其他组件提供原有默认格式。

### 计量单位与原始数量级

- 单位标签来自受信描述，不能通过“流水”猜人民币，通过“Tokens”猜结果是否已缩放。
- 查询若已返回百万 Token，不能再套除以 1e6 的格式；本阶段不实现单位换算。无法证明原值尺度时保留原值，并给创作期可解释原因。
- 百分点与比例值分开处理；当前 percent 格式按百分点消费，不能把 0.12 自动当 12%。金额、百分比、标识符、日期、数字字符串各有独立适用范围。
- 业务单位文本与数量级格式一起检查，避免表头“百万 Token”同时每格再追加“百万”。本次页面采用表头 Token、单元格追加百万。

### 自动数量级与精度

建议扩展现有纯函数，使其返回格式决策及内部理由（来源、完整性、回退原因），外部页面仅使用现有 format/defaultFormat。

自动候选复用现有格式闭集；增加百万后，原有 scale_order 与同单位对齐规则一并修改。不要仅在 max≥1e6 时选百万：同时检查非零最小值、负数、精度误差及同轴多序列。精度判定必须与 TypeScript 实际格式化器一致，特别是 0.05 边界。

自动选择依据全量已验真结果；部分 initial 的存在不改变完整性要求。结果不完整时建议继续保守 number，但允许已确认原值尺度下的用户显式格式或可信默认格式。是否允许根据样本自动选数量级属于待决策项。

格式一致性按使用范围管理：同一表格列、同一图表数值轴固定格式；双轴分别处理；不同组件可以不同格式。不要将整个页面所有同名字段强行统一。渲染期筛选/翻页不改变已存格式。

## 实施前需要确认

1. 自动选“万/百万/亿”的产品策略：百万何时优于万？按数量区间、组件类型还是组织偏好？将边界样例作为最终规则，不能只说“自动合适”。
2. 用户指定百万时，小值显示 0.0 是否可接受？建议允许用户显式选择精度；自动策略不让非零值显示为零。百万最多两位的现有闭集无法保护所有小值，必要时回退原值，不能私自添加格式枚举。
3. 部分/未知总数结果：继续保守 number（建议），还是允许样本推断并披露局限？本次零 DQE 首屏需求不能视为对后者的授权。
4. 单位/scale 缺失时：保留原值并提示（建议）；Adapter 如需补充事实，另列外部协调，不在 MC 伪造。
5. 呈现意图和自动决策出处是否已有合适的创作期承载位置？如果必须新增工具契约，先按仓库架构 grill 规则确认。

## 实施步骤与完成标准

1. 审计真实创作主链：定位用户格式要求、描述映射、取数、字段建议、组件绑定、编辑保存全部入口。完成标准：给出调用路径和格式覆盖表，说明当前为何产出 number；区别本地推断和产物来源证据。
2. 用合成数据建立失败回归：字段建议纯函数与正式 compose/edit 主链都覆盖。完成标准：明确“明细用百万”在当前实现失败的断言；查询、rows、字段身份和其他组件格式保持不变。
3. 扩展既有策略及装配，不新增运行时单位猜测。完成标准：收口全部待决策项，对应测试通过，自动格式不会覆盖人工明确选择。
4. 更新现有 Skill 的格式指引、相关正式文档和必要契约；Skill 上游/自有归属按 AGENTS.md 处理。完成标准：Skill 指导调用受控规则，模型不发明单位或尺度，不把策略只写在提示词里。
5. 分层验收与分发。完成标准：每层独立报告 pass/fail/blocked/not-run，保留最终页面、差分、日志与浏览器证据。

## 必测矩阵

| 用例 | 期望 |
|---|---|
| 用户“仅明细用百万”，同源表格+趋势图 | 表格绑定百万，趋势图格式不变；原值不变 |
| 完整 Token 数据覆盖万/百万/亿阈值 | 按已确认策略选择，边界与负数结果一致 |
| 显式 number / 来源 defaultFormat / 上轮自动默认 | 按出处和优先级处理，编辑不误覆盖人工值 |
| 20/714、totalCount 缺失、空结果 | 按部分结果政策执行，格式选择不触发额外 DQE |
| 已缩放单位、unknown scale、百分比、金额 | 不重复缩放，不猜币种/比例语义 |
| 小非零值与超大值共存，0/null/负数/舍入边界 | 自动策略不把非零显示为零；显式策略遵循已确认取舍 |
| 同轴同单位、混合单位、双轴、同字段不同组件 | 一致性范围正确，不扩散覆盖 |
| 保存重开、筛选、翻页 | 固定保存格式；查询与原值语义不变 |
| 真实 DS：默认格式与明确百万请求的创建/编辑 | 工具链、产物绑定、浏览器显示均有证据 |

验收依据：[Skill DS 验收流程](../agents/skill-ds-model-acceptance.md)。至少运行相关 Python 测试、页面绑定/格式器测试及浏览器验证；涉及契约分发时执行 `pnpm authoring:contracts`、`pnpm authoring:contracts:check`、`python3 metriccanvas-authoring/scripts/check_bundle.py`，生成文件不得手改。真实模型和生产 Relay/DQE 的结论分别记录，不能以本地测试替代。

## 接续注意

本工作区存在大量其他未提交改动，包括字段格式、图表数值轴、Schema 版本及 IOC 工作。先检查 git status 和逐路径 diff；保留无关改动，按实际文件归属交付。本 handoff 本轮仅静态源码核实和方案整理，自动格式规则、真实模型与生产集成均未实施或验收。
