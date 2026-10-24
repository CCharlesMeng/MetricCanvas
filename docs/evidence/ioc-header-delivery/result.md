# IOC 公共页头 B0–B5 main交付（2026-10-20）

本批本地合并与验证完成，IOC能力登记为6.36–6.40；保留main已发布的图表扩展6.32、Tab URL初值6.33、指标卡前置文字6.34、统一呈现条件6.35。B5仅显式跨页传值，无新增来源视图恢复；B6挂起，不迁移既有IOC业务页面。

唯一主计划[§23](../../plan/2026-10-16-ioc-header-feature-plan.md)维护版本协调和接口收口。合并基线`af9710e99c31ad46cd351f8d0dd84aa56288c0e9`；代码及生成物指纹`b7d04178df37e4fcd065c57c1ddcb675fd742524d0995f6a60400c921ca86d47`，见[输入清单](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/ioc-header-delivery/evidence/source-manifest.json)。历史B0–B5记录保留原版本和哈希，不能当作最新main验收。

共享displayInputs/DisplaySnapshot扩展可选timeZone/periods，用permissionRevision统一身份边界。单一订阅拥有初始化与更新；订阅失败、输入撤回都关闭依赖呈现并暂停相关期间查询，无关数据继续；权限修订变化停止旧实例及导出。FilterState沿用main数值revision，B0原子事务、递归清理与候选门禁继续生效。非法子项仍按已批准§17.6整组拒绝，父筛选未变化，后代保留原上下文。层级空选值保留合法level，ECharts不透明JSON不被货币投影解释。

首次合并前本地验证：check/build通过；全量282文件、2474项通过、5跳过；协议生成915/4/1一致；local-authoring仓外安装独立校验全部53页；公共Python模块复杂度最大15。没有追加其他Skill、历史Bundle行为或真实DS验证。

首次合并前浏览器：源码73/73、六包安装消费者54/54、实际Playground跨页6/6通过；main统一呈现16场景与Tab URL10场景通过。各组有重叠，不累加。新增组合页为ioc-header-availability-demo：同一可信输入提供标量条件与期间事实，切换期间说明不增加查询；失去订阅或撤回输入不会显示旧期间数据。静态PDF/PNG/XLSX、权限取消下载与公开JS接线也已回归。

[验收账本](acceptance.md) · [命令与原始结果](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/ioc-header-delivery/evidence/verification.json) · [并行保护](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/ioc-header-delivery/evidence/preservation.json)。原始日志已显式纳入交付，避免gitignore排除日志而断开证据链接。

推送后的远端SHA与CI需以对应GitHub工作流核验，预期或bypassed不计通过。交付执行命令为`node tools/scripts/wait-ci.mjs <完整合并SHA>`。真实DQE、Relay、CloudIOC、门户SDK、DS模型及部署仍为NOT_RUN；本地合成HTTP不能替代真实验收。原工作区有并行修改，保留其本地main及文件状态，只从隔离工作树更新远端main。

首次推送后的兼容性失败与修复见[安装消费者收口](ci-closure.md)。首次合并指纹及日志保留为历史输入；后续发布输入以release-source-manifest.json为准。此补充不扩大B5/B6范围，也不把首次失败工作流记为通过。

兼容性修复后的最终本地验真：check/build通过，全量283文件、2480项通过、5跳过；六包安装消费者完整浏览器182/182，实际Playground6/6；local-authoring独立安装53页及915/4/1生成一致性通过。源码在该轮验证期间冻结为`f9fe044b653e76a63732f6211b74c6a6dc2b2d8eb633d08775c3c19c4f08c80f`。最终准确SHA的远端CI以GitHub工作流回执为准。

双实例测试的异步页面就绪前置条件及第二次CI收口见ci-closure.md最后一节；仅测试输入变化，产品源码保持db892ce0。最终测试输入以readiness-source-manifest.json为准。
