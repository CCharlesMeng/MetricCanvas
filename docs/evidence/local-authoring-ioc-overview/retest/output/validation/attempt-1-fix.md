# attempt-1 修复记录

- 校验退出码：1。
- 原始问题：`/dashboardToolbar` 不符合 Schema 6.18；对象分支只接受其受控常量，`variant: standard` 非法。
- 修复：将 dashboardToolbar 改为合法的 `visible`。筛选范围与 inline 数据限制继续由 `scope-text` 明示，不删除业务信息。
- attempt-1 已冻结且哈希检查退出码为 0，没有覆盖或重建。
