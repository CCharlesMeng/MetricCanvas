# 行权效率：区域层级与站点筛选

入口 `/pages/governance-compliance`，页面为用户提供的完整查询版，使用 Schema 6.112。启动 `pnpm dev:playground`；实际数据需要集成应用提供业务 DQE、组织候选及权限，不使用合成响应冒充真实结果。

四组“中国区 / 海外”按钮保持独立选择，默认“中国区”，查询值仍为“国内”。Region 处于 geo 层级或选中值为“全球”时显示并消费对应站点选择，包括 `region-dept=全球` 链接；进入具体地区部或代表处时隐藏按钮，四条站点绑定的 `when` 同时暂停各自谓词。期间、区域和客户分类绑定保留；返回全球恢复原站点选择，URL 继续保存该状态。

复现入口 `/pages/governance-compliance?mtime=month%3A2026-11&sdt-duration-site=国内&sdt-count-site=国内&biz-decision-site=国内&contract-decision-site=国内&region-dept=全球`：四张图表左上角均显示“中国区 / 海外”，切换其中一组只改变其对应查询；刷新保留选择。将区域参数改为具体地区部 `region-dept=海外地区部` 或代表处 `rep-office=巴黎代表处` 时，四组按钮隐藏且查询不带“国内或海外”谓词。示例组织名称仅供回归，实际取值需使用集成应用的授权候选。

参考对象为 `sdt-duration-site-filter`、`sdt-count-site-filter`、`biz-decision-site-filter`、`contract-decision-site-filter` 及各自页面数据源的同名站点绑定。移植时同步保留按钮 `visibleWhen` 与绑定 `when` 的条件，并映射目标页的层级 id、全球规范值、查询字段；只隐藏按钮不会自动暂停查询。

保留按钮组时不能直接删除对应的查询绑定，否则校验报“筛选按钮组需要至少一个查询通过 filterBindings 或查询模式消费”。隐藏后不筛选使用上述 `when` 暂停谓词；它保留各组的默认值和独立选择。

四张柱线混合图沿用引擎统一默认单位位置，页面不再配置 yAxis 单位补丁：时长双轴“天”、人数双轴“人”，商务及合同图左轴“个”、右轴“%”，刻度仅显示数字。系列单位、提示格式和原值刻度保留，百分比不乘100。

浏览器回归 `apps/playground/tests/governance-compliance-filters.browser.ts` 直接消费本页，使用拦截的合成响应覆盖全球 ready/empty/error、具体组织不带站点谓词，以及四图八条数值轴的轴顶单位；不代表真实 DQE 验真。

IOC 页头已从旧根级形状移到首分区首组件，保留标题、说明、筛选顺序与呈现设置。表格、指标、查询字段、排序、基线及原有正文条件沿用用户原件。旧版本引擎不支持 `when`；升级引擎后再加载该 JSON。

合成能力验收入口 `/pages/filter-binding-when` 覆盖同一层级条件下的按钮、查询、表格与导出，以及 empty/error 场景。业务页真实 DQE、权限与返回数据仍需实际接入验证。
