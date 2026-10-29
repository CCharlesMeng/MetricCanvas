# 错误文案改为人能读懂的说明

同一未提交批次的后续修订：首先用实际表格标题和字段label，说明发生了什么、为什么无法合并、该检查什么；内部ID、queryField、rowKey配置路径保留在后续技术定位中。无标题或label时使用“当前表格”“记录标识”等通用文案，不在首段退回内部ID。来源定位仅在报错时复用已有组件诊断遍历。

## 原附件回放

“评审组织人驳回情况统计”无法合并数据。同一个查询返回的第 7 条和第 18 条记录，“评审组织人”相同。页面用这个字段区分每条记录，因此不能重复。请改用能区分每条记录的字段。

附件实际值不进入错误消息；原始数据不入仓。脱值回执在readable-attachment-replay.log。本轮不修正页面选择审批人为唯一标识的问题，只改善错误说明。

## 验证

- 正式SourceProgram回放原附件：准确定位原表格和第7/18条记录；断言首段不含commercial、rowKey、queryField、offset或原始行键值。
- 三个相关测试文件31项通过；其中完整首段断言要求标题、中文字段、原因和行动建议，技术信息与错误码继续保留。
- local-authoring与参考文档42项通过；生成契约一致性检查及数据执行包类型检查通过。
- 浏览器5197的multi-source-table合成重复场景：控制台首段显示“审批统计明细”、第1/2条、“来源内编码”及修改建议，随后为分页/技术定位。页面自身错误展示仍服从现有页面声明。
- 复用原完整页面与三种rowFailure参数；产品正文、页面README及官方生成的Skill/MC知识同步，Schema及Skill版本沿用同一未交付批次。
- MC完整检查通过：生成一致性、来源覆盖、33项Python测试及诊断夹具一致性均通过。真实DQE/Relay未访问。

## 复杂度

metriccanvas-ts-ast/1，TypeScript5.9.3，selfCC；详见readable-complexity.json。

|相关函数|本轮前|本轮后|
|---|---:|---:|
|unionMemberError|2|4|
|unionMemberError新增标题匹配回调|新增|2|
|unionKeyLabel|新增|2|
|unionSortLabel及映射回调|新增|1/3|
|unionRow|8|9|
|validateRowOrder|6|6|
|contractIssueMessage|3|4|
|测试辅助函数及全部回调|1至4|1至4|

其余投影、分页、取消及检查点分支保持。所有修改函数及新增辅助/回调均不超过15，无未关闭复杂度项。

本地日志与JSON的归档位置、基线和交付范围见 [交付记录](delivery.md)。
