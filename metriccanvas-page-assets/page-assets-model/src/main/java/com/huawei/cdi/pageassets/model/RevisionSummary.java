package com.huawei.cdi.pageassets.model;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;
import java.util.Objects;

/**
 * RevisionSummary
 */
@JsonAutoDetect(fieldVisibility = JsonAutoDetect.Visibility.ANY,
        getterVisibility = JsonAutoDetect.Visibility.NONE, setterVisibility = JsonAutoDetect.Visibility.NONE)
public class RevisionSummary {
    @JsonProperty("revisionId")
    private String revisionId = null;

    @JsonProperty("revisionNumber")
    private Long revisionNumber = null;

    @JsonProperty("createdAt")
    private OffsetDateTime createdAt = null;

    public RevisionSummary revisionId(String revisionId) {
        this.revisionId = revisionId;
        return this;
    }

    @NotNull
    public String getRevisionId() {
        return revisionId;
    }

    public void setRevisionId(String revisionId) {
        this.revisionId = revisionId;
    }

    public RevisionSummary revisionNumber(Long revisionNumber) {
        this.revisionNumber = revisionNumber;
        return this;
    }

    @NotNull
    public Long getRevisionNumber() {
        return revisionNumber;
    }

    public void setRevisionNumber(Long revisionNumber) {
        this.revisionNumber = revisionNumber;
    }

    public RevisionSummary createdAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
        return this;
    }

    @NotNull
    @Valid
    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        RevisionSummary that = (RevisionSummary) o;
        return Objects.equals(this.revisionId, that.revisionId)
                && Objects.equals(this.revisionNumber, that.revisionNumber)
                && Objects.equals(this.createdAt, that.createdAt);
    }

    @Override
    public int hashCode() {
        return Objects.hash(revisionId, revisionNumber, createdAt);
    }

    @Override
    public String toString() {
        return "class RevisionSummary {\n"
                + "    revisionId: " + revisionId + "\n"
                + "    revisionNumber: " + revisionNumber + "\n"
                + "    createdAt: " + createdAt + "\n"
                + "}";
    }
}
