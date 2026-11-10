## 商务类型前端枚举（6.80）

入口 `/pages/table-column-enums`，内联合成编码0、1、9和空值。单元格显示项目商务框架、项目非框架、9、—。打开商务类型筛选直接看到两项中文枚举，选择项目商务框架仅保留 B-1；清空后导出 Excel，前两条为中文标签。枚举选项不请求候选接口；查询页仍使用原始编码过滤。业务页 `/pages/business-decision-all-details?approver-name=合成审批人甲&mtime=month:2026-11` 通过 DQE Sim execute 返回原始编码，再由前端映射。

复用用途：在保留原始编码的同时，为表格单元格、静态筛选候选和 Excel 提供中文枚举展示。

参考对象：完整页面 table-column-enums.json（原入口：`table-column-enums.json`），组件 `business-types` 的 `biz-type` 与 `numeric-code` 列；关注列的 `enumValues`、`filterable`，以及 `main` 数据槽引用的 `businesses.fields`。按组件及字段身份定位，数组下标仅表示当前文件位置。

移植边界：沿用目标页已确认的字段类型与原始编码，只替换有业务依据的标签映射；保留目标页的数据源、查询、筛选和分页方式。`businesses` 的合成数据仅用于演示，数值编码与字符串编码不能混用。单元格、候选和导出需要分别核对，结构合法不能单独证明三者行为一致。

可观察预期与环境：本页为 inline 合成场景，无需 DQE；按上文操作核对标签、未映射编码、筛选结果和 Excel。真实查询的下推行为另在对应 DQE 场景验收，本页不证明业务编码全集或真实服务兼容性。
