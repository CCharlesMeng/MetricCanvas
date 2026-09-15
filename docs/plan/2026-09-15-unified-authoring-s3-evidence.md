# S3 候选链与最终草稿提交证据

日期：2026-09-15。实现 HEAD：`d2efc94`，共享契约：`bdd2195`。在独立 worktree `/private/tmp/metriccanvas-unified-s1-20260915`、分支 `codex/unified-authoring-s1` 验证；没有 push 或生产切换。

| 验收层 | 状态 | 证据与限制 |
|---|---|---|
| 本仓代码 | pass | 公开内容工具→不可变候选链→可信最终选择→Lifecycle保存→精确回读纵切通过 |
| 真实模型行为 | blocked | S2/S3 可信Adapter的真实模型runner尚未接入；旧runner拒绝协议，零新增模型请求，不复用历史分数 |
| 真实服务接入 | blocked | 当前轮次、候选持久存储、执行记录、可回读program通道与强Lifecycle实际提供方未验收，生产写路径关闭 |

## 实际行为

- 五个统一工具保持；read/edit增可选candidate_ref。compose/create生成新候选，edit可在根基线或同轮候选上续写。根身份/工作区/请求/运行/轮次/页/精确基线绑定不改变，子版本递增；兄弟分支以不同引用区分。
- 完整候选只在程序artifactEnvelope/store；模型获得安全摘要、candidateRef/version/hash。候选结构、完整页面、ID/hash、父版本和根绑定校验；root/candidate分页游标隔离；未知来源异常不输出原始秘密。
- 全失败、无变化不新建候选；最终与原基线语义相同不新建修订。合法独立成功子集仍可提交。
- 可信程序先原子claim最终引用和完整命令，再存program token与sending状态。重复调用保留原候选、operationId、描述、retainDimensionValues及载荷；只有选定最终稿保存一次。
- Lifecycle内部lookup→save、program-load→read的await间隙再次验证轮次，取消后不新增副作用。已发送未知结果保留原记录；重复调用只查询原操作，不重新发送。
- 成功回执经Lifecycle验证后，按精确ref回读并比较完整候选/hash才返回saved。旧FileLifecyclePrograms输入/输出分离不满足协调器roundtrip存储要求；本片使用明确实现该契约的测试替身。

## 检查与版本

- `PYTHONDONTWRITEBYTECODE=1 work/venv/bin/python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p 'test_*.py'`：**348项通过**。包含11条共享结构向量、4候选测试、12公开工具测试、17提交协调测试和3公开纵切测试。原始日志：`work/s3-python-full.log`；提交后同HEAD复验：`work/s3-d2efc94-python.log`。
- 公开纵切实际断言：人工列宽237保持，两候选只最终新增一个修订；回执丢失后相同operationId查询恢复且save_calls=1；另一窗口head推进后冲突拒绝且不覆盖。
- `node node_modules/vitest/vitest.mjs run tests/authoring-export-isolation.test.ts`：15项通过（`work/s3-ts.log`）。S3未改工作台TS，S2真实T20/工作台验证沿用S2证据，未将其当S3浏览器新证据。
- `node --import tsx tools/scripts/export-authoring-contracts.ts --check`、`check_bundle.py`通过：1426个摘要检查。Bundle 0.2.0；authoring-turn/1.0、authoring-candidate/1.0。统一Skill 8文件、178行、15,812字节，普通问数保持。
- 本地离线sdist构建并在`work/s3-installed`隔离安装，从空cwd使用`python -I`运行实际安装CLI：5工具、edit含candidate_ref；候选/提交模块从安装路径加载；缺当前提供方返回CURRENT_TURN_UNAVAILABLE；0模型请求。日志`work/s3-installed.log`。

## 后续边界

S3内存执行记录替身只证明端口消费，不证明重启恢复。原子更新、持久检查点、取消/预算/重启与精确发布闭环由S4继续验证；真实提供方与生产切换由S8验收。当前不能据本地pass宣布整片或整项目全部完成。
