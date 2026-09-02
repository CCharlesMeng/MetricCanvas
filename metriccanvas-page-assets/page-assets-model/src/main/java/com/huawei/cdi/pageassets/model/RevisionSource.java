package com.huawei.cdi.pageassets.model;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonValue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.Objects;

/**
 * RevisionSource
 */
@JsonAutoDetect(fieldVisibility = JsonAutoDetect.Visibility.ANY,
        getterVisibility = JsonAutoDetect.Visibility.NONE, setterVisibility = JsonAutoDetect.Visibility.NONE)
public class RevisionSource {
    /**
     * Gets or Sets type
     */
    public enum TypeEnum {
        RELAY("relay"),
        MANUAL("manual");

        private final String value;

        TypeEnum(String value) {
            this.value = value;
        }

        @Override
        @JsonValue
        public String toString() {
            return String.valueOf(value);
        }

        @JsonCreator
        public static TypeEnum fromValue(String text) {
            for (TypeEnum b : TypeEnum.values()) {
                if (String.valueOf(b.value).equals(text)) {
                    return b;
                }
            }
            return null;
        }
    }

    @JsonProperty("type")
    private TypeEnum type = null;

    @JsonProperty("sessionId")
    private String sessionId = null;

    @JsonProperty("runId")
    private String runId = null;

    @JsonProperty("skillVersion")
    private String skillVersion = null;

    public RevisionSource type(TypeEnum type) {
        this.type = type;
        return this;
    }

    @NotNull
    public TypeEnum getType() {
        return type;
    }

    public void setType(TypeEnum type) {
        this.type = type;
    }

    public RevisionSource sessionId(String sessionId) {
        this.sessionId = sessionId;
        return this;
    }

    @Size(max = 128)
    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public RevisionSource runId(String runId) {
        this.runId = runId;
        return this;
    }

    @Size(max = 128)
    public String getRunId() {
        return runId;
    }

    public void setRunId(String runId) {
        this.runId = runId;
    }

    public RevisionSource skillVersion(String skillVersion) {
        this.skillVersion = skillVersion;
        return this;
    }

    @Size(max = 64)
    public String getSkillVersion() {
        return skillVersion;
    }

    public void setSkillVersion(String skillVersion) {
        this.skillVersion = skillVersion;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        RevisionSource that = (RevisionSource) o;
        return Objects.equals(this.type, that.type)
                && Objects.equals(this.sessionId, that.sessionId)
                && Objects.equals(this.runId, that.runId)
                && Objects.equals(this.skillVersion, that.skillVersion);
    }

    @Override
    public int hashCode() {
        return Objects.hash(type, sessionId, runId, skillVersion);
    }

    @Override
    public String toString() {
        return "class RevisionSource {\n"
                + "    type: " + type + "\n"
                + "    sessionId: " + sessionId + "\n"
                + "    runId: " + runId + "\n"
                + "    skillVersion: " + skillVersion + "\n"
                + "}";
    }
}
