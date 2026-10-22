# pages/platform

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 页面搭建｜拖拽、删除与撤销

入口：`/pages/platform-canvas-experience`；[页面 JSON](platform-canvas-experience.json)。

启动：`pnpm dev:platform`，在页面搭建工作台加载资产。

在 Platform 页面搭建工作台调整顺序、跨分区移动、删除并撤销；试验场仅展示内容。

合成演示

仅展示结构；操作需页面搭建工作台

1. 本预览只检查页面内容与分区；不会出现搭建手柄。
2. 在 Platform 页面搭建工作台打开此页面，再体验拖拽、删除和撤销；完整操作见仓库 pages/README.md。

本页地址不是搭建入口；搭建工作台由 Platform 提供，具体页面资产须在对应环境加载。

关键声明：`sections[].components[].layout`, `sections[].components[].type`。

关联：[metric-card-equation](../capabilities/layout/metric-card-equation.json)。
