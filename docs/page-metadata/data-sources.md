# 页面数据源与初始行

页面数据源使用inline静态行或query受控查询。源id来自dataSources对象键，组件data槽引用它。每个数据源声明结果字段契约；数据快照ready/empty/error是运行态，不回写文档。

query.initial保存捕获时间和匹配该查询的初始行，只能在当前条件与声明初值匹配时使用；变更后由网关查询。执行bootstrap初始结果另走执行端口，条件标识与查询定义一致才复用，不与旧initial混用。查询分页需有效totalCount，失败源沿现有错误分类隔离。

可选compute作用于已归一化行集。inline行使用页面字段id；query结果经queryField映射。静态JSON通过校验不证明真实DQE成功。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。
