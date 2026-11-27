# 指标卡 metricCard

突出一个或少量核心指标的当前值、变化值与可选完成率。适用于总额、数量、完成率、KPI、核心指标、年度活动进展。数据形状：单行或少量行；至少一个 metric 字段，可选变化值和完成率 metric。

数据槽和字段绑定声明取哪行哪列；不同variant改变摘要结构，不能把列清单当任意HTML模板。

<a id="metric-card-change-visibility"></a>

## 变化项显隐

6.136 起，`props.rows[].changes[]` 和 `props.secondaryRows[].changes[]` 可就地声明 [`visibleWhen`](../conditions.md)。例如，已应用的时间范围筛选器 `period` 使用期间选择时，可用下面的变化项声明按月显示环比。

```json
{
  "label": "环比",
  "field": { "data": "main", "field": "mom", "format": "percent-0" },
  "visibleWhen": { "filter": "period", "part": "mode", "op": "eq", "value": "month" }
}
```

用 `op: "in"` 和 `values: ["year", "quarter"]` 可让同比在年、季度两种模式下显示。每项条件独立生效，省略条件的变化项照常显示。变化项可引用筛选器、权限或事实，行字段引用和 `enabledWhen` 在此处非法。

条件为假、等待或出错时隐藏对应变化项。卡内指标行、主值及其他构件继续呈现，可见变化项沿用声明顺序和原字段绑定。页面和导出按当前条件合并所有消费者的字段需求。隐藏变化项独占的补充数据槽跳过查询；如果表格、地图、动作或计算仍消费该字段，则保留对应数据。普通单项 DQE 查询可裁剪未使用的独立指标，复杂查询保留完整输出。

主值与比较值可分别绑定独立查询的 `main`、`compare` 槽。屏幕上各值随本轮对应槽就绪而显示，其余值继续显示加载骨架。比较值与主值来自同一请求时，两者随该响应一起显示。合同商务总览按年、季取同比，按月取环比，近一年跳过比较请求。

变化项的 `colorRule`、`tone` 和默认正负规则对数值、单位和趋势箭头着色，标签沿用卡片的中性文字颜色。例如「环比 +3%」可将 `+3%` 显示为红色，「环比」仍为灰色。

完整场景见 [指标卡变化项显隐](../examples/metric-card-change-visibility.json)，Playground 入口为 `/pages/metric-card-change-visibility`。

<a id="metric-definition-tip"></a>

## 指标定义气泡

6.129 起，在指标卡的 `props.rows[]` 或 `props.secondaryRows[]` 对应行设置 `showDefinition: true`。运行时沿该行的 `valueField` 读取顶层度量结果字段的 `metricCode`，在指标名称右侧显示问号。省略开关或设置为 `false` 时隐藏。共享字段的每个使用位置独立控制。卡片已有 `props.title` 时，逐行问号仍紧跟各自行的指标名称。

```json
{
  "schemaVersion": "6.129",
  "id": "closure-rate-tip",
  "layout": "dashboard",
  "dataSources": {
    "metrics": {
      "fields": {
        "closureRate": { "type": "number", "role": "measure", "metricCode": "DEMO-TOTAL-CLOSURE" }
      },
      "source": { "type": "inline", "rows": [{ "closureRate": 95 }] }
    }
  },
  "sections": [{
    "id": "metrics",
    "components": [{
      "id": "closure-rate",
      "type": "metricCard",
      "layout": { "span": 3 },
      "data": { "main": "metrics" },
      "props": {
        "variant": "primaryDetail",
        "rows": [{
          "label": "总闭环率",
          "valueField": { "field": "closureRate", "format": "percent-1" },
          "showDefinition": true
        }]
      }
    }]
  }]
}
```

开启的指标行必须绑定带编码的度量。使用 `byFilter` 时，各分支字段须分别声明编码，运行时取当前生效分支的编码。集成应用提供 `dataGateway.fetchMetricDefinitions` 时显示问号。

6.127 的 `props.tipCode` 继续用于旧页面。主标题有文字时问号显示在主标题旁。省略主标题且只有一个带标签的主指标行时，问号显示在该行名称旁。同一张指标卡的 `tipCode` 与行级 `showDefinition: true` 互斥。

问号可悬停或通过键盘打开。问号的辅助名称和气泡的固定文案统一使用中文，服务端返回的指标内容按原文显示。气泡独立查询指标定义并显示名称和编码、定义、公式、解释人及可选更新说明。当前页面会话按编码缓存已成功加载的定义，重复打开直接展示。换页、重新初始化页面或更换数据网关时重新建立缓存。查询失败或缺少对应编码时可以重新加载。图标与气泡之间移动时保持打开，离开两者或切换页签时关闭并取消当前请求。被取消或缺失的定义仍可再次查询。可用的 HTTP(S) 链接以黑色粗体显示在右下方，新开标签页。更新时间非空时显示「查看最新指标定义」，否则显示「查看更多」。静态导出仅呈现标题与指标值。

气泡宽度随内容收缩，外宽和外高各最多 400 CSS px，含内边距。窄视口给左右各留 8 CSS px，高度还受问号上方或下方可用空间限制。长文本换行，超出高度时可在气泡内滚动。尺寸由运行时统一控制。

从 `/pages/metric-card-definition-tip` 可观察短内容收缩和长定义滚动。[完整合成页面](../examples/metric-card-definition-tip.json)。

**加载状态。**

首次取数、切换期间或其他筛选条件发起重查时，主数值、次级指标、变化值及完成率数字在原位显示灰色骨架，共用表格从左向右的循环扫光。标题、指标名、变化标签和完成率环形轨道保留。等待期间隐藏数值、单位、趋势箭头和值级操作。查询完成后按字段格式直接显示最终值，完成率圆环同时更新。命中查询缓存时直接显示结果。系统开启减少动态效果时使用静态骨架。空结果或查询失败显示原有缺失值。所有 variant 共用这一渲染行为，适用于已有页面。缓存和失效边界见[加载时保留组件结构](../data-sources.md#screen-loading)。

`/pages/metric-card-loading` 使用 DQE Sim 合成数据。切换区域可观察全部指标卡形态的加载与数值更新，覆盖主数值、次级指标、变化值、完成率及宽窄屏。

<a id="metric-card-value-color"></a>

## 主值着色 6.138

在 `props.rows[].colorRule` 声明已有的正负或固定颜色规则，给主指标数值着色。正负模式使用字段格式对应的正负判定，零值和缺失值沿用原有呈现。规则应用在数值本身，指标名称、独立单位、次级指标和点击动作沿用原样。省略时继续使用卡片默认主值颜色。

```json
{
  "label": "利润偏差",
  "valueField": { "field": "margin-gap", "format": "points-1-signed" },
  "colorRule": { "mode": "sign", "positive": "green", "negative": "red" }
}
```

配置示例见 [指标卡主值着色](../examples/metric-card-value-color.json)，Playground 入口为 `/pages/metric-card-value-color`。

## 主指标与多行次级指标 6.65

`props.variant: "primaryDetail"` 表达一张卡内的一个主指标和零到多行次级指标。`rows` 必须恰好一行，名称在上、主值在下，主值和变化值使用 400 字重，普通主值默认黑色；`secondaryRows` 按声明顺序在其下逐行呈现，每行是指标名及指标值，不设数量上限。不需要次级指标时省略 `secondaryRows`，不能写空数组。它们是独立字段绑定，不能把次级指标塞进表示变化信息的 `changes`。主指标的多条变化项在主值下默认纵排，每条的标签和数值同行。

每一行次级指标的上方间距为8 CSS px（首行距主指标8px，其后行距上一行8px），水平名称与数值间距8px。字体为 `"PingFang SC", sans-serif`、normal、400、14px、字距0、左对齐；指标名为 `rgba(0,0,0,0.5)`、行高20px，指标值及单位为 `rgba(0,0,0,0.8)`、行高17px。长名称允许换行，零值和缺失值继续沿用字段格式及缺失占位规则。

同一栅格视觉行内的卡片按最高卡片的自然内容高度拉伸，短卡底部保留空白；无固定卡高、行数截断或补齐空行。窄屏堆叠后各卡恢复自然内容高度，下一行不与上一行取同一最大值。卡面复用现有白底、浅灰边和16px圆角。

与单面板 `compactStack` 混排时，该紧凑卡的外层及唯一面板共同拉伸，同一视觉行的卡面底边保持一致；各自的 variant、文字、字体、颜色、间距及内容在卡内的位置保持原样，仅在较短卡的底部留白。不需要新增高度字段或切换 variant。带次级面板或进度环的 `compactStack` 保留原有多块内容布局，不把每块面板强制等分高度。混排验收见 `/pages/metric-card-primary-detail` 的 `mixed-variants` 分区。

显式声明 `row.link: true` 并配有合法的 `navigate` 或 `openDetail` 动作时，非空指标值可聚焦和点击。真实零值仍可作为链接。`valueField`、单位、格式、数据槽与筛选联动均复用现有绑定协议。`secondaryRows` 在其他形态中保持既有呈现。

6.126 起，主次指标行可声明 [`action.selectTab`](../actions-and-navigation.md#metric-select-tab)，每行独立决定目标页签。配置了行级动作的非空值可以直接点击。同一行的 `action` 与 `link: true` 互斥，其他行仍可使用卡片级导航或详情。

可点击指标的下划线只覆盖数值文本，包含数字格式生成的百分号。单独显示的单位、普通数值和缺失占位都没有下划线。

验收入口：`/pages/metric-card-primary-detail`，完整页面为 `pages/capabilities/layout/metric-card-primary-detail.json`；仅内联合成数据，覆盖0/1/3/6行等高、长名称、零、缺失值与显式链接。该场景不证明真实DQE/Relay接入。

Dashboard 白底内容容器（Tab、`container: "card"` / `"panel"` 分区）中的指标卡自动使用 1px、黑色10%透明度的实线边框和16px圆角，与连接指标卡同样保留独立卡面；无需新增页面字段。灰底画布保持既有呈现，Report保留原有边框。普通卡的外框包住完整内容，紧凑型卡的每个指标面板分别带框；组合卡只绘制外层边框，内部指标不重复套框。可观察场景：[`tab-mixed-content`](../examples/tab-mixed-content.json)。
<a id="metric-card-before"></a>

## 前置连接文字 6.34

Dashboard 的 plain/card 内容分区可以在顶层相邻指标卡的 `layout.before` 声明 `{ "text": "+", "gap": 8 }`。text 复用文本取值，按纯文本呈现；gap 缺省 8，只接受 4/8/12/16/24（CSS px），分别表示连接文字内容盒到两侧卡片外框的间距。缺失可选文本参数时整个连接声明不参与排布。

连接文字不占 span。连续连接指标卡整体占成员 span 之和，最多 12；内部先扣除文字宽度及双侧间距，再按成员 span 比例分配卡片空间。四卡各 span 3，扣除连接空间后仍等宽。文字使用固有宽度，长文字单行省略且保留完整可访问名称，不能撑宽页面。卡片空间预算不足或命中既有窄屏规则时改为单列，文字位于两卡之间，纵向双侧使用相同 gap。

连接整组自动拉宽至成员 span 对应的可用宽度，首尾卡片对齐组内左右边缘；合计 span 12 时占满分区一行。整组指标卡与连接文字的外层不绘制边框。plain 分区中的独立连接排布盒保留 border-box、白底、16px圆角和20px内边距；显式 card 分区统一承担白底与内边距，内部连接排布盒不再叠加外框。每张指标卡保留独立的白色卡面、1px灰边和12px圆角；连接文字到左右小卡片外框的距离各为声明的gap（本示例均为8px），不会通过拉大文字两侧空隙对齐。卡片自身按span比例吸收剩余宽度，等宽或比例分配基于扣除所属容器内边距、文字及双侧 gap 后的内容空间；这些呈现规则由连接排布统一拥有，无需页面 CSS 或新增容器声明。

原文档第一张卡的 before 保留声明但不显示；其他位置的前项必须是相邻指标卡。只有原相邻两项均呈现时显示连接文字，不跨隐藏项重连，也不以查询加载或错误代替可见性判断。页面搭建移动或删除打断相邻关系时清除失效前缀，撤销会一起恢复。

第一版仅支持 Dashboard、plain/card、默认 12 列的顶层指标卡；不支持 Report、columnTracks、panel、backdrop、connectPrevious、嵌套及 after。非法组合由页面校验明确拒绝。连接只表达展示关系，不执行等式计算。完整验收入口为 `pages/capabilities/layout/metric-card-equation.json`，包括 `=`、`+` 和“其中”，第一组使用DQE Sim合成区域查询，第二组为静态对照。

在白底无边框的同一分区里放置小标题、筛选按钮及连接指标卡时，使用 section.container:card 与 section.title，先声明占满12列的 filterGroup，再声明相邻指标卡。分区负责外观，连接行只负责排布；详见[内容分区](../sections-and-layout.md)。演示 `/pages/metric-card-equation` 的区域按钮通过显式查询绑定联动四卡，第二组静态指标保持不变。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。


数值与单位遵循[统一语义格式](../field-bindings-and-formats.md#numeric-value-display)：组件显式格式优先，自动金额和数量不再重复追加旧的元/万等单位标签。比率变化项使用正负号，即使 `showTrendArrows: true` 也不显示箭头；绝对变化项保留既有箭头行为。进度环图形可裁到0–100%，文字仍按真实比率格式化，不把超过100%的真实值改成100%。缺失比率默认显示 `—`，自定义缺失文字按原声明。合成场景 `/pages/semantic-numeric-display`。
