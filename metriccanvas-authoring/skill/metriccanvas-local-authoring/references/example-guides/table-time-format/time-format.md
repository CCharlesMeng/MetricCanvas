## 时间格式与固定 UTC+8

入口 `/pages/table-time-format`；页面为 inline 合成数据，无 URL 参数、无需 DQE。运行 `pnpm dev:playground` 后直接打开。原始 ISO、偏移、无时区、斜杠、紧凑结构和秒/毫秒数字字符串均显示相同 UTC+8 时刻；首七行时间应为 `2026-11-10 02:30:00`，跨年为 `2027-01-01 02:30:00`，非法日期保留原文，空值显示 `--`。右侧另有 `YYYY-MM-DD`、`YYYY-MM-DD HH:mm`、`HH:mm:ss`、`YYYY年MM月DD日` 四列；首行分别为 `2026-11-10`、`2026-11-10 02:30`、`02:30:00`、`2026年11月10日`。点击表格导出 Excel 核对各格式列与页面文本一致，空值保持空单元格。此页仅验证前端转换与本地导出，不代表真实 DQE/Relay。

复用用途：将表格中的多种时间输入统一转换为固定 UTC+8 的显示文本，并让表格与 Excel 使用相同时间格式。

参考对象：完整页面 table-time-format.json（原入口：`table-time-format.json`），组件 `times` 的 `createdAt`、`dayAt`、`isoDayAt`、`minuteAt`、`clockAt`、`chineseDayAt` 字段引用及其 `format:{type:"time",pattern:...}`；`records.fields` 保留原始字段类型，`raw` 列用于对照输入。

移植边界：映射目标页已有字段及数据槽，保留查询、筛选、分页与导出关系，仅移植已确认的时间格式。无时区输入按 UTC 解释，显示固定 UTC+8；不要把格式展示当作业务时区转换或改写源值。合成记录、列标题和文件名不作为目标页业务数据。

可观察预期与环境：使用上文 inline 入口检查普通、跨年、非法与空值，分别核对页面文本及 Excel。本文描述操作预期，指南未声明本轮结构、浏览器或导出已执行；真实 DQE/Relay、权限和业务时区口径另验。
