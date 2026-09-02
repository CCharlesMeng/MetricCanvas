package com.huawei.cdi.pageassets.domain.page.json;

/** RFC 6901 JSON Pointer 片段转义，与基线 `escapePointer` 一致。 */
public final class JsonPointer {
    private JsonPointer() {
    }

    public static String escape(String segment) {
        return segment.replace("~", "~0").replace("/", "~1");
    }

    public static String child(String path, String segment) {
        return path + "/" + escape(segment);
    }

    public static String index(String path, int index) {
        return path + "/" + index;
    }
}
