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

## 2026-11-02：Region 默认 URL 输入

用户确认地区部和代表处以不同参数名表示层级：`region-dept=value` 与 `rep-office=value`，同时出现时按 URL 顺序取最后一项，重复同名键也遵循此规则。用户进一步否定额外的页面映射层；正式实现是 IOC Header 的默认行为，页面只保留原有 Region 组织树和 Header 认领。固定参数对应层级 ID region-dept / office，兼容已有 department 地区部 ID，不从业务值猜测层级。普通页面不隐式启用，目标输入契约由实际 Header 推导上下文；旧 value/level 兼容，候选与查询绑定保持。未发布的通用 urlParams.byLevel 字段撤回，不新增 Schema 能力下限。完整合成入口 `ioc-region-url-demo`。

## 2026-11-12：重点国代统一与 Region 取交集

用户明确批准统一交集口径。标准 boolean `key-office` / `key-national-only` 勾选后同时保留 Region 和完整授权重点名单；未选 Region 或选全球时仅受名单限制，非重点代表处与名单的空交集返回空结果。历史显式 Region 覆盖保持可读但不再生效，其他普通布尔筛选的显式覆盖能力保持。字段净增减为零，不增加配置开关、版本分支或页面逐一迁移要求。引擎负责执行交集、候选约束、初始快照安全及导出一致性；集成应用按标准筛选身份桥接完整名单，不再根据“是否覆盖 Region”识别重点国代。真实名单、权限和 DQE 接线仍需在实际环境验证。
