# 商务决策明细：审批人下钻筛选

页面：`business-decision-all-details.json`，沿用户提供的业务 JSON 局部修改。主目标是 URL 查询参数 `approver-name` 经主表的 `paramBindings` 下推到 DQE 字段 `审批人姓名`；它不是维度候选筛选器，商务基本信息补列不消费它。标题继续读取同一个参数。

入口：`/pages/business-decision-all-details?approver-name=合成审批人甲&mtime=month:2026-11`。

本地预览使用 DQE Sim 的合成数据，页面不包含 inline、initial 或专用模拟开关。在当前工作树分别启动：

```sh
DQE_SIM_PORT=18387 pnpm --filter @metriccanvas/dqe-sim dev
DQE_SIM_PORT=18387 pnpm --filter playground dev --host 127.0.0.1 --port 5187 --strictPort
```

浏览器 Network 过滤 `execute` 后刷新，可检查对象主表请求的 `filter.fields` 含 `审批人姓名 = 合成审批人甲`，补列只带原有区域／代表处业务条件及商务 ID 关联条件。没有独立审批人候选查询。组织树候选由 Playground 复用现有 IOC Region 合成候选 Adapter 提供，业务数据仍经标准 execute HTTP 查询 Sim。

验收：甲共24条；将参数改成乙共6条；无匹配姓名显示空结果；省略参数共30条。原有期间、区域、搜索、商务类型筛选、导出和本地完整关联分页保留。IOC Header 承接标题、期间、单选组织树及原说明。根据用户最新收口重点，本轮不切换后端分页，也不添加未经真实数据上下文确认的记录唯一字段。

此页需包含记录成员独立消费参数修复的引擎／校验器。生产 DQE 字段、权限、数据与稳定分页未由 Sim 证明。浏览器证据见 `docs/evidence/2026-11-02-record-join-query-params/business-page/`。

商务类型使用6.80列声明 `enumValues`：字符串0显示项目商务框架，字符串1显示项目非框架；表头是前端完整枚举，不请求动态候选，筛选仍提交原编码。单元格与Excel均显示中文。需要本轮支持列枚举的引擎；此能力不改变审批人参数或既有分页。
