# 9235/9236 页面装配与字段协议核验附录

日期：2026-09-29。源码基线：`1641ca04`。状态：进行中的改进审计；未修改业务代码。附件中的 Relay 补丁和内部执行统计为用户提供的材料，本仓源码核验不能证明其已部署或已通过真实 Java/DQE 验收。按 [过程文档规则](README.md) 暂存此处，决策收口后随主报告迁移。

## 1. 20 行确有装配限制，但完整执行结果没有在 execution.py 被丢弃

[execution.py:72-92](../../metriccanvas-authoring/tool/metriccanvas_authoring/data/execution.py#L72) 的 `rows` 保留 DQE 返回行，`sample_rows` 才截取 20 行；`effective_total_count` 在服务未给总数时回退到返回行数。[results.py:148-149](../../metriccanvas-authoring/tool/metriccanvas_authoring/data/results.py#L148) 持久化全部执行行以及原始 `total_count`；[executable_units.py:167-179](../../metriccanvas-authoring/tool/metriccanvas_authoring/data/executable_units.py#L167) 仅在页面数据源 `initial` 中嵌入样本。

真正耦合在 [page_structure.py:94-116](../../metriccanvas-authoring/tool/metriccanvas_authoring/pages/composition/page_structure.py#L94)：装配从 `source.initial` 取样本，以 `initial.totalCount == len(rows)` 验证匹配唯一性及饼图完整性。因此 DQE 返回 41 行而上游总数未知时，会出现页面 `initial.totalCount=41`、样本 20 行，同时模型可见 `coverage.totalCount=null`。这两处 totalCount 含义不能混用；[results.py:210-214](../../metriccanvas-authoring/tool/metriccanvas_authoring/data/results.py#L210) 明确只有上游总数已知且相等才声明 coverage.complete。

不能将饼图检查改成 `count >= len(rows)`：这样会把缺失类别的局部和显示成整体比例。建议公共层把可信完整性证据与页面首屏样本分开；装配通过已授权 resultRef 消费完整行/可信统计，而页面和模型可见证据仍保持预算。上游总数未知也不能仅凭“返回了全部响应行”承诺全量，需保留 unknown 状态。

验证建议：20/21/41 行；上游 totalCount 已知/未知/大于返回行数；截断样本；多进程 resultRef 读取；确保新证据继承原有身份、创作轮次、数据上下文版本及查询校验策略校验。不能给模型新入口传 `complete=true` 自证完整。

## 2. metricCard 不强制要求 dimension

[page_structure.py:98-108](../../metriccanvas-authoring/tool/metriccanvas_authoring/pages/composition/page_structure.py#L98) 仅在显式传 `match` 时要求维度与完整性；[page_building.py:56-71](../../metriccanvas-authoring/tool/metriccanvas_authoring/pages/composition/page_building.py#L56) 通过数据形状选择组件，[page_building.py:115-123](../../metriccanvas-authoring/tool/metriccanvas_authoring/pages/composition/page_building.py#L115) 支持仅 measure 的卡片。

本次本地最小执行：单行 `{v:42}`、一个 measure、无 dimension、无 match，`block_component` 返回 `metricCard`。因此应纠正附件与部署 Skill 的“卡片需要一个维度”表述。总量结果直接绑定 measure；只有从多行结果选某一业务对象时才需要可验证的唯一 match。不要为了满足错误说明给总量查询添加无意义 groupBy。

## 3. 时间维度 output_dims 与 queryField 当前允许不同

[executable_units.py:208-215](../../metriccanvas-authoring/tool/metriccanvas_authoring/data/executable_units.py#L208) 明确约定：DSL 使用基础维度名，返回列使用 `caption(period)`；[executable_units.py:350-353](../../metriccanvas-authoring/tool/metriccanvas_authoring/data/executable_units.py#L350) 由规范维度名构建 output_dims。

这不是当前仓库未处理的字段错误：[TypeScript 校验器:608-621](../../packages/page/src/validate.ts#L608) 与 [Python 校验器:714-730](../../metriccanvas-authoring/tool/metriccanvas_authoring/pages/validation/page_validation.py#L714) 均从时间 period 推导允许的返回列名。部署报错可能来自旧版本校验器或 Java 实际协议差异，需比较部署版本和真实响应，不宜直接纳入“output_dims 全加粒度”补丁。

此外，[source_mapping.py:124-127](../../metriccanvas-authoring/tool/metriccanvas_authoring/data/source_mapping.py#L124) 用基础名与返回列名的关系构造时间层级身份，单改 output_dims 会改变字段身份派生输入。验证应同时覆盖查询发送体、真实返回列、两端校验器及稳定字段 ID，而不只断言两字符串相等。

## 4. caption 与 alias 必须保护语义唯一性

[lab_projection.py:219-240](../../metriccanvas-authoring/tool/metriccanvas_authoring/data/lab_projection.py#L219) 的规范维度名还用于治理配置及维度值域查找。全局改 caption 优先可能使内部 name 为键的 governance/value-domain 失联，且不同内部字段可能共享 caption。建议先以 Java adapter 的真实列协议映射确定性名称，或者在公共投影中设计明确的稳定身份、显示名、输出名关系；验证同 caption 不同内部名、治理查找和值域查找。

[data_context.py:294-305](../../metriccanvas-authoring/tool/metriccanvas_authoring/data/data_context.py#L294) 对名称/别名冲突失败。附件 `setdefault` 改法会按元数据顺序静默绑定到第一个指标；某指标的 alias 甚至可抢占后续指标的 canonical name，可能查到错误业务指标。不能以 relaxed 模式为由允许这种歧义。

可评估的公共改进：先建立唯一 canonical name 索引，再建立 alias 的候选集合；重复 canonical name 仍拒绝，冲突 alias 在被使用时返回歧义候选，精确 canonical name 可继续使用。此为方案而非现有行为，需覆盖顺序置换、alias 对 canonical name 冲突、多个同名 alias 与不同业务域隔离。

## 5. scope 的换行差异属实，不能把全局 sources 当作 section 成功证据

[referenced.py:56-86](../../metriccanvas-authoring/tool/metriccanvas_authoring/pages/referenced.py#L56) 的 `sources` 是全请求数据源集合，`used` 是本 section 已成功装配的数据源。因此 `if used` 直接改 `if sources` 会在无关 section 中产生空口径提示，并不能说明失败组件口径。已失败组件已有 `structure-missing-*` 提示。保持“成功呈现口径”与“请求但未呈现口径”明确区分；若增加后者，应独立标识且只取本 section 的已验证记录。

[referenced.py:114-115](../../metriccanvas-authoring/tool/metriccanvas_authoring/pages/referenced.py#L114) 的 add_result_component 单行前缀确与 compose 多行前缀不同。可在公共层抽统一格式化函数，并验证重复编辑不产生重复说明、移除组件后的口径清理。add_source_component 没有已解析 resultRef 的 request，不能伪造对应查询口径。

## 6. revision 0 与数字格式

[lifecycle.py:74-92](../../metriccanvas-authoring/tool/metriccanvas_authoring/assets/lifecycle.py#L74) 两条保存响应分支均要求 `revisionNumber > 0`。若提供方明确初始修订从 0 开始，可评估公共协议调整至非负整数，但要确认历史列表/读取/导出契约一致；保留精确 ref、base、operationId、内容证明和身份校验。验证 0 首次保存、负数/布尔值拒绝、旧 revisionId 更新拒绝、冲突响应，不以两处代码审阅代替保存闭环。

[source_mapping.py:66-100](../../metriccanvas-authoring/tool/metriccanvas_authoring/data/source_mapping.py#L66) 已提供查询哈希、数据上下文版本与字段描述一致性验证及格式映射，且不修改原始值。格式枚举是 [field.ts:27-44](../../packages/page/src/field.ts#L27) 的 `compact-wan-*`、`compact-yi-1` 等，附件 `compact-zh_CN` 不是受支持值。

金额需要明确 CNY 与基础货币尺度；不得仅凭“流水”词或 AMOUNT 推定人民币。数量缩放可使用确认后的受支持格式，保留原始数值，避免 adapter 与前端重复缩放。验证数量/金额/比率/空单位、未知货币、显示预设与实际查询数值一致性。

## 本附录验证边界

已完成：源码追踪；本地调用证明无维度单行 metricCard 可装配；本地构造 41 行 DqeExecutionResult 确认 rows=41、sample_rows=20、effectiveTotalCount=41、upstreamTotalCount=None。

未执行：真实 Java/DQE、Relay 部署版本对照、生产会话重放、浏览器呈现与任何补丁验收。本附录无业务代码改动。
