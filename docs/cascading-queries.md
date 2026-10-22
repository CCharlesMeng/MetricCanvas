# 级联查询：元数据定义与使用逻辑

页面协议概览与专题导航见[PAGE-METADATA.md](../PAGE-METADATA.md)。本专题维护查询结果绑定的完整用法；参数与时间筛选规则见[PAGE-PARAMETERS.md](../PAGE-PARAMETERS.md)，开发预览入口见[页面试验场](../apps/playground/README.md)。

本文说明Schema6.14的查询结果绑定，以及它与具名算子、组件数据槽的协作方式。适用于“先选择一批对象，再查询这些对象的明细”的集合式查询，例如商务SDT报告的项目Top5。现行决策见[ADR-0099](adr/0099-raw-query-result-bindings-and-bounded-left-joins.md)，协议见[查询定义](page-metadata/queries-and-bindings.md)和[具名算子](page-metadata/compute.md)。

## 1. 声明分别放在哪里

| 声明 | 所属位置 | 职责 |
| --- | --- | --- |
| 主查询 | 主源source.query.body | 选择对象、原始字段与顺序 |
| 查询结果绑定 | 下游source.query.resultBindings | 从主查询原始维度结果提取集合，形成下游维度条件 |
| 明细查询 | 下游source.query.body | 查询本轮集合中的对象明细 |
| pivot | 下游compute | 将类别行展开成多个结果字段 |
| joinAggregate | 主源compute | 按组合键左关联明细产出，保留主行 |
| 字段契约 | 各自fields | 声明原始与计算字段的类型、角色、单位和缺失规则 |
| 展示 | sections[].components[] | 通过数据槽消费主源的最终快照 |

每个页面数据源的dsl_list仍只有一项。依赖属于页面数据源，组件不负责发起第二次请求。查询结果绑定及pivot列级valueField要求schemaVersion为6.14；旧版本文档不能仅加入这些字段而保留旧版本号。

## 2. 商务SDT的请求与计算顺序

页面[商务SDT报告](../pages/business/report/sdt/business-sdt-cascade-example.json)包含两条独立的链：

| 表格 | 主源 | 阶段源 | 排序 |
| --- | --- | --- | --- |
| 项目决策时长最快Top5 | project-efficiency-bottom5 | project-efficiency-bottom5-stages | 决策时长asc，limit5 |
| 项目决策时长最慢Top5 | project-efficiency-top5 | project-efficiency-top5-stages | 决策时长desc，limit5 |

1. 主查询返回客户名称、项目名称、商务编号与SDT成员决策时长，确定左四列和项目顺序。
2. 上游原始归一化行中的commerce-id去重后成为一组商务编号。每组只执行一次阶段逻辑查询，不逐行扇出。
3. 阶段查询输出商务编号、阶段名称、SDT成员决策时长和SDT成员决策次数。
4. 阶段源pivot按商务编号分组，将三个阶段的时长与次数展开成六个字段。
5. 主源joinAggregate按商务编号左关联回原来的项目行。原表格仍显示5行10列。

两组主逻辑查询可以同批或并行；每个阶段查询必须等待自己的主原始结果。网关可批量提交独立逻辑查询，HTTP批次数不等于逻辑查询数。正常本地预览是主查询两项同批，然后阶段查询两项同批。

```mermaid
flowchart LR
  A[主查询原始Top5] --> B[本轮商务编号集合]
  B --> C[阶段查询原始行]
  C --> D[pivot六个字段]
  A --> E[joinAggregate保留主行]
  D --> E
  E --> F[原项目表格]
```

查询阶段与计算阶段分别校验依赖。阶段查询依赖主源的原始查询结果，主源计算依赖阶段源计算结果，这是合法顺序；不能等待主源已经完成合并才发阶段请求。真正的查询循环或计算循环仍会被拒绝。

## 3. resultBindings的定义

以下配置位于最快阶段源的source.query：

```json
"resultBindings": [
  {
    "source": "project-efficiency-bottom5",
    "field": "commerce-id",
    "target": "dimension",
    "queryField": "商务编号",
    "maxValues": 5
  }
]
```

| 字段 | 取值规则 | 含义 |
| --- | --- | --- |
| source | 已声明的查询数据源id | 引用上游；首版不支持inline源 |
| field | 上游原始页面维度字段id | 必须有queryField映射，类型为string或number；不支持计算产出 |
| target | 固定dimension | 将结果用于下游维度条件 |
| queryField | 下游DQE维度字段名 | 本例为商务编号；不是页面字段id |
| maxValues | 1到1000的整数 | 限制去重后的集合数量；本例取5 |

commerce-id是页面字段，商务编号是DQE字段，两者通过fields中的queryField显式映射。运行时读取归一化原始快照、保留值类型、去重并确定性排序；这种排序只稳定谓词和缓存身份，不改变主表行顺序。

阶段查询中的静态filter.dims为空。运行时将绑定解析为普通维度条件，再由现有网关编译到如下DQE结构：

```json
{
  "dim_name": "商务编号",
  "dim_value_list": ["本轮商务编号A", "本轮商务编号B"]
}
```

上例编号是说明用值，实际编号由本轮主结果生成，不能将截图中的编号写死。没有fillInto路径、dsl索引或表达式。resultBindings中的同一queryField不能重复，也不能与静态维度条件、paramBindings或filterBindings的相同目标竞争。

一个下游可以声明多个结果绑定；各维度条件同时生效，使用AND语义。尚有输入未就绪时等待；已知空输入跳过请求；已知失败优先传播失败。不得把空输入当作“删除维度条件后查询全部”。

## 4. 主集合与完整明细的边界

上游原始结果必须来自完整查询，或者具有显式正整数order.limit的有限选择。固定有限选择不能有offset或查询分页；6.20允许显式查询分页窗口作为独立输入范围，见第11节；有限选择源不能作为grandTotal、groupSubtotal或timeFill的全量输入。固定有限选择或完整结果上游不接受运行时查询排序或表头筛选覆盖，以保持声明的选择范围；显式查询分页上游可按本轮生效查询更新窗口。展示层本地分页或排序不成为下游输入。

阶段源source.resultScope为complete。这表示本轮商务编号条件下的原始阶段明细完整，不表示查询所有商务项目。阶段源不能带limit、offset或查询分页。已提供totalCount时必须与原始行数相符；没有totalCount时沿用完整结果声明，因此真实接线仍需确认后端没有隐式截断。

Top5主源属于有限选择，不能标作整个业务总体完整。主查询totalCount大于5时，合并与导出仍保留本轮Top5；该总数不会豁免辅助源的完整性核验。

## 5. pivot的多度量定义

阶段源的默认取值字段为decision-time；次数列通过columns[].valueField覆盖默认值：

```json
{
  "op": "pivot",
  "categoryField": "stage-name",
  "valueField": "decision-time",
  "keyFields": ["commerce-id"],
  "columns": [
    {"output": "rep-office-time", "categories": ["代表处SDT"]},
    {"output": "rep-office-count", "categories": ["代表处SDT"], "valueField": "decision-count"},
    {"output": "region-time", "categories": ["地区部SDT"]},
    {"output": "region-count", "categories": ["地区部SDT"], "valueField": "decision-count"},
    {"output": "cloud-time", "categories": ["华为云计算SDT"]},
    {"output": "cloud-count", "categories": ["华为云计算SDT"], "valueField": "decision-count"}
  ]
}
```

同一个类别可分别映射时长和次数；冲突按有效valueField与category的组合判定。每列仍可以声明有序categories列表，取第一个匹配类别，不对多个类别求和。同一商务编号与阶段重复的原始行会使本例多度量透视失败；缺阶段仅产生对应null，0不会被转换成null。

输入与输出字段必须保持数值类型、单位、币种一致。阶段字段和主源的六个计算输出均显式声明，允许null。原始decision-time/decision-count保留queryField，pivot和joinAggregate产出的字段不声明queryField。defaultFormat只是展示建议，number-1不会改变计算用的原始时长。

## 6. joinAggregate与组件消费

主源compute引用阶段源，以local commerce-id与foreign commerce-id关联，将六个产出逐一映射回主源fields。每项values使用aggregate unique，要求每个关联组合键恰好一条明细产出；多条匹配会失败。onMissing null保留主行，并将没有匹配的输出置空。不得通过stage指标重新选取主Top5。

组件继续使用data.main指向原主源。最快/最慢表的组件id、列组和字段绑定保持原样；两张表使用现有fit content以支持内部横向滚动，pagination mode为none。源中有六个输出不会自动产生六列，表格columns仍须显式配置。

## 7. 两个数据源的完整声明示例

以下dataSources片段可放入schemaVersion为6.14的完整页面，包含最快Top5的全部原始字段、计算字段、查询和算子。页面仍需要meta、filters、sections等声明；可直接对照[完整合法页面夹具](../packages/page/fixtures/contract-valid/query-cascade-page.json)。

```json
{
  "dataSources": {
    "project-efficiency-bottom5": {
      "fields": {
        "customer-name": {"type": "string", "role": "dimension", "label": "客户名称", "nullable": true, "queryField": "客户名称"},
        "project-name": {"type": "string", "role": "dimension", "label": "项目名称", "nullable": true, "queryField": "项目名称"},
        "commerce-id": {"type": "string", "role": "dimension", "label": "商务编号", "nullable": false, "queryField": "商务编号"},
        "decision-time": {"type": "number", "role": "measure", "label": "商务决策时长", "defaultFormat": "number-1", "unit": "天", "nullable": true, "queryField": "SDT成员决策时长"},
        "rep-office-time": {"type": "number", "role": "measure", "label": "决策时长", "defaultFormat": "number-1", "unit": "天", "nullable": true},
        "rep-office-count": {"type": "number", "role": "measure", "label": "审批人次", "defaultFormat": "number", "unit": "次", "nullable": true},
        "region-time": {"type": "number", "role": "measure", "label": "决策时长", "defaultFormat": "number-1", "unit": "天", "nullable": true},
        "region-count": {"type": "number", "role": "measure", "label": "审批人次", "defaultFormat": "number", "unit": "次", "nullable": true},
        "cloud-time": {"type": "number", "role": "measure", "label": "决策时长", "defaultFormat": "number-1", "unit": "天", "nullable": true},
        "cloud-count": {"type": "number", "role": "measure", "label": "审批人次", "defaultFormat": "number", "unit": "次", "nullable": true}
      },
      "source": {
        "type": "query",
        "query": {
          "language": "dqe",
          "body": {
            "dsl_list": [
              {
                "output_metrics": ["SDT成员决策时长"],
                "output_dims": ["客户名称", "项目名称", "商务编号"],
                "filter": {
                  "time": {"period": "month", "start": "202609", "end": "202609"},
                  "dims": [],
                  "metrics": []
                },
                "order": {"order_by_field": "SDT成员决策时长", "type": "asc", "limit": 5}
              }
            ]
          }
        }
      },
      "compute": [
        {
          "op": "joinAggregate",
          "source": "project-efficiency-bottom5-stages",
          "keys": [
            {"local": "commerce-id", "foreign": "commerce-id"}
          ],
          "values": [
            {"field": "rep-office-time", "output": "rep-office-time", "aggregate": "unique"},
            {"field": "rep-office-count", "output": "rep-office-count", "aggregate": "unique"},
            {"field": "region-time", "output": "region-time", "aggregate": "unique"},
            {"field": "region-count", "output": "region-count", "aggregate": "unique"},
            {"field": "cloud-time", "output": "cloud-time", "aggregate": "unique"},
            {"field": "cloud-count", "output": "cloud-count", "aggregate": "unique"}
          ],
          "onMissing": "null"
        }
      ]
    },
    "project-efficiency-bottom5-stages": {
      "fields": {
        "commerce-id": {"type": "string", "role": "dimension", "label": "商务编号", "nullable": false, "queryField": "商务编号"},
        "stage-name": {"type": "string", "role": "dimension", "label": "阶段名称", "nullable": false, "queryField": "阶段名称"},
        "decision-time": {"type": "number", "role": "measure", "label": "阶段决策时长", "defaultFormat": "number-1", "unit": "天", "nullable": true, "queryField": "SDT成员决策时长"},
        "decision-count": {"type": "number", "role": "measure", "label": "阶段审批人次", "defaultFormat": "number", "unit": "次", "nullable": true, "queryField": "SDT成员决策次数"},
        "rep-office-time": {"type": "number", "role": "measure", "label": "决策时长", "defaultFormat": "number-1", "unit": "天", "nullable": true},
        "rep-office-count": {"type": "number", "role": "measure", "label": "审批人次", "defaultFormat": "number", "unit": "次", "nullable": true},
        "region-time": {"type": "number", "role": "measure", "label": "决策时长", "defaultFormat": "number-1", "unit": "天", "nullable": true},
        "region-count": {"type": "number", "role": "measure", "label": "审批人次", "defaultFormat": "number", "unit": "次", "nullable": true},
        "cloud-time": {"type": "number", "role": "measure", "label": "决策时长", "defaultFormat": "number-1", "unit": "天", "nullable": true},
        "cloud-count": {"type": "number", "role": "measure", "label": "审批人次", "defaultFormat": "number", "unit": "次", "nullable": true}
      },
      "source": {
        "type": "query",
        "resultScope": "complete",
        "query": {
          "language": "dqe",
          "body": {
            "dsl_list": [
              {
                "output_metrics": ["SDT成员决策时长", "SDT成员决策次数"],
                "output_dims": ["商务编号", "阶段名称"],
                "filter": {
                  "time": {"period": "month", "start": "202609", "end": "202609"},
                  "dims": [],
                  "metrics": []
                },
                "order": {}
              }
            ]
          },
          "resultBindings": [
            {"source": "project-efficiency-bottom5", "field": "commerce-id", "target": "dimension", "queryField": "商务编号", "maxValues": 5}
          ]
        }
      },
      "compute": [
        {
          "op": "pivot",
          "categoryField": "stage-name",
          "valueField": "decision-time",
          "keyFields": ["commerce-id"],
          "columns": [
            {
              "output": "rep-office-time",
              "categories": ["代表处SDT"]
            },
            {
              "output": "rep-office-count",
              "categories": ["代表处SDT"],
              "valueField": "decision-count"
            },
            {
              "output": "region-time",
              "categories": ["地区部SDT"]
            },
            {
              "output": "region-count",
              "categories": ["地区部SDT"],
              "valueField": "decision-count"
            },
            {
              "output": "cloud-time",
              "categories": ["华为云计算SDT"]
            },
            {
              "output": "cloud-count",
              "categories": ["华为云计算SDT"],
              "valueField": "decision-count"
            }
          ]
        }
      ]
    }
  }
}
```

最快改为最慢时，主查询order.type改为desc，并分别更换两个源id、resultBindings.source、joinAggregate.source和表格data.main；两条链不能共用另一张表的商务编号集合。

## 8. 月份、刷新、初始数据与导出

本例两项查询都显式使用month 202609，四源落地页面也保持这一月份。不存在自动替换的{{yyyymm}}文本占位符，也没有新增页面日期控件。需要动态日期时，使用已有页面参数或时间筛选绑定，让主、阶段查询各自显式消费同一个期间；仅修改主查询的日期不会自动改变阶段查询的日期。

上游条件改变时，编排器先同步失效下游和旧代次，再等待新主结果。迟到成功或失败不能覆盖当前快照；同编号但月份等查询条件改变也会形成不同查询键。共享请求只在没有当前消费者时取消。

派生编号集合不进入用户筛选状态或URL，因此不配置selection.writes来实现自动级联。表格单元格点击联动仍用于用户主动筛选，两者复用同一生效查询与网关，但输入来源和触发机制不同。

本例级联关联链不复用缺少输入证明的initial或执行启动回执，避免把不同采集批次的行合并。其他独立数据源仍可沿用现有初始行复用规则。

导出重新执行主查询，以导出本轮编号查询阶段行，再完成相同计算。不能复用屏幕旧编号，也不能根据主totalCount扩大为全业务全集。业务Top5限制与普通查询分页导出是不同范围；完整报告PDF编码仍属于宿主验收。

## 9. 校验、失败和本地试用

| 场景 | 处理 |
| --- | --- |
| 上游未返回 | 等待，不发阶段请求 |
| 上游成功空集 | 下游为空，不发无条件请求 |
| 上游失败 | 保留错误分类，不提交下游，消息不携带业务行 |
| 键缺失、null、空白、类型错误或非法数值 | 拒绝集合，不静默过滤坏行 |
| 去重集合超过maxValues | 报错，不截断 |
| 未知源/字段、计算字段输入、目标冲突、循环或旧版本能力 | 静态校验拒绝 |
| 多度量透视同分组同类别重复 | 计算失败 |
| 缺少某阶段 | 对应字段为null，其余阶段和主行保留 |
| 辅助响应不满足complete | 失败，不显示不完整结果为成功 |

```sh
pnpm validate
pnpm exec vitest run packages/page/tests/query-result-bindings.test.ts packages/engine/runtime/tests/query-cascade.test.ts tools/dqe-sim/tests/business-sdt-cascade.test.ts
pnpm dev:dqe
```

页面试验场预览地址为http://localhost:5173/pages/business-sdt-cascade-example。已有服务运行时无需重复启动。DQE Sim只识别普通请求，阶段pivot/join由引擎完成；9月和10月夹具仅用于本地验证。empty/main-error/detail-error可通过DQE_SDT_SCENARIO注入仿真状态，正常启动不设置该变量。

本地正常、空集、失败、竞态、两个月份、窄屏及导出数据证据见[验收结论](evidence/2026-10-12-business-sdt-cascade/result.md)。部分阶段时长为合成夹具，真实DQE的阶段粒度、单位、唯一性、缺失含义、权限及隐式上限仍需单独验真；前端本地通过不证明Relay/Java或生产接线。

## 10. 复用主结果并过滤下游输入（6.19）

A完整呈现、B只查询部分对象时，在B的 `resultBindings[].where` 声明行条件。不要修改A的查询范围，也不要复制A为第二个数据源或回写隐藏筛选器。不同下游可以对同一A使用不同条件。

```json
{
  "source": "projects",
  "field": "project-id",
  "target": "dimension",
  "queryField": "项目编号",
  "maxValues": 500,
  "where": {
    "all": [
      {"field": "status", "op": "eq", "value": "进行中"},
      {"field": "amount", "op": "gt", "value": 1000000}
    ]
  }
}
```

本例按状态和金额筛行，再传项目编号；A仍展示全部行。完整例子见[过滤复用页面](../packages/page/fixtures/contract-valid/query-result-where-page.json)：高金额明细和低金额明细分别声明自己的条件。条件闭集、空值、原始单位和上限规则见[查询绑定协议](page-metadata/queries-and-bindings.md)。这不是“金额值集合作为下游指标条件”，后者需要单独的目标分支及真实DQE验真。

顺序固定为声明范围核验、过滤、提取、去重、maxValues检查；过滤后为空不发送下游请求。where只读原始标量字段，不能引用计算产出。多个绑定仍为独立维度集合条件的AND。旧绑定缺省where保留6.14行为；声明where需6.19及支持此能力的运行时。

## 11. 任意列排序与分页窗口联动（6.20）

字段映射、order、表格分页和结果绑定的逐项解读，统一见[配置解读](page-metadata/queries-and-bindings.md#配置解读首轮查询任意列排序与分页级联)。

[80行演示页面](http://localhost:5173/pages/query-result-where-page)使用查询分页，首轮请求金额降序、offset:0、limit:10。点击项目编号、名称、状态、金额或执行周期的列头可改变查询排序，Shift点击可以叠加排序；运行时回到第一页。翻页与修改每页条数会改变同一查询的窗口。

下方两个查询分别在当前窗口中按“进行中且金额>300万元”与“进行中且金额≤300万元”独立筛选，再以项目编号集合作为维度条件。上游展示当前窗口全部行，下游只收到编号集合，未接收上游页码。初始金额降序只是可改变的默认值；引擎按resultBindings推导依赖，不认识示例中的项目名称或具体列。

该组合不增加绑定字段。分页数据源必须声明正整数limit及offset:0，并不声称complete。字段集合相同则缓存可复用；无依赖查询不受影响。分支可并行，汇合等待各输入，多层依赖逐层传播。输入变化使下游分页回到第一页，过期结果不能覆盖本轮数据。固定TopN保持其业务选择范围，不被自动当作分页查询。

共享单次执行按第一页级联；报告导出重查捕获时的窗口及其依赖结果，保留当时的页码、排序与大小。普通未参与级联的分页表仍按完整导出规则取全量。示例通过本地DQE仿真真实HTTP执行；不代表真实DQE/Relay/Java验收。

## 组合查询与固定级联

6.22 的 pagedJoin 引用查询定义，内部按已提交视图选择驱动成员；这些定义引用不是 resultBindings 的结果依赖，不改写固定图、不反转或制造循环。SourceProgram.read 统一普通 raw/compute、组合、单次执行和完整导出；QueryRunner 只共享完全相同生效请求与资源。内部补列不写入普通成员公开快照/initial。
