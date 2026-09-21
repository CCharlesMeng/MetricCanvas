# 页面参数、维度绑定与初始化（6.2）

> 本文保留6.2交付时的实现说明，版本状态与能力范围不是当前基线。维度和时间参数的统一现行规则以根目录 [PAGE-PARAMETERS.md](../../PAGE-PARAMETERS.md) 为入口。

页面参数在打开页面实例时确定，此后保持不变。筛选器是页内可变状态。6.2新增维度参数及显式查询/筛选初始化绑定；6.0/6.1旧标量与文本取值继续可读。没有新增globalParams或dimensionValues根字段，也没有表达式或时间/金额范围提取。

## 声明及值

| 字段/分支 | 契约 |
|---|---|
| id | 必填；`^[a-z0-9][a-z0-9-]*$`，不得重复或与筛选器id相同，至少一个消费者 |
| type | 必填；原有string/number/boolean；新增dimension |
| required | 必填boolean；无有效输入/默认时，true阻止页面呈现及查数，false缺席 |
| label | 可选非空string；缺值提示 |
| default | 可选；标量分支严格对应类型。维度单值为非空string，多值为非空且无重复的string[] |
| multiple | 仅dimension可声明；可选boolean，缺省false。false/缺省为单值，true为多值 |

维度值是数据服务定义的稳定字符串值，不按显示名推断。无值应省略default，不得用空数组假装有效多值。声明默认值类型不匹配、空维度字符串/空数组、重复多值均拒绝。类型或绑定能力声明在6.0/6.1下会在具体使用位置报能力下限错误。

URL键为参数id，多值用重复键，如`regions=EU&regions=NA`；值不按逗号拆分，特殊字符只解码一次。维度单值出现重复键为非法输入；旧string重复键仍按原先首值语义。输入缺席/非法时采用default，否则按required处理。可选缺值不添加对应查询条件，不生成“已选择”假象；它不是权限放行，授权约束始终由外部服务执行。

## 唯一默认与显式目标

```json
{
  "params": [{"id":"regions","type":"dimension","multiple":true,"required":true,"default":["EU"]}],
  "filters": [{"id":"region-filter","type":"dimension","dimension":"region","initialParam":"regions"}],
  "dataSources": {
    "sales": {
      "source": {
        "type":"query",
        "query": {
          "language":"dqe",
          "body":{"dsl_list":[{"filter":{"dims":[]}}]},
          "paramBindings":{"regions":{"target":"dimension","queryField":"region"}},
          "filterBindings":{"region-filter":{"target":"dimension","queryField":"region"}}
        }
      }
    }
  }
}
```

这是绑定局部片段，省略了字段契约/组件等；完整合法页面见`packages/page/fixtures/contract-valid/dimension-params-page.json`，同时覆盖共享源与不共享源。

query.paramBindings为可选映射：键是声明的dimension参数id；值必须且仅含`target:"dimension"`与非空`queryField:string`。不从参数id、页面字段名或筛选器dimension猜测查询目标。一个数据源的同一queryField只能有一个参数来源；不同数据源可以显式绑定同一参数，未声明绑定的数据源保持不变。

维度与时间点筛选器的可选`initialParam`为参数id字符串，与filter.default互斥。维度筛选器引用dimension参数；层级维度筛选器的初值落在defaultLevel那一层，查询侧必须显式绑定该层的谓词字段。时间点筛选器引用必需的times参数，且该参数必须是单点（start与end相同）、精度与筛选器granularity一致；它在paramBindings里没有对应目标，显式查询目标就是那条timePoint筛选绑定。绑定参数的查询目标不能再在DQE `filter.dims`声明该目标的静态条件。已有filterBindings指向同目标时，必须且仅有一个筛选器，并且其initialParam引用相同参数。该筛选器消费的每个查询目标都须明确声明相同paramBindings，不能一半参数控制、一半另有默认。初值引用无查询消费者会被拒绝。非dimension参数不得用作这些绑定。

## 运行时顺序

1. 完整校验原始模板；一次读取initialSearch，解析参数。缺必需值立即停止，不调用数据网关。
2. 解析文本取值。旧标量格式规则保持；维度值只用文本展示，多值按逗号连接，不引入新的格式/拼接语法。
3. `initializePageParams(Page, values)`构造运行态副本：有筛选绑定的目标只初始化筛选default；没有筛选绑定的目标才把参数条件加入副本的查询体。原始模板、参数声明及持久化修订不改写。
4. 初始筛选按筛选声明/参数初值→显式筛选URL的既有覆盖顺序建立一次。页内操作只消费当前filters；清空时不恢复参数默认。部分共享源可继续保持最初参数值。
5. URL后续变化不监听，不重新实例化；filter-change仍走既有查询、导航和事件端口。打开另一实例或宿主显式update才创建新运行会话。

公开初始化函数面对已校验Page；仍拒绝缺必需值/错值形状。`parsePage`是渲染解析，不作为持久化写出；原文hash/ref必须在任何规范化前核验。

## 版本与兼容

当前作者版本为6.2，四包候选rc.3。新增文档生成器写current。布局兼容规范化独立遵循最小迁移：6.0→6.1，6.1保持6.1，6.2保持6.2；都只保留layout。这样一次布局读取不会无理由抬升已有文档的能力声明。未知6.3/7.0仍拒绝。

TS与Python共用40项布局矩阵（保留原6.0/6.1输入，新增6.2读取与6.3拒绝）和13项参数黄金向量。Python负责创作预检/规范化；运行时URL与交互属于浏览器消费，不假装Python提供相同渲染器。真实Java提取/权限/执行尚需提供方兑现；#144处理执行回执消费。
