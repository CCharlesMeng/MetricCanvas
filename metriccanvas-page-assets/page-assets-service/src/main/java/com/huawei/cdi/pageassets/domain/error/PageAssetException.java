package com.huawei.cdi.pageassets.domain.error;

import com.huawei.cdi.pageassets.domain.page.TypedError;
import com.huawei.cdi.pageassets.domain.revision.RevisionRef;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * 业务失败的唯一载体：稳定码 + 人读 message + 按码取形的 details。HTTP 状态映射在入站适配器完成。
 */
public final class PageAssetException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    private final ErrorCode code;
    private final transient ErrorDetails details;

    public PageAssetException(ErrorCode code, String message) {
        this(code, message, null);
    }

    public PageAssetException(ErrorCode code, String message, ErrorDetails details) {
        super(message);
        this.code = Objects.requireNonNull(code, "code");
        this.details = details;
    }

    public ErrorCode code() {
        return code;
    }

    public Optional<ErrorDetails> details() {
        return Optional.ofNullable(details);
    }

    public static PageAssetException invalidPage(List<TypedError> errors) {
        return new PageAssetException(ErrorCode.INVALID_PAGE, "页面文档未通过校验", new ErrorDetails.InvalidPage(errors));
    }

    public static PageAssetException pageIdMismatch(String commandPageId, String documentId) {
        return new PageAssetException(ErrorCode.PAGE_ID_MISMATCH,
                "命令页面 id " + commandPageId + " 与页面文档 id " + documentId + " 不一致");
    }

    public static PageAssetException confirmationRequired(String pageId) {
        return new PageAssetException(ErrorCode.PAGE_ID_CONFIRMATION_REQUIRED, "首次保存前必须确认页面 id " + pageId);
    }

    public static PageAssetException pageNotFound(String pageId) {
        return new PageAssetException(ErrorCode.PAGE_NOT_FOUND, "页面不存在:" + pageId);
    }

    public static PageAssetException revisionNotFound(String revisionId) {
        return new PageAssetException(ErrorCode.REVISION_NOT_FOUND, "页面修订不存在:" + revisionId);
    }

    public static PageAssetException revisionConflict(String message, RevisionRef currentLatest) {
        return new PageAssetException(ErrorCode.REVISION_CONFLICT, message, new ErrorDetails.RevisionConflict(currentLatest));
    }

    public static PageAssetException idempotencyConflict(String idempotencyKey) {
        return new PageAssetException(ErrorCode.IDEMPOTENCY_CONFLICT,
                "幂等键 " + idempotencyKey + " 已被不同的请求使用");
    }
}
