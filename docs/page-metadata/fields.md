# 结果字段契约

页面字段id是dataSources.<id>.fields的键；queryField指向DQE输出，两者不可隐式当成同一个名字。dimension用于分类，measure用于数值计算，detail承载受控明细；字段类型、角色和nullable必须与真实结果匹配。

<a id="dqe-output-measures"></a>

## DQE 直接输出的数值作为度量（6.56）

DQE 的输出位置与页面的结果字段角色分别声明。`output_dims` 中已经存储的计数、金额等数值，可以显式映射为 `type: number | money`、`role: measure`，供柱状图、折线图、指标卡及表格等现有消费者使用。按角色分组的写法将该字段放入 `fields.measures`；金额仍须声明 `currency`。能力下限为 6.56，旧版本及 5.x 只读兼容文档不得使用。

```json
{
  "fields": {
    "region": {"queryField":"区域","type":"string","role":"dimension"},
    "projects": {"queryField":"项目数量","type":"number","role":"measure","unit":"个"}
  },
  "source": {
    "type":"query",
    "query":{"language":"dqe","body":{"dsl_list":[{
      "output_dims":["区域","项目数量"],"output_metrics":[],
      "filter":{"dims":[],"metrics":[]},"order":{}
    }]}}
  }
}
```

字段角色只声明页面用途，不改写 DQE 查询，不增加 `SUM`、`COUNT`、去重或客户端分组。每根柱使用该结果行已返回的数值；同一区域若返回多行，仍保留多行，目标区域粒度须由原查询保证。`measure` 不隐含可加总，折叠仍要求 `collapsible: true`。

未显式选择度量角色的数值编号仍是维度；字符串、布尔、日期和时间等 `output_dims` 标量不得借此声明为度量。`output_metrics` 的标量仍要求 `role: measure`。现有 `detail` 专用消费规则保持原义。数值度量沿用下文的归一化与缺失规则，包括来自 `output_dims` 的字段及其内嵌初始行。

查询筛选目标继续由 `filterBindings` 显式决定；把页面字段声明为度量不会把维度条件改写为指标条件。`numberRange` 等既有绑定仍使用原来的 DQE 指标谓词，不因本能力获得新的上游筛选能力。完整示例 `stored-count-measures` 展示两个现成计数的柱图与明细、真实零和缺失值，并支持区域维度筛选；使用本地合成数据，不代表真实 DQE 取数验真。

<a id="查询数值度量的容错"></a>

## 查询数值度量的容错

查询结果中 `role: measure` 且 `type: number` 或 `money` 的单元格统一归一化为有限数字或 `null`。有限数字（包括真实零和负数）原样保留；非空十进制及科学计数法字符串转换成有限数字；`"--"`、空串、非数字字符串、布尔、对象、数组及非有限数字转为 `null`。不解析千分位、百分号或十六进制，不把缺失值转为零。无效单元格保留所在行，其他字段和行继续渲染。

该规则同样作用于查询内嵌初始行与嵌套明细中的数值度量，动态返回和首屏一致。数值度量即使声明 `nullable: false`，实际缺失也只记录非阻断告警；此声明在查询结果上表示数据预期，不再保证运行时一定非空。已有可空字段的正常 `null` 不告警。数据网关返回可选的 `warnings`，并在查询诊断中按字段及原因汇总数量；不记录原始值或数据行。

6.60 起，查询顶层标量失配采用下节展示证据规则；缺少映射字段、非对象行及明细结构/数量上限保持严格校验；`inline` 数据和文档字面量仍按原结果字段契约严格验证。组合表格成员和投影复验允许查询数值度量的 `null`，行键继续严格校验。

没有原文展示证据时，表格和指标卡沿用字段绑定的 `missingText`（通常为 `—`），折线和柱图保留缺口，饼图略过缺失值，指标卡进度环显示缺失占位符且不附百分号。计算沿用各算子已声明的缺失值规则，不额外补零；允许忽略缺失的合计可能只覆盖有效值，不能视为完整数据。验收完整示例 `query-numeric-tolerance` 包含八种合成输入及派生完成率，不代表真实 DQE 或业务口径验真。

query支持平铺和按角色分组的文档字段写法，normalize保持原始文档，运行时解析才展平。一个DQE输出应唯一映射到页面字段；派生字段不带queryField，必须由compute产出。

recordList使用显式items.fields约束每条嵌套记录，限制在已支持的明细呈现。collapsible:true是小计/合计的显式授权，不能从measure角色推断可加总。格式只影响显示，不修改原数值。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

嵌套明细字段可通过6.32的`table.props.rowExpansion.data:{type:"recordList",field:"..."}`被显式消费为子表格；字段契约仍为一层、每父行最多100项，子表列直接引用items.fields中的页面字段id。


## 查询标量的原文展示证据（6.60）

查询数值度量（number/money）的空字符串及仅空白字符串按业务缺项归一化为 null，不产生空文本原文回退，单元格按字段绑定 missingText 展示；真实数值0与有效数字字符串0保持0。nullable:false 的非空预期仍产生缺项告警。非空非法数值文本继续保留原文证据和告警。此修复不改变文本维度内容、缺少声明属性的映射错误或 inline 的严格类型校验。验收 `/pages/partner-health-union-null-probe`（Mock）。

查询顶层 string、number、money、boolean、date、datetime 标量值失配时，可展示的原始有限标量独立保留为 cellFallbacks；有效值通道取 null。表格按 String(raw) 展示原文并告警，计算、查询输入、行键和其他组件仍使用有效类型值。合法数值字符串继续采用既有数值归一化规则，非数字文本不参与计算。

真正空值及非有限数字继续缺失处理，不显示字符串 null 或 NaN；非标量对象不走通用 String。nullable:false 在查询顶层标量上表示非空预期，实际缺失告警；inline、字面量、嵌套明细非数值项及结构规则保持严格。数值维度失配可在表格展示，但关联和结果绑定仍会因有效键缺失而拒绝执行，不能删掉输入条件后改查全量。

ready 数据快照和数据网关结果可以附带 cellFallbacks，按当前快照行下标及稳定页面字段 id 记录 raw 与 reason。所有行投影和序列化同步重排证据，派生计算不会把输入原文变成输出值。普通 query 初始行保存原始查询标量，重新打开时归一化；pagedJoin 的已归一化 initial 可附带相同证据，且不改变业务字段字典。初始行、动态查询和 Excel 保持一致。该字段是结果的展示证据，不是页面表达式或展示策略开关。
