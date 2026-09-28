# 独立部署 Adapter 本地验证

日期：2026-09-28。范围：ADR-0094 的通用部署契约、连接清理、静态组合及活动开发入口解耦。外部报告与门户专属材料按用户要求归档于 docs/plan/qiankun-platform/portal-handoff/，不作为平台测试 fixture 或构建输入。

## 修改

- 部署契约 v1：可由外部经典脚本注册 Adapter，按 mount 创建连接，失败/卸载后只调用一次 disconnect。
- 主应用可保持原始 props，由独立 Adapter 映射；原直接标准 props 路径仍可用。
- 配置变化默认真实订阅；明确承诺整页重载的部署可选择 reload 模式，仍检查每请求作用域。
- 组合工具随静态归档发布，核验平台摘要、保留输入、生成独立组合清单；拒绝版本不兼容、覆盖输出或将已有组合再次当平台输入。
- 移出活动源码中的门户专属开发身份、SDK 地址、证书/域名启动脚本和代理；旧文件保存在仓内交接资料目录，默认开发绑定 loopback。
- 未改变 Java/DQE 鉴权协议，未编写或猜测内网 Adapter，未修改无关工作区文档。

## 本轮实际证据

| 检查 | 结果 |
|---|---|
| platform check | PASS，Svelte 0 错误/警告，测试 TypeScript 通过 |
| 平台与页面试验场配置回归 | PASS，35 文件、399 测试 |
| 独立 build | PASS，仍有大 chunk 提示，未作性能验收 |
| 微前端 build/pack | PASS，生产资源扫描通过 |
| 仓外声明消费 | PASS，只复制 portal-contract.d.ts，用独立 TypeScript Adapter 编译，不导入平台源码 |
| 直接 props 生产浏览器 | PASS，标准 qiankun 2.10.16、Chromium 151.0.7922.34 |
| 外置 Adapter 生产浏览器 | PASS，组合工具实际生成 HTML；主应用仅提供合成权限 props，连接创建与清理数匹配 |
| 目标门户私有补丁与真实身份/服务/SDK | NOT_RUN |
| 发布、Git 提交/推送、远端 CI | NOT_RUN |

两种浏览器路径复用现有生产场景：内部 URL/后退/前进/刷新、编辑保存重新打开、区域内外编辑保护、局部弹层、token 更新、身份失效、卸载重挂/快速切换、失败挂载清理及未知写入不重发。HTTP 为替身，外部 guard 由测试主应用提供；不能据此声称真实门户已提供 guard 或支持相同生命周期行为。

复现外置路径：先执行 `pnpm --filter platform pack:microfrontend`，再执行 `DEPLOYMENT_ADAPTER_TEST=1 pnpm --filter platform test:microfrontend`。直接路径去掉环境开关。

## 产物快照

- 本地 RC：`1.0.0-rc.2`，不是 registry 发布。
- 归档：`apps/platform/dist/metriccanvas-platform-1.0.0-rc.2.tar.gz`。
- SHA-256：`74b49038b7bcd70e0c82f8b4176c77f3226291c57681bf4f4f24f6497dc99ba3`。
- Git 基线：`97ec583bf4e41f5b2ed040c10d8b20fa1e279e6e`，`sourceDirty=true`，不是包含本轮改动的提交。
- 源码输入树摘要：`815a78dbf3964e6a307bd094ec46295d3fb1ddd663779e0e11ccd46fdbcf640f`。
- 最终归档新增组合脚本的“拒绝二次组合”保护后已执行定向测试与重新 pack；浏览器验证使用同一 UMD/CSS/契约内容，未重复无关全站浏览器检查。

真实 Java/DQE 身份字段映射尚未获得，配置缺失仍失败关闭；AI 扩展完整类型分发和实例 SDK 兼容需单列，不以基础 Adapter 类型通过替代真实 AI 接入。Git 历史与既有历史材料不属于本轮追溯清理范围。
