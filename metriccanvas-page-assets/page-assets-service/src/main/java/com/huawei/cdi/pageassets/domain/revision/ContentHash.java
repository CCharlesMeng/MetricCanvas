package com.huawei.cdi.pageassets.domain.revision;

import com.fasterxml.jackson.databind.JsonNode;
import com.huawei.cdi.pageassets.domain.page.json.Json;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/** 基线 `hash(canonicalizeJson(document))`：规范化 JSON 的 sha256 十六进制。 */
public final class ContentHash {
    private ContentHash() {
    }

    public static String of(JsonNode document) {
        return sha256(Json.canonical(document));
    }

    public static String sha256(String text) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
