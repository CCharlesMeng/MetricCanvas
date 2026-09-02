package com.huawei.cdi.pageassets.domain.page.document;

import java.util.List;
import java.util.Set;

/** 展示格式预设闭集；与 Page Schema 中 `textValueReference.format` 的 enum 一致（有测试守）。 */
public final class ValueFormats {
    public static final List<String> PRESETS = List.of(
            "text", "number", "number-1", "number-2", "number-grouped", "compact-wan-0", "compact-wan-1",
            "compact-yi-1", "cny-adaptive", "percent-0", "percent-1", "percent-2", "percent-2-signed",
            "date", "date-month-day");

    /** 数值语义的格式预设：只有 number 参数能引用。 */
    private static final Set<String> NUMERIC = Set.of(
            "number", "number-1", "number-2", "number-grouped", "compact-wan-0", "compact-wan-1",
            "compact-yi-1", "cny-adaptive", "percent-0", "percent-1", "percent-2", "percent-2-signed");

    /** 日历语义的格式预设：参数值是日历字符串时才有意义。 */
    private static final Set<String> DATE = Set.of("date", "date-month-day");

    private ValueFormats() {
    }

    public static boolean isPreset(String value) {
        return value != null && PRESETS.contains(value);
    }

    public static boolean suitsParamType(String format, String paramType) {
        if (NUMERIC.contains(format)) {
            return "number".equals(paramType);
        }
        if (DATE.contains(format)) {
            return "string".equals(paramType);
        }
        return true;
    }
}
