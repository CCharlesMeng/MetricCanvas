# object 主成员的记录关联排序修复

2026-10-28。基线 main `9ee7e6ac6`，实现工作树 `/Users/moon/.codex/worktrees/object-record-sort-fix/DataDashboard`。

## 失败与修复

用户原始 `business-rejection-details` 为 Schema6.69、object审批主表与普通商务信息补列表的 `pagedJoin.records`。JSON校验通过，但 `recordReadOrder` 自动将9个输出字段转换为排序；默认object编码器拒绝未经适配的多字段排序，报 `DQE_CONFIG_ERROR`，HTTP调用数0。

新场景 `pages/capabilities/query/object-record-join-demo.json` 及回归先在旧实现上运行：7项全部失败，包含相同的请求前编码错误。修复后7项通过。指标与object成员统一保留显式查询排序，无排序时仅使用成员关联键升序；不添加第二键。显式多字段object排序仍被原有网关检查拒绝，不提供合成“可信”适配。

表格在完整关联后执行显示排序，记录行键与商务关联键继续分离，审批记录不去重。日期下推、补列、搜索、筛选、分页、导出、取消、超时与完整性检查的职责保持。

## 验证

- `pnpm test packages/data-execution/tests packages/engine/runtime/tests packages/page/tests`：176文件1554项通过。
- 六个直接相关执行测试文件：62项通过；新增object场景7项，以及商务页面object变体1项。
- `pnpm --filter @metriccanvas/data-execution check`：源码和测试类型检查通过。
- `pnpm validate`：120页面全部通过。
- 未改动用户原始JSON，使用正式SourceProgram及DQE编码器重放：HTTP调用1次，`order_by_field:商务ID/type:asc`、offset0/limit500，审批完成时间下推2026年9月闭区间。回执见 `original-repro.json`；响应是空行Mock，仅证明请求可以发出。
- 仓外复制完整local-authoring安装目录，独立校验新场景和用户原始JSON均通过；Skill修订为1.3.1。
- `pnpm mc:content:check`：契约导出、来源覆盖、32项MC测试及诊断夹具检查全部通过。使用项目锁定Python环境；诊断夹具由生成器更新内容摘要。
- local-authoring知识输出预算回归最初发现 `data.pagedJoin` 超出16KiB；精简产品正文后重生成，`tests/local-authoring-tools.test.ts` 全部32项通过，未放宽预算或截断知识。
- 首轮 `pnpm authoring:check` 的其他217项通过（含完整生成隔离检查）；该轮唯一失败是上述已修复的知识输出预算，后续独立重跑该文件32项通过。该首轮命令本身为退出1，不记为整条命令成功。
- 修复预算并重生成后的最终5文件复验：local-authoring工具、行展开、独立安装、升级及参考文档共188项全部通过；加上已通过的30项生成隔离检查，覆盖全部218项，无未关闭失败。

浏览器：5186来自本修复工作树，复用本地DQE Sim18228。`/pages/object-record-join-demo` 走标准HTTP网关，首屏24行、R024至R020；下一页R019；搜索B003保留R006/R005及合同金额3000；审批金额升序首条R001；补列合同金额下限12000得R023/R024。二月4条，东区及金额下限2700后仅R027，合同金额14000。截图 `browser.png` 与 `browser-filters.png`。原5173仍为主工作区版本。

对应产品说明：`PAGE-METADATA.md` 与 `docs/page-metadata/data-sources.md`；操作入口：`pages/capabilities/query/README.md`。协议参考、知识和分发清单由 `pnpm authoring:contracts` 从此工作树真源生成，未复制主工作区的并行生成物。

## 复杂度

metriccanvas-ts-ast/1、TypeScript5.9.3，自身CC逐函数测量（闭包和回调独立）：`recordReadOrder` 4→3；测试辅助 `responseFor` 6→7，扩展的业务回归回调5→8；新测试函数与全部回调CC1—5。均≤15，本次无未关闭超限项。原文见 `complexity-before.json`、`complexity-tests-before.json`、`complexity-after.json`。

## 证据边界

真实DQE/Relay未执行。关联键可能重复，单字段排序不能证明真实服务在相同排序值间稳定翻页；准确计数、跨批内容稳定性及权限仍需服务端验真。无提交、push或CI结论。

## 用户原始元数据渲染

用户随后要求直接展示其元数据。将原始附件全文不作改动粘入修复版5186的JSON即时预览，契约有效；标题“商务驳回明细”、2026年9月期间、全球/地区部/代表处切换、说明文字和完整11列表头均呈现。截图为 `user-metadata-render.png`，未注入合成行或写入initial。

该预览使用真实本地HTTP链路调用DQE Sim；`Business/Commercial Review Rejection Details` 不在Sim支持对象中，回执为 `DQE_SIM_UNSUPPORTED_QUERY / object 合成场景不支持此查询`（见 `user-page-live-sim-response.json`）。运行时表格投影为空态，不能解释为真实商务数据0条。原始元数据的真实行结果仍须连接用户实际DQE环境验证。

用户随后授权模拟完整运行，已新增该对象与商务补列表的专用Sim分支，并将业务页面保存为用户原文。最新结果见 [原始元数据模拟完整运行](simulation/acceptance.md)：1205条审批、责任人与生命状态补列、筛选、分页以及两份浏览器实际下载的Excel均已验收；上述unsupported记录保留为新增模拟分支前的历史现场。真实DQE/Relay仍未验收。
