---
status: accepted
date: 2026-10-29
note: 用户要求 IOC Region 只允许 Header 中单个树形下拉，并明确普通维度筛选保留；本次按已确认范围受控迁移，不保留 IOC Region 的旧写法
---

# IOC Region 只允许页头中的单个组织树

IOC 业务页此前允许平面 Region、外部层级按钮与隐藏切层，也允许把地区部和代表处拆成多个 Header 筛选。用户明确这些都不再是合法的 IOC Region 场景，并限定普通看板、报表的维度筛选不受影响。

使用 iocHeader 的页面中，公共输入 id 为 region 的筛选器只允许由 iocHeader.filterIds 认领的层级维度：display 为 tree，selection.mode 为 single，treeSelection 为 level，支持搜索，不声明 hierarchyPicker。节点选择一次提交原始值和层级；不按显示名或业务编码推测父子关系。该组织树的同一层级不能再拆成其他可见筛选；表格父级定位等不可见查询参数保留。候选结构、查询字段映射与 URL 的层级信息一起迁移。

普通维度保留已有平面、多选和层级展示能力；不全局删除通用 hierarchyPicker 字段。此处使用 IOC 的公共 Region 输入约定，不根据页面标题、标签或页面 id 猜测业务语义。

这是用户明确要求的受控迁移，收紧现有 IOC Region 声明而非纯增量扩展。识别并更新仓库合法页面、夹具、用例、参考文档和生成的独立校验器；旧版本声明不绕过新规则，不设置静默兼容或回退分支。它不构成 ADR-0051 下任意收紧或删除协议的一般豁免。真实接入方必须升级完整候选 Adapter，并分别验证业务字段与候选授权；本地合成树不是生产验证。
