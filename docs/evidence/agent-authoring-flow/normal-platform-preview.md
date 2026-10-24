# 正常 Platform 本地体验

2026-10-24，按用户要求停止以隔离原型和 agent-flow 测试夹具作为交付预览。将本轮 Platform 源码、测试和开发配置同步到主目录，原型没有接入正常入口；其他并行修改保留。

## 已启动的入口

- 管理目录：http://127.0.0.1:5175/manage
- 正常画布：http://127.0.0.1:5175/create?page=demo&resource=local-demo
- 独立表单：http://127.0.0.1:5175/manage/pages/demo/settings?resource=local-demo

5175 运行主目录的 `apps/platform/index.html` → `src/standalone/main.ts` → `PlatformRoot`，不是另一个页面或测试应用。沿用平台现有组件和主题。默认5174 HTTPS服务与CloudIOC配置保留，同样已经包含同步的应用源码。

启动命令：`pnpm dev:assets`、`pnpm --filter platform dev:local`；查询演示另运行 `pnpm --filter @metriccanvas/dqe-sim dev`。页面服务使用已有8080接口，数据保存在主目录 `.scratch/platform-page-assets/store.json`，原 pages JSON 不改写；这是本机开发数据，不是生产服务。

## 实际操作

正常目录进入现有 demo。在检查器将组件标题改为“本月 GMV · 编辑体验”，再直接修改左上角页面标题。服务记录 R2 只有页面标题改变，组件标题仍是“本月 GMV”，前端保留未保存组件修改；点击正常保存草稿得到 R3。进入独立基本信息表单修改描述并保存，目录显示 R4 与新描述。浏览器中保留正常表单供继续操作。

首次PUT发现本地资产服务的来源白名单未包含5175。仅为现有本机来源正则加入5175，重启该服务后实际保存通过，没有改远端服务或代理认证。

修正了管理表格新增列的宽度合计超过100%、操作区裁切的问题，使用原Grid列宽API与操作区换行；描述限制两行并保留完整title。没有替换主题或组件样式。

实际页面截图：[管理目录](platform-management.png)、[工作台](platform-workbench.png)、[基本信息表单](platform-info-form.png)。这些是正常Platform截图，原始PNG遵循evidence忽略规则留在本地。

## 验证

- 主目录 Platform 测试：47文件、479项通过。
- `pnpm --filter platform check`：0错误、0警告；测试类型检查通过。
- Vite配置单独TypeScript检查通过。
- `pnpm --filter platform build`：通过；保留原有大资源分块提示，没有修改构建门禁。
- `git diff --check -- apps/platform`：通过。
- `metriccanvas-ts-ast/1`，TypeScript5.9.3：新增developmentServer CC=8，配置工厂14→14；本地服务来源校验回调6→6。ManagementList本次仅修改列宽与呈现，无新增执行分支。未修改的资产handle41、workSession.restore17作为存量保留。

## 可体验范围

可直接操作画布、检查器、页面标题、保存草稿、管理行内编辑及独立信息表单。此入口尚未注入真实云宝Agent端口：不使用合成Chat，真实对话生成、自动会话、对话发布/确认保存未接通。现有本地接口未定义访问路径字段，所以路径维护明确禁用；不能以界面可见推断服务已具备能力。

应用源码已同步到主目录，完整架构与内网交接文档仍保存在本任务独立工作树；未提交或push。原先独立工作树的归档证明不替代主目录的本次构建和浏览器证据。
