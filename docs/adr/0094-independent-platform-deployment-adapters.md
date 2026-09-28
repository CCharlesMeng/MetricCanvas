---
status: accepted
date: 2026-09-28
note: 门户专属接线由独立部署项目维护，平台仅发布版本化契约与静态产物
---

# 平台与门户部署 Adapter 分别维护和发布

用户要求主应用相关实现由内部系统独立维护，与 GitHub 平台业务分别演进。延续 [ADR-0093](0093-platform-html-microfrontend-and-instance-lifecycle.md) 的 HTML 微前端形态，将“门户变量集中映射”进一步收敛为仓库外独立部署 Adapter；平台内只保留通用生命周期、输入验证和版本化契约。

独立项目消费固定版本静态归档中的声明，编译经典脚本注册 `MetricCanvasDeploymentAdapter`。平台每次挂载调用同步 connect，失败或卸载清理 disconnect。独立流水线组合脚本与平台 HTML，保留平台与 Adapter 各自摘要，主应用加载组合后的 entry。平台不 import 内网模块，也不包含门户字段映射、私有补丁或部署配置；不选择把私有映射放进 GitHub 的命名 Adapter 目录，也不强迫主应用扩充 props。

配置变化使用真实订阅；仅在部署保证身份/目标变化整页重载时允许显式 reload 模式。每请求作用域检查仍保留，不放宽鉴权、不伪造身份、不新增跨数据域恢复迁移。外部资料不足时交付通用接缝和合成证据，真实身份/SDK/门户验收单列。

唯一共享面是版本化契约和静态交付，不共享需要共同修改的源文件。破坏性修改升级契约；组合工具拒绝不支持的版本及损坏产物。旧的直接标准 props 方式继续可用。具体接入见 [部署维护边界](../plan/qiankun-platform/deployment-boundary.md)。

调查报告、补充提示词与历史接线备份按用户后续要求收录于 `docs/plan/qiankun-platform/portal-handoff/`，仅作资料归档，不参与运行构建。资料同仓不改变实际部署 Adapter 独立维护和不被平台源码导入的边界。
