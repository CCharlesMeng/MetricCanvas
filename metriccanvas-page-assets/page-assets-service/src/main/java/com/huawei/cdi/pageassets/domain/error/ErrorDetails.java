package com.huawei.cdi.pageassets.domain.error;

import com.huawei.cdi.pageassets.domain.page.TypedError;
import com.huawei.cdi.pageassets.domain.revision.RevisionRef;

import java.util.List;

/**
 * 错误信封的 details 只有两种取形（ADR-0062）：`INVALID_PAGE` 携带契约 `type/path/message` 列表，
 * `REVISION_CONFLICT` 只携带 `currentLatest { revisionId, revisionNumber }`（页面尚无修订时为 null）。
 */
public sealed interface ErrorDetails permits ErrorDetails.InvalidPage, ErrorDetails.RevisionConflict {

    record InvalidPage(List<TypedError> errors) implements ErrorDetails {
        public InvalidPage {
            errors = List.copyOf(errors);
        }
    }

    record RevisionConflict(RevisionRef currentLatest) implements ErrorDetails {
    }
}
