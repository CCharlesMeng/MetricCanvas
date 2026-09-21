# 旧链路可复现历史基线（#122 / ADR-0074）

固定提交：`fbc391a27419e1de7f5d20d8cf3f269611b27b04`。
固定 tag：`legacy/pre-static-platform-2026-09-08`（已推送 origin）。

完整仓库提交保留旧 Node/MCP、Java 实现、共享包、锁文件、脚本、测试与夹具；本记录不宣称旧链已从主线移除。基线冻结后只供复查，不继续开发，也不参与后续主线的默认工具链。

## 独立复现

```sh
git worktree add --detach /tmp/metriccanvas-legacy-102 legacy/pre-static-platform-2026-09-08
cd /tmp/metriccanvas-legacy-102
pnpm install --frozen-lockfile
pnpm test
pnpm build
python3 -m venv /tmp/metriccanvas-baseline-python
/tmp/metriccanvas-baseline-python/bin/python -m pip install --require-hashes -r metriccanvas-authoring/tool/requirements.lock
PYTHONDONTWRITEBYTECODE=1 /tmp/metriccanvas-baseline-python/bin/python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p 'test_*.py'
cd metriccanvas-page-assets
mvn -B -ntp test
```

使用完整仓库的独立 worktree，不以主线 node_modules 链接冒充独立安装，不另建嵌套 Git 仓库。依赖需要网络或完整缓存；首次离线安装缺缓存，按原锁文件联网安装后成功。

## 2026-09-08 实证

- 仓外路径 `/tmp/metriccanvas-legacy-102`；安装覆盖原 16 个 workspace，锁文件未改。
- Node 24.11.1、pnpm 11.13.0；原 Vitest：176 passed / 7 skipped 文件，1376 passed / 53 skipped 用例。此时未启动 DQE 仿真，因此不等同于运行仿真时的全量通过。
- 原 `pnpm build` 的 embed、Canvas 静态应用和平台 Node 构建均通过。
- Python 3.14 独立虚拟环境按 requirements.lock 安装，原 152 项 unittest 全部通过（含 stdio Harness）。
- 原 Java 在已安装 JDK 21.0.10 + Maven 3.9.11 下 `mvn -B -ntp -o test` 通过：261 tests，0 failures，0 errors，15 skipped。初次 JDK 25 沙箱内运行受 Mockito attach 限制，改用 JDK 21 并在沙箱外复跑成功；未改基线代码。
- Java 15 个跳过项、真实数据库、目标 JDK 17 与生产服务接入均不由这次测试证明。
- 原始日志存于 `/tmp/wayfinder-102/baseline-{test,build,java,python}.log`（临时证据）；持久索引为此文件和 #122 评论。

## 后续删除门槛

#123 提取工作台浏览器能力；#124 解除契约生成对旧编排的依赖；#125 按消费者逐组移除旧服务和默认工具链。页面资产客户端仍受 #105 的已确认接口消费验证约束。#104 真实部署与 #95 终点保持开放，历史基线不替代功能等价、真实接入或生产门槛。
