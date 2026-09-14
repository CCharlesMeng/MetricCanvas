# 受控语义HTML

semanticHtml是声明白名单语义标签/类和内嵌值的字段类型，不是任意网页。呈现前按现有安全规则解析，未知标签/属性不获得执行能力；格式化内嵌数值遵循结果字段契约。

普通text/fieldText与semanticHtml路径区分；不要把拼接HTML作为字段格式化的替代。允许结构标签为div/span/strong/p/br，允许class为detail-title/detail-value/detail-description/detail-meta/tone-positive/tone-negative/tone-neutral；未知标签、属性、类或未闭合结构整体失败关闭。data只包含单个有限规范数字，不接受属性或自闭合；signed按数值正负赋语义。最多1000节点、11层元素嵌套，字符长度按产品MAX_SEMANTIC_HTML_LENGTH限制。text的bodyFormat、页头subtitleFormat或semanticHtml字段显式接入此路径。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。


页面协议 6.2。结构真源为本册[schema.json](schema.json)，SHA256 `37d234af1e56009be5e50aba97a63f28d3207d2ef26da028ee0d90eee17bb399`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f73656d616e74696348746d6c4669656c64"></a>

### `@semanticHtmlField`

Schema位置：`#/definitions/semanticHtmlField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["type","role"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 受控语义 HTML 字符串，最长 64000 字符 |

<a id="schema-232f646566696e6974696f6e732f73656d616e74696348746d6c4669656c642f70726f706572746965732f74797065"></a>

### `@semanticHtmlField.type`

Schema位置：`#/definitions/semanticHtmlField/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="semanticHtml" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "semanticHtml" | 用于选择@semanticHtmlField.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f73656d616e74696348746d6c4669656c642f70726f706572746965732f726f6c65"></a>

### `@semanticHtmlField.role`

Schema位置：`#/definitions/semanticHtmlField/properties/role`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="detail" | Schema未设默认；装配/运行时默认见语义说明 | 维度、度量或明细等受控字段角色。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "detail" | 用于选择@semanticHtmlField.role分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f73656d616e74696348746d6c4669656c642f70726f706572746965732f6c6162656c"></a>

### `@semanticHtmlField.label`

Schema位置：`#/definitions/semanticHtmlField/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f73656d616e74696348746d6c4669656c642f70726f706572746965732f6e756c6c61626c65"></a>

### `@semanticHtmlField.nullable`

Schema位置：`#/definitions/semanticHtmlField/properties/nullable`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 是否显式允许空值，不能以字段缺失代替null。 |

<a id="schema-232f646566696e6974696f6e732f717565727953656d616e74696348746d6c4669656c64"></a>

### `@querySemanticHtmlField`

Schema位置：`#/definitions/querySemanticHtmlField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["type","role","queryField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | DQE 返回的受控语义 HTML 字符串，最长 64000 字符 |

<a id="schema-232f646566696e6974696f6e732f717565727953656d616e74696348746d6c4669656c642f70726f706572746965732f74797065"></a>

### `@querySemanticHtmlField.type`

Schema位置：`#/definitions/querySemanticHtmlField/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="semanticHtml" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "semanticHtml" | 用于选择@querySemanticHtmlField.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f717565727953656d616e74696348746d6c4669656c642f70726f706572746965732f726f6c65"></a>

### `@querySemanticHtmlField.role`

Schema位置：`#/definitions/querySemanticHtmlField/properties/role`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="detail" | Schema未设默认；装配/运行时默认见语义说明 | 维度、度量或明细等受控字段角色。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "detail" | 用于选择@querySemanticHtmlField.role分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f717565727953656d616e74696348746d6c4669656c642f70726f706572746965732f71756572794669656c64"></a>

### `@querySemanticHtmlField.queryField`

Schema位置：`#/definitions/querySemanticHtmlField/properties/queryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE输出或目标字段名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f717565727953656d616e74696348746d6c4669656c642f70726f706572746965732f6c6162656c"></a>

### `@querySemanticHtmlField.label`

Schema位置：`#/definitions/querySemanticHtmlField/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f717565727953656d616e74696348746d6c4669656c642f70726f706572746965732f6e756c6c61626c65"></a>

### `@querySemanticHtmlField.nullable`

Schema位置：`#/definitions/querySemanticHtmlField/properties/nullable`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 是否显式允许空值，不能以字段缺失代替null。 |

## 语义规则与反例（生成）

- `ranking-detail-semantic-description`：语义 HTML 说明必须绑定 semanticHtml 类型的 detail 字段。反例：[ranking-semantic-description-not-detail](errors/ranking-semantic-description-not-detail.json)、[ranking-semantic-description-record-list](errors/ranking-semantic-description-record-list.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。

## 示例与溯源（生成）

- [compute-page](examples/compute-page.json)：完整合法页面；查询仅为静态契约证据。
- 源码/验证定位：`packages/page/src/validate.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/schema/data-source.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`tools/scripts/page-conformance-vectors.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/engine/widgets/src/shared/semantic-html.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

