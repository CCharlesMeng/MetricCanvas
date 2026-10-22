# IOC公共页头B2实施结果

B0+B1之后的B2业务筛选已完成本地实施与验收。唯一主计划仍为`docs/plan/2026-10-16-ioc-header-feature-plan.md`，88项功能及B3–B6未交付能力保留；未迁移既有IOC业务页，未启用默认可选操作，未暂存、提交或推送。

隔离工作树：`/Users/moon/.codex/worktrees/ioc-header-b0-b1/DataDashboard`。HEAD仍为`952b3a273f0f4f8be5820f5af1bb76c2f5afa513`；B2起点是未提交6.32，见`evidence/start-manifest.json`及其备份路径，本批能力版本6.33。原工作区24项并行修改保留。

交付selection/required、有限options/disabled、全选不限、显式结构树、共用hint/clearOnChangeOf与候选交集。UI、SourceProgram、普通/组合查询、导出、seed/initial及一次性创作执行共用门禁；图表独立闭集和旧斜杠树保持语义。年季月锚点、详情单月及离散月份仍分别处理。

## 可交互预览

内容服务运行于127.0.0.1:4198，使用本地合成HTTP契约Adapter。

- [封闭枚举与显式清理确认](http://127.0.0.1:4198/pages/ioc-header-business-options-demo)：切分类清突破项；确认后查询恢复，全选不限保留URL/UI，boolean false显式发否值。
- [结构树与期间候选](http://127.0.0.1:4198/pages/ioc-header-business-tree-demo)：地区部/代表处同码隔离；2026-08取交集B，07空交集待确认，06拒绝，05未配置；旧斜杠树保持。
- [详情私有枚举与单月](http://127.0.0.1:4198/pages/ioc-header-business-detail-demo)：详情档位独立，单月输出mtime=YYYYMM。

## 验证状态

| 层次 | 实际结果 |
| --- | --- |
| 本地源码 | Vitest260文件，2270通过、5跳过；执行边界定向49通过；check/build通过，构建有既有chunk体积提示 |
| 协议与分发 | 36页文档通过；Python546项、跳过1；独立Skill/知识/导出隔离46通过；Bundle2802摘要检查、authoring生成物一致，Python复杂度最高15且无超限 |
| 浏览器 | 源码20项通过；六包仓外安装15项通过；390宽两页页头溢出0；三张静态页保留已应用值及说明 |
| 仓外Node ESM | 7个页面解析；denied及transport候选失败清旧initial，无关查询仍执行 |
| 独立检视 | 布局L3、规范C1/C4/C5、质量Q2/Q5/Q6/Q7及F3-21..26均通过；聚合0阻断、0待决、0未证实声明 |
| 真实服务 | DQE、CloudIOC、Relay、DS模型、门户、CI、部署均未运行；本地证据不替代真实服务验收 |

[正式验收](acceptance.md)由SDD聚合器生成；[声明账本](alpha-tests.md)、[共享证据包](evidence/review-evidence.json)、[净增量](evidence/b2.diff)、[代码清单](evidence/code-manifest.json)。代码指纹仅按官方base_ref/head/files规范化；B2起点manifest单列，规范化前后文件哈希集合相同。
