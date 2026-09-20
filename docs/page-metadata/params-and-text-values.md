# 页面参数与文本取值

旧数组参数：页面参数是一次初始化的不可变取值；筛选器是页内可变状态。标量参数保留string/number/boolean；6.2的dimension单值使用非空string，multiple:true使用非空、无重复string[]。URL多值用重复键，不拆逗号。标量/维度参数的非法URL输入回退唯一default；必需参数缺值会阻止呈现和查数。

文本取值引用为{param:id}，由声明取值并按可选format格式化；必需文本不能引用可能缺失的参数。initialParam只把实际参数用于筛选初值，不能与filter.default双默认；paramBindings显式指定查询目标，后续筛选清空不会复活原值。受筛选控制的目标不同时写静态参数条件。

执行回执的appliedInputs/filterValues是初始化权威；浏览器不再次用URL或模板默认覆盖。服务权限优先级不由Schema证明。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

可选参数缺失时，文本引用所在属性整体移除，数组位置按已有解析规则移除；必填文本只能引用必需参数。每个声明参数必须有消费者，6.2的查询初始化/筛选初值绑定也计入消费，既有conformance规则标识名保持兼容。参数格式要与类型相容；导航的`source:param`也是显式读取途径。


## 6.3 确定性时间参数

时间参数声明 `type: "time"`、`granularity: "month" | "date"`，值分别为真实日历的 YYYY-MM / YYYY-MM-DD（0001—9999年）。仅未提供URL键时使用default；显式非法、空串或重复时间键阻止初始化，不回退默认月份。时间文本引用当前支持原值展示，不接受数值或日期格式预设。

查询通过 `paramBindings.<参数id> = {target:"time",window:...}` 引用必需时间参数。每个查询只有一个时间参数来源，不与时间filterBindings共同控制；query.body内必须保留filter.time，不能同时声明start/end。month参数要求period=month，date参数要求period=day；这只是第一版接入限制，不是把输入精度与指标统计周期等同。

窗口：`{kind:"period",unit:"day"|"month"|"year",offset?:整数}` 表示完整周期（offset缺省0）；`{kind:"lastN",unit:"day"|"month",n:正整数}` 表示含基准期的最近N期；6.4新增 `{kind:"monthToDate"}` / `{kind:"yearToDate"}` 表示自然月/年起点至基准期，不读取系统今天，无需unit。旧 `{kind:"toDate",unit:"month"|"year"}` 保持兼容。月参数不能推断某一天；lastN单位须与输入精度一致（month→month、date→day）。日期计算为确定性日历算术，不读取时钟，不受进程时区影响；起止包含。生成窗口越出0001—9999年时报错。

运行时仅改副本中的查询起止，保留period、is_aggregate及指标；无数据呈现空结果，不回退最新期。时间绑定查询不消费没有参数执行凭据的source.initial旧行；经过prepareExecution核验的执行回执仍是权威。累计、同比/环比、历史预测版本、结果按小时分组与物理分区路由不由此规则计算。

## 6.6 分组参数与多个时间区间

params 增加对象分支：dimensions、times、scalars 均为可选非空数组，至少声明一个参数。dimensions 每项为 id、dim_name、可选 dim_value_list；times 每项为 id、granularity、可选且成对的 start/end；scalars 每项为 id、type 与可选 value。所有组的 ID 全局唯一，required 缺省 true，label 可选；新结构不接受 default。

维度统一非空去重字符串数组。时间精度 month/date，校验真实日历及起止顺序。多个 times 是独立输入，查询显式按 ID 选择；period 与 is_aggregate 留在查询侧。未填值模板允许校验与保存，但必需输入不全不能执行。

原位引用限于 DQE filter.dims[].dim_value_list 的 {param:id} 和 filter.time.start/end 的 {param:id,part:start/end}。时间两端同源、精度兼容，维度 dim_name 匹配声明；禁止与筛选/旧参数绑定双控或引用其他请求位置。执行前在副本解析，带引用的查询不消费未经核验的 initial 旧行。

文本区间显示 start 至 end，相同起止显示一次，维度多值用顿号连接。URL 维度重复键、时间值用编码后的 {start,end} JSON；未传使用保存实际值，显式非法不回退。旧数组/default/time-window 保持兼容，规范化保存不把分组改写为数组。
