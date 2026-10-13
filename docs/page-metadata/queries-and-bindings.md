# 查询定义与显式绑定

当前受控查询语言为DQE。查询体遵循真实协议分支，模型不得拼任意SQL或表达式。filterBindings对象键引用页面筛选器；dimension目标必须声明queryField，time目标不带window时绑定时间范围，带window时绑定时间点。页面字段id、筛选器dimension和DQE字段属于不同空间。

未绑定到某源的筛选变化不触发该源；绑定字段须存在于合法查询位置。paramBindings用于6.2维度初始化，目标唯一、共享源显式声明，不与同目标静态条件或多个参数竞争。页面只声明目标，不声明服务权限。

6.13 的 filterBindings `{target:"time",window:...}` 引用 timePoint，窗口使用明确的 period/yearToDate/monthToDate/lastN 等声明，保留查询 period/is_aggregate。没有 window 的 time 目标仍引用 timeRange。查询时间只能有一个筛选来源；窗口精度不隐式转换，绑定不得与固定起止/参数引用并存。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

## 查询结果绑定 6.14

query.resultBindings在下游查询声明source、field、target dimension、queryField和maxValues；读取上游查询的原始归一化string/number维度，去重集合作为普通维度谓词。每查询仍只有一项dsl_list。空上游不发请求；未知字段、计算产出、目标冲突、循环和超限拒绝；最大集合1000。上游须完整或声明有限limit且无offset/查询分页，局部表格视图不改变输入。新增级联链不复用缺输入证明的initial。
