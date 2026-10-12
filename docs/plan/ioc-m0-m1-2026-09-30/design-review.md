# M1 具体设计评审草案

状态：proposed，仅供评审。下面 TypeScript/JSON 是候选形状，不能送入现行 Page Schema，不能放入 contract-valid、pages 或 authoring。正式字段名/错误码待评审冻结。已确认业务行为不是本次问题。

## 现行实现与本次差分

| 接缝 | 当前真源 | 候选改变 | 不改变的责任 |
|---|---|---|---|
| 详情声明 | page/src/schema/page.ts：id/mode/filters/components；ADR-0096拒绝可见筛选与查询分页 | 增加只读打开输入与独立可变筛选声明；query详情支持分页 | 页面内作用域，无独立身份/修订/返回栈 |
| 详情加载 | runtime/src/detail-view.ts 复制全页筛选，绑定隐藏filter；RuntimeSurface持有单浮层 | 详情会话封装代次、依赖闭包、筛选/查询状态和销毁 | 复用现有编排器/DataGateway，widgets不查询 |
| 表状态 | runtime-ui/src/table-state.ts 重置页码和原值排序；DetailContent另有本地处理 | 提取同一表状态投影Module，页面/详情各自实例化 | 不共享可变状态，Tab返回保留状态 |
| 表格数据 | table.data.main，rowKindField，单字段mergeBy；当前无固定汇总数据槽 | 独立summary槽、字段映射及固定位置 | totalCount只计明细，汇总不写回主快照 |
| 计算 | ADR-0095左关联unique/sum，全空sumFields=null；ADR-0096重复期拒绝 | 显式全空策略、增长率、按键并集、按期聚合、TOP N、重复期策略 | 默认不变、闭集算子、组合键非字符串拼接 |

validate.ts 中已有 pinnedSummary 属于 mapChart/regionalOverview，不能当作表格已有固定汇总能力。现行 accepted ADR-0095/0096 保持原文；批准后再形成后续ADR或明确修订段落，不能借 accepted 状态套用本草案。

## A：页面内独立详情会话（推荐）

选择A1：复用现有编排器，详情会话持有独立状态。A2为独立页面资产，需增加身份、返回及资产治理；不推荐。A3继续仅完整结果本地详情，无法承载云服务明细和Token局部日期交互。评审仅决定A1及声明方式，不重问业务口径。

候选局部声明片段（不是完整页面）：

```ts
type DetailDraft = {
  id: string;
  mode: 'snapshot' | 'query';
  filters?: string[]; // 保留现行隐藏输入，旧文档不迁移
  localFilters?: Array<
    | { id: string; type: 'singleSelect'; options: string[]; defaultValue: string }
    | { id: string; type: 'timePoint'; granularity: 'day' | 'month'; defaultValue: string }
    | { id: string; type: 'timeRange'; defaultValue: { from: string; to: string } }
  >;
  components: unknown[]; // 实际沿用既有受控详情组件闭集
};
```

候选：localFilters 的 id 必须在整页唯一，仅本详情源可消费；声明仍放详情内以表达所有权。初期复用现有筛选类型的严格结构，以上缩写不代替Zod定义。现行 filters 仍只接受打开时隐藏绑定，禁止localFilters复用同id或写入绑定的客户/账号。全页筛选值只读复制；允许本地显式声明覆盖自身日期范围，禁止通过同名覆盖全页过滤器。

Token例：`localFilters=[{id:'tokenDetailRange',type:'singleSelect',options:['hours24','days7','days14'],defaultValue:'hours24'}]`；模式经运行时具名窗口规则解析到已有时间筛选绑定，HOUR/DAY选择不同预定义查询分支，不能只改横轴字段。查询闭集分支的候选声明为 `queryModes: {filter:'tokenDetailRange', cases:{hours24:{source:'hourSource'},days7:{source:'day7Source'},days14:{source:'day14Source'}}}`；所有分支声明字段类型/单位相同、仅激活分支加载。该声明是额外协议增量，若当前查询表达已满足则不引入。h_tag未补证前不得冻结实际字段契约。

打开合计与明细的选择输入草案：`{kind:'all'}` 或 `{kind:'member', value: row.serviceCode}`。二者通过独立动作静态绑定；member缺值拒绝，all不是空字符串、不是省略必需参数。统一运行时选择已声明的全服务/单服务查询及既有filterBindings，不把SQL片段带入Page。Token合计模型同理；账号仍必需。

Module Interface（仅内部，不进入页面协议）：

```ts
createDetailSession({ page, viewId, openInputs, frozenPageFilters, clock, gateway })
// 返回 subscribe(listener)、setLocalFilter(id,value)、setTableState(id,state)、dispose()
// 创建前验证全部打开输入；失败不发请求。dispose幂等。
```

运行时拥有scopeGeneration、scopeFingerprint、requestGeneration。筛选指纹由规范化后的输入及业务筛选产生；分页/排序另外产生窗口标识。所有发布检查scopeGeneration和当前源请求代次；关闭/换行/全页筛选先失效再取消，不能依赖网络取消成功。请求失败发error，不重用旧成功快照；重试是当前会话新请求。表格层只发送状态意图，不持有取消句柄。

| 前态 | 事件 | 后态/请求/可见结果 |
|---|---|---|
| closed | open缺客户/日期非法 | closed + 受控错误；0请求 |
| closed | open snapshot | ready；0请求，读取当前主快照（loading/error照实呈现） |
| closed/ready/error/loading | open query B | 销毁A；新generation loading B，默认第一页/默认局部值 |
| loading | 当前详情返回 | ready/empty；仅同scope及当前request生效 |
| ready/loading/error | 翻页 | 页码改变；只加载明细窗口；合计/总数若同业务筛选仍可复用 |
| ready/loading/error | 排序 | 页码回1；查询排序经既有通道；不对返回窗口再排序 |
| ready/loading/error | 局部日期切换 | 新scopeFingerprint；受影响表页码回1；旧明细/合计/总数同时失效 |
| 任意打开态 | Tab/锚点切换 | 主页面内容状态依既定规则；不创建第二详情 |
| 任意打开态 | close/Escape | closed；dispose；恢复触发控件焦点，控件已消失则安全退回页面 |
| 任意打开态 | 全页筛选变化 | closed；dispose；保留筛选控件焦点，旧响应不得重开 |
| 任意 | 已销毁A晚返回/旧页响应 | 丢弃；当前B或closed状态不变 |
| loading/ready | 当前源失败 | 该数据槽error；不填0、不拿上一客户结果 |

正例：云服务明细翻到第2页offset10；Token近7改14只动详情。负例：snapshot带localFilters/query分页、主源引用局部筛选、局部筛选覆盖customer、详情导航/递归浮层、未消费的局部筛选、查询窗口声明complete参与跨源聚合，全部拒绝。

## B：明细/汇总/总数分离（推荐）

B1独立命名槽与表格投影；B2把合计插进主源会污染totalCount、页大小与排序；B3 widget识别旧REST信封会把查询逻辑带入呈现。推荐B1。

候选片段（借用 data 的命名槽概念，具体Zod扩展待批准）：

```json
{
  "data": { "main": "incomeDetails", "summary": "incomeSummary" },
  "props": {
    "pagination": { "mode": "query" },
    "fixedSummary": {
      "slot": "summary", "position": "top", "emptyDetails": "hide",
      "scope": "queryFilters", "expectedRows": 1,
      "fields": { "income": "totalIncome" }, "label": "合计"
    }
  }
}
```

所有显示列必须显式映射至summary字段或声明静态标签/空文本；禁止猜同名字段。数值类型、单位、币种一致，summary必须完整且恰好一行；0行、2行是契约错误，不自行求和。云服务主表emptyDetails=show，云服务明细浮层=hide；二者不同。summary中动作使用该槽显式绑定，不能偷用第一条明细的service。

总数不新增第二业务行：保持主源快照totalCount。设计夹具把上游Count单独记录，未来响应适配将其归一化成DataGateway已有totalCount；本轮不实现旧REST Adapter，不修改网关。若同一现有DQE查询无法返回所需总数，则标该消费者集成缺口，不在widget解析Count或扩协议。

业务筛选变化时明细/summary/totalCount一起失效；分槽loading/error可独立呈现，但禁止旧scope与新scope拼装。翻页不改业务口径，可复用同scope的summary；明细新窗口loading时不可显示旧窗口。summary失败允许显示同scope明细＋汇总错误提示；整表验收状态非全成功。

本地表过滤语义候选：scope=queryFilters表示汇总是独立查询口径，不随局部文本过滤改变，界面标“查询范围合计”；scope=filteredDetails只能对完整源按声明可加字段计算并有单独具名计算路径，初期不开放该值，避免伪装全量合计。消费者若要求过滤后总和，先补具体用例再扩展。

正例：总数25，第2页10明细＋1合计，offset10；空明细hide为0行，show为1合计。负例：将totalCount写26、汇总混进main、summary窗口不完整、单位CNY/USD不匹配、summary跨scope/失败当0、用query窗口做全局合计，全部失败关闭。

## C：闭集计算与显式策略（推荐）

C1按消费者具名扩展；C2改全局默认会破坏旧页；C3通用表达式增加不可控计算面。推荐C1。以下字段均草案：

| 候选声明 | 正例 | 负例/兼容 |
|---|---|---|
| sumFields.allMissing: null或zero | 机会点12月全null→0；部分null忽略、负数保留 | 缺省null；不把字符串/Infinity当0；与onMissing=null组合zero拒绝 |
| growthRate 的 onZeroBase/onMissingBase/onMissingCurrent: null或zero；scale | 概览100/0、100/null→0；客户相同→null | 策略显式；缺省仍按现有算子，不能自动替换delta+ratio |
| mergeByKey：keySet=left/union；keys元组；各源field/output；duplicates=reject/sum/orderedLast | 收入独有A、销毛率独有B→A+B；同指标序号后项覆盖 | orderedLast必须稳定序字段和唯一顺序；无顺序/相同顺序冲突拒绝；当前joinAggregate不改 |
| groupAggregate：groupBy、values{field,output,aggregate:sum,allMissing:null} | period_id相同100+null+200→300；全null→null | 不可折叠字段、币种不同、缺分组键拒绝 |
| timeFill.duplicates=reject/orderedFirst/orderedLast + orderBy | Token重复日orderedLast；客户双年重复月按来源find首项用orderedFirst | 默认reject；来源同月顺序证据不足则该消费者blocked，不凭数组偶然次序接受 |
| topN：n、nameField、valueField、remainderLabel、nullNameLabel；有限排序闭集 | 9/80/1000/50/20/30→1000/80/50/30/20＋其他9 | 稳定同值次序；不可加/分页窗口拒绝；特殊空名/空值次序依来源，不能只sort字符串 |
| 时间计划：queryWindow与referenceYear分离；referenceYear=system/page/maxValidData | 固定系统2026、页面2025，三趋势语义见fixture | 非法yyyyMM/空数据最大年无定义→受控空态；不读每个图表的new Date |

来源只有数组顺序而没有稳定业务序时，orderedFirst/Last仍需补最小顺序契约；不要求内部重做计算。序字段只是候选设计，不证明现有接口已经提供。组合键保留元组结构，严禁下划线拼接。

Token复合分组候选：`mergeGroups:{by:['customer','account'], columns:['customerIndex','customer','account','turnover']}`，窗口内只合并相邻完整组；计数单位显式标customer而非row。现有DQE offset/limit以什么单位工作必须证实，不能仅新增Page字段就声称按客户分页。缺完整组保证保持blocked；sparkline字段契约等trend_data补证后再定，不先引入任意JSON。

## 兼容与落点

- 6.11读取不变，新能力6.11拒绝；6.12现有未交付增量可选扩展，缺省保持旧行为。实施前核对6.12是否已发布，若改已发布语义应另增次版本。
- packages/page：真源、类型、版本能力检测、引用/作用域/单位/互斥校验；设计负例先落目标定向测试，再实现。
- runtime：详情会话/依赖批次/受控计算；runtime-ui：共享表状态和分槽投影；widgets：纯呈现与事件，无查询/业务计算。
- M2对应AC-02–08；M3对应AC-09–15/19；M4按页面补绑定/SDD；M6最后统一生成契约，不手改生成文件。
- 本包reference oracle只验证设计内在一致，不替代上述Module Interface的产品测试；新增行为仍not-run。

## 待本次评审的集中结论

建议批准A1页面内详情会话、B1独立汇总槽、C1闭集显式策略作为实施方向；同时审阅A的局部声明所有权与有限查询分支、B的空明细/查询范围合计语义、C的稳定序要求。批准方向后仍需按各候选字段定向用例冻结，不自动批准未知Token字段或DQE扩展。无需重问0/null、五页顺序、21入口范围、日期/Tab/浮层行为或客户接触延期。
