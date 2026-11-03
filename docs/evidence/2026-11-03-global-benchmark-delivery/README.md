# 独立全局均值关联交付

实施工作树为 `deliver-global-benchmark`，交付基线为 `2b6bbeee072d5c31fe5aa1356b758a42524bc176`。作者源来自 `global-chart-benchmark` 的 `552ef5c1228ce292ad9a2ec66673fa82e1c67ba4` 加本地修改；精确范围见 [来源清单](source-scope.json)。原工作树不被覆盖。

## 行为与协议

Schema 6.83 扩展现有 `joinAggregate.keys: []`，将独立完整单行结果的度量用于每个现有主行，只允许 `unique`。未新增字段或算子，字段净增减为 0。主行身份、顺序与数量保持，空主集合不制造行；零值保留、缺行补空，多行、查询失败、截断及总数矛盾沿错误路径传播。普通非空键关联保持原语义。

全局均值查询不绑定区域，仍绑定期间和站点，并遵守执行身份权限。区域切换只影响代表处数据，期间及站点切换同步刷新实际值和均值。数值复制、批次隔离、取消、完整读取与导出复用既有引擎。

原候选的 6.81 已被主线页头能力占用，交付顺延至 6.83，完整保留 6.81 页头和 6.82 列头默认值能力。6.82 及以下拒绝空键关联。升级示例由实际产品升级器重新生成。local-authoring 升为 1.20.0；所有契约、MC、Skill、锁及诊断夹具均从交付真源生成，没有复制原树生成包或手改摘要。

## 验收对应

- 页面：`pages/capabilities/chart/chart-global-benchmark.json`，入口 `/pages/chart-global-benchmark`；目录 README 给出筛选和异常步骤。
- 文档：`PAGE-METADATA.md`、`docs/page-metadata/compute.md`、`components/barChart.md` 及 reference-map。
- 协议：scalar-join 测试、三个导出反例、能力版本表；共用 `featureConformancePages` 注册，保留主线其他场景。
- Skill：正式导出入口生成协议知识、示例、独立校验器和完整身份清单；仓外复制与归档回验使用实际安装目录。

## 本地检查

- `pnpm test --maxWorkers=2`：16 个相关文件、148 项通过，覆盖计算依赖、期间比较、页头、列头默认值和柱线图。
- 初轮全仓测试因未刷新的升级示例失败，并在多项超时后中止，未报告全仓通过。升级示例已修复；另外四个超时文件以 `--maxWorkers=1` 原断言复验，33 项全部通过。没有放宽超时或业务断言。
- `pnpm check`：全仓类型检查通过，各 Svelte 检查无错误、无警告。
- Playground：真实 Chrome，区域、月份、站点、零值、空结果、重复结果、失败和窄屏通过；[机器报告](browser.json)、[宽屏](global.png)、[窄屏](narrow.png)。数据为合成预览网关。
- MC：最终 52 项测试通过、来源覆盖及生成一致性通过。首次整体检查在最终诊断身份处发现漂移，官方生成器刷新后通过；最后包装调用的末尾夹具因未禁用 Python 字节码而拒绝加载，清理本批生成缓存并显式设置 `PYTHONDONTWRITEBYTECODE=1` 后，该失败步骤复验通过。最终为组件检查与失败步骤复验的组合证据，未将先前失败包装调用报告为绿色，未修改断言或摘要。
- Embed：构建、独立 `check:dist`、类型检查及浏览器 261 项通过；14 个 JS，最大文件 929901 字节。实际 ZIP 逐文件字节核对通过，见 [归档回执](embed-archive.json)。
- `pnpm packages:check`：六个实际 pnpm tarball 的入口、类型、运行导出、相对引用及 Svelte 编译检查通过。
- local-authoring 五个专项 204 项通过，包含仓外整目录复制、合法/非法页面校验与升级回放；repair 两个文件 16 项通过。独立 Skill 1.20.0 tar.gz 实际打包与仓外回验通过，见 skill-release.json。
- 完整 `pnpm skills:check` 的历史 Bundle/其他 Skill 隔离部分按默认 local-authoring 验收范围主动中止，未把该包装命令报告为通过；标准远端 CI 继续执行仓库完整配置。
- 页面目录校验通过，零失败。

## 复杂度

使用 `metriccanvas-ts-ast/1`、TypeScript 5.9.3，逐函数自身 CC，包含新增辅助函数、匿名函数和测试回调；Svelte 仅提取 script，不把模板计为覆盖。完整前后结果与文件映射见同目录 complexity 文件。

| 函数 | 前 → 后 |
|---|---:|
| joinErrors | 3 → 4 |
| collectDependencies | 11 → 14 |
| completeDependency | 10 → 10 |
| scenarioEnvironment | 15 → 15 |
| tablePreview | 7 → 8 |
| queryTableGateway | 7 → 9 |
| previewDataGateway | 14 → 14 |

本次测量范围所有函数最高 15，无超限未关闭项；没有新增公开运行时 API。全局导出器沿用主线的集中场景清单，只增加声明项。

## 证据边界与保留项

上述为本地静态、确定性测试、合成浏览器及分发证据。真实 DQE、Relay、模型、目标集成应用和部署均未验收。原工作树内的原业务页候选、附件、历史生成物和验收材料继续保留，其 6.81 候选不作为本批正式 6.83 页面发行。

完整 Chrome/Edge 仓外兼容性和 Linux/Windows 原生 Embed 构建以精确交付提交的远端 CI 为准；本地 Chrome 不能替代该矩阵。
