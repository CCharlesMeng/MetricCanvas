# Playground 文件夹目录交付验收

2026-10-22。范围：pages 文件聚合、Playground 自动发现和旧 catalog 清理。Platform 仅调整开发资产种子的路径查找，不重构产品代码。

## 结果

- 以实际文件夹路径分组，不维护逐页 catalog、别名、用途或服务环境登记。删除旧 catalog JSON、说明组件、配置路径提取器和旧目录状态模块。
- 标题、说明、布局、完整组件树与数据来源读取实际页面文档；详情提供通用 JSON 查看与下载。说明迁至主题目录 README。
- 业务按 report/dashboard 区分，IOC 看板按 project/opportunity 区分；后续 main 新增的示例一并按能力文件夹归位。82 份 JSON 原始字节、id 与 `/pages/<id>` 地址均保持。见 delivery-migration.json。
- 现有 IOC 专题 `/ioc-header` 和能力一览继续保留；专题场景从实际文件发现，预览适配器收在 fixtures，普通业务目录无需配置适配器即可展示。
- 递归扫描用于页面校验、独立本地创作校验器、范式生成、Platform 开发种子和 Embed 测试内容服务；跨目录重名明确失败。

## 验证

交付 checkout 为独立 page-folder-delivery worktree，初始基线 612d2e51。未带入原混合工作区的其他产品修改；最新 main 的后续提交在推送前合入。

- `pnpm validate`：82/82；所有迁移 JSON 与基线原始字节一致。
- `pnpm test`：312 个文件通过，2705 个测试通过、4 个既有测试跳过；包括仓外独立 Skill 安装与递归校验、生成隔离和消费者测试服务闭合。
- `pnpm check`：通过，Svelte 0 错误、0 警告。
- `pnpm build:playground`：通过。
- `pnpm authoring:contracts:check` 与 `python3 metriccanvas-authoring/scripts/check_bundle.py`：通过，3667 项摘要检查。
- page-directory-browser：82 个页面直接访问、当前 JSON 下载、组合过滤、返回与窄屏通过。检查目录外框加载；需要显式输入的页面仍由产品运行时展示其输入诊断。
- page-folders-browser：父子目录、查询、返回、临时业务目录自动渲染与新增/修改/删除热刷新通过，临时文件已删除。
- directory-navigation-browser：返回、刷新、历史记录、空结果、重置、新标签页和存储不可用通过。
- ioc-header-showcase-browser：15 个场景、32 项能力索引、层级候选、币种、跨页传值、移动布局和历史记录通过，无页面异常或外部查询请求。

机器结果见本目录 browser JSON；桌面与窄屏截图见 directory-desktop.png / directory-mobile.png。核心目录、文件索引、校验入口及新增适配器函数 selfCC 均不超过 15，测量见 complexity.json。未改变页面协议版本，不表示真实 DQE、Relay 或生产环境已验收。
