package com.huawei.cdi.pageassets.adapter.outbound.contract;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huawei.cdi.pageassets.domain.contract.ProductContract;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

/**
 * 从 JAR 内读取 contracts/metriccanvas 快照，并在加载时核对三层摘要：
 * 每个文件对 manifest.json 的 sha256、manifest.json 对 contract-lock.json 的 sha256、
 * 以及页面 Schema 版本一致。任一漂移即拒绝启动，而不是带着过期契约运行。
 */
public final class ClasspathContractSnapshot {
    public static final String ROOT = "contracts/metriccanvas/";
    public static final String LOCK = "contracts/contract-lock.json";

    private final ObjectMapper mapper;
    private final ClassLoader loader;

    public ClasspathContractSnapshot() {
        this(new ObjectMapper(), ClasspathContractSnapshot.class.getClassLoader());
    }

    public ClasspathContractSnapshot(ObjectMapper mapper, ClassLoader loader) {
        this.mapper = mapper;
        this.loader = loader;
    }

    public ProductContract load() {
        byte[] manifestBytes = read(ROOT + "manifest.json");
        JsonNode manifest = parse(manifestBytes, "manifest.json");
        JsonNode lock = parse(read(LOCK), "contract-lock.json");

        String manifestSha = sha256(manifestBytes);
        String expectedSha = lock.path("productManifestSha256").asText();
        if (!manifestSha.equals(expectedSha)) {
            throw new IllegalStateException("contract snapshot drifted: manifest sha256 " + manifestSha
                    + " != contract-lock " + expectedSha);
        }
        String schemaVersion = manifest.path("pageSchemaVersion").asText();
        if (!schemaVersion.equals(lock.path("pageSchemaVersion").asText())) {
            throw new IllegalStateException("contract snapshot drifted: pageSchemaVersion mismatch");
        }

        List<String> files = new ArrayList<>();
        for (JsonNode entry : manifest.path("files")) {
            String file = entry.path("file").asText();
            String actual = sha256(read(ROOT + file));
            if (!actual.equals(entry.path("sha256").asText())) {
                throw new IllegalStateException("contract snapshot drifted: " + file);
            }
            files.add(file);
        }

        List<String> errorTypes = new ArrayList<>();
        parse(read(ROOT + "page/error-types.json"), "error-types.json").path("types")
                .forEach(type -> errorTypes.add(type.asText()));

        return new ProductContract(
                manifest.path("productContractVersion").asText(),
                schemaVersion,
                manifestSha,
                parse(read(ROOT + "page/schema.json"), "schema.json"),
                parse(read(ROOT + "page/component-catalog.json"), "component-catalog.json"),
                List.copyOf(errorTypes),
                List.copyOf(files));
    }

    public JsonNode readJson(String relativePath) {
        return parse(read(ROOT + relativePath), relativePath);
    }

    public List<String> conformanceCases(String kind) {
        List<String> cases = new ArrayList<>();
        JsonNode manifest = parse(read(ROOT + "manifest.json"), "manifest.json");
        String prefix = "page/conformance/" + kind + "/";
        for (JsonNode entry : manifest.path("files")) {
            String file = entry.path("file").asText();
            if (file.startsWith(prefix)) {
                cases.add(file);
            }
        }
        return cases;
    }

    private byte[] read(String resource) {
        try (InputStream in = loader.getResourceAsStream(resource)) {
            if (in == null) {
                throw new IllegalStateException("contract resource missing: " + resource);
            }
            return in.readAllBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private JsonNode parse(byte[] bytes, String name) {
        try {
            return mapper.readTree(new String(bytes, StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new IllegalStateException("contract resource unreadable: " + name, e);
        }
    }

    private static String sha256(byte[] content) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
