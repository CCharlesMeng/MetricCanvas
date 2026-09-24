# 创作接入代码所有权

现行接入文档统一在 [metriccanvas-authoring/RELAY-HANDOFF.md](../metriccanvas-authoring/RELAY-HANDOFF.md)。

唯一交付目录为 metriccanvas-authoring；其 tool/metriccanvas_authoring/adapters 全部归内部维护，其余公共清单文件单向更新。平台只使用公共 metriccanvas-platform-content 入口和内部 factory。旧包外独立扩展已退役，不再安装额外 Relay 包。

架构、接口、初始化、更新和真实环境验收都在该目录内说明，内部不需要本页才能接入。
