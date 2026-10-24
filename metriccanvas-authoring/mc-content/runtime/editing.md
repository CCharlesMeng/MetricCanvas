# 精确编辑与操作回执

read_page_context 返回 pageId、ref、workVersion。edit_page 的 page_id 精确等于该 pageId，expected_version 等于观察的工作版本；context_ref 由可信程序绑定身份、页与轮次。工作版本不能代替 Java revisionId。目标配置分页沿同一工作版本和 nextCursor 继续，省略不表示不存在；remove_section 使用完整 componentIds。

受控操作闭集、required 与分支由 tool/edit_page 的完整 inputSchema 定义。add_result_component 原子注册 resultRef 对应新源并挂到 sectionId；add_source_component 复用已有源。add_section 的初始 blocks 只引用已有源或真实文本，不能提前引用尚未注册的新结果源。页头受保护。

每个操作后校验整页；分区至少有一个组件。跨分区移动唯一组件会因空分区失败，即使后面还有 remove_section。已取得可信正文的文字可用 add_text（全页唯一新 ID）复制，再以 dependsOn 删除原分区及其完整 componentIds，最后 move_component 定位。正文省略时无法从标题恢复；占位组件可能在部分成功保存后残留，不是原子事务。

operations 逐项返回 applied/failed/skipped；partial 可保存独立成功项，不代表整批成功；unchanged、全失败或非法页不新增保存。CURRENT_PAGE_STALE、竞争、权限及 unknown 保存由程序核对原冻结提交，不能以新入口重放。saveStatus=saved 且 ref/draftId/artifactRef 可核验才证明保存；预览失败不重复保存。

set_ioc_header 完整替换根 header（null 删除），不删除旧业务页头或改写筛选/查询。Dashboard 须同批显式 dashboardToolbar=hidden 或基线已 hidden。set_url_input_validation 的 enabled 控制 strictURLInputs；不能由 Schema 版本推断开启。IOC 自动装配仍不支持。
