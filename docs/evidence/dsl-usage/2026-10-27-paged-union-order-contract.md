# DSL-20261027-paged-union-order-contract：来源排序与合并比较规则不一致

- 来源与日期：2026-10-27 用户提供 region-auth-norms-detail 页面、请求及返回结果，要求落盘并定位修复方式。
- 操作与场景：DQE 排错；审批人 × 代表处的两个指标查询使用 pagedUnion 逐行合并。
- 版本与环境：输入 Schema 6.61；诊断源码为本地 origin/main 54021ab6776c37c8e7e5f669e6c76cc88a3d7a48（Schema 6.66）；用户实际部署版本未知；当前脏工作区并非该版本。
- 预期与实际：按审批次数 desc、成员稳定键 asc 读取有序流；返回序列前两行值为 2、99，抛出 DQE_ROW_CONTRACT_ERROR。两份响应执行描述 orders 为空。
- 最小复现与证据：`../region-auth-norms-detail-20261027/replay.mjs` 抽取固定版本真实排序检查，200 行与最小二行样本均复现；交换二行通过。完整附件仅本地，结论见[诊断报告](../region-auth-norms-detail-20261027/README.md)。
- 定位结论：请求的主排序未生效；尚不能区分服务不支持 order.by、字段解析失败或转换丢失排序。ADR-0086 已注明指标排序编码待真实复验。另有商务成员键重复、合同成员键全空，需分别修正。
- 修复与回灌：修正实际指标服务排序适配；提供符合行粒度的稳定唯一非空键；核实合同字段所属模型及可组合性。不得局部重排一批来掩盖错误。已将症状到相邻行比较、原始订单描述和键检查的定位方法补入 local-authoring 的作者维护 reference `references/local-workflow.md`。未改生成知识、校验器或产品协议。
- 验证：原页在指定源码快照结构校验通过；原始响应归一化通过；排序/重复键/null键源码回放通过。真实 DQE 重查、完整跨批数据及浏览器未验证；Skill 完整独立分发验收未执行。
- 状态与待办：待验证。诊断结论已确定，真实服务修复、稳定唯一键返回和 Skill 分发验证待完成；修复步骤在上述报告，不自动创建 Issue 或交付变更。

## 同日用户纠正

仅要求两个来源分别按自己的审批次数指标降序；`order.by` 是未经验证的前端编码，不能要求后端扩展语法。修复目标改为现有 `order_by_field/type` 单字段格式，并同步调整合并器自动追加姓名次序和等值比较的约束。已保存修正请求 `request.single-sort.json`；未改运行时，未进行真实服务复验。此前“后端补齐多字段排序”的建议撤回。

## 同日补查：决策意见明细请求仍含 order.by

- 用户新样本为 KPI + 商务决策意见 + 合同决策意见三项批量请求；商务主排序为“商审审批人决策次数”，合同为“审批人决策次数(合同)”，并各有姓名升序。此样本不同于原记录的申请规范率请求，不能混用指标修正。
- 当前工作区 `packages/data-execution/src/dqe/dqe.ts:643-675` 的 `effectiveDqeItem` / `encodedDqeItem` 仍无条件把生效排序数组编码成 `order.by`。用 `node --import tsx --input-type=module` 直接导入 `effectiveDqeItem`，输入空 order、offset=0/limit=200 及商务次数 desc/姓名 asc，实际输出与新样本的 order 一致；断言 `order.by === undefined` 失败。未请求真实服务。
- 源头依据仍是 ADR-0086 将 GraphQL 字段指令 `@order(type, priority)` 推成对象 DSL 的 by 数组；`docs/evidence/中间层分析.md` 描述的是非标准 GraphQL，并未提供对象 DSL 支持 by 数组的证据。此处是前端适配缺陷，不能将修复责任转成后端扩展语法。
- 已保存的 54021ab 源码快照 `source/plan.ts:25-35` 证明 pagedUnion 自动追加成员行键升序并设置 200 行读取批次；该证据适用于这个源码版本，用户当前部署版本未知。
- 版本差异：本次读取的 `region-auth-norms-detail.json` 中，决策意见明细是单个 query（“决策总次数”“有效意见占比”及“类型”维度），不是用户样本的两份决策查询。当前编码器克隆查询体并改筛选/分页/排序，没有把这一份查询拆成用户样本两份的逻辑。实际加载页面/构建需核对；不能仅凭磁盘文件认定线上加载同版。
- 本次仅补充诊断证据，未改产品可执行代码、页面 JSON 或 Skill；既有 local-workflow 定位方法继续适用。生产修复及真实 DQE 验证仍未完成。

## 同日运行时修复：本地验收完成

- 独立工作树 `/Users/moon/.codex/worktrees/dqe-sort-contract/DataDashboard`，基线 c0ebb8bc47dd676e9f83e6d21fb2b371402d839d。已修复指标网关单字段编码、默认排序解析、合并等值行检查，以及关联选页/子表格自动追加第二排序键；by/orderByField在HTTP前明确拒绝。Sim、嵌入端点、页面示例、流水报表旧拼写、协议文档、ADR和local-authoring派生物同步。
- 最终202文件1846测试通过；local-authoring完整6文件215测试通过（部分与前项重叠，不相加）；类型、Playground构建、产物一致性、独立校验原页面和三条浏览器场景通过。正式网关批量路径已验证418条等指标逆序行键跨200行批次合并。
- 证据报告保存在该工作树 `docs/evidence/dqe-sort-contract-20261027/README.md`；带复杂度前后全量JSON与四张浏览器截图。新增函数/测试回调selfCC均不超过15，存量超限Sim函数下降或不增长并留明细。
- 未推送或部署，不能认定用户正在运行的实例已更新。真实服务无可用本地认证配置，未复验；原响应重复来源键/合同字段为空仍为独立业务数据契约问题，不以删除检查或虚构值绕过。基线ADR索引缺失链接单列，不冒充通过。
