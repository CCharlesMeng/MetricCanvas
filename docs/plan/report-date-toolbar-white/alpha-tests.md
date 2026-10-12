# alpha-tests

## AC ↔ 证据映射

| AT | 状态 | 执行环境 | 证据记录 | 新鲜度 | 说明 |
| --- | --- | --- | --- | --- | --- |
| AT-1 | PROVEN | mock | BE-1、BE-2、BE-3；artifacts/geometry-check.txt | review-1；dependency hashes 与当前代码相同 | 白底及顶边、左右边缘对齐；工具带与封面间隙为 0 |
| AT-2 | PROVEN | mock | BE-2、BE-3、BE-4；artifacts/geometry-check.txt | review-1；dependency hashes 与当前代码相同 | 390/320px 无横向溢出；月份范围改为 1—5 月后，期间文本更新且表格为 5 行 |

## 质量命令

19 项相关测试通过；engine check 0 errors / 0 warnings；两文件 git diff --check 通过。见 evidence/artifacts/。证据为本地模拟，未声明真实 Relay/DQE 服务验收或 PDF 端到端验收。
