# 审批人参数通过 DQE Sim HTTP 验收

2026-11-02，用户明确要求页面JSON干净、合成数据只在DQE Sim中实现、Network可见execute。此前内存网关已删除，不继续作为验收链路。

## 当前实现

- `pages/capabilities/table/record-join-query-params.json` 业务声明保持不变：没有inline源、rows、initial、模拟开关或专用网关配置。Skill导出仅沿用现有版本升级和格式化规则，业务声明一致。
- 删除Playground的 `record-params` 场景选择、专用页面/目录网关注入和 `apps/playground/fixtures/record-query-params.ts`。
- 默认数据网关经同源 `/rest/cdi/cdinl2databuilderservice/v1/dsl/execute` 发出真实HTTP，Vite只代理到服务端Sim。
- 夹具集中在 `tools/dqe-sim/fixtures/record-query-params.json`。Sim执行器按精确对象/补列查询签名处理条件、排序、计数、窗口和投影；不做前端字段映射或客户端响应拦截。
- 真实内网DQE仍未接入；本记录证明正式HTTP请求/编码/响应归一化/关联/渲染链路通过Sim。

## 服务与操作

独立工作树 `/Users/moon/.codex/worktrees/record-join-member-params/DataDashboard`。

```sh
DQE_SIM_PORT=18387 DQE_SIM_HOST=127.0.0.1 pnpm --filter @metriccanvas/dqe-sim dev
DQE_SIM_PORT=18387 pnpm --filter playground dev --host 127.0.0.1 --port 5187 --strictPort
node apps/playground/tests/record-join-query-params-browser.mjs docs/evidence/2026-11-02-record-join-query-params/http
```

18387为本工作树Sim（原18228服务属于另一个工作区，未停止或替换）；5187为本工作树Playground。打开 [审批人甲](http://127.0.0.1:5187/pages/record-join-query-params?approver-name=合成审批人甲)，Network过滤execute后刷新。

主场景产生3条POST，响应200且带Sim的x-request-id：

1. 对象主表，offset 0 / limit 2，filter.fields含 `审批人姓名 = 合成审批人甲`，返回A-1/A-2，总数3。
2. 对象主表，offset 2 / limit 2，同一审批人条件，返回A-4，总数3。
3. 基本信息补列，按商务ID的B-1/B-3读取，不含审批人条件，返回B-1的责任人。

页面显示3条审批，第一页两条同商务审批，第二页缺基本信息的A-4保留且责任人为空。不存在单独的审批人候选查询。记录模式完整快照建好后本地翻页，翻页不要求重复HTTP。

## 验证结果

- Sim新增用例修改前3项失败，修改后4项通过；检查完整总数/窗口、重复商务、补列键、无匹配、多参数和不支持条件拒绝。
- 正式网关 + 临时Sim HTTP + 统一运行时6项通过，候选值接口调用0；404真实HTTP响应保持DQE_TRANSPORT_ERROR，不返回部分关联结果。显式记录查询分页同样通过。
- 合并Sim/server/驳回/语义面/协议/运行时定向回归：6文件38项通过，Sim类型检查通过。
- 浏览器6场景通过，execute调用数依次为3、2、4、4、4、1；每个场景必须有HTTP且全部200，保存完整请求、响应与x-request-id到 `browser.json`。没有page.route或fetch响应注入。
- Playground检查0错误0警告，engine测试类型、tools类型、tests类型检查通过。
- local-authoring工具/独立Skill定向67项通过，页面参考8项通过。补齐页面参考测试中的实际页面输入注册，修复新增完整示例未被测试载入的问题。
- 契约重新生成与最终 `authoring:contracts:check` 通过；MC诊断夹具重生成。Skill升至1.14.14，复制到仓外后的独立校验器接受演示页和用户业务页，知识包含标准HTTP调用语义。
- 页面清洁检查通过；没有修改用户业务JSON的参数版，也没有修改产品查询执行或关联算法。

## 复杂度

工具 `metriccanvas-ts-ast/1`，TypeScript 5.9.3，以各函数selfCC计，闭包分别统计。详见 `complexity.json`。

- executeLocalDemo：3→3（只增注册项）。
- 运行时测试start：2→3（正式网关及测试失败端点）。
- 新Sim executeRecordQueryParams为15，outputFields为6，matches为10，windowResult为11，其余新辅助/回调不超过3。
- 删除的页面内存网关不再参与当前实现。页面/目录网关路由恢复原逻辑；新增Sim及其辅助函数无超限未关闭项。

代码未提交、推送或部署内网；工作树保留供当前预览和后续交付。第一阶段的完整Skill隔离回归记录保留在上级文件，本次没有把旧内存浏览器结果改写成HTTP结果。
