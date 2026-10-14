# 查询输入过滤与分页排序级联：交付前验收

日期：2026-10-14。交付基线：ec35d7f6cbad07ebaeebae8030180c910539281e（交付前已fetch的origin/main）。目标为main。

本批交付6.19 resultBindings.where、6.20显式查询分页窗口输入与任意列排序依赖更新、80行示例、配置逐字段解读、功能/架构影响，以及对应TS/Python校验、契约和Skill分发。

远端已合入共享data-execution模块，因此交付前把输入解析和单次执行窗口核验接入该模块；engine保留原有重导出。未带入主工作区的customBlock、表格搜索/Excel导出等其他未交付工作。显式路径清单分开记录源码与生成产物。

## 对齐main后的检查

- pnpm test：215个测试文件通过；1967用例通过，4个既有跳过。
- pnpm check：全仓类型及Svelte检查通过。
- pnpm build：产品包、embed、静态platform构建通过。
- pnpm packages:check：入口、声明及交付包检查通过。
- pnpm validate：本交付检出的17个pages文档全部通过。
- Python锁定环境完整回归：530测试通过，1个既有跳过。
- radon/6.0.1复杂度检查：上限15，实际最大15，无超限；能力检测抽为独立函数，保留检测次序。
- authoring:contracts:check：593 product / 4 authoring / 1 interface产物一致；Bundle0.3.1摘要检查通过。
- git diff --check：通过。

本地命令日志保存于/tmp/metriccanvas-query-cascade-delivery/。浏览器交互与截图见[paged-scenario.md](paged-scenario.md)；配置与影响见[architecture-impact.md](architecture-impact.md)。本批未验收真实DS模型、DQE/Relay/Java或生产部署；远端提交与CI结论在交付最终回执中另行报告。
