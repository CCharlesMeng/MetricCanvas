package com.huawei.cdi.pageassets.model;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;

import java.util.Objects;

/**
 * 当前最新修订的标识；页面尚无修订时为 null。
 */
@JsonAutoDetect(fieldVisibility = JsonAutoDetect.Visibility.ANY,
        getterVisibility = JsonAutoDetect.Visibility.NONE, setterVisibility = JsonAutoDetect.Visibility.NONE)
public class LatestRevisionRef {
    @JsonProperty("revisionId")
    private String revisionId = null;

    @JsonProperty("revisionNumber")
    private Long revisionNumber = null;

    public LatestRevisionRef revisionId(String revisionId) {
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

    public LatestRevisionRef revisionNumber(Long revisionNumber) {
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

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        LatestRevisionRef that = (LatestRevisionRef) o;
        return Objects.equals(this.revisionId, that.revisionId)
                && Objects.equals(this.revisionNumber, that.revisionNumber);
    }

    @Override
    public int hashCode() {
        return Objects.hash(revisionId, revisionNumber);
    }

    @Override
    public String toString() {
        return "class LatestRevisionRef {\n"
                + "    revisionId: " + revisionId + "\n"
                + "    revisionNumber: " + revisionNumber + "\n"
                + "}";
    }
}
