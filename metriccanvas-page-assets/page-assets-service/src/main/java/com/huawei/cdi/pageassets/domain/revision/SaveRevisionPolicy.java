package com.huawei.cdi.pageassets.domain.revision;

import com.fasterxml.jackson.databind.JsonNode;
import com.huawei.cdi.pageassets.domain.error.PageAssetException;
import com.huawei.cdi.pageassets.domain.page.PageValidator;
import com.huawei.cdi.pageassets.domain.page.TypedError;
import com.huawei.cdi.pageassets.domain.page.json.Json;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * 保存修订的判定（基线 `saveRevisionPrecondition` + `checkSaveDocument`）。判定只有这一份实现：
 * 内存与 MySQL 仓储只负责各自的存储副作用。
 */
public final class SaveRevisionPolicy {
    private final PageValidator validator;

    public SaveRevisionPolicy(PageValidator validator) {
        this.validator = Objects.requireNonNull(validator, "validator");
    }

    /**
     * 前置判定（乐观锁 + 首保确认）。首保：baseRevisionId 必须为 null 且必须显式确认页面 id；
     * 后续保存：基线必须是当前最新修订。
     */
    public void precondition(Optional<PageHead> head, SaveRevisionCommand command) {
        if (head.isEmpty()) {
            if (command.baseRevisionId() != null) {
                throw PageAssetException.revisionConflict("首次保存的 baseRevisionId 必须为 null", null);
            }
            if (!command.pageIdConfirmed()) {
                throw PageAssetException.confirmationRequired(command.pageId());
            }
            return;
        }
        PageHead current = head.get();
        if (!current.latestRevisionId().equals(command.baseRevisionId())) {
            throw PageAssetException.revisionConflict(
                    "保存基线不是当前最新页面修订:" + current.latestRevisionId(), current.latest());
        }
    }

    /**
     * 内容判定：完整页面复验（结构 + 全部跨引用不变式，版本策略含在校验器内）+ 命令与文档 id 一致。
     * 返回提交的原样文档（修订存原样，不存解析产物）。
     */
    public JsonNode checkDocument(SaveRevisionCommand command) {
        List<TypedError> errors = validator.validate(command.document());
        if (!errors.isEmpty()) {
            throw PageAssetException.invalidPage(errors);
        }
        String documentId = Json.text(Json.get(command.document(), "id"));
        if (!command.pageId().equals(documentId)) {
            throw PageAssetException.pageIdMismatch(command.pageId(), documentId);
        }
        return command.document();
    }
}
