# S6 组合创建、S7 四类扩展与统一 HEAD 验收

日期：2026-09-15。实现冻结 HEAD **`09982cb`**（S6基础 `dfd9fce`）；验收后只补仓库证据文档。分支 `codex/unified-authoring-s1`，独立工作树 `/private/tmp/metriccanvas-unified-s1-20260915`，没有push或生产切换。

## 分层状态

| Slice | 代码／确定性验证 | 真实模型 | 真实接入 |
|---|---|---|---|
| S0 | 来源与哈希盘点完成 | 不适用 | 内部调查来源并非直接源码验证 |
| S1 | 统一作者、分发、五工具边界及回归pass | blocked，旧分数不复用 | Relay注入/路由待提供方 |
| S2 | latest交接、本轮门禁、范围读取、本地工作台pass | blocked | latest/身份/产物分流待提供方 |
| S3 | 不可变候选、最终选择、只保存最终稿pass | blocked | 实际候选/程序/生命周期提供方待接通 |
| S4 | SQLite重启恢复、取消/预算、精确发布及浏览器恢复pass | blocked | Java/Relay原子与恢复语义待实测 |
| S5 | 可信源映射、公开创建/已有页新增、共享格式向量pass | blocked | 内部源协议/规则等价/刷新待实测 |
| S6 | 受控混合创建，两种布局、已有页保持、失败依赖pass | blocked | 真数据与Relay完整任务待接通 |
| S7 | 四类可替换本地边界、实际消费者与拒绝测试pass；能力范围如下 | blocked | F1–F17内部规则与实现迁移未完成 |
| S8 | 就绪矩阵与成组回退步骤已落盘；真实切换/影子部署未执行 | blocked | 未完成，不可整体关闭规格 |

## S6 实际能力

统一create_content_page的request精确组合9类既有受控操作：六类内容add、add_data_component、set_component_layout、move_component。固定main目标与受保护page-header；不开放完整页面、任意props、DQE或rows。复用S5调度器和原构造器，仅新建执行creation layout。report/dashboard均保持显式内容顺序/span；现有页新增组合不重建手工页。独立成功可部分提交，数据失败不留源或假图、依赖跳过。未知字段引用/显式不支持组件拒绝。公开纵切6项，旧创建与普通问数回归保持。

## S7 实际边界与限制

- **数据**：原DataContext、DQE、SourceDescription端口。两套合成数据实现通过注册→发现→组合→候选，拒绝过期Spec、取消状态。
- **业务解释**：可替换propose端口仅向discovery提供带来源/版本、当前数据上下文版本的词汇/时间候选；核心校验真实治理目标，保留核心结果。同词多目标（含跨metric/dimension）和时间冲突显式ambiguity，不静默覆盖。默认无扩展保持原解析。两套合成扩展通过注册→公开发现→明确canonical Spec→组合。5新测试、6旧discovery回归。当前时间提案明确支持day/month/year且DataContext必须声明；其他粒度返回BUSINESS_TIME_UNSUPPORTED。
- **组件能力**：可替换choose策略只能选已通过产品硬门控且已有完整构造/渲染支持的类型。用户pinned优先；不允许扩展修改字段、props、页面schema或创造新组件。两种注册策略产生实际barChart/table合法候选，未知/硬拒绝/异常无fallback、既有页保持，共4公开测试。真正新增组件仍需产品schema、组装/编辑、前端renderer和兼容测试同步实现；配置不会代替这些本仓工作。
- **系统Adapter**：七个既有端口current_turns、candidate_store、execution_records、lifecycle_service/programs/identities、recovery_authority；完整性/方法/强能力检查，始终构造原Lifecycle和提交/恢复协调器。包顶层bootstrap组装公开MCP，application不反向导入inbound。两套独立SQLite系统经公开编辑→候选→丢回执→取消→原operation恢复saved，精确ref、冻结command、单次save、系统隔离通过。
- **装配**：四类slots严格分离；未知实现/字段、重复ID、同slot竞争、版本/hash不符、核心覆盖和弱Lifecycle能力拒绝。注册名选canonical或define-report，返回同一Skill作者/服务；不是内部平台已接受别名的证明。7部署测试通过。manifest不能动态import、读取任意路径或注册另一状态机。

来源hash由可信host核实后输入registry，本地比对不能证明远端代码真实性。内部业务规则、组织权限、数据解码器、自定义renderer、Java/Relay与H1–H15均未取得实证；具体未迁移项见[就绪清单](2026-09-15-unified-authoring-release-readiness.md)。这些外部缺口没有被用来省略上述本仓可实现消费者。

## 冻结 HEAD 的检查

- Python全套 **409项通过，25.791秒**，`work/final-09982cb-python.log`。包含公开MCP链路、旧普通问数/内容/发布、持久重启和四类扩展。
- TS **22文件312项通过**：278工作台、10turn契约、15导出隔离、9共享格式；`work/final-09982cb-ts.log`。
- 真实Chromium恢复测试pass，`work/final-09982cb-browser.log`；启动锁、重载、取消/查询、未核实状态、错误ref、精确打开、null释放、请求失败。测试无模型/保存调用；服务器已停止。
- `tsc --noEmit -p tests/tsconfig.json`、工作台测试tsconfig检查pass；svelte-check 0错误/0警告。S7只改Python，前端检查对应未变化的同一树。
- `node --import tsx tools/scripts/export-authoring-contracts.ts --check`、check_bundle.py、git diff --check通过。Bundle0.2.0，1460摘要检查。统一Skill **8文件、182行、17,875字节**；完整产品资料与普通问数保留，不把大规模生成副本删除计为业务代码减少。
- 从本HEAD离线构建sdist，安装到全新`work/final-installed`；空cwd、`python -I`、实际安装CLI验证五工具、九类组合Schema、SQLite静态dashboard候选及业务/组件/系统模块独立导入。缺提供方仍CURRENT_TURN_UNAVAILABLE，模型请求0。日志`work/final-09982cb-installed.log`。

| 冻结物 | SHA256 |
|---|---|
| bundle.json | e946771474c4fbf5750bfe4ee3dc00c8be44cc842e0d75ac320ec01e30a05e1b |
| bundle.lock.json | 097c6c39d371249b1e2a72972ce075c24388ff310c40888b38db57a6f5db4910 |
| contract-lock.json | 337e14b779d92357ea8d8e5c2c0ee92586c77c658ddaf8b262e4519b3b4ba46f |
| 本地sdist metriccanvas_authoring-0.2.0.tar.gz | 6f8e83c3d00b625db4afaec4f23c43878c706f4452c29373b1ab51cdf0477e59 |

真实模型请求仍为0。旧runner在新协议上明确退出；还需实现可信运行Adapter，并解决既有DeepSeek载荷/目的地址授权缺口，不能直接重跑旧runner。审批缺口、真实服务接通与内部向量三者是分别存在的剩余工作。
