# B5 显式跨页传值验收

用户决定：只做跨页传值，不需要恢复；B6挂起。唯一主计划为[§22](../../plan/2026-10-16-ioc-header-feature-plan.md)。本批在既有隔离工作树承接未提交B4，不提交、不推送，不迁移已有业务页面。Schema6.36；代码/生成物指纹`c6886cbcb47c8c806c231c9e31003ae3845b9ff69ec702f8f4857e275bd4ce82`，路径与哈希见[evidence/code-manifest.json](evidence/code-manifest.json)。

本地实施和分发闭环完成。新增显式`validateTargetInputs:true`导航及`strictURLInputs:true`接收策略：映射row/param/filter到URL，源页通过目标公开输入投影验证类型、粒度、层级、必需值，目标页独立解释URL并继续执行既有候选授权门禁。省略标记保留旧页兼容；规范化升版本不会暗中开启严格行为。

## 实际页面与手动操作

从[Playground目录](http://127.0.0.1:4208/)的验收分组发现三页，也可直接访问：

1. [概览来源](http://127.0.0.1:4208/pages/ioc-header-navigation-source-demo)：期间、币种和区域为已应用输入，点“携带已应用条件进入清单”。
2. [清单目标/详情来源](http://127.0.0.1:4208/pages/ioc-header-navigation-list-demo?origin=直接入口)：行“示例项目甲”传`P&中文/001`与名称、来源、单月、币种及多值区域。清单是内联合成数据。
3. [详情直接入口](http://127.0.0.1:4208/pages/ioc-header-navigation-detail-demo?project-id=P001&project-name=示例项目&origin=直接入口&month=2026-09&currency=RMB&regions=north)：身份参数只读；详情单月独立可改，正文显示本地合成HTTP实际收到的查询条件。

真实浏览器已从目录进入来源→清单→详情；另在清单选择USD，详情URL、已应用条件及服务回显均为USD，编码特殊字符完整，区域north/south仍为两个值，见[浏览器截图](evidence/artifacts/preview-transferred-usd.jpg)与[可访问树](evidence/artifacts/preview-transferred-usd.txt)。详情修改月份不回写来源；新标签和刷新只消费各自URL。“使用默认条件重新打开清单”明确使用默认条件，不恢复先前视图。

关键负向场景：清单切季度再点行，提示不能隐式截成详情单月；缺编码行拒绝使用href中的stale值；来源“目标能力缺失示例”无可用href，操作显示契约错误。详情直接URL删project-id、month=bad、currency=BAD均显示输入错误且HTTP查询数为0。行为测试另覆盖目标投影迟到/取消、能力撤回、缺映射值不得回退默认、维度层级不得改变。目标授权候选仍在目标运行实例验证，投影不宣称具有授权结论。

## 功能、文档、分发对应

| 能力 | 实际页面/行为 | 真源文档与分发 |
|---|---|---|
| row/param/filter显式URL映射 | source/list/detail；项目键、名称、来源、期间、币种、多选 | PAGE-METADATA、actions-and-navigation、params-and-initialization、PAGE-PARAMETERS、reference-map及三页示例 |
| 目标输入与严格URL策略 | 三页strictURLInputs；非法输入阻断查询 | Zod/领域类型、能力门槛6.36、正反契约；公开projectNavigationInputs/resolveNavigationTarget |
| 接入应用 | Playground实际页面仓库；Embed同源投影；Platform阅读路由 | 共用RuntimeNavigation；无目标能力明确拒绝，普通链接兼容 |
| 受控创作和编辑 | set_table_link的validateTargetInputs与set_url_input_validation；保存重开/回滚 | 产品Bridge、两份Skill、837/4/1生成文件、Bundle2978哈希、仓外Skill与六包安装消费者 |

## 验证结论

- 本地：check/build通过；44/44页面；Python552项（1跳过）；契约/Bundle/复杂度通过。Vitest全量268文件通过、1文件三个30秒超时；该文件保持阈值单独重跑20/20，覆盖全量269文件的唯一结果为2361通过、4跳过。**这是全量加独立重试，非一次全量全绿。**
- 浏览器：实际Playground6/6；源码Embed57/57；另有时间兼容26/26；仓外六包消费者38/38。测试组存在重叠，不相加成唯一个数。1440/1024/390的三页共9帧根级横向溢出0；390截图已目视检查，服务长文本在表格自身滚动区域展示。
- 分发：独立Skill仓外复制3/3实际页面可校验、无外链；六包tarball安装后Node ESM15页可解析，HTTP执行回归及B5安装浏览器通过。Platform只做单元/类型/构建验证，未声称真实门户验收。
- 真实DQE、Relay、CloudIOC、门户SDK、DS真实模型、CI与部署均**NOT_RUN**。当前查询服务为本地合成Sim，不能据此认定真实授权或服务已验收。

原始日志、失败尝试与重试结果完整列于[evidence/verification.json](evidence/verification.json)；对应断言见[验收账本](alpha-tests.md)。没有新增视图快照/恢复/导航条目存储；B6整体挂起，88项规划保留。

## 重启预览

在隔离工作树分别运行：

```sh
DQE_SIM_PORT=4210 DQE_SIM_HOST=127.0.0.1 pnpm sim:dqe
DQE_SIM_PORT=4210 pnpm --filter playground dev --host 127.0.0.1 --port 4208
```

浏览器验收读取上面同一份pages文件，不临时改写交互配置。原工作区并行修改的观察记录见[evidence/preservation.json](evidence/preservation.json)。本批为现有UI上的逻辑实施，无外部设计源复刻，SDD不适用；未声称独立代理审核。
