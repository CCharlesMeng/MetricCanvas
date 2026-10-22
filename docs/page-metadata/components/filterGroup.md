# 独立筛选 filterGroup

6.45 引入，旧图表筛选采用本次明确批准的受控迁移。

Dashboard 正文中的独立固定单选筛选组件，也可放入组合卡。组件不承载数据、不强制卡面或标题；沿用原图表筛选按钮的圆角、配色、键盘与窄屏换行行为。

```json
{
  "id": "channel-filter",
  "type": "filterGroup",
  "layout": {"span": 12},
  "visibleWhen": {"filter":"scope","part":"values","op":"containsAny","values":["DOMESTIC"]},
  "props": {
    "filterId": "channel",
    "options": [{"label":"直营","value":"CN"},{"label":"加盟","value":"OVERSEAS"}]
  }
}
```

`filterId` 引用同页普通维度筛选器，例如 `{"id":"channel","type":"dimension","dimension":"region","default":["CN"]}`。`options` 是非空固定候选列表，各 value 唯一；label 仅用于展示，value 写入统一筛选状态、URL 和查询。default 必须是候选中的恰好一个值。不使用层级、级联、initialParam 或另一份声明级候选、选择策略。

作用范围只由查询定义中的 `filterBindings` 决定；至少一个查询必须消费这个筛选器。允许多个查询绑定同一筛选器，也允许指标卡、图表或其他组件共同消费受影响结果。不增加受控组件 ID 列表，不按控件位置隐式划范围，不要求复制共享数据源。未绑定且不依赖受影响结果的数据源不因本控件切换刷新。

组件顶层 `visibleWhen` 与筛选声明的 `visibleWhen`、静态 `visible:false` 及祖先门禁由统一展示模块组合求值。隐藏控件保留筛选状态和查询绑定；内容分别声明自己的条件。再次显示恢复已有选择。候选项固定，不因页头切换自动改变，也不请求候选端口。只读页面禁用按钮或下拉；加载、空结果、查询失败不移除独立控件。

同一筛选器只能声明一个 filterGroup，不在页头重复显示。Report、详情视图、动态候选、多选与空选不在首批范围。非法或多值 URL 输入回退声明默认项；运行期非法写入保留已应用选择。静态导出共用冻结筛选与展示投影，以当前选中 label 替代按钮或下拉。

旧图表 `props.filter` 已移除，校验器给出明确迁移提示，不提供旧渲染分支。迁移将 filterId/options 移到独立组件，保留筛选声明、默认项、查询绑定和稳定业务值；需要保持同组布局时使用组合卡。四类图表均可作为组合卡的叶子组件，不开放递归容器。

验收入口：`filter-group-page` 展示图表卡左上按钮切换指标、右上区域下拉，两项通过查询绑定共同刷新图表与合计；`filter-group-state-page` 展示带符号指标卡、一控多、独立与卡内布局、页头条件显隐、无关对照和 URL 恢复；`chart-local-filter-page` 为四类旧图表声明迁移后的页面。这些场景数据均为本地合成数据，不代表真实 DQE、Relay 或生产接入验收。

## 固定单选下拉与对齐（6.47）

`props.display` 可取 `buttons`（省略时的默认值）或 `select`。下拉复用现有维度筛选控件，保持固定候选、必选单选、不请求候选端口；状态、URL、条件显隐、只读与静态导出与按钮完全一致。`props.align` 可取 `left`（默认）或 `right`，只控制控件在所占栅格中的对齐，不改变查询范围。显式配置任一属性均要求 6.47。

图表卡中的两个控件各占 `layout.span:6`，图表占 12；右侧使用 `{"filterId":"region","display":"select","align":"right","options":[{"label":"全部区域","value":"all"},{"label":"华东","value":"east"},{"label":"华南","value":"south"}]}`。两个筛选器分别绑定 queryField，组合条件由查询消费。示例的 `all` 是合成数据集显式提供的全区域汇总行，不代表通用的“不过滤”值，也不能把该业务值移植到真实查询。

按钮切换指标仍是显式筛选：合成数据有 `toolbar_metric` 维度，图表和合计查询都绑定它以及区域维度；不同指标的单位和内容分别通过集中 `visibleWhen` 选择。运行时不替换查询字段、不执行脚本。原型链接 `/prototypes/chart-filter-toolbar` 重定向到正式示例。
