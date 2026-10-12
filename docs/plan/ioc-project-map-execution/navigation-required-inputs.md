# 待评审：缺必需导航输入时失败关闭

状态：用户已挂起（2026-09-30）。保留问题与候选方案，不作为四页核心功能前置；不修改现行Schema/默认行为。PM-10已确认“缺必需标识/日期拒绝导航”的业务规则不再提问。

## 已复核问题

runtime/src/navigate.ts对绑定缺值直接省略；项目详情的page-title、opportunity-code、mtime又保存了演示值。因此行缺opportunity-code仍可打开详情并使用示例项目编码。这不是当前日期来源修复能够覆盖的情况。

## 推荐最小协议增量

在NavigationTarget增加可选 `requiredQuery: string[]`，声明当前动作必须提供的参数键。字段名只是提案。缺省空数组保持既有导航行为；6.11携带新字段拒绝，6.12新能力显式检测。

项目主页TOP/丢单与机会点清单到详情声明：

```json
{
  "href": "/pages/ioc-project-detail",
  "query": {
    "opportunity-code": {"source":"row","field":"opportunity-code"},
    "mtime": {"source":"filter","id":"mtime"}
  },
  "requiredQuery": ["opportunity-code", "mtime"]
}
```

清单mtime仍绑定行；TOP立项状态可使用现有静态URL参数，不新增常量表达式。若requiredQuery对应动态绑定，绑定值缺失时禁止退回href同名静态值。非空字符串、有限数字、boolean按现行标量规则验证；日期合法性由类型化输入契约负责，requiredQuery不谎称可识别任意业务字符串日期。

page校验键唯一且必须存在于query或href参数。运行时集中返回导航解析结果：可导航URL或missing-required，不让每个widget重复检查。runtime-ui所有入口（表格列/行、指标链接、图表、文本）使用同一结果，无有效URL则不输出可点击href，不抛未捕获错误；集成应用不接到导航事件。不增加目标页面目录依赖。

正例：完整标识＋页面月成功；行月独立成功；值0/false按既有规则有效。负例：必需标识null/缺字段/空串/NaN/Infinity，动态缺值加静态同名诱饵均不生成链接；未声明requiredQuery的旧页维持省略行为。

替代：只在目标页移除演示默认值，可避免部分误展示，但点击仍发生，且无法在源页给出一致不可用状态；目标页日期目前还是string、查询参数未绑定，单删默认不能证明链路完整。因此建议requiredQuery并在详情正确的查询输入契约就绪后移除必需查询键的演示回退。

影响范围：page Schema/能力检测/语义校验、runtime导航解析、runtime-ui所有导航入口及定向测试。创作侧仍最后同步；不允许绕过原生成契约门槛。需评审这个兼容增量，不能自行把新字段写入页面。
