# IOC 页头

普通组件外壳，属性复用旧 IOC Header。仅允许首 section 首位，span固定12，最多一个；跟随section条件和分组，不绑定数据源。身份、筛选认领、返回、只读、吸顶、导出及读取迁移语义由[页面模块](../page.md#ioc-页头进入分区681)统一维护。

完整合成场景：`ioc-header-section-placement`（混排与显隐）、`ioc-header-section-groups`（分组）、`ioc-header-section-sticky`（吸顶）。均可在Playground按页面id访问。

重点国代标准 boolean 筛选 `key-office` / `key-national-only` 勾选后默认覆盖 Region，页头和筛选声明无需添加 `overridesFilters`。Region 保留完整候选和最新选择；取消勾选后恢复 Region，时间、客户级别及权限继续生效。默认覆盖不提供名单，集成应用仍须完成授权名单桥接。详见[布尔筛选覆盖](../filters.md#boolean-filter-overrides)。
