# 查询结果绑定的行过滤扩展

日期：2026-10-14。用户已认可方案并授权落盘、实施与验证。范围是用原始维度或度量字段筛行，再提取原始 string/number 维度集合作为下游输入；指标值集合目标不在本批。

## 目标与协议

A 的原始结果供完整展示和多个下游复用。B 在 `source.query.resultBindings[].where` 声明自己的输入过滤，不修改 A 的行、总条数、计算声明、筛选状态或 URL。

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

where 缺省维持旧行为。叶子支持 eq/ne、in/notIn、gt/gte/lt/lte、isNull/isNotNull；组合支持非空 all/any，最多4层组合、64个叶子，每个集合最多1000个字面量。节点严格互斥，不接受表达式、函数、任意路径或未知键。

字段只引用同一上游查询源的有 queryField 映射的标量字段。string/date/datetime 用字符串等值或集合比较，boolean 用布尔值，number/money 用有限数值；有序比较只允许 number/money。值不强转、字符串不裁剪。金额与数值使用契约原始单位，不受格式或显示精度影响。null 在普通比较中均不匹配，包括 ne/notIn；空值判断必须显式声明。条件值首版仅字面量，不读取筛选器或页面参数。

## 执行与失败

执行顺序：等待原始快照 → 核验声明范围与字段契约 → 验证过滤输入字段 → 筛行 → 提取维度 → 保留类型去重与排序 → maxValues检查 → 普通维度谓词。maxValues作用于过滤去重后的集合，不能先截取上游。响应字段契约违规不因过滤而被掩盖；被过滤掉的合法null维度不需要提取。

A未就绪时B等待；A失败时传播错误；过滤后空集合不发B请求；选中行维度缺失、null、空白、类型错误与超限使B失败，不静默丢弃。B自己的输入错误不修改A或其他消费者。多个绑定仍是独立IN集合的AND，不支持元组相关性。

A的完整性按其声明范围判断。显式Top5只能在5行内过滤；完整范围必须resultScope complete，不能用查询分页窗口。过滤/提取不消费compute产出，原始查询和计算依赖图维持分离。

刷新沿用下游失效、取消、代次和生效查询缓存。过滤规则不进URL。导出从本轮原始结果解析同一绑定。所有执行环境调用同一规则实现，不增加独立调度或查询协议。

## 版本、职责与交付

基线6.18，能力增量6.19；无where的旧文档保持语义，旧版本声明where明确拒绝。同步公共类型、Zod/JSON Schema、TS/Python语义校验、版本能力门禁、共享契约向量、文档与独立本地创作Skill。协议正文在docs/page-metadata/queries-and-bindings.md，教程在docs/cascading-queries.md，PAGE-METADATA.md保留导航。按产品真源生成分发物，避免混入其他任务未完成的能力。

混合主工作区中共享取数模块正在提取。此批以独立干净检出实施：当前执行解析在engine/runtime，过滤规则由page内部Module提供；共享取数包迁移解析代码时复用同一规则，不能分别重写。

## 实施与验收

1. 类型、受控条件结构、字段语义校验、版本门禁；TS/Python共用向量。
2. 纯过滤规则与查询输入解析；保持A不可变、过滤后空集合短路及合法键验证。
3. 新增完整查询级联页面：同一A完整展示，B/C各自过滤；运行时/导出、刷新竞态、空值、类型、组合、去重、超限与错误传播回归。
4. 生成并核对产品契约、Bundle与独立Skill；公共API、类型、页面校验与相关测试。
5. 记录本地结果；真实DS、DQE、Relay、Java与部署验收分别报告，不以夹具代替。

## 状态

本仓实现与本地验收完成。6.19协议、条件闭集、TS/Python校验、浏览器/导出、产品契约、Bundle和独立Skill已完成；主工作区共享取数解析也已接入并通过单次执行回归。完整干净产物位于codex/query-result-where独立检出，主工作区其他分发差异保持。未开展真实DS、真实DQE、Relay、Java或部署验收，未推送。验收记录见docs/evidence/query-result-where/acceptance.md（独立检出）。

## 5173验证入口（首轮排序场景）

页面：pages/query-result-where-page.json。打开http://localhost:5173/pages/query-result-where-page；缺服务时在仓库根执行pnpm dev:dqe。本地仿真数据位于tools/dqe-sim/fixtures/query-result-where.json。

首轮projects查询体明确声明order为{"order_by_field":"金额","type":"desc"}，不带limit/offset，完整返回8行。页面按金额从480万元降至30万元显示所有项目。B筛选进行中且金额>100万元，传P-001/P-005/P-008集合并返回3行评估；C筛选进行中且金额<=100万元，传P-003/P-006集合并返回2行评估。下游查询各自也声明金额降序；集合为稳定谓词排序，展示顺序由各查询排序决定。

金额与执行周期列可点击调整已返回完整行集的显示顺序，Shift+点击追加显示排序。首轮请求排序和表格显示排序是两个明确阶段；不新增级联上游的运行时查询排序/窗口选择语义。请求层重查排序若需要改变有限主集合，另行设计，不能解除既有守卫后直接使用。

页面有紧凑页头、完整项目名称、金额/状态/周期和两组评估结果。5173实际浏览器已验证首轮降序、金额列升/降序切换与下游集合保持；本地HTTP及原有SDT回归共7项测试通过，DQE Sim类型检查通过。截图见docs/evidence/query-result-where/sorted-preview.jpg。
