# B5 验收账本

证据状态PROVEN仅指对应本地环境，不外推真实服务。代码输入以evidence/code-manifest.json为准；逐命令与原始输出见evidence/verification.json及logs/。

| 项目 | 状态 | 证据 | 可观察结论 |
|---|---|---|---|
| 显式来源→清单→详情 | PROVEN local/browser | Playground6项；Embed6业务项；手动USD截图 | 编码/名称/来源/单月/币种/多值准确传入，目标HTTP绑定一致 |
| 来源目标相互独立 | PROVEN browser | ioc-navigation.spec.ts | 详情改单月、刷新、新标签各用自身URL；重新打开清单按默认条件 |
| 期间语义 | PROVEN local/browser | navigation-inputs单测；季度负例；time-browser26项 | 年季月、详情单月、离散月份继续分开，拒绝隐式范围截单月 |
| 无契约/缺必需值/非法输入 | PROVEN local/browser | source缺目标、list空行、detail三种非法URL；required RED/GREEN | 无可用href或可读诊断；目标非法URL零查询；映射缺值不得用默认值掩盖 |
| 投影生命周期 | PROVEN browser | ioc-navigation-lifecycle.spec.ts | 旧投影被取消，迟到无效，能力撤回不会落回未校验链接 |
| 层级与封闭候选 | PROVEN local | navigation-inputs与运行筛选回归；level RED/GREEN | 不能默默改变来源level；私有/固定不可写输入不作为公开目标输入 |
| 兼容URL/交互入口 | PROVEN local/browser | navigation.spec、旧IOC和period/table组；check/build | 普通链接、原生anchor、新标签保留；严格策略必须显式标记 |
| 响应布局 | PROVEN browser | layout测试、navigation-geometry.json、三张390截图 | 1440/1024/390共9帧根级横向溢出0；长服务文本表格内滚动 |
| 协议与受控创作 | PROVEN local | version/publicAPI/正反契约；Python552项 | Schema6.36、strict标记编辑/移除与链接guard保存重开/回滚 |
| 产品分发/独立Skill | PROVEN installed | contracts837/4/1；Bundle2978；skill3页；六包Node15页/浏览器38项 | 同源生成、哈希闭合、仓外消费者可用 |
| Platform阅读接缝 | PROVEN local | reading-navigation.test.ts与check/build | /pages映射到/manage/pages，显式query/hash保留；replaceSearch无新增条目存储 |
| Vitest全量与隔离重试 | PROVEN with retry | vitest-full.log、vitest-isolation-retry.log | 三个30秒超时后完整单文件20/20；唯一2361通过4跳过，不称单次全绿 |
| 真实DQE/Relay/CloudIOC/门户SDK/DS/CI/部署 | NOT_RUN | verification.json | 本地合成数据、无真实模型调用不能替代真实验收 |
| 视图恢复/B6 | NOT_SELECTED / SUSPENDED | scope.md、主计划§22 | 无恢复实现或默认可选操作；88项编号不删改 |

失败尝试保留：源码浏览器首次56/57的失败为旧断言写死4175端口；改为当前URL origin后原57项全部通过。分发隔离测试保留30秒阈值，独立重试完整文件，不删失败测试、不放宽断言。最终生产代码冻结后完成build/authoring/installed；最后测试端口修正不改变生产或分发输入。
