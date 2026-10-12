# 页面参数原位引用：验收用例

状态：本仓用例已执行，逐 AT 证据、全仓基线失败与外部未验证项见 [verification.md](verification.md)。对应 [tasks.md](tasks.md) 与 [Spec](../2026-09-17-page-template-inputs-spec.md)。

| ID | Given / When / Then | 负责任务 |
|---|---|---|
| AT01 同构文档 | Given 一份新版无值模板；When 填 params.value；Then 两份均通过同一结构 Schema，除 value 外文档不变，无额外模板包装 | P1、P7 |
| AT02 类型与必填 | Given 单/多维度、日期/月区间及旧标量参数；When 提供合法值或空数组、重复值、错精度、非法日历、value/default 并存；Then 正例接受、反例定位报错，新查询参数必填 | P1、P2 |
| AT03 缺值不执行 | Given 结构合法但缺必填值且有旧 initial 的页面；When 打开；Then 零 DQE 请求、不显示旧 initial、报告缺哪个参数，不省略条件查全量 | P1、P3 |
| AT04 受控引用 | Given 未声明 param、错误 part、双端不同参数/window、未授权位置引用和旧版本新语法；When 校验；Then 拒绝；普通业务数据中同名对象不被递归误替换 | P1、P2 |
| AT05 解析确定性 | Given 固定页面与规范输入；When 两次解析并核对原稿；Then 输出语义一致且原稿不变，单值转一项列表，多值/日期窗口正确，文本与查询同源 | P2、P3 |
| AT06 提取身份 | Given 同维度同值、同维度异值、同名跨域及仅用于 groupBy 的字段；When 批量提取；Then 只对有依据的同语义同值归并，异值/无身份依据分开，分组不提取 | P4 |
| AT07 选择与覆盖 | Given 全部、多数、少数和单查询候选；When 展示并修改勾选；Then 默认规则准确、覆盖可追溯，未选条件不变，用户选择决定产物 | P4、P5 |
| AT08 筛选接管 | Given 参数同时初始化一个筛选而另一个查询保持固定输入；When 修改及清空筛选；Then 受控查询跟随筛选且不复活参数，另一个查询仍保持固定输入，不叠加谓词 | P3 |
| AT09 无值保存与空结果 | Given 原值已预览的候选；When 保存模板并用无数据期间重新执行；Then 保存文档无所选 value/default、无 query initial，执行呈现空结果，不回退其他期 | P3—P5 |
| AT10 原值回填与迁移 | Given 已验证查询或旧 paramBindings 页面；When 提取/迁移并用原值解析；Then 各查询条件语义等价，period/lastN/yearToDate 保留；不等价时拒绝，不能强行升版 | P2、P4、P7 |
| AT11 输入权威与发送 | Given 显式外部输入及冲突 URL/历史/旧值；When 初始化；Then 本次有效值不被覆盖，非法显式值失败不回退，最终 DQE 无引用对象且原字段拼写不变 | P2、P3 |
| AT12 命名稳定 | Given report-period 声明及 report_period 输入、重复提取与 label 修改；When 校验/提取；Then 错名不被自动兼容，同语义 ID 稳定、异语义不合并，DQE snake_case 保留 | P1、P2、P4 |
| AT13 确认完整性 | Given 已预览候选；When 源修订、选择或实际输入变化后复用旧确认；Then 拒绝；合法填值预览不因物化差异被误判篡改，未声明结构差异仍拒绝 | P5 |
| AT14 保存与程序通道 | Given 可信创作候选和用户确认；When 成功/未知/取消/陈旧回执；Then 仅可信成功回执可称发布，未知不重写，完整页面不经模型转抄，不依赖 Java 未声明 lookup | P5、P6 |
| AT15 独立交付 | Given 不装渲染包、不连接 Relay 的消费者；When 调用解析模块与完整向量；Then 得到明确输入/输出或错误，可交普通 DQE，TS/Python 校验一致，未新增实例存储 | P6、P7 |

执行证据已记录 verification.md，明确区分本地替身与真实提供方；完整 Tokens 示例贯穿 AT01、AT05、AT06、AT07、AT09 与 AT11。E1 真实联调未执行。
