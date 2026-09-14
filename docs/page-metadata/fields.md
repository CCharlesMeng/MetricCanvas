# 结果字段契约

页面字段id是dataSources.<id>.fields的键；queryField指向DQE输出，两者不可隐式当成同一个名字。dimension用于分类，measure用于数值计算，detail承载受控明细；字段类型、角色和nullable必须与真实结果匹配。

query支持平铺和按角色分组的文档字段写法，normalize保持原始文档，运行时解析才展平。一个DQE输出应唯一映射到页面字段；派生字段不带queryField，必须由compute产出。

recordList使用显式items.fields约束每条嵌套记录，限制在已支持的明细呈现。collapsible:true是小计/合计的显式授权，不能从measure角色推断可加总。格式只影响显示，不修改原数值。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。
