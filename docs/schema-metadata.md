# 数据上下文中的 Schema 元数据

> 适用范围：NL2DQE 创作期
>
> 格式版本：`1.0`
>
> JSON Schema：[schema-metadata.schema.json](./schema-metadata.schema.json)
>
> 完整示例：[examples/schema-metadata.example.json](./examples/schema-metadata.example.json)

## 1. 定位

Schema 元数据是**数据上下文快照**的一部分，用于告诉页面搭建 Agent：

- 当前身份可以使用哪些执行环境、Schema、对象和字段；
- 字段具有什么类型、业务含义、别名、单位和角色提示；
- 对象之间有哪些受支持关系；
- 查询必须遵守哪些权限、安全和资源限制；
- 哪些问题—查询组合已经过验证；
- 查询结果应满足什么字段契约。

Schema 元数据只服务创作期。它不是看板页面，不是运行时目录，也不包含业务数据行。

## 2. 与其他概念的边界

| 概念 | 职责 | 是否含业务数据行 | 是否进入运行态 |
|---|---|---:|---:|
| 数据上下文快照 | 约束 NL2DQE 可使用的数据与规则 | 否 | 否 |
| Schema 元数据 | 描述数据源、对象、字段、关系和限制 | 否 | 否 |
| 查询定义 | 可执行的 DQE 请求体 | 否 | 是 |
| 结果字段契约 | 声明查询稳定输出 | 否 | 是 |
| 数据快照 | 一次运行时执行得到的数据与状态 | 是 | 是 |

旧模型中的指标目录和元数据快照已经退出。Schema 元数据不得重新包装成指标 code 白名单。

## 3. 顶层结构

```jsonc
{
  "formatVersion": "1.0",
  "id": "context-id",
  "version": "immutable-version",
  "generatedAt": "2026-07-31T08:00:00.000Z",
  "source": "source-description",
  "executionEnvironments": []
}
```

| 字段 | 必填 | 规则 |
|---|---|---|
| `formatVersion` | 是 | Schema 元数据格式版本，独立于页面 `schemaVersion` |
| `id` | 是 | 数据上下文稳定 id |
| `version` | 是 | 本次不可变快照版本 |
| `generatedAt` | 是 | ISO 8601 生成时间 |
| `source` | 是 | 元数据来源说明，不包含凭据 |
| `executionEnvironments` | 是 | 当前身份可访问的执行环境 |

同一 `id + version` 的内容不可变。任何字段、权限或约束变化都产生新版本。

## 4. 执行环境

```jsonc
{
  "id": "dqe-customer-activity",
  "name": "客户活动 DQE",
  "language": "dqe",
  "endpointRef": "dqe-primary",
  "description": "受控执行环境",
  "schemas": [],
  "constraints": {},
  "security": {}
}
```

规则：

- `id` 在快照内唯一；
- `language` 当前只允许 `dqe`；
- `endpointRef` 是服务端登记的执行环境引用，不是 URL 或凭据；
- `schemas` 只包含当前身份可发现的内容；
- `constraints` 声明生成和执行硬限制；
- `security` 说明权限范围与敏感数据规则。

页面不得复制 `endpointRef`。统一运行时按环境配置选择 DQE 端点。

## 5. Schema 与对象

Schema 用于组织一个执行环境中的对象：

```jsonc
{
  "id": "customer-activity",
  "name": "客户活动",
  "description": "客户活动分析域",
  "objects": [],
  "relationships": [],
  "verifiedQueries": []
}
```

对象：

```jsonc
{
  "id": "customer-activity-summary",
  "name": "客户活动汇总",
  "kind": "dataset",
  "description": "按客户级别、地区部和时间查询活动汇总",
  "fields": []
}
```

规则：

- `id` 是元数据内稳定身份；
- `name` 是外部查询协议使用或展示的名称；
- `description` 必须说明业务含义和适用范围；
- `kind` 当前使用 `dataset`，未来扩展需增加明确判别分支；
- 同一 Schema 内对象 id 唯一；
- 不得把样例业务记录放进对象。

## 6. 字段

```jsonc
{
  "name": "NA客户数",
  "type": "number",
  "description": "符合当前查询条件的 NA 客户数量",
  "aliases": ["客户数"],
  "roleHints": ["measure"],
  "unit": "个",
  "nullable": false,
  "sensitive": false
}
```

| 字段 | 必填 | 规则 |
|---|---|---|
| `name` | 是 | 外部查询协议使用的字段名 |
| `type` | 是 | `string` / `number` / `boolean` / `date` / `datetime` |
| `description` | 是 | 业务含义、口径和适用条件 |
| `aliases` | 否 | 仅用于发现，不改变字段定义 |
| `roleHints` | 是 | `dimension` / `measure` / `time` 的建议集合 |
| `unit` | 否 | 业务单位 |
| `granularity` | 否 | 时间或统计粒度 |
| `nullable` | 是 | 查询结果是否允许空值 |
| `sensitive` | 是 | 是否为敏感字段 |

规则：

- `roleHints` 是创作提示，不替代页面结果字段契约；
- `aliases` 只提高检索召回，不允许作为 DQE 输出字段名；
- `unit` 不隐含展示格式；
- 敏感字段只在当前身份有权使用且场景必要时暴露；
- 字段说明不得包含业务数据样例；
- 类型或单位变化必须产生新的数据上下文版本。

## 7. 关系

关系只声明执行环境正式支持的连接路径：

```jsonc
{
  "id": "customer-to-activity",
  "from": {
    "object": "customer",
    "field": "customer-id"
  },
  "to": {
    "object": "activity",
    "field": "customer-id"
  },
  "cardinality": "one-to-many",
  "description": "客户到活动记录"
}
```

允许基数：

- `one-to-one`
- `one-to-many`
- `many-to-one`

不声明 `many-to-many` 隐式连接。需要中间对象时必须显式建模。

关系元数据不授权查询；实际执行仍按当前身份和执行环境规则校验。

## 8. 已验证查询

已验证查询把典型业务问题连接到可执行 DQE 请求和稳定结果字段：

```jsonc
{
  "id": "customer-count-by-level",
  "question": "按客户级别查看 NA 客户数",
  "description": "返回客户级别和对应客户数量",
  "language": "dqe",
  "body": {
    "dsl_list": [
      {
        "output_dims": ["客户级别"],
        "output_metrics": ["NA客户数"],
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
      "name": "客户级别",
      "type": "string",
      "role": "dimension",
      "nullable": false
    },
    {
      "name": "NA客户数",
      "type": "number",
      "role": "measure",
      "unit": "个",
      "nullable": false
    }
  ]
}
```

规则：

- 查询必须在当前执行环境真实执行并验真；
- `body.dsl_list` 在单个示例中恰好包含一项；
- `resultFields` 覆盖所有输出维度、输出度量和公式 alias；
- 不保存执行返回的数据行；
- 已验证查询是生成参考，不是跳过权限、安全或资源校验的白名单；
- 外部协议或字段契约变化后必须重新验证并产生新快照版本。

## 9. 执行约束

```jsonc
{
  "readOnly": true,
  "maxRows": 1000,
  "maxColumns": 20,
  "maxQueriesPerBatch": 5,
  "timeoutMs": 30000
}
```

约束是硬规则：

- `readOnly` 当前必须为 `true`；
- `maxRows` 和 `maxColumns` 约束结果规模；
- `maxQueriesPerBatch` 约束 DQE 批量传输；
- `timeoutMs` 约束单次执行；
- Agent 不能通过拆分、重试或多轮调用绕过资源上限。

## 10. 安全规则

1. 快照按当前身份和权限范围生成；
2. 不可访问对象和字段不得出现在检索结果；
3. 凭据、Cookie、Token 和真实端点 URL 不进入快照；
4. 敏感字段必须带 `sensitive: true`；
5. Schema 元数据和日志都不得包含业务数据行；
6. 已验证查询仍需在每次执行时重新检查权限；
7. 数据上下文不足时返回 `DATA_CONTEXT_ERROR`；
8. 不得退回旧指标目录或让模型自行补造字段。

## 11. 搜索规则

`search_data_context` 可以匹配：

- 执行环境名称和说明；
- Schema 名称和说明；
- 对象名称和说明；
- 字段名称、说明和别名；
- 已验证查询的问题和说明。

搜索结果必须：

- 返回数据上下文 `id + version`；
- 标明匹配对象的完整路径；
- 返回执行约束和安全摘要；
- 不返回越权对象；
- 不把别名伪装成正式字段名；
- 不返回业务数据行。

## 12. 页面生成规则

从 Schema 元数据生成 DQE 页面数据源时：

1. 选择满足需求的最小对象和字段集合；
2. 以正式字段名生成 DQE 查询；
3. 对公式输出声明 alias；
4. 真实执行并验真结果字段；
5. 为页面选择稳定字段 id；
6. 在页面 `fields` 中声明类型、角色、标签、单位和空值；
7. 用 `queryField` 显式映射外部字段；
8. 用 `filterBindings` 显式映射动态筛选；
9. 保存页面修订时记录 `dataContextVersion`；
10. 不把 Schema 元数据整体复制进页面文档。

## 13. 反例

以下内容不得进入 Schema 元数据：

```jsonc
{
  "sampleRows": [
    {
      "客户名称": "某真实客户",
      "收入": 128600
    }
  ],
  "endpoint": "https://internal.example/api",
  "token": "secret",
  "metricCode": "legacy-gmv"
}
```

原因分别是：

- 业务数据行泄露；
- 内部端点暴露；
- 凭据泄露；
- 恢复已退出的指标目录模型。

## 14. 验收清单

- JSON 可按格式 Schema 校验；
- `id + version` 唯一且内容不可变；
- 字段类型、单位、空值和敏感标记完整；
- 关系只描述正式支持路径；
- 已验证查询不包含返回数据行；
- 执行约束完整；
- 搜索结果按当前身份裁剪；
- 页面生成只引用所需字段；
- 页面保存记录正确的 `dataContextVersion`；
- 运行时不加载数据上下文快照。
