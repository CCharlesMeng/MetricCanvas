# 数据上下文 Schema 元数据

Schema 元数据是数据上下文快照中的结构化数据说明。页面搭建 Agent 使用它发现可用执行环境、指标条目、对象、字段、关系和查询约束。

本文描述创作期的数据上下文，不描述页面。页面协议见 [PAGE-METADATA.md](../PAGE-METADATA.md)。

配套文件：

- [JSON Schema](./schema-metadata.schema.json)
- [完整示例](./examples/schema-metadata.example.json)

格式版本为 `1.1`。

## 作用范围

Schema 元数据提供：

- 当前身份可访问的执行环境；
- 可用于查询的 Schema、指标条目、对象和字段；
- 指标的口径说明、可加性与时间聚合方式；
- 字段类型、业务含义、别名、单位和角色提示；
- 对象之间受支持的关系；
- 查询安全边界和资源限制；
- 已验证查询及其结果字段；
- 数据上下文快照的身份和版本。

Schema 元数据不包含：

- 业务数据行；
- 页面布局；
- 组件配置；
- 页面筛选状态；
- 执行端点 URL 或凭据；
- 运行时数据快照。

## 与页面协议的关系

| 内容 | Schema 元数据 | 页面 |
|---|---:|---:|
| 执行环境与可访问对象 | 是 | 否 |
| 字段业务说明与关系 | 是 | 否 |
| 查询安全与资源约束 | 是 | 否 |
| 页面数据源 | 否 | 是 |
| DQE 查询定义 | 可作为已验证查询 | 作为可执行查询 |
| 结果字段契约 | 已验证查询的参考输出 | 运行时强制契约 |
| 筛选器、分区和组件 | 否 | 是 |
| 业务数据行 | 否 | 仅 `inline` 页面包含 |

页面搭建 Agent 根据数据上下文形成页面文档。统一运行时只消费页面文档。

## 顶层结构

```json
{
  "formatVersion": "1.1",
  "id": "sales-analytics",
  "version": "2026-07-31.1",
  "generatedAt": "2026-07-31T08:00:00.000Z",
  "source": "analytics-control-plane",
  "executionEnvironments": []
}
```

| 字段 | 必填 | 说明 |
|---|---:|---|
| `formatVersion` | 是 | 固定为 `"1.1"` |
| `id` | 是 | 数据上下文的稳定标识 |
| `version` | 是 | 不可变快照版本 |
| `generatedAt` | 是 | ISO 8601 生成时间 |
| `source` | 是 | 元数据来源标识 |
| `executionEnvironments` | 是 | 当前身份可使用的执行环境 |

同一 `id` 和 `version` 对应唯一内容。Schema、字段、关系、权限或约束发生变化时使用新的版本。

## 执行环境

```json
{
  "id": "dqe-sales",
  "name": "销售分析 DQE",
  "language": "dqe",
  "endpointRef": "dqe-primary",
  "description": "销售分析执行环境",
  "schemas": [],
  "constraints": {
    "readOnly": true,
    "maxRows": 10000,
    "maxColumns": 100,
    "maxQueriesPerBatch": 20,
    "timeoutMs": 30000
  },
  "security": {
    "scope": "sales-read",
    "notes": ["敏感字段按当前身份裁剪"]
  }
}
```

| 字段 | 必填 | 说明 |
|---|---:|---|
| `id` | 是 | 快照内唯一的执行环境标识 |
| `name` | 是 | 展示名称 |
| `language` | 是 | 查询语言；当前为 `dqe` |
| `endpointRef` | 是 | 服务端登记的端点引用 |
| `description` | 否 | 执行环境说明 |
| `schemas` | 是 | 可访问 Schema |
| `constraints` | 是 | 查询资源限制 |
| `security` | 是 | 权限范围与安全说明 |

`endpointRef` 不是 URL。页面不保存 `endpointRef`。应用壳根据运行环境注入数据网关。

## 执行约束

```json
{
  "readOnly": true,
  "maxRows": 10000,
  "maxColumns": 100,
  "maxQueriesPerBatch": 20,
  "timeoutMs": 30000
}
```

| 字段 | 说明 |
|---|---|
| `readOnly` | 执行环境只允许只读查询，固定为 `true` |
| `maxRows` | 单个结果集最大行数 |
| `maxColumns` | 单个结果集最大列数 |
| `maxQueriesPerBatch` | 单次批量请求最大查询项数 |
| `timeoutMs` | 查询超时时间 |

页面搭建 Agent生成的查询满足这些约束。执行端对约束进行独立校验。

## 安全范围

```json
{
  "scope": "sales-read",
  "notes": [
    "客户标识只允许聚合使用"
  ]
}
```

`scope` 标识当前数据访问范围。`notes` 提供需要参与查询生成的安全规则。

数据上下文只暴露当前身份可发现的内容。字段未出现在快照中表示当前创作上下文不可使用该字段。

## Schema

```json
{
  "id": "sales",
  "name": "销售分析",
  "description": "销售订单与区域分析",
  "metrics": [],
  "objects": [],
  "relationships": [],
  "verifiedQueries": []
}
```

Schema 在执行环境内组织指标条目、对象、关系和已验证查询。一个 Schema 即一个业务域。

| 字段 | 必填 | 说明 |
|---|---:|---|
| `id` | 是 | 执行环境内唯一标识 |
| `name` | 是 | 展示名称，即业务域名 |
| `description` | 是 | 业务范围 |
| `metrics` | 是 | 业务域内的指标条目 |
| `objects` | 是 | 可查询对象 |
| `relationships` | 是 | 受支持的对象关系 |
| `verifiedQueries` | 是 | 已验证查询 |

## 指标条目

```json
{
  "name": "成交总额",
  "type": "number",
  "description": "统计期内已完成订单的成交金额合计",
  "aliases": ["GMV", "成交额"],
  "unit": "元",
  "additivity": "可加",
  "timeAggregation": "求和",
  "isRatio": false,
  "dimensions": ["区域", "客户级别", "统计周期"],
  "nullable": false,
  "sensitive": false
}
```

| 字段 | 必填 | 说明 |
|---|---:|---|
| `name` | 是 | 查询协议使用的业务指标名 |
| `type` | 是 | 与字段相同的类型闭集 |
| `description` | 是 | 口径说明 |
| `aliases` | 否 | 检索别名 |
| `unit` | 否 | 业务单位 |
| `additivity` | 是 | `可加`、`半可加` 或 `不可加` |
| `timeAggregation` | 是 | `求和`、`均值` 或 `期末值` |
| `isRatio` | 是 | 是否为比率 |
| `dimensions` | 是 | 可与该指标组合的维度名；空数组表示未声明可组合性 |
| `nullable` | 是 | 查询结果是否允许空值 |
| `sensitive` | 是 | 是否为敏感指标 |

指标条目是业务域级的发现条目，不是某个对象的字段。所属业务域由所在 Schema 承载，不在条目内重复声明。

`additivity` 描述**能否折叠已经返回的数据行**：`可加` 允许在任意维度上求和；`半可加` 允许在非时间维度上求和，跨时间按 `timeAggregation` 处理；`不可加` 表示不得折叠已返回的数据行，但在目标粒度重新查询仍然合法。声明缺失时不得跨粒度派生（见 [ADR-0039](./adr/0039-derived-measure-templates-as-company-definitions.md)）。

比率指标的分子分母声明不属于 `1.1`。

## 数据对象

```json
{
  "id": "sales-orders",
  "name": "销售订单",
  "kind": "dataset",
  "description": "订单级销售数据",
  "fields": []
}
```

对象规则：

- `id` 在 Schema 内唯一；
- `kind` 固定为 `dataset`；
- `description` 说明业务含义和适用范围；
- `fields` 描述可用于查询的字段；
- 对象不包含业务数据样例。

## 字段

```json
{
  "name": "region",
  "type": "string",
  "description": "销售区域",
  "aliases": ["大区", "区域"],
  "roleHints": ["dimension"],
  "unit": "元",
  "granularity": "order",
  "nullable": false,
  "sensitive": false
}
```

| 字段 | 必填 | 说明 |
|---|---:|---|
| `name` | 是 | 查询协议使用的字段名 |
| `type` | 是 | `string`、`number`、`boolean`、`date` 或 `datetime` |
| `description` | 是 | 业务含义和口径 |
| `aliases` | 否 | 检索别名 |
| `roleHints` | 是 | `dimension` 或 `time` |
| `unit` | 否 | 业务单位 |
| `granularity` | 否 | 时间或统计粒度 |
| `nullable` | 是 | 查询结果是否允许空值 |
| `sensitive` | 是 | 是否为敏感字段 |

`roleHints` 用于查询生成和字段发现。自 `1.1` 起字段只描述维度与时间维度，指标由 Schema 的 `metrics` 声明。页面仍显式声明自己的结果字段 `role`。

`aliases` 只参与发现，不作为查询输出字段名。

`unit` 描述业务单位，不指定组件展示格式。

Schema 元数据的 `type: "number"` 描述查询发现层的数值能力，不直接决定页面的结果字段类型。页面搭建在业务语义已确认是人民币金额时，应把真实执行后的结果字段物化为 `type: "money"`、`role: "measure"`、`currency: "CNY"`；`defaultFormat: "cny-adaptive"` 仍只是可被组件字段绑定覆盖的展示建议。

## 对象关系

```json
{
  "id": "customer-orders",
  "from": {
    "object": "customers",
    "field": "customer-id"
  },
  "to": {
    "object": "sales-orders",
    "field": "customer-id"
  },
  "cardinality": "one-to-many",
  "description": "客户与订单的关联"
}
```

支持的基数：

- `one-to-one`
- `one-to-many`
- `many-to-one`

关系的对象和字段引用同一 Schema 中已声明的内容。关系说明可用连接路径，不授予额外数据权限。

## 已验证查询

```json
{
  "id": "gmv-by-region",
  "question": "按区域查看成交额",
  "description": "返回区域和成交总额",
  "language": "dqe",
  "body": {
    "dsl_list": [
      {
        "output_dims": ["region"],
        "output_metrics": ["gmv"],
        "filter": {
          "dims": [],
          "metrics": []
        },
        "order": {}
      }
    ]
  },
  "resultFields": [
    {
      "name": "region",
      "type": "string",
      "role": "dimension",
      "nullable": false
    },
    {
      "name": "gmv",
      "type": "number",
      "role": "measure",
      "unit": "元",
      "nullable": false
    }
  ]
}
```

已验证查询包含：

- 典型业务问题；
- 可执行 DQE 请求体；
- 查询用途说明；
- 稳定结果字段。

`resultFields` 描述验证时的输出。页面采用该查询时，在页面数据源中声明完整字段契约和 `queryField` 映射。

## 发现与使用

数据上下文检索可以返回：

- 执行环境；
- Schema；
- 指标条目；
- 对象；
- 字段；
- 已验证查询。

检索结果携带数据上下文版本。页面修订在使用查询数据源时记录创作所依据的数据上下文版本。

页面搭建步骤：

1. 根据页面需求检索数据上下文；
2. 选择执行环境、指标条目、维度字段或已验证查询；
3. 形成 DQE 查询定义；
4. 声明页面结果字段契约；
5. 通过页面校验和真实查询预览确认结果。

静态 `inline` 页面不依赖数据上下文。

## 校验规则

Schema 元数据文件满足以下约束：

- 所有必填字段存在；
- 未定义属性被拒绝；
- id 在各自作用域内唯一；
- 指标条目名在业务域内唯一，且 `additivity` 与 `timeAggregation` 取自闭集；
- 时间使用 ISO 8601；
- 数值限制为正整数；
- `readOnly` 固定为 `true`；
- 对象关系引用存在的对象和字段；
- 已验证查询的 `dsl_list` 恰好包含一个查询项；
- 已验证查询结果字段名唯一；
- 敏感信息不出现在 `source`、`endpointRef`、`description` 或 `notes` 中。

使用 [`schema-metadata.schema.json`](./schema-metadata.schema.json) 校验结构。引用完整性和敏感信息规则由数据上下文提供方校验。

## 完整示例

[`examples/schema-metadata.example.json`](./examples/schema-metadata.example.json) 展示：

- DQE 执行环境；
- 查询约束与安全范围；
- 销售分析 Schema；
- 指标条目；
- 数据对象与字段；
- 对象关系；
- 已验证 DQE 查询。
