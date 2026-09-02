package com.huawei.cdi.pageassets.domain.revision;

import java.util.UUID;
import java.util.regex.Pattern;

/** 修订 id 由 Java 生成：UUIDv4，按公司惯例存 `char(32)` 无横线形式（ADR-0062）。 */
public interface RevisionIdGenerator {
    Pattern SHAPE = Pattern.compile("^[0-9a-f]{32}$");

    String next();

    static RevisionIdGenerator uuidV4() {
        return () -> UUID.randomUUID().toString().replace("-", "");
    }

    static boolean isWellFormed(String revisionId) {
        return revisionId != null && SHAPE.matcher(revisionId).matches();
    }
}
