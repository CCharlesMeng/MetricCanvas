# IOC公共页头B3本地实施结果

B3按主计划§17.5落地Schema6.34：金额范围草稿/预设/基本单位、静态USD、封闭字段与metric选择、换币清金额的原子协调和确认门禁。元数据、表格、图表、同币种计算、详情后绑定、静态呈现与XLSX共用已应用case；已有业务标签保留，旧列条件失效，导出冻结所选case。

实现仅在`/Users/moon/.codex/worktrees/ioc-header-b0-b1/DataDashboard`；原工作区并行修改保留，不暂存、不提交、不推送。没有批量迁移业务页面或新增默认可选操作。B4–B6及待审Condition/displayInputs保持规划。

## 可交互预览

[金额与币种验收页](http://127.0.0.1:4200/pages/ioc-header-currency-demo)使用本地合成HTTP，页面同时具有独立人民币/美元基本单位字段，不做汇率换算。切币后先清金额并等待显式确认；金额输入与预设按万元/万美元显示，URL/查询保留基本单位。

[历史截图：美元交互预览](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/ioc-header-b3/evidence/preview-currency.png)

## 验证状态

| 层次 | 结果 |
| --- | --- |
| 本地源码 | 全量264文件、2300通过5跳过；最终投影/版本探测修正按依赖复测39项通过（其中4项为重复用例执行，未算作新增覆盖）；check通过。全应用build通过，最终受影响包/embed重建通过，有既有chunk体积提示 |
| 协议与创作 | 37页通过；Python548项、1跳过；最终金额受控编辑2项重开/回滚通过；生成物current、Bundle2846摘要检查；复杂度最高15、0超限 |
| 源码浏览器 | 原期间/业务页头/表格及金额23项回归通过；最终金额修正后2项再验通过，包含实际XLSX下载及pageerror断言 |
| 仓外消费者 | 六包新建安装，Node ESM解析8个IOC验收页；17项安装浏览器通过 |
| 呈现 | 390宽页头overflow=0、文档scrollWidth=390；金额面板left74/right374，确定取消可见；静态USD条件、列标题、图表/表格值及单位一致 |
| 独立Skill | 最终46项分发、知识/校验器与导出隔离检查通过 |
| 真实服务 | DQE、CloudIOC、Relay、DS模型、门户、CI、部署及真实USD业务未运行；本地证据不替代业务验收 |

[正式验收](acceptance.md)由SDD聚合器生成；[声明账本](alpha-tests.md)、[共享原始证据](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/ioc-header-b3/evidence/review-evidence.json)、[B3净增量](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/ioc-header-b3/evidence/b3.diff)、[代码清单](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/ioc-header-b3/evidence/code-manifest.json)。B3起点基于未提交B2的文件备份；不能将HEAD累计差异当作B3净增量。

非阻断建议：currency-selection.test.ts存在4组重复用例，后续可去重，保留单份断言以免维护分叉。按SDD建议级handoff处理，冻结版本不为此扩大重跑。
