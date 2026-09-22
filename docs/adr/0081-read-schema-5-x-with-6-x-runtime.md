---
status: accepted
date: 2026-09-17
note: 平台与页面试验场读取 5.0—5.4 后规范化为 6.x
---

# 6.x 运行时兼容读取 Schema 5.x

平台与页面试验场必须能够渲染 Schema 5.0—5.4 页面。5.x 的页面主体是当前
6.x Schema 的子集，因此在读取边界接受整个 5.x 已发布范围，校验后规范化为
唯一的 6.x 运行态文档；历史修订正文、内容哈希和修订身份均不原地改写，新建
文档仍只写 `versionPolicy.current`。

5.x 的站内 `page` / `carryFilters` / `setFilters` / `setParams` 导航在读取时
转换为 `/pages/{page}` 的 `href` / `query` 普通 URL 导航。携带筛选器按其值、
范围或层级分量展开为同名 query 键，行字段绑定转换为 `source: row`。

此兼容例外覆盖 5.0—5.4，其他跨主版本继续拒绝。它取代 ADR-0068 中“6.0
引擎遇到旧文档失败”的读取结论，但不恢复旧导航作为作者协议，也不改变 6.x
的唯一写出规则。
