# 安装消费端 CI 验收宿主修正

日期：2026-10-30。基线 `50ba76ebac45ce929d14b1627813c9ad67144803` 包含同比环比提交 `f0993f1146bb2d134ae9061fcf9449ea121444da` 及执行边界修正。

该基线的 [CI 40987562959](https://github.com/CCharlesMeng/MetricCanvas/actions/runs/40987562959) 中 authoring、tests、types、build 均通过；compatibility 的安装消费端浏览器回放510项通过、8项失败。8项对应4个场景在Chrome与Edge各失败一次，不能记为全绿。

## 复现与原因

从该CI的 `compatibility-current-50ba76ebac45ce929d14b1627813c9ad67144803` 工件取出实际 `embed.tgz`，只解包其dist到独立工作树的示例宿主。使用相同运行时二进制执行以下命令，四个场景全部复现失败：

```sh
MC_EMBED_EXAMPLE_PORT=5287 pnpm --filter @metriccanvas/embed exec playwright test \
  --grep 'protected payload|机会点清单使用|Tab 活动面板|explicit tabs' --workers=1
```

1. 通用示例宿主无条件调用 `projectNavigationInputs`，导致故意非法的图表文档在挂载前抛错，引擎没有机会发送结构化invalid事件。现在仅共享筛选桥确实需要公共输入时才进行该投影。重点国代共享输入的投影与导航语义保留。
2. IOC布局测试注入的网关缺少可信候选Adapter，区域筛选阻塞查询并在页头出现等待说明，导致80px高度与表格行断言同时失败。补齐测试宿主的合成候选服务后，原80px、布局、溢出与数据行断言全部通过，未放宽断言或改变产品布局。
3. 旧tabs测试在IOC Region上主动写入 `hierarchyPicker: tabs`，与已生效的ADR-0124冲突。改为验证该声明被结构化拒绝、错误路径为 `/filters/1/hierarchyPicker`、不派发DQE请求且无pageerror。后续单树原子提交、不可清空、重复选择不重查等交互测试保留并通过。

修改范围为嵌入示例宿主及浏览器验收夹具，产品协议和运行时行为保持当前契约。Schema仍为6.77。浏览器测试是参考索引的验证真源，官方生成器重新生成索引与分发清单；local-authoring补丁版本为1.14.1。

## 验证

- 首先逐项复跑：图表1项、IOC布局2项分别恢复；包含合法单树交互的5项最小集全部通过。
- 扩展为 chart-echarts-option、embed、ioc-header-business、key-office-filter 四个完整浏览器文件，Chrome 50项通过，运行时仍是CI原工件，验证修正作用于宿主与夹具。
- `pnpm build:packages` 通过；`pnpm --filter @metriccanvas/embed check` 通过，Svelte零错误、零警告。
- 执行边界及页面id中立性2项通过；`git diff --check` 通过。
- 独立local-authoring与参考手册2文件42项通过；最终 `pnpm mc:content:check` 通过，包括1317产品、4创作、1接口派生文件一致、MC源覆盖、33项Python测试及诊断夹具。完整Chrome/Edge安装消费端矩阵以修正提交对应CI为准。

本地原始日志位于 `/tmp/period-ci-repro.log`、`/tmp/period-ci-green.log`、`/tmp/period-ci-browser-regression.log`；原CI工件保留在 `/tmp/period-compat-artifacts-50ba`。这些是合成验收，不构成真实DQE或Relay证明。

## 复杂度与清理

用仓内 `metriccanvas-ts-ast/1`、TypeScript5.9.3 对三个手写变更文件的HEAD基线与当前内容测量；HTML提取module script，测试内可执行的 `INSTALL_IOC_GATEWAY` 字符串单独提取测量，未将字符串当作已覆盖代码。

宿主的共享筛选判断为顶层条件；现有宿主函数自身CC保持。注入的 `window.iocGateway` 为2→2，新增候选请求函数为2；新增与修改的测试回调及辅助函数均≤15，无本批未关闭超限。完整前后结果见 [compatibility-complexity.json](compatibility-complexity.json)。

没有添加DEBUG日志、产品故障开关或临时产品能力。原期间比较工作树里的后续分页方案文档保持原状；本次修正在独立 `period-ci` 工作树完成。
