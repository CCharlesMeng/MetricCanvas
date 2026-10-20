# 合并后验证

- 全仓`pnpm check`、产品`pnpm build`通过。
- 177个测试文件、1417项回归通过，覆盖页面协议、运行时、数据执行、local-authoring仓外安装及参考闭合。最后补齐禁用父节点元数据与可展开语义后，重跑17项相关树测试。
- 33项Chrome组件浏览器通过，覆盖普通根、ShadowRoot、16px留白、标签点击与箭头、禁用父节点的可用后代、inert祖先关闭。
- 7项仓外UI安装包浏览器通过；打包文件为新文件名，避免Vite缓存旧包。
- 本次完整页面5个场景通过；main原15个页头演示及统一页头场景通过，含币种、层级、跨页传值、失败重试、紧凑布局、自然年及390px。
- 55个页面校验通过；authoring契约与report PDF派生物一致性检查通过。

当前合并源码/派生物哈希见evidence/delivery-inputs.json；命令和日志见evidence/validation.json。旧ui/polish/left-inset证据只保留为历史，不能替当前合并验证。CI在推送后单独核对，不将本地成功等同于CI或真实服务验收。
