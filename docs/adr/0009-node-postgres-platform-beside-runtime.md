# 平台采用独立 SvelteKit Node + PostgreSQL,统一运行时保持独立

二期新增独立的 SvelteKit Node 全栈平台应用,承载页面搭建工作台、Agent Runner、MCP、发布确认和管理入口,以 PostgreSQL 持久化看板页面、页面修订与发布状态。现有统一运行时继续独立构建和部署,正式通道与预览通道分别通过平台 `PageRepository` 适配器读取当前发布修订和指定页面修订,运行时不感知 PostgreSQL、修订或 Agent。

Agent Runner 只依赖模型提供方与 MCP 客户端接口。内置调用和后续远程调用复用同一 MCP server factory、工具 Schema 与结构化结果,区别仅在 transport adapter;平台领域模块与 PostgreSQL 不向 Agent Runner 开旁路。

## Considered Options

- 把现有静态统一运行时改成全栈应用:会把页面呈现与生产治理耦合,破坏既有 `PageRepository` seam,被否决。
- 让 Agent Runner 直接调用领域模块以减少协议开销:会形成内置与外部 Agent 两套治理路径,被否决。
- 以内存状态完成技术 MVP 后再接数据库:无法验证重启持久化和事务不变式,被否决。

## Consequences

- DeepSeek Secret 和 PostgreSQL 连接只存在于 Node 服务端环境,不得进入浏览器 bundle、日志、页面文档或数据库内容。
- PostgreSQL adapter 负责事务和持久化映射;页面生命周期模块的公开接口仍以领域动作和结构化结果表达。
- 页面搭建工作台保存完整对话的责任留在当前浏览器会话,平台只记录结构化写操作与必要的用量/错误分类。
