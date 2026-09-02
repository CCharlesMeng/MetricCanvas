package com.huawei.cdi.pageassets.domain.revision;

import java.util.Objects;

/**
 * 修订来源（ADR-0063）：`relay { sessionId?, runId?, skillVersion } | manual`。
 * 来源结构必填，Run 标识可选；`skillVersion` 由 Tool 从 bundle.json 提供。
 */
public sealed interface RevisionSource permits RevisionSource.Relay, RevisionSource.Manual {

    String type();

    record Relay(String sessionId, String runId, String skillVersion) implements RevisionSource {
        public Relay {
            if (skillVersion == null || skillVersion.isBlank()) {
                throw new IllegalArgumentException("relay 来源必须携带 skillVersion");
            }
            sessionId = blankToNull(sessionId);
            runId = blankToNull(runId);
        }

        @Override
        public String type() {
            return "relay";
        }

        private static String blankToNull(String value) {
            return value == null || value.isBlank() ? null : value;
        }
    }

    record Manual() implements RevisionSource {
        public static final Manual INSTANCE = new Manual();

        @Override
        public String type() {
            return "manual";
        }
    }

    static RevisionSource relay(String sessionId, String runId, String skillVersion) {
        return new Relay(sessionId, runId, Objects.requireNonNull(skillVersion, "skillVersion"));
    }

    static RevisionSource manual() {
        return Manual.INSTANCE;
    }
}
