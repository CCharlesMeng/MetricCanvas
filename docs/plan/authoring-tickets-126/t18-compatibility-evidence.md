# rc.4 分发兼容矩阵证据

S2任务01a09f69-a06b-7703-b87b-ccdfe05d765e，分支codex/s2-rc4-compatibility，工作树/private/tmp/metriccanvas-126-s2。

固定源码提交 `e3b94e31d9af9766547c2e4d4d656d8cf6919300`，树 `9ef0f9fc1d9045fd8e889f0fdfad6a61fcaec72a`，父正式#144基线 `3286efc91b0535e0ef839838b0985e338c3f5623`。唯一实现改动是compatibility.mjs增加#143/#144参数夹具复制及execution.spec.ts类型引用映射到安装包；保留原断言、安全overrides与零重试策略。node --check和git diff --check通过。

运行现有compatibility.mjs，显式--source-tree固定上述提交，METRICCANVAS_COMPATIBILITY_DIR=/private/tmp/s2-rc4-compatibility；Edge使用之前已取得的真实Microsoft Edge程序。脚本git archive创建隔离源码、两套依赖安装，最低版本只在隔离副本固定Svelte/Vite插件组合。原仓锁文件及源码不变，没有以旧rc.2矩阵代替。

| Svelte | 源码全量测试 | source check/build | 独立消费者 | 实际浏览器 | 浏览器结果 |
|---|---|---|---|---|---|
| 5.56.6 | 1045 passed | 5 skipped (1050) | 通过 | page-only Node ESM、严格peer安装、类型/Svelte检查、Vite构建通过 | Chrome 152.0.7977.83 / Edge 153.0.4234.32 | 112通过，0失败/跳过/flaky |
| 5.29.0 | 1045 passed | 5 skipped (1050) | 通过 | page-only Node ESM、严格peer安装、类型/Svelte检查、Vite构建通过 | Chrome 152.0.7977.83 / Edge 153.0.4234.32 | 112通过，0失败/跳过/flaky |

合计224项真实浏览器测试，包含ESM/IIFE、Canvas、版本门禁、布局兼容、维度参数和执行初始快照/筛选记录。四包均为1.0.0-rc.4，实际消费者安装来自每组四个tarball，安装包realpath不回指仓根；page-only不带Svelte/ECharts。所有公开子路径的类型与渲染消费门禁通过。此为仓外隔离消费者证据，不冒称真实内网#103验收或#104部署、Java/Relay真实联调。

结果总表 `/private/tmp/s2-rc4-compatibility/summary.json`；每组完整日志在对应版本/logs下，浏览器结构化报告在consumer/browser-results.json，浏览器版本在consumer/browser-versions.json。所有原命令输出总日志 `/private/tmp/s2-rc4-compatibility.log`，8份tarball清单在artifact-manifest.json。

- Svelte 5.56.6，`/private/tmp/s2-rc4-compatibility/5.56.6/embed.tgz`：SHA256 `b0d93f15c42326ba315af618382668111b4989d0456a00e47b168a38fba80a0e`，1374877字节。
- Svelte 5.56.6，`/private/tmp/s2-rc4-compatibility/5.56.6/engine.tgz`：SHA256 `7fdb1ee1eab807c973a1994ac1ef31b3467d26660ff38f8347924cc2c872d69a`，274709字节。
- Svelte 5.56.6，`/private/tmp/s2-rc4-compatibility/5.56.6/metric-canvas.tgz`：SHA256 `449b4e6b77b458b63a0fc9f9012de6f0aa10e5a76407027bfbf16d233d4f422d`，8078字节。
- Svelte 5.56.6，`/private/tmp/s2-rc4-compatibility/5.56.6/page.tgz`：SHA256 `2fcee835653592cbba3854e55c0b844257c2eed35fa1df433edf18dcc09feae9`，129373字节。
- Svelte 5.29.0，`/private/tmp/s2-rc4-compatibility/5.29.0/embed.tgz`：SHA256 `fa8cc35dd4e2be46288e06b0fd40c24d682ccccafbb7ec1d81f558cd8b50342b`，1438457字节。
- Svelte 5.29.0，`/private/tmp/s2-rc4-compatibility/5.29.0/engine.tgz`：SHA256 `35662800debd73c5d98f4298699007e82dde31d13d99b7826dea2661aea5233d`，270702字节。
- Svelte 5.29.0，`/private/tmp/s2-rc4-compatibility/5.29.0/metric-canvas.tgz`：SHA256 `538e05a8d8f1665663113114890cc8d3f65d41fd58a6937b3aad9ce1ee2ca8be`，8054字节。
- Svelte 5.29.0，`/private/tmp/s2-rc4-compatibility/5.29.0/page.tgz`：SHA256 `2fcee835653592cbba3854e55c0b844257c2eed35fa1df433edf18dcc09feae9`，129373字节。

矩阵运行时后续#136只变Python作者/生成锁，#142只变S1工作台属性；两者不改变本矩阵四产品包，因此无需重复无关分发浏览器。但本证据不声称在新共同基线重跑工作台全仓测试，手册最终组合仍须保留这些已验收增量。无registry发布、远端push或部署。
