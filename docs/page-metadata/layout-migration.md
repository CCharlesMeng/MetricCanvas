# 6.1 布局兼容与存量迁移

当前页面协议6.1；读取接受6.0/6.1，新写出为6.1 + `layout`。四个引擎交付物锁步 `1.0.0-rc.2`，此为本地候选版本；Svelte公开支持范围仍为 `>=5.29.0 <6`。没有执行registry发布。

| 原始文档 | 读取 | 规范化写出 |
|---|---|---|
| 6.0 + layoutForm:report/dashboard | 接受 | 6.1 + layout原值 |
| 6.1 + layout:report/dashboard | 接受 | 原布局 |
| 6.1 + layoutForm:report/dashboard | 持续兼容接受 | 6.1 + layout原值 |
| 6.0/6.1均无布局字段 | 接受，report | 6.1 + layout:report |
| 6.0 + layout | 拒绝能力越级 | 不写出 |
| 任意双字段，包括同值 | 拒绝双真源 | 不写出 |
| 未支持版本或非法布局值 | 拒绝 | 不写出 |

组件自身的 `layout` 对象、分区容器与列轨、dashboard工具栏都不变。旧6.1 layoutForm兼容承诺同样保留，不能将它误删为“过渡实现”。运行态Page已删除layoutForm属性，旧字段只保留在PageDocument输入类型和校验/规范化边界。

## 安全升级顺序

1. 先升级所有读取方至支持6.1的引擎，之后启用新版写出。仅支持6.0的消费者不能消费6.1，不伪造降级版本号。
2. 精确读取持久化修订时先验证原始内容hash、ref和请求归属，再调用 `normalizePageDocument`（Python为 `normalize_page_document`）。不能用规范化后文档比原hash。
3. 旧不可变修订、来源引用与冻结报告不原地重写；规范文档用于新的工作副本。保存升级结果须创建新修订；历史读取保持旧原文。
4. 新动作开始时确定规范文档；重试沿用同一操作键与请求内容，不随重试重新生成不同文档。哈希算法和服务端幂等权威由提供方确认。

`normalizePageDocument`复制原始完整文档，仅升级顶层布局/版本，保留参数文本引用、分组字段、queryField和DQE原始initial行。`parsePage`还会物化文本和字段/行，仅供渲染，不能反写为原持久化文档。

## 本地文件迁移

```sh
node --import tsx tools/scripts/migrate-layout.ts old-page.json new-page.json
```

工具完整校验输入后写独立新文件，拒绝相同路径与已存在的输出。先写同目录临时文件，再原子创建新输出；无效文档不留下目标。它不连接资产服务、不伪造修订，不批量覆盖目录。新结果再次迁移仍相同。

5.x不是该工具的输入范围。先按ADR-0068使用显式部署URL映射完成导航迁移到6.0，再经本工具生成6.1新文件，均保持历史原文。

## 可复验依据

- 当前生产样例：pages/和非legacy的packages/page/fixtures/contract-valid；都必须为唯一新写出。
- 旧读取专用：legacy-layout-report.json、legacy-layout-dashboard.json。
- 完整32项矩阵：contracts/metriccanvas/page/conformance/layout-compatibility.json，由当前公开规范化结果单向导出；TS与Python均比对完整输出/错误。
- 当前写出与CLI门禁：packages/page/tests/canonical-writers.test.ts、layout-migration-cli.test.ts。
- 打包与支持区间：tools/package-build/README.md；本次精确树、包摘要及实际浏览器结果见T07验收回执。

本说明不代表真实Java/Relay、IOC或内网部署已完成；#103/#104继续跟踪真实消费者与部署。页面元数据参考手册的全模块字段生成/分发属于#126 M2交付，此次仅先明确布局迁移入口，不宣称手册主体已交付。
