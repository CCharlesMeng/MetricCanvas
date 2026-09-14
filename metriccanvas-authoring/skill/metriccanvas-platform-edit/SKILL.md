---
name: metriccanvas-platform-edit
description: 修改 Platform 已有页面，包括新增组件、局部改版、筛选绑定、表格下钻或显式切换布局。基于可信程序读取的精确修订使用受控操作，保留未触及内容。
allowed-tools:
  - edit_page
metadata:
  mcp_servers:
    - metriccanvas-content
---

# Platform 修改页面

1. 读取[公共编排约定](references/platform-authoring.md)。由可信程序按当前身份与工作区读取精确修订，提供 baseline_token、目标组件标识及必要摘要。缺少可靠基线时请求读取并等待；目标不明确时澄清。完成条件是可信完整基线可读且修改目标唯一。禁止用 compose_page 或 create_content_page 重建缺失基线。
2. 将意图映射到 edit_page 的受控操作。已有页“新增一个图”属于修改；仅用户明确另建时交回创建路由。已有数据形状或工具操作不支持该新增时报告具体缺口，保留原页，不能把类型转换或整页重建冒称新增成功。
3. 普通修改继承原 layout。只有用户明确要求切换时，读取目标 [report](references/layouts/report.md) 或 [dashboard](references/layouts/dashboard.md) 基线，发 set_page_layout；这是既有页转换，不应用新建默认。检查工具返回的标题、容器、占位、宽度与铺底影响。真实冲突失败时根据 issue 说明需用户决定的布局调整，保留原设置。
4. 独立修改分项；依赖新增组件或筛选的操作显式 dependsOn。结构与绑定用专用操作；查[协议索引](references/page-metadata/README.md)确认含义，同时以工具公布的请求 Schema 为可执行边界。完成条件是每项都有唯一 id、精确目标及正确依赖，未提及设置不加入请求。
5. 调用 edit_page，逐项报告 applied/failed/skipped/unchanged，并翻译 adjustments 的呈现影响。部分成功仅交接合法成功子集；全失败或无变化时保留旧页且不请求新增修订。后续轮次必须读取最新可信基线，不能复用旧 token 冒充已保存状态。程序收到内容产物后执行生命周期保存；只有回执及精确引用验证成立，才报告已保存。
