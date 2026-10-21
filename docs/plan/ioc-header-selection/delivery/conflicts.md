# IOC选择能力与main合并冲突

用户于2026-10-20确认：保留main现有协议，兼容适配本次能力，然后提交并推送main。本记录区分文本冲突和自动合并后的语义冲突。

起点：`952b3a273f0f4f8be5820f5af1bb76c2f5afa513`；本次原始提交：`98d41659f4c65c844e5d3e8a01f7ffa15cf65a64`；合并目标：`589767c0f6a787562362d64a7b5d73d108ca997a`。

Git标记410个文件冲突：398个在契约/Skill派生目录，12个在源码或正文目录。逐路径见[evidence/merge-conflicts.json](evidence/merge-conflicts.json)。数量不等于410项业务冲突。

| 冲突点 | 本次隔离实现 | main已有行为 | 最终处理 |
| --- | --- | --- | --- |
| 单多选声明 | `selection:"single"|"multiple"` | `selection:{mode,required,allBehavior}` | 保留main对象格式；本次完整页面、夹具和测试迁移，拒绝未发布的字符串格式，不以联合类型容忍两套真源 |
| 树选择 | `descendants/independent/leaf`普通树父子策略 | `level`显式层级树 | 保留level，新增普通树枚举；只有level使用层级候选回执、当前层级限制及显式parent层级关系 |
| 候选父关系 | 同一维度候选批次`parentValue` | `FilterCandidate.parent:{level,value}`与hierarchy | 两种用途分开：普通树仍引用同批稳定代码；level结构树沿用main输入和校验，不将显示路径或代码推断为层级 |
| Schema版本 | 原占用6.32 | main当前6.42，6.32已有图表呈现能力 | 增量为6.43；保留main全部既有能力，新增searchable和普通树规则门禁，重生成兼容向量 |
| 状态与输入边界 | 局部单选校验 | main必选、权限、候选回执、联动确认及日期/金额校验 | 保留main协调器，使用既有dimensionSelectionIssue；补回本次非法单选URL保留有效值及详情参数基数校验 |
| 选择控件 | 统一Selection，搜索、单行标签、树线及16px留白 | main另有Select、MultiSelect、TreeSelect；Select新增inert祖先关闭处理 | 维度下拉统一接入Selection，兼容对象声明、required与level映射，补上inert祖先关闭；保留公开旧组件入口 |
| 页头/试验场入口 | 页面专用合成网关 | main已有IOC页头预览网关 | 按目录externalInputs开发输入标记组合入口，合成夹具放在fixtures目录，产品源码不按页面ID分支；新场景归功能演示，保留原15个IOC集合场景 |
| 目录自动合并 | JSON追加页面项 | main增加capabilities数组 | Git未标冲突但新页面项被放进能力数组；已移入pages并补齐main要求的体验说明与运行条件 |
| 主题和协议派生物 | 旧基线导出 | main新增表格主题、能力、文档及Skill知识 | 解决产品真源后运行官方主题生成器、report-pdf生成器与authoring导出器，不逐个手工合并派生JSON |

浏览器回归适配了新的语义定位：原summary/原生checkbox改为选择按钮、搜索框及树节点按钮；原箭头测试仍检查同一实际位置和垂直居中。窄屏统一页头在容器断点重新布局后以重试断言检查同一“无页面横向溢出”条件，没有放宽几何期望。

历史ui、polish与left-inset证据保留为各自旧基线记录；当前合并后的验证只引用delivery/evidence，不冒充原指纹仍新鲜。所有页面数据均为本地合成，不代表真实DQE、Relay或CloudIOC服务验收。


## 首轮CI与安装式集成收口

- UI新增Selection、TreeSelection、UiTreeOption公开符号，按既有公开面门禁更新快照，未删除main原有符号。
- 首轮CI指出页面ID中立性约束：试验场合成输入现由page-catalog的externalInputs标记接入；数据夹具迁出产品src，避免按页面ID或示例维度名写产品分支。
- 安装式IOC业务回归保留显式清除确认：候选交集为空时仍需点击清除，不会自动解除查询门禁。重试放进错误浮层，避免面板遮住操作。
- 切层或收起后的浮层状态读取原生popover实际状态；窄屏重新定位后先刷新DOM，再preventScroll聚焦，避免父容器被自动水平滚动至触发器离开视口。因果RED见evidence/popover-focus-red.txt；同一密集场景已在29项嵌入回归中通过。
- 原生复选框和summary定位迁移为选项/树节点语义定位；稳定代码、URL、查询次数、必选和候选门禁断言保留。390px几何断言等待布局完成，不放宽边界。

此后只以最新补充提交的CI作为最终结论；初次推送的CI不记作通过。


## 兼容性 CI 的页头高度回归（2026-10-21）

`30974179` 的类型、构建、单测与 authoring 作业通过；兼容性浏览器 418 项通过、2 项失败，均为 Chrome/Edge 下机会点清单页头预期 80px、实际 82px。

最小复现为嵌入浏览器 `embed.spec.ts` 的机会点清单用例。原因是官方选择框 `inline-block` 的基线留白：32px 控件使包装容器达到 38px。适配层仅增加 `vertical-align:top`，保留官方 display、尺寸、颜色及页头原有 80px 断言。完整 CI 仍以随后补充提交的结论为准。
