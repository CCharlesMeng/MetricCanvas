# B4证据账本

## AC ↔ 证据映射

| AT | 状态 | 执行环境 | 证据记录 | 新鲜度 | 说明 |
| --- | --- | --- | --- | --- | --- |
| AT41 | PROVEN | contract | BE-41；vitest；browser | 当前依赖哈希 | day/month/ISO周、ISO所属年、整组URL、每模式记忆及非法整组拒绝；旧period/单月/datetime回归 |
| AT42 | PROVEN | contract | BE-41、BE-46；vitest；installed；static | 当前依赖哈希 | 静态case穷尽/同输出契约、所有叶子校验、公共执行/快照/缓存/seed/initial/导出使用同一冻结选择；本地Node HTTP验证，不代表真实Relay |
| AT43 | PROVEN | mock | BE-42；vitest；browser | 当前依赖哈希 | 同次时钟、含锚点日的N天、完整日历月、显式anchor及禁选区间内点拒绝 |
| AT44 | PROVEN | contract | BE-43、BE-46；vitest；browser；installed | 当前依赖哈希 | 可信快照/订阅、latest与complete分离、合法URL优先、修订/时区/完整自然期边界、相关门禁与身份隔离 |
| AT45 | PROVEN | contract | BE-44、BE-48；vitest；browser；installed | 当前依赖哈希 | V2完整mode/time/dims及12日历月窗口、离散1/3月、模型交集、迟到/失败隔离；无V2不降legacy |
| AT46 | PROVEN | contract | BE-45；vitest；browser；artifacts/panel-geometry.json | 当前依赖哈希 | max/min/blocked/disableFuture、只读/ShadowRoot；4页三宽度及ShadowRoot共13帧，水平溢出/重叠/裁断最大值0 |
| AT47 | PROVEN | contract | BE-41、BE-43、BE-44、BE-46；browser；static；installed | 当前依赖哈希 | 4个实际pages、HTTP请求/结果/XLSX/静态一致；冻结导出；B0–B3与期间/详情/离散月份回归 |
| AT48 | PROVEN | contract | BE-47；vitest；python；authoring；bundle；complexity；installed | 当前依赖哈希 | 6.35正反契约、原子创作/编辑/回滚/保存重开、Skill与Bundle、六包仓外Node/浏览器闭环 |

contract为本地合成HTTP及已声明产品接口契约环境；mock为冻结时钟的合成测试。真实DQE、CloudIOC、Relay、DS模型、门户、私有周编码、CI和部署均NOT_RUN，不以本地PROVEN替代。最终完整源码指纹见evidence/code-manifest.json；267文件2346通过、5跳过，550 Python含1跳过；37源码与30安装包浏览器。

## 因果与还原证据

4个新页面为新增实现；纯逻辑用例直接覆盖正反契约。窄屏双日历的实际阻力另以同一冻结R6契约复现RED：弹层内部溢出184px；修正为纵排后13帧最大值0，5条规则GREEN。原始几何、前后截图及契约哈希见evidence/artifacts/panel-geometry-red.json、panel-geometry.json与render-matrix-red/green.json。两份报告使用同一contract_sha256；不把新增页面统称为免RED。

最终候选生命周期审查额外复现：anchorFact变loading后，旧成功回执能覆盖基础候选槽，旧失败后恢复也可能不重新请求。已增加加载器原子不可用操作，取消/推进代次/清回执并发布unavailable；2个单元与2个浏览器负向用例在同一场景转GREEN，恢复使用新请求。RED/GREEN命令见candidate-red/green.log。

## 计划外承接

| 文件 | Task | 原因 |
| --- | --- | --- |
| SourceProgram/session、execute、orchestrator、RuntimeSurface及ExportView | T2 | 承接已批准共享边界，合法URL先于动态默认求值；冻结同次时钟/事实/修订，阻止旧initial/seed/captured query绕过当前门禁 |
| 旧普通query.body消费者及测试 | T1/T2 | query联合类型需显式普通叶子或静态case遍历；保留原行为，不进行业务迁移 |
| navigate/schema/navigation与平台时间编辑接缝 | T1/T4 | mode/from/to深链必须完整；模式时间程序保持原子编辑，避免平台旧单body编辑路径破坏联合契约 |
| DatePicker.svelte与日历辅助Module | T3 | 完整自然期间限制、禁选内点、ShadowRoot及窄屏双日历实际溢出修复 |
| interaction_editing.py、Interface、产品生成知识与独立Skill/Bundle | T4 | 时间声明与全部静态查询case一次提交，复用产品真源校验并可保存重开 |

## 人工验收记录

无本批必须由人工完成的项目。

## Deferred

B5/B6、通用Condition、权限及真实服务/私有周编码验真保留主计划，不属于本批已验证声明。displayInputs本批仅开放DataPeriodFact具名分支，未开放任意对象路径。
