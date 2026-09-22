# T07 / #133 布局迁移收口验收

S2任务 `01a09f69-a06b-7703-b87b-ccdfe05d765e`，工作树 `/private/tmp/metriccanvas-126-s2`，分支 `codex/s2-layout-closeout-133`。基于S0已集成#131/#132的 `9135d22f1616ff63357cbfce5cd6a80b016f0e24`；实现提交 `27584af27ef3cec2475be308c2194075d8f8cd56`，精确验证树 `96bd6b1e91e9a0861ce8de3d54b7279f8c030964`。其后仅增加本回执与t07-artifacts.json，不更改被测源码或生成物。

## 结果与范围

- 运行态Page删除layoutForm过渡属性；PageDocument输入边界、公开规范化和校验仍保留6.0/6.1旧字段读取，以及缺省report。双字段一律拒绝，6.0新字段能力越级拒绝；未弱化32项兼容矩阵。
- 11个pages文档和11个当前有效夹具改为6.1/layout，仅修改版本/顶层布局；两个新版夹具原本已规范。另保留report/dashboard两个显式legacy夹具，当前有效夹具总数15。导出器使用无布局基底生成兼容矩阵，避免新版夹具污染旧输入。
- 四交付物锁步1.0.0-rc.2，全部当前产物/快照/锁按作者源单向再生成。冻结legacy-contracts和provenance未改。test_bundle_info从自身contract-lock读取候选版本，不再固定rc.1。
- 增加离线migrate-layout.ts：完整校验后复制规范化，只追加新文件，原子创建且拒绝已有目标；原输入、不可变修订和hash不变。无资产服务调用，无伪造修订。迁移手册说明先升级读取方、原始hash核验先于规范化以及历史文档回退边界。

## 精确验证

两套矩阵均从同一Git树archive到仓外，使用真实pnpm pack产物再npm安装；无工作区源码别名或symlink。每套分别执行源码test/check/build、四包打包、page-only Node ESM且无Svelte/ECharts、独立消费者严格peer安装、公开入口类型检查、Svelte检查、Vite构建及浏览器测试。

| 仓外矩阵 | Svelte | Vite / 插件 | Chrome | Edge | 浏览器结果 |
|---|---|---|---|---|---|
| 当前 | 5.56.6 | 8.1.5 / 7.2.0 | 152.0.7977.83 | 153.0.4234.32 | 102通过，0跳过/失败/不稳定 |
| 最低 | 5.29.0 | 6.3.6 / 5.1.1 | 152.0.7977.83 | 153.0.4234.32 | 102通过，0跳过/失败/不稳定 |

两版本源码均129文件、951测试通过，5个既有跳过；pnpm check及pnpm build成功。浏览器涵盖画布20项与Embed82项（分别在两浏览器执行），包括旧/新report/dashboard、ESM/IIFE、错误隔离、查询/初始行与正式渲染/创作隔离。支持范围仍为Svelte >=5.29.0 <6。

- `node --import tsx tools/package-build/check.ts`：四包rc.2的导出、声明、编译与打包门禁通过。
- `node --import tsx tools/scripts/export-authoring-contracts.ts --check`：192 product / 4 authoring / 1 interface，无漂移。
- `python3 metriccanvas-authoring/scripts/check_bundle.py`：478摘要通过。
- Python测试：156通过，无新增pending/豁免。
- Python sdist重新构建并安装到仓外独立目录；`python -I`从/tmp运行，模块与runtimeContracts均断言落在安装目录，32项完整规范化/错误矩阵通过；内置productContractVersion=1.0.0-rc.2、schemaVersion=6.1。Python自身包版本仍0.2.0。
- `git diff --check`通过。

原始矩阵、八个实际验证tarball、Python sdist及各日志的路径/SHA256见相邻t07-artifacts.json；它同时列出408个精确实现改动文件。临时产物位于/private/tmp，不代表永久发布渠道。

## 既有门禁修复

原compatibility.mjs在最低支持矩阵发现仓库已有安全overrides就直接assert失败。对9135d22基线脚本复现，日志 `/private/tmp/s2-t07-compat-before.log` 含“Merge existing overrides explicitly before extending this matrix”。最小修正只向既有overrides块加入三项框架版本钉选，保留原安全覆盖；原工作区锁文件不变。最终两套完整门禁均按修正后的精确树执行，没有删断言或跳过浏览器。

Edge未系统安装；从Microsoft官方渠道下载153.0.4234.32安装包，SHA256与官方元数据一致，沙箱外pkgutil确认Microsoft Developer ID签名与Apple公证有效，仅解包到临时目录。执行版本来自浏览器实际启动回执，未拿下载文件名冒充运行证据。

## 所有权与后续

S2负责Page类型/契约作者源/单向生成物、pages、迁移CLI/测试/文档及打包矩阵。精确文件清单见t07-artifacts.json。此前借用S1的五个文件已在#131验收后归还，本票没有再次修改。S3临时交给S2的唯一Python测试test-harness/tests/test_bundle_info.py随本票提交后归还S3。

#133依赖#131/#132已满足，不等待M0。本回执可供S0验收集成，M0是否READY仍由S0汇总#127/#128等决定；#143/#144必须等明确M0 READY，未提前实施。执行消费继续遵守#130精确目标/操作键、原始修订身份与hash先核验契约。

没有远端push、registry发布、Java/Relay实现或真实内网部署；#103/#104仍需原线验收。此票只交付布局迁移说明，#126 M2完整页面元数据参考手册的全模块字段生成/分发尚未完成，不计入本票成果。回退时保留已承诺的新旧文档读取能力；已写6.1的消费者不可回退到仅支持6.0的读取方。
