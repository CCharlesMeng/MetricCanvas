# partner-health main 范围交付

日期：2026-10-29。交付基线 `origin/main=d24a417210041a3c057e06dd0012e07d0bcc6c76`，独立工作树 `/Users/moon/.codex/worktrees/partner-health-union-delivery/DataDashboard`。

交付组织键并集、分类和总分计算、数值空文本缺项修复，正式 partner-health 两种组织粒度接线，以及独立 Mock 的中国区/海外顶部卡片、合成响应和未执行查询候选。正式页没有接模拟网关；顶部整体查询候选没有写入正式页。

显式复制49个源码/夹具/说明路径；从交付基线重新生成1074个派生路径，不复制主工作区的生成目录。主工作区的repair Skill、Skill发布工具与测试、CI配置、package脚本、AGENTS、平台README、sum-fields-zero示例等并行修改未带入。共享计划索引只纳入partner-health一行。

记录中的 Schema6.74 与 local-authoring1.10.0 是本轮协议和独立校验器版本。生成与MC检查使用项目Python依赖，MC子进程在本机的stdin传输由临时启动器提供确定EOF；实际执行原始Python校验代码，没有修改产品来放宽检查。

## 验证分层

- 本轮业务回归覆盖page/data-execution/runtime、伙伴健康度正式与Mock入口、原有得分及公开API。首轮194文件1743项中5项在生成器尚未完成时读取6.73旧快照；生成完成后对应2文件20项复验通过，不将首次失败报告为全绿。
- 扩展authoring-export-isolation批次因本机重复冷生成耗时较长停止，未宣称该批通过；核心local-authoring与页面参考5文件194项通过，完整扩展检查交由对应提交CI核对。
- 页面试验场check（0错误0告警）、生产build、测试TypeScript检查通过；交付checkout136/136页面通过。主工作区额外的未交付示例不在该计数内。
- 官方生成一致性1295 product/4 authoring/1 interface、MC来源覆盖、33项Python MC测试及MC可见夹具一致性通过。
- 浏览器证据沿用主工作区精确相同的正式/Mock JSON和Mock网关源码：地区部/代表处15行；顶部中国区35、海外30；全缺总分0且分类`--`；真实全0。源码字节比对与原有复杂度记录保留于本机交付日志。
- 原始合成输入、可运行诊断和顶部候选请求/响应随交付保存；大体积截图、日志及历史运行结果按既有忽略规则保留在主工作区，另有本机交付日志。
- 真实业务DQE、部署验收未执行。本次用户仅授权代码提交和push。

## 复杂度

固定口径metriccanvas-ts-ast/1、TypeScript5.9.3。计算visit27→5，新辅助函数≤9；computeOutputFields13→15；sourceComputeErrors9→10；normalizeScalar11→14；applyComputation5→6；页面loadPage13→14；pageExternalInputs13→14，scenarioEnvironment10→11。顶部Mock增量fetchData10→11、字段映射回调3→4，新函数≤5。无本轮超限未关闭项，未改parsePage31为既有债务。

本机交付日志前缀 `/tmp/partner-health-delivery-`；主工作区保全哈希清单 `/tmp/partner-health-primary-before.json`。远端SHA、CI和临时交付工作树归档在推送后核对，最终回执不将本地或Mock检查当作真实服务成功。
