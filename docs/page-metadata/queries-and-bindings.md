# 查询定义与显式绑定

当前受控查询语言为DQE。查询体遵循真实协议分支，模型不得拼任意SQL或表达式。filterBindings对象键引用页面筛选器；dimension目标必须声明queryField，time目标只绑定时间范围。页面字段id、筛选器dimension和DQE字段属于不同空间。

未绑定到某源的筛选变化不触发该源；绑定字段须存在于合法查询位置。paramBindings用于6.2维度初始化，目标唯一、共享源显式声明，不与同目标静态条件或多个参数竞争。页面只声明目标，不声明服务权限。

6.13 的 filterBindings `{target:"time",window:...}` 引用 timePoint，窗口使用明确的 period/yearToDate/monthToDate/lastN 等声明，保留查询 period/is_aggregate。没有 window 的 time 目标仍引用 timeRange。查询时间只能有一个筛选来源；窗口精度不隐式转换，绑定不得与固定起止/参数引用并存。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。
