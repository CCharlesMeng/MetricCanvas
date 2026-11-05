# 图表局部筛选的数据源候选

## 已确认口径

图表卡右上可组合多个下拉。静态候选使用 inline 页面数据源；动态候选从查询页面数据源指定 output 的完整结果去重。树节点显式声明自身值、显示名和父关系，父节点可选且只提交自身值，多选提交实际选中集合。候选来源不可受自身筛选影响。

## 最小声明与 Schema 检查

沿用 filters、FilterState、filterBindings、filterGroup 及 DimensionFilter；现有固定 options 保持兼容。现有协议没有页面数据源候选引用，因此新增 filters[].candidates 对象，包含 dataSource、valueField，以及可选 labelField、parentField。字段引用已声明结果字段，不引用原始 DQE 字段。display、selection、treeSelection 继续由筛选声明拥有，不复制到组件。

```json
{
  "id": "organization", "type": "dimension", "dimension": "organization",
  "display": "tree", "treeSelection": "independent",
  "selection": {"mode": "multiple"},
  "candidates": {"dataSource": "organization-options", "valueField": "code", "labelField": "name", "parentField": "parent"}
}
```

组件为 `{"id":"organization-picker","type":"filterGroup","layout":{"span":6},"props":{"filterId":"organization","display":"select","align":"right"}}`；省略旧 options 时，筛选声明必须拥有 candidates。查询/inline 数据源保留现有定义与字段所有权。新增能力版本 6.90，拒绝旧版本偷渡。

## 实施顺序

1. 产品协议与语义：候选引用、互斥、字段类型、依赖环与版本门禁；保留旧固定单选行为。
2. 执行：复用 SourceProgram 完整读取，严格校验完整性后按稳定值去重；失败、取消、上限或非法树均不给出部分候选。复用现有候选门禁及请求上下文；候选来源读取不接受自身选择。
3. 呈现：复用树形/平面单多选、候选状态、只读、URL 与静态导出；多个控件继续使用组合卡工具栏。
4. 验收与同步：添加真实完整页面及操作 README、协议正文、能力与异常测试，生成 local-authoring/MC 契约并仓外验证；运行类型、复杂度、浏览器与 embed 分发门禁。

## 复杂度职责

产品引用校验、候选行投影、树关系校验、完整结果读取分别承担独立不变量；不将上述流程堆入 RuntimeSurface。编码前后使用仓内 AST 口径测量新增和修改函数，Svelte 仅测脚本；新增 selfCC 不超过 15，存量修改不增长。

## 工作边界

在独立工作树实施，不带入主目录并行未提交变更。此请求包含本地实现与验收，未要求提交、push 或生产部署。合成页面/浏览器不作为真实 DQE、Relay 或组织权限服务接入证据。

## 本地实施结果

实施已完成。候选来源、静态树、父节点独立单多选、完整去重、来源引用/完整性诊断、URL、只读和冻结导出均已接通。内部候选请求保留已声明依赖的完整状态，避免丢失期间模式、组织层级或布尔覆盖前的存储值；这些元数据不进入页面 Schema。

产品核心 2,314 项回归、依赖状态 52 项定向回归、独立端口的 11 项分发浏览器检查、类型及构建已通过。Schema 文档、Playground 与 local-authoring/MC 产物同源生成；仓外 Skill 校验通过。完整命令、复杂度前后结果、剩余存量及外部服务边界见 [验收记录](https://github.com/CCharlesMeng/MetricCanvas/blob/560dec290d39588f70003ddb3d498891a3db4a6f/docs/evidence/filter-source-candidates/README.md)。代码保留在独立工作树，未提交或 push。
