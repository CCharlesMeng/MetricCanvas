# 共享页面取数：讨论基线与实现裁决

日期：2026-10-14。状态：Q1–Q14已确认，S1–S5本仓实施与本地验收完成；真实Relay/DQE部署及远端交付未执行。本文是本次共享页面取数工作的唯一讨论与实施方案入口，后续进展就地更新。

本工作与[报告/看板创作主计划](2026-10-12-report-dashboard-authoring-plan.md)相邻，但不替代其取数规划、查询生成、创作授权和保存前计算验真。部署与真实 Relay/DQE 接入仍需单独验收。

## 1. 问题与已确认约束

报告召回后需要在 Relay 执行环境重新取数。浏览器与 Relay 的执行环境不同，但必须消费同一份页面查询声明和同一份执行逻辑，尤其是查询结果绑定形成的级联，不能各自实现一套调度规则。

用户已确认的接口约束：

- 一个简单的单次执行入口，概念形状为 `execute(metadata): Promise<PageDocument>`。
- 输入是完整页面 metadata，本次实际参数值放在 `params` 内，不另传一份业务参数。
- 输出只是一份完整 metadata，查询源回填 `initial`。不增加 `execution`、`snapshots` 或证明封套等出参。
- 数据网关在执行环境初始化时供给，端点、凭据与可信身份不进入页面文档。
- 不向业务调用方要求 `signal`；内部请求取消和超时属于实现细节，具体接线待讨论。
- 返回页面副本，保留原查询引用、字段契约、计算声明、章节与组件，不修改调用方输入。
- `initial` 保持当前协议的查询原始输出字段名，不写入计算后的字段行。
- Q1已确认：允许增加Node执行进程以调用同一TS实现，不新增常驻Node服务；生产实际部署能力仍需接入验收。
- Q2已确认：每次调用execute重新执行目标查询，不复用输入的旧initial。
- Q3/Q6用户裁决：成功源替换initial；失败源不处理，输入有旧initial就保留，原本没有就仍没有。不整体reject，不主动删除失败源旧initial；页面其余声明保留。
- Q4/Q8用户裁决：所有声明query源，包括非当前Tab及辅助源，都执行其声明查询窗口并回填initial；inline保留原rows。所有源不等于所有行，Top5及初始分页窗口保留。
- Q7/Q9用户裁决：允许浏览器补查缺失initial；已有initial直接使用，不因capturedAt不同整链重取，接受同条件刷新中跨采集时刻数据组合。
- Q10用户裁决：填参入口在查询条件实际改变时清除受影响源及其下游的旧initial；同条件刷新保留。execute自身仍遵守成功替换、失败不处理。
- Q11用户裁决：本轮共享已有完整metadata的召回/刷新与浏览器查询执行，保留Python创作期数据发现、查询生成、授权与真实查询验真路径。
- Q12用户裁决：Node执行进程直接使用共享TS DQE适配器访问DQE，Relay接入程序供给地址、可信当前调用身份与超时配置；Python不逐请求转发。
- Q13用户裁决：返回带initial文档用于本次交付展示，不自动保存或发布，不新增采集快照存储；现行页面资产保存去除query initial的规则保持。
- Q14用户裁决：回填主页面所有可执行query源，包括各Tab、辅助源和snapshot详情；query详情继续点击后执行，共用查询核心，不逐行提前查询所有详情。

最终职责：执行入口解析已填参数、形成生效查询、执行查询级联、归一化及字段检查、回填原始行。`compute`声明保留，由引擎执行；入口不执行展示计算，也不额外返回最终计算结果。Python创作期保存前计算验真的独立任务继续按原主计划推进，不因本次召回入口收窄而降低其验收要求。

此前建议的 `metadata + execution + snapshots` 出参、公开 `evaluationTime/signal` 选项及强制级联证明方案已被接口收窄取代，不进入本方案的默认实现。

## 2. 调用与页面示例

已新增 `@metriccanvas/data-execution`。下面为实际业务调用形状：

```ts
// 部署初始化时绑定本执行环境的数据网关。
const executor = createPageDataExecutor({ gateway: relayDataGateway });

// 业务调用只有完整 metadata；其 params 已填写实际值。
const filledMetadata = await executor.execute(metadata);
```

输入使用[现有商务 SDT 级联页面](../../packages/page/fixtures/contract-valid/query-cascade-page.json)的完整字段、查询、计算与组件声明，并填入：

```json
{
  "params": {
    "query": {
      "times": [{
        "id": "report-period",
        "granularity": "month",
        "start": "2026-09",
        "end": "2026-09"
      }]
    }
  }
}
```

两个查询的 `filter.time` 替换为 `{ "period": "month", "param": "report-period" }`，不同时保留固定起止。此片段不是独立合法页面，完整页面沿用上述夹具。

明细源的现行查询结果绑定为：

```json
{
  "resultBindings": [{
    "source": "project-efficiency-bottom5",
    "field": "commerce-id",
    "target": "dimension",
    "queryField": "商务编号",
    "maxValues": 5
  }]
}
```

执行顺序：物化期间 → 取最快 Top5 原始项目行 → 提取去重编号集合 → 一次查询明细 → 回填两个源的 `initial`。上游空集合时不发送无约束明细查询。主集合的 Top5 不因 `totalCount` 较大而自动扩成全业务集合；明细源的 `resultScope: complete` 继续遵循其完整性约束。

输出仍是完整页面，仅举主源回填字段：

```json
{
  "capturedAt": "2026-10-14T01:00:00Z",
  "rows": [{
    "客户名称": "客户甲",
    "项目名称": "项目A",
    "商务编号": "A",
    "SDT成员决策时长": 2
  }],
  "totalCount": 1
}
```

这些行是示意数据，不是真实 DQE 执行证据。执行入口须在回填时保持原始字段形式；归一化的页面字段用于内部依赖解析，不能直接写回 `initial`。

## 3. 职责与同源位置

| 参与方 | 本次职责 | 接口收窄不代表什么 |
|---|---|---|
| Skill | 指导形成查询定义、查询结果绑定、具名算子与页面表达；已有报告召回可直接消费已有声明 | Skill 文本不承担级联调度；本次不重建数据发现或查询生成 |
| Relay 接入程序 | 读取完整页面、填写本次参数、供给数据网关并调用Node入口，交付完整 metadata | 已允许新增Node执行依赖，但生产环境和接线仍须实际验收 |
| 共享取数模块 | 参数物化、生效查询、结果集合输入、字段归一化、依赖执行与原始行回填 | 不产生第二套页面协议、不引入独立实例存储、不隐式保存发布 |
| 引擎 | 消费 initial、执行 compute、展示组件，管理筛选、分页、取消与后续查询 | 不为简化单次入口而重查所有交互数据，也不移除现有交互生命周期 |

同源要求是调用同一份实现，而不仅是JSON结构相同或两边各写一套相同算法。独立包只依赖页面协议，不反向依赖引擎；具体迁移与兼容方案见第7节。

## 4. 当前代码事实与架构影响

| 位置 | 当前行为 | 本次影响 |
|---|---|---|
| [参数物化](../../packages/page/src/resolve-page-params.ts) | `materializePageParams` 对有参数的页面删除查询源 initial | 同值参数初始化也会失去回填数据；须区分使用已填值文档和实际输入改变 |
| [运行时参数初始化](../../packages/engine/runtime/src/page-params.ts) | 调用参数物化，为筛选器赋初值；旧时间paramBindings另有删除initial的分支 | 返回文档的参数与默认筛选必须和本次查询一致，不能引擎初始化后查另一条件；两处删除规则均需处理 |
| [运行时编排](../../packages/engine/runtime/src/orchestrator.ts) | 收集组件/AI总结/快照明细视图的查询及计算依赖；级联链跳过 initial；关联源不同 capturedAt 时重取 | “完整 metadata”不自动等于查所有声明源；首屏复用规则须显式改变 |
| [查询结果输入](../../packages/engine/runtime/src/query-result-inputs.ts) | 读取归一化原始维度，去重且保留类型，空集合短路，错误与超限传播 | 提取为共享实现；不能从计算后项目行获取输入，或把集合写入用户筛选状态 |
| [DQE适配器](../../packages/engine/data-gateway/src/dqe.ts) | 形成实际 DQE 请求并归一化为页面字段 | 回填 original initial 需要共享字段反映射/原始行保留实现，不能混淆两种行格式 |
| [页面物化](../../packages/page/src/materialize.ts) | 将 query initial 原始字段归一化为内部行 | 保持当前序列化字段约定，验证嵌套字段与计算产出不被误写 |
| [计算快照](../../packages/engine/runtime/src/compute/snapshots.ts) | 在原始快照图上计算，核验完整结果并传播失败 | 本次保留引擎计算；不能承诺填 initial 就证明最终计算正确 |
| [导出取数](../../packages/engine/runtime/src/export-snapshots.ts) | 新鲜取数；普通源按导出策略获取完整数据，级联保留有限集合，最终执行计算 | 可复用查询核心，导出完整性策略不能被首屏策略替代 |
| [执行启动接口](../../packages/engine/runtime/src/execution.ts) | 已有精确目标、逐源状态与执行回执初始化路径 | 是否保留兼容、迁移调用者需单独定；本次拒绝新增封套不等于授权删除旧接口 |
| [引擎包](../../packages/engine/package.json) | 包含UI/图表依赖及 Svelte peer，运行时与DQE通过子路径导出 | 独立分发取数包应审查依赖闭包、旧导出兼容和版本一致性 |
| [Relay MCP示例](../../metriccanvas-authoring/examples/relay/mcp_configs/metriccanvas-authoring.json)、[参数程序接缝](../../metriccanvas-authoring/tool/metriccanvas_authoring/adapters/firstparty/parameter_program.py) | 示例通过uvx启动Python工具；参数程序允许部署方配置子进程命令，本地测试有Node调用 | 不证明生产已具备Node；部署选型是架构决策，不能默认给Python部署增加Node |
| [详情输入](../../packages/engine/runtime/src/detail-view.ts)、[详情调度](../../packages/engine/runtime-ui/src/RuntimeSurface.svelte) | snapshot详情共用主页面数据；query详情在点击后按row/param/filter绑定构造独立作用域，并清除initial | 单次metadata没有点击行，不能普遍预取query详情；当前即便仅param/filter的query详情也按点击执行 |

TS DQE适配器已支持注入endpoint/headers/fetchImpl/超时，不读取浏览器身份或Cookie存储，源码未依赖DOM；已有Node HTTP测试代码覆盖绝对endpoint调用。这证明源码接缝存在，不代表本轮运行测试或生产可用。Node接入要提供绝对DQE地址和可信当前调用身份，不能依赖浏览器相对URL与自动Cookie行为。

### 现行决策需要显式修订的地方

[ADR-0099](../adr/0099-raw-query-result-bindings-and-bounded-left-joins.md)目前要求无绑定输入证明的initial及执行启动回执不复用、关联链重取。Q5–Q10已裁决新消费约定，后续实施须修订该结论。当前已通过ADR-0105修订并在代码实现，真实接入仍单列验收。

[创作主计划第5节](2026-10-12-report-dashboard-authoring-plan.md#5-计算规划与输出验真)仍要求保存前计算求值与输出验真。召回入口不返回计算结果，不能推导为取消该要求或替代其 C05a。

同一采集批次的 `capturedAt` 只能表达应用层批次一致性，不证明数据库事务快照或相同权限。此方案不新增证明封套，实时授权仍由数据网关和数据服务履行。

[部署主题](../adr/topics/domain-modeling-and-package-boundaries.md)的现行ADR-0060/0061结论为生产不运行Node服务端、Python运行时不加载Node。Q1/Q12已允许Node执行进程直接查DQE，此变化须在实施ADR中明确局部修订；不新增常驻Node服务，不把既有Python创作流程整体迁移。现有本地参数程序Node测试只能证明接缝可行，不能证明生产可用。

同一主题下ADR-0071把runtime/data-gateway收进engine，定义四个锁步产品交付物。新增独立取数交付包需修订包交付约定；不能因为根入口已是TS就推导为新包分发已闭合。

保存与召回展示仍是两条生命周期：现行Authoring保存会去除query initial，参数模板不携带initial。Q13已确认保持此规则，入口只交付带数据的展示文档，不持久化采集结果。

## 5. 决策树与第一轮结果

| 节点 | 问题 | 当前结果 | 后续依赖 |
|---|---|---|---|
| Q1 执行环境 | 是否允许Relay增加JS执行运行依赖以调用同一TS实现 | 用户接受Node执行进程，不新增常驻Node服务 | Python桥接、包交付、依赖方向及旧接口兼容 |
| Q2 入口新鲜度 | 输入已有 initial 时每次重查还是复用 | 用户接受execute每次重新取数 | 失败时旧initial处理、批次时间 |
| Q3 失败结果 | 任一目标查询失败时整体拒绝，还是返回未完整回填的页面 | Q6确认成功替换，失败不处理，保留输入已有旧initial；整体reject及删除旧initial建议退出 | 旧initial展示、参数改变后的旧数据 |
| Q4 执行范围 | 所有声明查询源，还是当前完整页面渲染所需依赖闭包 | Q8确认所有声明query源，含非当前Tab及辅助源，执行声明窗口；inline不取数 | 延迟明细执行上下文、窗口与分页 |
| Q5 首屏消费约定 | 怎样使用级联 initial | Q9确认已有initial直接使用，缺失才补查，跨采集时刻可组合；不强制整链重取 | 输入改变先清理受影响旧initial，见Q10 |

Q1–Q14全部已裁决；Q5由Q6–Q10的具体规则收口，当前无待答的业务/架构frontier。旧公开接口兼容和目录迁移按第7节实施方案处理，新增入口不删除现行调用路径。

### 5.1 级联initial与部分回填（已裁决）

以A=Top5项目、B=阶段明细为例：查询阶段A.query→A的归一化原始行→提取商务编号集合→B.query；计算阶段B原始行→pivot→与A原始行左关联。两种依赖分图处理，不构成互相等待。A.initial保存项目查询原始行，B.initial保存阶段查询原始行，resultBindings和compute均保留在文档中。无需另存编号集合或计算后表格。

| 本次取数结果 | 返回文档（已确认成功替换/失败保留） | 引擎首次展示 |
|---|---|---|
| A、B成功 | 各写原始initial，使用同一本次capturedAt | 两源都免查询，直接执行pivot与左关联 |
| A成功、B失败且B原无initial | A写新initial；B仍无initial | 允许保留A快照，仅以A编号补查B，成功后计算；具体复用接线待实现 |
| A成功、B失败且B原有initial | A写新initial；B保留旧initial | 使用现有A/B计算，不因采集时间不同整链重取 |
| A失败 | A保留输入状态；依赖A的B本轮不执行，也保留输入状态 | 有initial直接用，缺失源允许补查，独立成功源继续回填 |
| A成功且为空 | A写空initial；B通过空集合短路写空initial | 空数据正常展示，不把空集合解释成“无筛选查询” |

Q7/Q9已确认缺失补查、已有initial直接使用。失败后保留旧initial的源不自动重查。仅输出metadata不带成功/失败封套时，浏览器不能一般性辨认“本次失败但保留旧结果”；这符合当前选择，不添加状态封套弥补。

本轮执行依赖只读取本轮成功查询结果。输出保留旧initial不等于execute允许以旧上游编号驱动本轮下游查询；否则违反Q2每次重新执行的裁决。依赖失败的下游本轮跳过，输出保留原状态。

本次所有成功initial可使用一次执行共同的capturedAt，复用现有字段，不添加绑定证明或公开状态封套。该时间表达批次，不证明数据库事务一致性。部分缺失时保留成功上游，用其编号补查缺失下游。Q9已接受失败保留旧initial形成跨批次组合，因此要取消现行关联链仅因capturedAt不一致就丢弃initial的规则，以及级联无证明一律重取规则。

浏览器改变筛选时，上游与下游按依赖失效，不复用旧编号对应的明细。Q10已确认填参入口在实际查询条件改变时先清除受影响源及下游initial，再调用execute；同条件刷新保留。此清理由填参入口负责，不改变execute失败不处理约定。只改展示参数而不影响查询，不应清除数据。

Q6已确认：输入有initial时成功替换，失败不处理。此前删除失败旧initial建议退出。

Q7已确认：允许浏览器补查缺失initial的源。保留成功上游补查下游为拟定实现；查询失败后使用既有错误态，不无限重试。

Q8/Q14已确认：主页面所有可执行query源，包括非当前Tab和辅助源，执行声明窗口并回填；inline保留原rows。query详情按点击上下文延迟执行，不取消Top5、不自动拉全业务数据。

### 5.2 第二轮结果

- Q9已接受：initial存在就用，缺失才补查，接受同条件刷新中的跨采集时刻组合。
- Q10已接受：填参入口在实际条件改变时清除受影响源及下游旧initial，同条件刷新保留；execute自身Q6行为不变。
- Q11已接受：本轮覆盖已有完整metadata的召回/刷新与浏览器查询，保留Python创作期发现、生成、授权与真实查询验真。

### 5.3 最后一轮结果

- Q12已接受：Node执行进程直接通过共享TS DQE适配器访问DQE；Relay供给可信端点、当前调用身份及超时配置，Python不逐请求转发，接入信息不进入metadata。
- Q13已接受：带initial文档只用于交付展示，不自动写回Java页面资产，不新增快照存储，沿用保存时去除query initial规则。
- Q14已接受：主页面所有可执行query源（各Tab、辅助源、snapshot详情）回填；query详情继续点击后按row/param/filter作用域执行，也共用查询核心。不预取所有行的query详情，保留其定义和现有点击生命周期。

## 6. 验收草案

- 单源、级联、上游空集合、失败、超限；Top5主集合与完整辅助源分别核验。
- 服务端取数与浏览器重取产生相同生效查询和归一化原始行语义；数据服务不同时刻返回内容变化不算算法漂移。
- 原始字段 initial → 引擎归一化 → pivot/左关联正确；不重复计算、不丢失0/null。
- 已填参数首屏有initial就使用，不因采集时间不同整链重取；缺失源允许补查。失败保留旧initial按Q6执行，不把“仍有旧数据”报告为本次查询成功。填参入口在实际查询条件改变时先清除受影响源及下游旧数据。
- 首屏窗口、查询分页与完整导出各保留原语义；不把 totalCount 改成采样行数。
- 入口输出完整可校验页面，输入不变；具体失败与执行范围按grill结果补齐。
- 独立包安装闭包、引擎兼容导出、Skill分发与生产调用分别验收；本地通过不替代真实Relay/DQE接入。

## 7. 具体实施方案

### 7.1 Module与依赖方向

新增`packages/data-execution/`，交付名拟定`@metriccanvas/data-execution`，为Node和浏览器共用的纯TS/JS包，不依赖Svelte、ECharts或引擎UI。

```text
@metriccanvas/page
       ↑
@metriccanvas/data-execution
       ↑                 ↑
@metriccanvas/engine    Relay Node执行入口
       ↑
Platform / Embed
```

- `page`保留页面Schema、参数和字段契约、序列化校验及协议层纯函数。
- `data-execution`拥有数据网关端口、DQE适配器、生效查询构造、查询结果输入、依赖执行及原始initial回填。
- 根入口提供`createPageDataExecutor({gateway})`，实例业务方法只暴露`execute(metadata)`。
- 引擎通过明确的运行时集成子路径调用查询核心；既有订阅、筛选/分页状态、缓存失效、代次和取消生命周期继续由引擎管理，复用核心不等于每次交互调用整页execute。
- `compute`实现及组件呈现留在engine；导出复用查询核心但保留完整取数策略与计算步骤。
- Relay侧提供一次执行的Node程序入口，以JSON读取完整metadata并输出完整metadata；部署配置供给DQE地址、当前身份和超时。程序日志与产物通道分开，不额外包装页面结果。

网关端口与适配器一起从引擎实现位置提取，避免新包为了使用DQE又反向依赖engine。旧`@metriccanvas/engine`类型导出及`@metriccanvas/engine/dqe`通过兼容再导出保留；新旧导出指向同一实现，不复制代码。现行ExecutionPort/ExecutionBootstrap不删除，不把新接口强塞进其回执协议。

### 7.2 执行与错误处理

1. 校验完整文档及已填参数，保留调用方输入；在内部副本物化参数与筛选初值。
2. 确定主页面全部可执行query源，识别query详情专属源及其点击上下文；不以首屏可见组件筛掉其他Tab或辅助源。
3. 建立本轮原始查询依赖图，只以本轮成功结果调度下游；保持集合类型、去重、上限、空集合短路与完整性规则。
4. 每个成功源将本轮行按查询原始字段形式写入输出initial；失败/依赖阻塞不改输出该源原有initial。
5. 输出原始完整页面副本，仅更新成功源initial。期间、查询引用、compute、sections和组件声明保留。

源级查询、映射或完整性失败采用已确认的部分回填规则。文档本身非法、必需参数缺失或部署无法启动属于无法执行入口的错误，拒绝调用，不把非法文档声称为已执行；错误沿用现有分类，具体类型在实现时收敛，不新增页面状态封套。禁止用保留的旧initial推导本次查询全部成功。

### 7.3 引擎与填参入口调整

- 参数初始化不再因页面有params或时间paramBindings一律删除initial；只有实际条件改变才按查询/计算依赖清除受影响initial，避免同值初始化触发重查。
- 在已有填参程序和浏览器显式输入覆盖处接入条件变化判断；比较生效条件而非只比较参数对象，展示参数变化不误伤查询。
- 首屏已有initial直接使用；缺失下游以保留上游原始行形成集合补查，不因capturedAt不同丢弃整条链。
- 浏览器交互产生新条件后继续按受影响依赖传播失效，取消旧请求、丢弃过期响应，不回退旧initial冒充当前条件成功。
- 查询分页、完整辅助源、Top5及导出各沿用原范围；当前需要完整首页的分页约束不以本次同源改造放宽。
- query详情仍由点击绑定形成独立输入，沿用现有清除其执行initial的语义，使用同一个查询核心。

### 7.4 ADR、Skill与分发

- 新增本次实施ADR，局部修订ADR-0060/0061的Node执行依赖、ADR-0071的取数交付物及ADR-0099的initial复用约定；主题页与索引同步。
- 平台Skill增加“已有完整页面召回/刷新调用取数程序”的接入说明与示例；不迁移Python创作发现、生成和验真。
- 新包与引擎采用兼容锁步发布，更新构建/发布清单、公开面快照、独立安装消费检查和Bundle可部署入口说明。
- 外部Relay接入事项明确列为配置与验收责任：Node运行环境、当前调用身份、绝对DQE地址、代理/证书、进程取消与超时。仓内Node入口及本地桥接证据不等于生产已接通。

### 7.5 实施顺序

| 阶段 | 工作 | 完成证据 |
|---|---|---|
| S1 | 冻结ADR及接口，提取网关端口、DQE与查询核心，保留旧导出 | 类型/公开面与既有查询测试通过，无环依赖 |
| S2 | 新增单次execute、原始行回填及部分失败规则 | 单源/级联/空集合/失败保留/嵌套映射/范围用例 |
| S3 | 接入引擎查询与导出核心，调整initial及填参失效 | 首屏复用、缺失补查、输入改变、取消/代次、分页/导出回归 |
| S4 | Node程序与Relay接入示例，更新Skill/分发 | JSON输入输出、部署配置、独立包与Bundle安装闭包 |
| S5 | 集中浏览器与集成验收，整理交付证据 | SDT真实页面展示/刷新证据；真实Relay/DQE单列结论 |

## 8. 实施状态

用户已授权实施。S1–S5本仓实现与本地验收完成：新包、查询核心提取、引擎/填参initial规则、Node程序、Skill说明、公开面/分发检查和浏览器已交付当前工作区。完整证据见[实施验收](../evidence/shared-page-data-execution/result.md)。

提交交付已获用户授权，已在最新main独立worktree整理本次范围并重新验证；提交/推送/远端CI结论按最终SHA报告。剩余外部工作是Relay部署方安装与身份/DQE接线、真实集成验收及实际包发布。本地HTTP、Node独立安装和Chrome证据分别成立，不将其称为真实Relay/DQE接通或已发布。原混合工作区无关改动保留。

共享工作区随后进入另一任务的6.19查询结果行过滤改动，最后契约导出报`Unowned reference definition: queryResultWhere`；该任务记录完整分发产物位于独立检出。本次共享输入实现保留已接入的where逻辑，未覆盖其生成产物；当前全门禁状态及复验边界见验收记录末节。

本次main交付独立于原混合工作区，未包含6.19结果行过滤和其他未提交功能。查询输入解析提取main现行实现，原工作区保留其他任务修改；独立交付的契约与Bundle检查通过，详见验收记录的独立交付验证。
