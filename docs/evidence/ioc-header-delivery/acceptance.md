# 合并验收账本

| 项目 | 本地结论 | 证据 |
|---|---|---|
| B0–B5已授权范围 | PASS；B5仅传值，恢复未选，B6挂起 | 主计划§22–23；B0–B5历史记录；本目录结果 |
| main已发布能力 | PASS；6.32–6.35保持原义 | version测试、73源码浏览器、54安装浏览器、Playground16+Tab10场景 |
| 单一输入与身份门禁 | PASS | actual availability page；条件+期间说明；订阅失败、撤回输入、身份变化回归 |
| 整组写入与依赖清理 | PASS | 全量2474项；无效子项整组拒绝、零通知、修订不变，后代原上下文保留 |
| 元数据/authoring一致性 | PASS | 915/4/1生成文件、local-authoring仓外53页；产品Zod/版本/正反向量/API |
| 独立消费者 | PASS | 六包tarball、Node ESM15IOC页面、HTTP静态时间程序、浏览器54项 |
| 页面与宽窄布局 | PASS | Playground source/list/detail；9帧1440/1024/390，根级无横向溢出；3张窄屏图 |
| 完整本地回归 | PASS | 全量282文件2474通过5跳过；check/build；公共模块复杂度max15 |
| 并行保护 | PASS | 原工作区只读、不stash/reset/clean；历史B5证据按原哈希保留 |
| 推送与CI | 后续按准确SHA核验 | verification.json所列wait-ci命令；提交对应GitHub工作流 |
| 真实服务、模型、门户、部署 | NOT_RUN | 本地使用合成数据；未将CI等同真实集成 |

跨页实际入口及步骤继承B5验收；合并预览端口4220，DQE Sim4221。主页面路径为`/pages/ioc-header-navigation-source-demo`，目标清单需origin参数，详情需project-id/project-name/origin/month等显式输入。可从Playground目录发现全部页面，SDK真实契约与目录说明同源。

历史失败和重试明确保留：初次main集成修复目录数组迁移、协议版本占用、ECharts不透明byFilter边界；并行main更新后重新合入统一呈现。阶段性的原测试报告不替代最终全量全绿结果，不放宽测试超时，不移除失败用例，不覆盖main功能。

原始命令与日志见evidence/verification.json。所有产物与快照都以source-manifest.json的代码指纹关联；代码和生成物在最终验证期间未再改变。
