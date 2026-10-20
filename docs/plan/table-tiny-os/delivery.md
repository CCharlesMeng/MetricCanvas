# main 交付复验

2026-10-20，从 `origin/main` 的 `9afcf63726dde69d3674ea311ef88b1e91a05f90` 建立隔离交付目录。原实施目录的并行改动保持原样；只迁移 Table 的非 reportCompact 皮肤、呈现几何、冻结参照、示例及相关文档。远端新增的权限门禁、搜索选项和其他协议能力保留。

`dev-baseline.md`、`alpha-tests.md` 和原有证据包记录原实施基线 `952b3a27` 的验证，不能直接充当新 main 的证明。新 main 的源码、锁文件摘要和复验命令见 [交付验证记录](evidence/delivery-verification.json)，17 项浏览器结果见 [执行结果](evidence/artifacts/delivery-playwright-results.json)。

本次重新执行：全仓类型检查，Embed 构建，54 个页面文档校验，44 项表格与目录单元测试，17 项浏览器检查（含新 main 的静态搜索选项），创作契约一致性及3302个分发摘要核对，均通过。链接颜色用例补充有效导航目标，符合 main 已新增的交互资格门禁，没有放宽产品权限逻辑。

三种基础网格的同环境像素相等断言在新 main 上继续通过。AT-01 中完整筛选日历、枚举面板及全部交互状态的像素覆盖仍未完成，此次提交不将其改写为100%验收通过。真实 DQE/Relay/部署未在此批验证。

远端推送与 CI 以本次提交 SHA 对应的 GitHub Actions 运行结果为准；此文件仅记录提交前已完成的本地复验。
