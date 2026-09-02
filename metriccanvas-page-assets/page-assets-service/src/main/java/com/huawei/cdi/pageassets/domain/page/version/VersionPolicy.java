package com.huawei.cdi.pageassets.domain.page.version;

import com.fasterxml.jackson.databind.JsonNode;
import com.huawei.cdi.pageassets.domain.page.TypedError;
import com.huawei.cdi.pageassets.domain.page.json.Json;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 页面协议版本策略（ADR-0051）：`schemaVersion` 是 `MAJOR.MINOR`，当前主版本内全部次版本
 * 都被接受（ADR-0062 "保存接受当前主版本内全部受支持 minor"），声明的版本是能力下限。
 */
public final class VersionPolicy {
    public static final int MAJOR = 5;
    public static final int CURRENT_MINOR = 4;
    public static final VersionPolicy CURRENT = new VersionPolicy(MAJOR, CURRENT_MINOR);

    private static final Pattern VERSION = Pattern.compile("^(\\d+)\\.(\\d+)$");

    private final int major;
    private final int minor;

    public VersionPolicy(int major, int minor) {
        this.major = major;
        this.minor = minor;
    }

    public int major() {
        return major;
    }

    public int minor() {
        return minor;
    }

    public String current() {
        return major + "." + minor;
    }

    /** 当前主版本内已发布的次版本列表，由低到高。 */
    public List<String> supportedVersions() {
        List<String> versions = new ArrayList<>();
        for (int i = 0; i <= minor; i++) {
            versions.add(major + "." + i);
        }
        return versions;
    }

    public List<TypedError> versionErrors(JsonNode document) {
        String version = schemaVersionOf(document);
        if (version == null) {
            return List.of();
        }
        int[] parsed = parse(version);
        if (parsed != null && parsed[0] == major && parsed[1] <= minor) {
            return List.of();
        }
        String message = parsed != null && parsed[0] == major
                ? "文档格式版本 " + version + " 高于运行时当前次版本 " + current()
                : "不支持的文档格式版本 " + version + ":运行时只接受 " + String.join(" / ", supportedVersions())
                + "，跨主版本不提供自动迁移";
        return List.of(TypedError.schema("/schemaVersion", message));
    }

    /** 能力下限判定：文档使用了高于其声明次版本的能力即报错，定位到具体使用点。 */
    public List<TypedError> capabilityFloorErrors(JsonNode document) {
        String version = schemaVersionOf(document);
        int[] declared = version == null ? null : parse(version);
        if (declared == null || declared[0] != major) {
            return List.of();
        }
        List<TypedError> errors = new ArrayList<>();
        for (PageCapability capability : PageCapabilities.all()) {
            if (capability.minor() <= declared[1]) {
                continue;
            }
            for (String path : capability.usedAt(document)) {
                errors.add(TypedError.schema(path,
                        capability.description() + " 由 " + major + "." + capability.minor() + " 引入，"
                                + "文档声明的是 " + version));
            }
        }
        return errors;
    }

    /** 文档实际结构所需的最低次版本；0 表示只用到该主版本首个次版本的能力。 */
    public static int requiredMinorVersion(JsonNode document) {
        int required = 0;
        for (PageCapability capability : PageCapabilities.all()) {
            if (!capability.usedAt(document).isEmpty()) {
                required = Math.max(required, capability.minor());
            }
        }
        return required;
    }

    static String schemaVersionOf(JsonNode document) {
        return Json.text(Json.get(document, "schemaVersion"));
    }

    static int[] parse(String value) {
        Matcher matcher = VERSION.matcher(value);
        if (!matcher.matches()) {
            return null;
        }
        try {
            return new int[] {Integer.parseInt(matcher.group(1)), Integer.parseInt(matcher.group(2))};
        } catch (NumberFormatException overflow) {
            return new int[] {Integer.MAX_VALUE, Integer.MAX_VALUE};
        }
    }
}
