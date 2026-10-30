# 商务驳回明细：每页10条与对象列候选

入口：`/pages/business-rejection-details-pagination-10`，无需URL参数。默认服务地址为 http://localhost:5173/pages/business-rejection-details-pagination-10 。当前本机人工复验可使用5198，独立交付复验使用5199；使用前核对端口所属checkout。

在两个终端分别运行 `pnpm sim:dqe`、`pnpm dev:playground`，或用 `pnpm dev:dqe` 联合启动。默认DQE Sim端口18228；端口被占用时两侧设置相同 `DQE_SIM_PORT`，Playground用 `pnpm --filter playground dev --port 5199 --strictPort` 指定空闲端口。CloudIOC真实环境按页面试验场接入说明配置，不能把Sim当作真实DQE验收。

JSON沿用户提供的审批明细元数据修改：主源为object查询，`order`初始为审批时间desc、limit10、offset0；`business-basic`只按当前页去重的商务ID补充责任人与生命状态。表格按商务ID补列，保留同商务的每条审批，不将商务ID当作唯一审批记录标识。原全量关联页 `/pages/business-rejection-details` 保留作对照。

## 人工检查

1. 默认2026年9月，第一页序号1—10，下一页11—20。Network中主请求limit10、offset0/10，响应data长度10；total_count1205是匹配总数。
2. 打开审批阶段筛选，应包含初审、复审。只选初审后总数603，明细仍每页10条。审批结果候选为驳回，且保留阶段条件。
3. 候选可能在空闲时预热。对象候选只请求目标字段（阶段名称或审批结果），保留区域、审批期间、其他列条件，排除本列条件。默认order为空，不读取其他审批输出字段；显式配置候选行数上限时，投影也遵守上限并限制响应窗口。
4. 模拟器不执行DISTINCT：默认9月候选可返回1205个单字段值，前端验证完整性后去重成两个阶段。候选请求不是当前10条采样，也不是完整审批明细的全字段读取。缺总数、截断或超限时明确失败，不展示部分候选。
5. 10月8条；11月空。责任人缺失仍保留审批记录。区域筛选另有组织候选请求，不与审批明细或表头列候选混淆。

## 数据与能力边界

所有审批与商务信息由 `tools/dqe-sim/src/rejection-details.ts` 生成，为合成数据。9月1205条、10月8条，同商务保留多条审批，含一处商务信息缺失。原字段“审批完成时间/审批人姓名”与本页“审批时间/审批人名称”使用相同合成值保持兼容。

生命状态来自当前窗口补列，未提供全局生命状态筛选。窗口级联导出保留捕获窗口，不等同原全量关联导出。商务编码包含搜索须接入可信搜索编码器；不会只搜索当前页。相同审批时间的服务排序稳定性、真实字段权限及默认返回上限需真实服务复验。

对象参数与用户原始范例见[查询协议](../../../docs/page-metadata/queries-and-bindings.md#object-query-parameters)。验收与复杂度见[本批记录](../../../docs/evidence/object-query-candidates-20261030/README.md)。
