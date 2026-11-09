# 数值与绑定检查

新增或调整数值字段、绑定、数值格式或展示单位时使用本页；只改标题、列宽或布局时沿用既有数值声明。查询和来源变化另按[数据识别与接数](data-analysis.md)验证数据依据。

## 展示单位

“给表格列加单位”“数值后显示天／万元／%”或“图例带单位”先读取专题：

```sh
node "<skill-dir>/scripts/read-knowledge.mjs" show --topic fields.display-unit
```

按专题中的组件局部声明修改目标列或系列；列组继续定位到实际字段叶子列。数据源字段契约的单位描述原值刻度，和组件展示单位分别核对；仅调整展示时保留字段契约、查询、原值及其他共享消费者。需要缩放时再选择对应 format。

完成前逐项对照原需求与修改差异：目标列／系列确实声明了请求的 unit，原字段契约和其他消费者保持；预览确认单位出现在数值或图例的目标位置。结构校验及下方 page.presentation 不会根据自然语言需求判断是否漏写列级 unit，不能用它们通过代替此项对照。

## 数值与有效绑定

先读取实际涉及的字段与绑定，核对可信单位、百分刻度、完整性和原值。Tokens 基础刻度与完整结果证据满足条件时选择百万；已缩放值、未知刻度和部分样本保留事实，不推断全量。具体同源规则按需读取：

```sh
node "<skill-dir>/scripts/read-knowledge.mjs" show --topic authoring.presentation
```

使用独立工具检查有效绑定，输入文件至少为 `{}`：

```sh
node "<skill-dir>/scripts/associate-data.mjs" page.presentation --page page.json --input presentation-input.json
```

需要局部差异检查时在输入提供 `baseline`，值为修改前完整页面对象；时间敏感页同时提供本轮明确的 `evaluation`。退出码 0 表示操作完成，仍须检查 JSON 的 status/findings；2 为产品拒绝，3 为调用或文件错误。脚本只输出回执，不覆盖页面。

按 finding 的实际 binding pointer 修复本次新增冲突，保留明确用户配置。百分比明确需要显示原值时，在 `presentationIntent.rawValuePaths` 声明相应 number 系列绑定的 pointer；该意图不能豁免币种或重复缩放问题。不得改变原始数值去迎合显示。若业务意图与可信刻度冲突，保留原件并说明具体缺口。

该检查仅为 data-only 证据；完成后按[本地验收](local-workflow.md)完整校验并预览所涉表格、图表轴、标签与 Tooltip，分别报告静态、呈现与真实取数证据。
