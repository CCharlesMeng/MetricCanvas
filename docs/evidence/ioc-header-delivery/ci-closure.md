# 安装消费者与共用状态兼容性收口

首次远端合并为 `4c953b1a3b1c5d3d3a4c9c937f8c75efbf598b7c`；[CI 39357574626](https://github.com/CCharlesMeng/MetricCanvas/actions/runs/39357574626) 的 tests、types、authoring、build 通过，compatibility 在启动消费者内容服务时因缺少 `ioc-time-candidates.mjs` 失败。不能将该次合并称为完整 CI 通过。

标准兼容性复制清单现在通过 `copyConsumerFixtures` 共用，复制完整 Embed 测试夹具。新增回归在没有工作区链接的临时目录中启动实际内容服务、发送时间候选请求并验证十二个月结果；修复前确实因缺少模块失败。B4 布局采集所依赖的 contract、adapter 和无外部依赖 collector 固定为仓内测试夹具，附来源与 SHA256。B4/B5 浏览器采集写入 Playwright 测试产物，运行回归不覆盖历史验收记录。

完整安装消费者浏览器测试还验证以下旧页面兼容边界，保留原有断言：

- 图表的兼容 URL 先排除非法候选，再补声明默认；新 strictURLInputs 页面继续拒绝非法值。
- 候选加载暂存已通过原有源定义及条件验证的 initial/执行回执，保持等待状态；首次候选通过后释放初始行，不重复查询。条件、事实或表格视图改变时丢弃暂存；释放后的再次失效不能复活旧行。新增执行和 document initial 两分支、条件/视图变更回归。
- 旧 initialParam 数组继续初始化未声明 selection 的 tabs 已应用条件；点选仍写单值，显式 selection.mode=single 严格校验。产品真源、协议正文和独立 authoring 校验器同步。
- 候选门禁变化本身不写 URL、不发 filter-change、不记录最后筛选；仅已应用筛选值实际变化时执行这些动作。

`evidence/source-manifest.json` 和 `artifact-manifest.json` 保留首次合并前的验证输入；本次修复后的输入见 `evidence/release-source-manifest.json`，结果与失败原始记录见 `evidence/ci-closure.json`。提交后的最终 GitHub CI 仍按准确 SHA 单独等待，最终回执以 GitHub 工作流为准。真实 DQE/Relay/CloudIOC/门户/DS/部署保持 NOT_RUN。B5 仅传值，B6 挂起。

最终本地结果：类型/构建通过；283文件、2480项通过、5跳过；六包安装消费者浏览器182/182；实际Playground6/6；独立local-authoring53页与915/4/1生成一致性通过。该轮验证输入冻结为`f9fe044b653e76a63732f6211b74c6a6dc2b2d8eb633d08775c3c19c4f08c80f`。

## 双实例用例的异步文档前置条件

第二次CI运行[39359574313](https://github.com/CCharlesMeng/MetricCanvas/actions/runs/39359574313)的四个其他任务通过；Chrome/Edge矩阵395/396通过。唯一失败为Chrome双实例用例，在宿主HTML加载后、异步页面JSON就绪前挂载第二实例，导致文档未定义而没有第二个月份控件。注入150ms元数据延迟后复现同一错误；增加首实例已显示声明月份的前置检查后，连续10次及全部6个页头用例通过，浏览器TypeScript检查通过。月份隔离、切季/月记忆及独立销毁断言全部保留；无跳过、重试或超时放宽。

本次仅修改测试前置条件与证据，产品源码、协议、独立校验器保持db892ce0内容，因此复用该输入已通过的本地及远端检查。完整测试输入新指纹为`f9252c4644c24e0a6e2c2d7bcc240a15990d337d33970811e5d84fefb794ce3f`，见[测试输入](evidence/readiness-source-manifest.json)和[回归证据](evidence/readiness.json)。最终CI仍按新SHA完整执行。
