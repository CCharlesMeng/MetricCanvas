# DSL-20261027-paged-union-order-contract：前端生成非 DQE 排序结构

- 来源与日期：2026-10-27 用户反馈 region-auth-norms-detail 请求含 order.by，并明确仅需要各来源按自己的次数指标排序，随后授权完整修复及提交push。
- 操作与场景：指标查询交互排序、pagedUnion分页合并；相邻入口包括pagedJoin选页及行内查询子表格。输入Schema6.61，修复基线c0ebb8bc47dd676e9f83e6d21fb2b371402d839d（6.66），实际部署版本未知。
- 原始观察：请求order包含offset=0/limit=200及次数desc、姓名asc的by数组；旧申请规范率响应的最小次数序列为2、99，执行描述orders为空，合并检查拒绝逆序。新决策意见请求使用商审审批人决策次数和审批人决策次数(合同)，与旧申请规范率指标不同。
- 根因：网关将EffectiveQuery.sort编码成虚构by；合并器自动追加姓名/行键升序，且把等主指标行的行键逆序误判为业务排序错误；Sim及嵌入端点重复实现错误形状。ADR-0086从GraphQL字段指令推导对象DSL结构，缺乏服务依据。
- 修复：使用order_by_field/type，拒绝保存的by/orderByField与指标显式多字段；移除远端自动第二排序键和未请求的等值键比较。保留重复/空键、主排序、窗口完整性、计数、取消及资源限制。Sim同步，页面/文档/ADR和local-authoring派生物从产品真源重建。
- 回灌：docs/page-metadata/queries-and-bindings.md、data-sources.md、components/table.md及ADR-0086；安装包由authoring:contracts生成。
- 验证：202文件1846项相关测试通过，local-authoring完整6文件215项验收通过（部分重叠，不相加），类型和Playground构建通过。正式网关Mock路径验证418条等指标、逆序行键的跨200行批次合并。实际浏览器验证级联表、查询子表格及双来源分页合并。完整命令、测量口径与截图见[验收报告](../dqe-sort-contract-20261027/README.md)。
- 边界：真实DQE/Relay未复验。旧业务响应另有重复审批人键与合同字段为null，不得删除身份检查或虚构值绕过；需要上游模型与真实服务独立验证。原始业务数据与附件只保留用户本地，本文记录必要的脱敏结构和数值。
