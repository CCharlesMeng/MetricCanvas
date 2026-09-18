# 页面参数使用指南（6.5）

## 1. 版本与使用原则

**6.5 是 6.x 唯一支持的版本。** 本文只说明 `schemaVersion: "6.5"`，不再提供 6.0—6.4 的兼容或迁移用法；5.x 的读取政策不在本文调整范围内。

页面参数回答「这次看什么」。一次页面实例初始化后参数固定；换一组值需要重新初始化另一个页面实例。页内可交互修改的是筛选状态，不是页面参数。参数不会自动影响全页，查询和文本必须显式引用它。

本文贯穿同一个需求：生成「中国区、2026 年上半年 Tokens 用量报告」→ 提取模板 → 用原值运行 → 召回后改为「欧洲区、2026 年第三季度」。

### 先看重点：哪些属于页面 JSON，哪些只是过程数据？

**最终保存的页面 JSON 以 `schemaVersion / id / params / dataSources / sections` 等页面字段为主体。`baseline`、`dimensionIdentities`、候选列表和文本替换指令都不是页面字段，不要加进页面 JSON。** 能用 JSON 表示一个对象，不代表它就是页面协议的一部分。

| 名称 | 所属位置 | 是否进入最终页面 JSON |
|---|---|---|
| `params`、`dataSources`、`sections` | 页面结构 | 是；参数声明、查询引用和文本引用放在这些字段内 |
| `params[].value` | 填值文档中的本次输入 | 填值文档有，无值模板没有 |
| `verifiedPage`、`template` | 示例程序的变量名，变量里装的是完整页面 | 保存变量所持有的页面对象，不把变量名当作 JSON 外层字段 |
| `trustedContext.baseline` | 提取函数的第二个参数：来源标识 | 否；用于关联提取依据的精确页面状态 |
| `trustedContext.dimensionIdentities` | 同一个过程对象：维度身份映射 | 否；帮助程序判断哪些查询条件可合并为共享参数 |
| `extraction.candidates`、`selectedIds` | 程序返回的候选、人工确认的候选 ID 列表 | 否；选中候选才转成页面内的 params 和引用 |
| `textReplacements` | 提取确认时的文本修改指令 | 指令映射不保存；修改结果进入 sections 等对应位置 |
| `prepared.document` | 提取函数返回结果中的无值模板 | 保存这里面的页面对象，不保存整个 prepared |
| `prepared.originalValues`、`suppliedValues` | 原值核对/预览、本次赋值使用的输入映射 | 映射本身不是页面字段；解析后值进入填值文档的 params[].value |
| `result.document` | 解析函数返回的填值文档 | 可作为本次页面文档传递；持久化仍需显式保存 |
| `result.resolvedPage`、`result.effectiveInputs` | 解析后的执行副本、生效输入 Map | 不写回无值模板，也不作为页面外层字段 |

只关心页面格式时，看各场景的「完整页面/模板/填值文档 JSON」。下面标有「过程数据」的内容只供程序接入使用。

| 产物 | 参数与查询形态 | 用途 |
|---|---|---|
| 具体页面 | 无参数声明，查询条件是具体值 | 创作期验真后直接运行 |
| 无值模板 | 有参数声明，没有本次值，查询保留引用 | 保存与召回复用；必需输入未补齐前不能运行 |
| 填值文档 document | 参数含 value，查询和文本仍保留引用 | 初始化本次页面实例 |
| 执行副本 resolvedPage | 查询引用解析为具体条件，文本引用解析为显示值 | 供本次执行消费，不覆盖模板 |

### 参数相关位置单独说明

| 位置 | 内容与约束 |
|---|---|
| `params[].id` | 稳定参数 ID；引用与输入精确匹配，report-period 与 report_period 不等价 |
| `params[].type` | dimension 表示维度，timeRange 表示明确区间，time 表示报告基准期；另有 string/number/boolean |
| `params[].required` | 可省略，等价于 true；查询引用的参数必须必填，每个声明必须有消费者 |
| `params[].value` | 本次输入。模板省略 value/default，填值用 value；value 与 default 不能同时声明 |
| `params[].label` | 人可读的输入名称，不参与匹配，不自动生成控件或标题 |
| `params[].multiple` | 维度多值声明；单值为非空字符串，多值为非空、无重复字符串数组 |
| `params[].granularity` | 时间精度为 month/date；timeRange 的 value 也须携带相同精度 |
| `query.body.dsl_list[0].filter.dims[].dim_value_list` | 用 `{"param":"region"}` 引用维度，执行时单值也变为 DQE 数组 |
| `query.body.dsl_list[0].filter.time.start/end` | 双端引用同一参数，分别声明 part=start/end；保留 period 与 is_aggregate |
| 文本属性，例如 `props.body` | 用 `{"param":"region"}` 展示本次值；是整个属性引用，不是字符串插值 |
| `filters[].initialParam` | 可用维度参数初始化筛选，之后由筛选状态管理相关查询 |

引用只出现在协议允许的位置，不做任意 JSON 字符串替换，也不改变指标口径。本文统一使用查询原位引用，不使用 `paramBindings`。

## 2. 场景一：初次生成并运行

用户请求「中国区 2026 年上半年 Tokens 用量」。创作期先确认真实维度取值、指标和查询时间窗口，完成查询验真，再装配页面。此时不必先提取参数，可以直接生成确定查询条件的页面。

下面是完整的最小页面 JSON：仅保留一个查询、两个说明文本和一个结果表格。业务报告的其他查询、样式、图表不纳入示例，不在 JSON 中放不合法的省略号。后续模板和填值文档保持相同页面结构。

```json
{
  "schemaVersion": "6.5",
  "id": "tokens-report",
  "layout": "report",
  "dataSources": {
    "tokens": {
      "fields": {
        "tokens": {
          "type": "number",
          "role": "measure",
          "queryField": "Tokens消耗量"
        }
      },
      "source": {
        "type": "query",
        "query": {
          "language": "dqe",
          "body": {
            "dsl_list": [
              {
                "output_dims": [],
                "output_metrics": [
                  "Tokens消耗量"
                ],
                "filter": {
                  "dims": [
                    {
                      "dim_name": "区域",
                      "dim_value_list": [
                        "中国区"
                      ]
                    }
                  ],
                  "time": {
                    "period": "month",
                    "is_aggregate": true,
                    "start": "2026-01",
                    "end": "2026-06"
                  }
                }
              }
            ]
          }
        }
      }
    }
  },
  "sections": [
    {
      "id": "overview",
      "components": [
        {
          "id": "region-text",
          "type": "text",
          "layout": {
            "span": 12
          },
          "props": {
            "body": "中国区"
          }
        },
        {
          "id": "period-text",
          "type": "text",
          "layout": {
            "span": 12
          },
          "props": {
            "body": "2026-01 至 2026-06"
          }
        },
        {
          "id": "tokens-table",
          "type": "table",
          "layout": {
            "span": 12
          },
          "data": {
            "main": "tokens"
          },
          "props": {
            "columns": [
              {
                "field": "tokens",
                "title": "Tokens 用量"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

参数相关说明：

- 此时没有 params，区域和起止月份都是查询中的具体值。
- 两个文本也保存具体值，不会因为查询条件变化自动变化。
- 字段映射和表格提供结果消费位置，不是要提取的参数。
- 页面可直接交给统一运行时；首次运行不等于保存或发布模板。

若生成时已经明确使用参数化文档，也可直接生成第 4 节的完整「填值文档」：声明参数、提供本次 value、在查询与文本中引用它，经校验和查询验真后运行。不要只生成无值模板就尝试执行。

## 3. 场景二：提取参数，形成无值模板

用户确认「以后允许切换区域和期间」后，从最终已验真的精确创作基线提取。当前提取简单字符串维度条件和固定月/日区间，不推断多个区间之间的同比等业务关系。

### 提取、选择和文本确认（过程数据，不是页面 JSON）

`extractPageParams(document, context)` 返回候选、原值、覆盖/未覆盖查询、跳过原因和默认勾选建议。跨数据源共享维度需要可信身份依据，不能只因字段同名就认定相同。

**这里是在准备 `extractPageParams(页面对象, 提取上下文)` 的第二个参数，不是在给页面增加字段。** 第一个参数 verifiedPage 是上一节的完整页面；第二个参数 trustedContext 由可信调用方提供：

```ts
// 过程变量：只传给提取函数，不放入页面 JSON。
const trustedContext = {
  baseline: 'verified-revision-example', // 占位值，实际使用已确认的来源标识
  dimensionIdentities: {
    tokens: {        // 页面数据源 ID：对应 dataSources.tokens
      区域: 'region' // 查询的 dim_name → 该维度的稳定业务身份
    }
  }
};
```

这两个字段解决不同问题：

- **baseline：这次提取基于哪一份页面状态？** 用于防止从修订 A 提取、预览的结果被拿去发布修订 B。提取函数只检查它非空并随结果返回，不凭字符串判断页面已验真；工作台检查来源是否与当前状态一致，可信调用方负责保证页面确实来自该基线并已经完成查询验真。它不是 schemaVersion，不是业务参数，也不参与 DQE 查询。
- **dimensionIdentities：哪些查询字段其实是同一个业务维度？** 此处表示 dataSources.tokens 的“区域”维度，业务身份为 region。若另一个数据源的“地区”也被可信调用方映射到 region，且原取值相同，就可合并为一个参数候选。没有映射时按“数据源 ID + 维度名称”分开处理，不因同名自动合并。

注意三个不同概念：这里的 `region` 是**维度业务身份**；后面 `params[].id` 中的 `region` 是**页面参数 ID**；`中国区` 是**参数取值**。本例前两者文字相同，是程序参考身份生成候选 ID 的结果，不代表身份映射直接指定参数 ID，也不代表两者是同一个字段。实际使用返回的候选 ID，不自行猜测。

本例候选 ID 为 region 与 report-period，实际调用以程序返回值为准。因为这里只有一个查询，候选都不默认勾选；用户可明确选择这两个候选。默认勾选仅适用于覆盖超过半数且多于一个查询的候选。

原页面文本仍含实例值，必须显式确认替换。下面是 **textReplacements 过程对象**，不是页面 JSON：键是“要改哪里”的 JSON Pointer，值是“改成什么”。映射本身不会保存，应用后的 `{ "param": "region" }` 才会出现在页面对应的 props.body 中。路径对应第 2 节完整页面：

```json
{
  "/sections/0/components/0/props/body": {
    "param": "region"
  },
  "/sections/0/components/1/props/body": {
    "param": "report-period"
  }
}
```

程序调用（verifiedPage 是第 2 节完整页面，trustedContext 来自可信提供方）：

```ts
import { extractPageParams, applyPageParamSelection } from '@metriccanvas/page';

const extraction = extractPageParams(verifiedPage, trustedContext);
if (!extraction.ok) throw new Error(JSON.stringify(extraction.issues));

// 过程变量：用户确认选择的候选 ID，不是页面 JSON 字段。
const selectedIds = ['region', 'report-period'];
const textReplacements = {
  '/sections/0/components/0/props/body': { param: 'region' },
  '/sections/0/components/1/props/body': { param: 'report-period' }
};
const prepared = applyPageParamSelection(extraction, selectedIds, textReplacements);
if (!prepared.ok) throw new Error(JSON.stringify(prepared.issues));

const template = prepared.document; // 这才是下方完整模板 JSON。
// 保存时使用 template，不是 { template: ... }，也不是整个 prepared。
// prepared.originalValues 留在过程里，只用于核对与预览。
```

调用关系：完整页面 + trustedContext → 提取候选 → 人工确认 selectedIds/textReplacements → prepared.document（无值模板）。只有最后这个页面对象进入模板保存流程。

### 提取后的完整模板 JSON

```json
{
  "schemaVersion": "6.5",
  "id": "tokens-report",
  "layout": "report",
  "params": [
    {
      "id": "region",
      "type": "dimension",
      "label": "区域"
    },
    {
      "id": "report-period",
      "type": "timeRange",
      "label": "报告期间",
      "granularity": "month"
    }
  ],
  "dataSources": {
    "tokens": {
      "fields": {
        "tokens": {
          "type": "number",
          "role": "measure",
          "queryField": "Tokens消耗量"
        }
      },
      "source": {
        "type": "query",
        "query": {
          "language": "dqe",
          "body": {
            "dsl_list": [
              {
                "output_dims": [],
                "output_metrics": [
                  "Tokens消耗量"
                ],
                "filter": {
                  "dims": [
                    {
                      "dim_name": "区域",
                      "dim_value_list": {
                        "param": "region"
                      }
                    }
                  ],
                  "time": {
                    "period": "month",
                    "is_aggregate": true,
                    "start": {
                      "param": "report-period",
                      "part": "start"
                    },
                    "end": {
                      "param": "report-period",
                      "part": "end"
                    }
                  }
                }
              }
            ]
          }
        }
      }
    }
  },
  "sections": [
    {
      "id": "overview",
      "components": [
        {
          "id": "region-text",
          "type": "text",
          "layout": {
            "span": 12
          },
          "props": {
            "body": {
              "param": "region"
            }
          }
        },
        {
          "id": "period-text",
          "type": "text",
          "layout": {
            "span": 12
          },
          "props": {
            "body": {
              "param": "report-period"
            }
          }
        },
        {
          "id": "tokens-table",
          "type": "table",
          "layout": {
            "span": 12
          },
          "data": {
            "main": "tokens"
          },
          "props": {
            "columns": [
              {
                "field": "tokens",
                "title": "Tokens 用量"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

参数相关变化：

- 新增 params 声明，不保留 value/default，避免把中国区、上半年作为下次默认输入。
- 查询维度值和时间端点改为引用；指标、分组、聚合、字段与表格配置不变。
- 两个文本也改为引用，避免数据切换后还显示旧区域或期间。不支持 `"${region}报告"` 插值，复合标题需改为通用标题或拆出独立参数文本。
- 程序用原值回填检查所选候选覆盖查询的查询体等价，失败则拒绝提取。这是确定性结构检查，不是重新向 DQE 取数。
- 原值单独返回供预览；选中参数后清除查询的内嵌初始行，不把上次数据当作下次结果。

模板结构合法不代表可执行：必需输入未补齐时阻止执行。

### 预览与发布

工作台接入可信 parameterSourcePort 后，用户审阅候选、输入和文本修正，预览后明确确认发布。来源、选择或输入变化都会使旧确认失效。保存的是无值模板，不是预览时的填值文档。

发布走既有 Java 单次保存路径：queued 只是入队，成功以可信回执为准，unknown 不重新发送。没有可信源端口时，不应宣称该生产链路已接通。

## 4. 场景三：赋值运行，或直接运行填值文档

### 本次输入与调用

模板和本次值可以分开传递。以下是 **suppliedValues 过程对象，不是页面 JSON**。输入映射的键与模板参数 ID 一致，解析后这些值才进入下方填值文档的 params[].value：

```json
{
  "region": "中国区",
  "report-period": {
    "start": "2026-01",
    "end": "2026-06",
    "granularity": "month"
  }
}
```

```ts
import { resolvePageParams } from '@metriccanvas/page';

const result = resolvePageParams(template, suppliedValues);
if (!result.ok) throw new Error(JSON.stringify(result.issues));

// 文档已有 value 时，可以直接解析，不再提供第二个参数。
const again = resolvePageParams(result.document);
if (!again.ok) throw new Error(JSON.stringify(again.issues));
```

解析函数不修改输入、不取数、不渲染、不保存。失败返回 issues；成功返回 document、resolvedPage 和只读 Map effectiveInputs。

### 填值文档的完整 JSON（result.document）

```json
{
  "schemaVersion": "6.5",
  "id": "tokens-report",
  "layout": "report",
  "params": [
    {
      "id": "region",
      "type": "dimension",
      "label": "区域",
      "value": "中国区"
    },
    {
      "id": "report-period",
      "type": "timeRange",
      "label": "报告期间",
      "granularity": "month",
      "value": {
        "start": "2026-01",
        "end": "2026-06",
        "granularity": "month"
      }
    }
  ],
  "dataSources": {
    "tokens": {
      "fields": {
        "tokens": {
          "type": "number",
          "role": "measure",
          "queryField": "Tokens消耗量"
        }
      },
      "source": {
        "type": "query",
        "query": {
          "language": "dqe",
          "body": {
            "dsl_list": [
              {
                "output_dims": [],
                "output_metrics": [
                  "Tokens消耗量"
                ],
                "filter": {
                  "dims": [
                    {
                      "dim_name": "区域",
                      "dim_value_list": {
                        "param": "region"
                      }
                    }
                  ],
                  "time": {
                    "period": "month",
                    "is_aggregate": true,
                    "start": {
                      "param": "report-period",
                      "part": "start"
                    },
                    "end": {
                      "param": "report-period",
                      "part": "end"
                    }
                  }
                }
              }
            ]
          }
        }
      }
    }
  },
  "sections": [
    {
      "id": "overview",
      "components": [
        {
          "id": "region-text",
          "type": "text",
          "layout": {
            "span": 12
          },
          "props": {
            "body": {
              "param": "region"
            }
          }
        },
        {
          "id": "period-text",
          "type": "text",
          "layout": {
            "span": 12
          },
          "props": {
            "body": {
              "param": "report-period"
            }
          }
        },
        {
          "id": "tokens-table",
          "type": "table",
          "layout": {
            "span": 12
          },
          "data": {
            "main": "tokens"
          },
          "props": {
            "columns": [
              {
                "field": "tokens",
                "title": "Tokens 用量"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

参数相关变化只有 params[].value。查询引用、文本引用、字段和组件保持不变；将此文档交给统一运行时初始化即可消费本次值。不要把执行副本中的确定条件写回模板。

### 执行时的确定查询 JSON

以下是 `result.resolvedPage.dataSources.tokens.source.query.body` 的完整内容，只省略执行副本的其他字段；它不是另一份页面文档：

```json
{
  "dsl_list": [
    {
      "output_dims": [],
      "output_metrics": [
        "Tokens消耗量"
      ],
      "filter": {
        "dims": [
          {
            "dim_name": "区域",
            "dim_value_list": [
              "中国区"
            ]
          }
        ],
        "time": {
          "period": "month",
          "is_aggregate": true,
          "start": "2026-01",
          "end": "2026-06"
        }
      }
    }
  ]
}
```

维度条件变为数组，中国区对应 `["中国区"]`；时间闭区间为 2026-01 至 2026-06，period 和 is_aggregate 不变。两处文本引用也解析为中国区和区间显示文本。发送 DQE 时不能残留 param 对象。

### 运行前必须检查

- 显式 suppliedValues 优先于文档 value，不传该键则采用文档保存值。当前解析器也接受 default 作为后备，但本文流程不用它；模板不得携带默认实例值，value/default 不得同时出现。
- 必需参数缺值返回 MISSING_INPUT；未知键返回 UNKNOWN_INPUT；非法值返回 INVALID_VALUE；结构非法返回 INVALID_PAGE 等。非法显式值不能回退旧值，失败后不能继续请求。
- timeRange 值必须是完整的 start/end/granularity 对象。月用 YYYY-MM，日用 YYYY-MM-DD；检查真实日历、精度和起止顺序。日精度 DQE 的 period 用 day。
- 参数化页面不能使用旧 query initial 兜底；指定期间无数据就显示空结果，不切换到最近有数据期。
- timeRange 没有 URL 编码协议，通过 value 或程序输入传值；已确认输入不应再被 URL、global_params 或筛选历史覆盖。
- 运行实例不自动成为持久化页面资产，保存需另行明确操作。

## 5. 场景四：召回模板，赋予另一组值

用户后续说「用这份报告看欧洲区第三季度」。外部服务召回第 3 节模板，读取参数声明，确认区域实际值与年份，再生成规范输入。年份没有已确认上下文时先追问，不能由解析器猜测。

假设确认的是 2026 年第三季度，以下仍是 **suppliedValues 过程对象，不是页面 JSON**：

```json
{
  "region": "欧洲区",
  "report-period": {
    "start": "2026-07",
    "end": "2026-09",
    "granularity": "month"
  }
}
```

调用 `resolvePageParams(recalledTemplate, suppliedValues)`，成功后得到以下完整填值文档：

```json
{
  "schemaVersion": "6.5",
  "id": "tokens-report",
  "layout": "report",
  "params": [
    {
      "id": "region",
      "type": "dimension",
      "label": "区域",
      "value": "欧洲区"
    },
    {
      "id": "report-period",
      "type": "timeRange",
      "label": "报告期间",
      "granularity": "month",
      "value": {
        "start": "2026-07",
        "end": "2026-09",
        "granularity": "month"
      }
    }
  ],
  "dataSources": {
    "tokens": {
      "fields": {
        "tokens": {
          "type": "number",
          "role": "measure",
          "queryField": "Tokens消耗量"
        }
      },
      "source": {
        "type": "query",
        "query": {
          "language": "dqe",
          "body": {
            "dsl_list": [
              {
                "output_dims": [],
                "output_metrics": [
                  "Tokens消耗量"
                ],
                "filter": {
                  "dims": [
                    {
                      "dim_name": "区域",
                      "dim_value_list": {
                        "param": "region"
                      }
                    }
                  ],
                  "time": {
                    "period": "month",
                    "is_aggregate": true,
                    "start": {
                      "param": "report-period",
                      "part": "start"
                    },
                    "end": {
                      "param": "report-period",
                      "part": "end"
                    }
                  }
                }
              }
            ]
          }
        }
      }
    }
  },
  "sections": [
    {
      "id": "overview",
      "components": [
        {
          "id": "region-text",
          "type": "text",
          "layout": {
            "span": 12
          },
          "props": {
            "body": {
              "param": "region"
            }
          }
        },
        {
          "id": "period-text",
          "type": "text",
          "layout": {
            "span": 12
          },
          "props": {
            "body": {
              "param": "report-period"
            }
          }
        },
        {
          "id": "tokens-table",
          "type": "table",
          "layout": {
            "span": 12
          },
          "data": {
            "main": "tokens"
          },
          "props": {
            "columns": [
              {
                "field": "tokens",
                "title": "Tokens 用量"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

参数相关变化：

- 只更新 region.value 和 report-period.value，原模板不变。
- 相同引用现在解析为欧洲区、2026-07 至 2026-09，文本同步显示本次输入。
- 不重新生成图表，不更改指标和聚合，不把这组值写回共享模板。
- 若召回的是上次的填值文档，未提供的键会沿用旧值。调用方必须核对并向用户明确全部生效输入，不能悄悄沿用旧区域或期间。
- 参数 ID 以实际召回文档为准，不能把 report-period 改写成 report_period。

召回检索、自然语言规范化、缺值追问和真实 Java/Relay 服务接入由外部提供方负责。参数解析函数不承担这些能力，本地验证也不等于 E1 真实联调完成。参见[程序接入与外部联调边界](docs/plan/page-parameter-inlining/external-integration.md)。

## 6. 报告基准期与时间窗口

「查看 1—6 月」使用 timeRange，查询消费明确端点。「以 6 月为基准，同时看当月和近 12 个月」使用 time，各查询显式声明自己的 window，两者不能直接互换。

下面把时间相关的参数声明与查询位置放在同一份 JSON 中。这是有意省略页面 ID、字段、组件和区域条件的局部示例，不可独立运行；实际替换前例时，还须将期间文本引用改为 report-month：

```json
{
  "params": [
    {
      "id": "report-month",
      "type": "time",
      "granularity": "month",
      "value": "2026-06"
    }
  ],
  "dataSources": {
    "tokens": {
      "source": {
        "type": "query",
        "query": {
          "language": "dqe",
          "body": {
            "dsl_list": [
              {
                "output_dims": [],
                "output_metrics": [
                  "Tokens消耗量"
                ],
                "filter": {
                  "time": {
                    "period": "month",
                    "is_aggregate": false,
                    "start": {
                      "param": "report-month",
                      "part": "start",
                      "window": {
                        "kind": "lastN",
                        "unit": "month",
                        "n": 12
                      }
                    },
                    "end": {
                      "param": "report-month",
                      "part": "end",
                      "window": {
                        "kind": "lastN",
                        "unit": "month",
                        "n": 12
                      }
                    }
                  }
                }
              }
            ]
          }
        }
      }
    }
  }
}
```

结果为 2025-07 至 2026-06，双端必须引用同一参数、使用相同窗口。窗口只决定读取哪些期间，不改变指标口径：若 6 月分区已返回年累计指标，不应因其名称再查 1—6 月求和。

### 已支持的窗口

| `window` 示例 | 含义 | 输入与结果 |
|---|---|---|
| `{kind:"period",unit:"month"}` | 基准所在完整月 | 月参数2026-03 → 2026-03 |
| `{kind:"period",unit:"year"}` | 基准所在完整自然年 | 月参数2026-03 → 2026-01至12 |
| `{kind:"period",unit:"year",offset:-1}` | 上一个完整自然年 | 月参数2026-03 → 2025-01至12 |
| `{kind:"period",unit:"day",offset:-1}` | 基准日前一天 | 日参数2024-03-01 → 2024-02-29 |
| `{kind:"lastN",unit:"month",n:12}` | 含基准月的最近12个月 | 2026-03 → 2025-04至2026-03 |
| `{kind:"lastN",unit:"day",n:7}` | 含基准日的最近7天 | 2024-03-01 → 2024-02-24至2024-03-01 |
| `{kind:"yearToDate"}` | 年初至基准期 | 月参数2026-03 → 2026-01至03 |
| `{kind:"monthToDate"}` | 月初至基准期 | 日参数2026-03-15 → 2026-03-01至15 |

规则：

- `period` 的单位是 `day/month/year`，`offset` 按单位移动完整周期，缺省0。
- `lastN` 的 `n` 是正整数，单位与输入精度一致：月参数按月、日参数按日。
- `yearToDate` / `monthToDate` 表示年初/月初至报告基准期，不读取系统今天，也无需 `unit`。
- 月参数不能推断某一天；日参数可取所在完整月或年，返回日期起止。
- 起止包含。计算只依赖输入和规则，不读取系统当前时间，也不受进程时区影响。越出年份范围时报错。

### 无数据如何处理

**按指定期间查询，无数据就呈现空结果，不回退到另一月份或最新可用期。** 服务故障、权限错误或查询被拒绝仍显示对应查询错误，不当成无数据。

当前能力不包含最新可用期自动获取、财年/周规则、Tab切换查询粒度或历史预测版本选择。物理分区、年度目标字段和财经接口参数的映射仍由数据服务契约确定；年度目标值不等于全年时间窗口。


## 7. 参数与页内筛选

维度参数可通过 filters[].initialParam 初始化维度筛选器，该筛选器不再另写 default。查询维度位置保留原位参数引用，同时通过 query.filterBindings 将同一维度交给筛选器。

初始化后，相关查询由筛选状态管理；修改或清空筛选不会恢复参数固定条件，也不会反向修改参数。未被筛选器接管的查询仍使用本次参数值。手动发送查询不能跳过筛选状态组装。

同一查询不能同时由时间参数和时间筛选器控制，也不能在引用以外另保留一套静态起止值。

## 8. 通过 MCP 调用：不需要模型填写过程证据

前文 `trustedContext`、`selectedIds`、`textReplacements` 是程序 API 的过程变量。模型调用统一 `metriccanvas-platform-content` 时，使用下面三个独立工具；baseline 和维度身份由可信提供方读取，**不是模型参数，也不是页面 JSON**。服务已注册这些工具，但部署仍需注入可信上下文、参数程序、持久记录和验真提供方。

### 第一步：提取候选

调用 `extract_page_parameters`：

```json
{"context_ref":"current-context"}
```

若来源是同轮创作候选，可额外传 `candidate_ref`。返回的 `modelSummary` 示例（引用仅为示意，实际必须使用工具返回值）：

```json
{
  "status":"extracted",
  "extraction_ref":"extraction-example",
  "candidates":[
    {"candidate_id":"choice-1","param_id":"region","type":"dimension","label":"区域","multiple":false,"coveredQueries":["tokens"],"uncoveredQueries":[],"defaultSelected":false},
    {"candidate_id":"choice-2","param_id":"report-period","type":"timeRange","granularity":"month","coveredQueries":["tokens"],"uncoveredQueries":[],"defaultSelected":false}
  ],
  "text_slots":[{"slot_id":"text-1","location":"/sections/0/components/0/props/body","candidate_ids":["choice-1"]}],
  "valuesOmitted":true
}
```

这里只省略有效期、跳过原因等非页面参数字段。`choice-1` 是本次选择用的候选 ID，`region` 才是最终 `params[].id`；`text-1` 是允许修改的文本槽位。它们均由程序返回，不能自行拼造。摘要不含原始取值；完整来源留在程序通道。

### 第二步：确认选择和文本

调用 `apply_page_parameter_selection`：

```json
{
  "context_ref":"current-context",
  "extraction_ref":"extraction-example",
  "selected_ids":["choice-1","choice-2"],
  "text_choices":[{"slot_id":"text-1","kind":"parameter","candidate_id":"choice-1"}]
}
```

此文本选择将整个槽位改为 `{"param":"region"}`。若要改成不含旧值的固定文字，则传 `{"slot_id":"text-1","kind":"literal","text":"Tokens 用量报告"}`。只能修改工具给出的槽位；多处文本必须逐处确认，不能提交任意路径。

结果摘要：

```json
{"status":"template_prepared","candidate_ref":"candidate-example","selected_ids":["choice-1","choice-2"],"requiresHumanConfirmation":true,"saved":false}
```

对应程序信封为 `metriccanvas.parameter-template`。其中 `artifact.document` 才是第 3 节所示的完整无值模板页面；candidate_ref、选择记录、人工确认状态不写入页面。模板和其后续编辑都禁止普通自动保存，须走人工发布。

### 第三步：赋值，交运行时

调用 `resolve_page_parameters`：

```json
{
  "context_ref":"current-context",
  "candidate_ref":"candidate-example",
  "values":{"region":"欧洲区","report-period":{"start":"2026-07","end":"2026-09","granularity":"month"}}
}
```

结果摘要包含 `status: "resolved"`、`instance_ref`、参数声明、有效期，以及 `executed: false`、`saved: false`。完整程序信封为 `metriccanvas.parameter-instance`，其 `artifact.payload.document` 是第 5 节的填值文档；`resolvedPage` 和 `effectiveInputs` 仍是执行过程数据。

**赋值成功不是执行成功。** 可信宿主按 instance_ref 重新验证权限、来源和有效期，再交工作台 RuntimeView 临时运行；不覆盖原模板、不进入保存队列。缺值或非法值不会生成实例。召回场景先由外部服务找到精确模板、装载为新轮次可信上下文，再调用 resolve（可省略 candidate_ref）；不能跨轮次复用旧的候选引用。

## 9. 查阅与验证入口

- [页面元数据规范](PAGE-METADATA.md)：页面整体结构。
- [完整无值模板夹具](packages/page/fixtures/contract-valid/inline-params-page.json)与[填值页面夹具](packages/page/fixtures/contract-valid/inline-params-values-page.json)：可验证原文。
- [Tokens 五查询具体页面](packages/page/fixtures/parameter-extraction/tokens-parameter-source.json)：多查询提取示例。
- [独立解析示例](packages/page/examples/resolve-page-params.ts)：运行 `node --import tsx packages/page/examples/resolve-page-params.ts`，验证两种赋值方式得到相同执行条件，不连接真实数据服务。
- [提取实现](packages/page/src/extract-page-params.ts)与[解析实现](packages/page/src/resolve-page-params.ts)：接口与失败规则。
