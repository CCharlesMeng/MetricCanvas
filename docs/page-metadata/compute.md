# 具名算子

compute按声明顺序处理归一化行集。ratio逐行相除，零/缺分母按null或zero处理，缺分子取空；scale缺省原比率，100将其变成百分刻度。delta做减法，任一输入空则空。

groupSubtotal在每组明细后插小计；grandTotal只累计明细、不重复累计小计；两者只使用collapsible:true度量。rowKind字段是可空string维度，subtotal/total标记汇总行。pivot按有序类别列表匹配首个类别，把行转列。

所有产出字段必须就地声明，不能伪装成原始输入或queryField。这是封闭算子系统，显示格式、任意公式及通用脚本均不是算子。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

## 汇总的全空结果（6.12）

`groupSubtotal`和`grandTotal`可声明`allMissing: "null" | "zero"`。省略或null保持原行为：某项度量整组没有数值时输出null；zero仅将全部为null/缺失的汇总输出0，不改明细。无效非空输入不因此变成0；溢出仍为null。空行集不生成汇总，总计继续排除小计行。策略属于该次计算，不属于字段的全局缺失规则。6.11不能使用该声明。

## 多度量透视与有限主集合左关联 6.14

pivot.columns可指定valueField覆盖算子默认字段。同类别可用于不同度量，重复的有效valueField与类别组合拒绝；新多度量透视的分组键与类别必须唯一。缺阶段产出null，0保持0。有限主结果仅在被结果绑定引用且声明正整数limit、无offset/查询分页时允许左关联；辅助源仍须complete，无分页窗口。导出保持此选择范围并使用本轮原始结果重建明细输入。

## 字段求和与缺项归零（6.71）

`sumFields` 的 `fields` 是有序、不重复的数值字段列表；6.71 起允许单个输入，`onMissing:"zero"` 将 null 或缺失按 0 相加，全部缺失也输出数值 0。负分直接相加，不重新计算权重、不折叠不同行。非法非空值和溢出仍取 null；空行集不生成行，查询失败不等于缺项。旧 `null`（任一缺项为空）与 `ignore`（部分缺项忽略、全部缺项为空）保持原行为。新策略和单字段列表在 6.70 及以下拒绝。

最小声明：`{"op":"sumFields","fields":["a","b"],"output":"category","onMissing":"zero"}`。输出字段须声明为数值度量，不能带 queryField 或嵌入输入行。多个算子顺序执行，可先算分类、再算总分。单字段分类可用同一策略将缺项归零。

Playground `/pages/sum-fields-missing-values` 使用 inline 合成数据验证部分缺项得分 8、风险 -2、总分 6，以及全部缺项和真实零值总分 0；`/pages/partner-health` 使用整体、地区部、代表处三种后端粒度后逐行计算，真实 DQE 需单独验真。
