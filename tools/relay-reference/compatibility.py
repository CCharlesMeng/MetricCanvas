"""Conservative compatibility precheck; runtime tests remain a separate gate."""
from __future__ import annotations

from release import canonical, version, verify


def version_reasons(old, new):
    reasons = []
    for field in ("interfaceVersion", "resourceIndexVersion"):
        before, after = version(old[field]), version(new[field])
        if before[0] != after[0] or after < before:
            reasons.append(field + ": incompatible version")
    if version(new["releaseVersion"]) < version(old["releaseVersion"]):
        reasons.append("releaseVersion: downgrade requires explicit rollback")
    if new["releaseVersion"] == old["releaseVersion"] and new["releaseId"] != old["releaseId"]:
        reasons.append("releaseVersion: immutable version has different content")
    return reasons


def environment_reasons(old, new):
    reasons = []
    for field in ("runtime", "defaultPageSchema"):
        if old[field] != new[field]:
            reasons.append(field + ": explicit integration upgrade required")
    if not set(old["pageSchemaVersions"]) <= set(new["pageSchemaVersions"]):
        reasons.append("pageSchemaVersions: previous support was removed")
    return reasons


def interface_reasons(old, new):
    reasons = []
    for name, operation in sorted(old["operations"].items()):
        if canonical(new["operations"].get(name)) != canonical(operation):
            reasons.append("operation:" + name + ": removed or changed contract")
    if not set(old["publicPaths"]) <= set(new["publicPaths"]):
        reasons.append("publicPaths: previous public path was removed")
    added = set(new["operations"]) - set(old["operations"])
    if added and version(new["version"])[:2] <= version(old["version"])[:2]:
        reasons.append("interfaceVersion: added operations require a minor version increase")
    return reasons


def compare(current_root, candidate_root):
    return compare_states(verify(current_root), verify(candidate_root))


def compare_states(current, candidate):
    """Same conservative rules for a verified tree and a pinned old consumer."""
    old, new = current["manifest"], candidate["manifest"]
    reasons = version_reasons(old, new) + environment_reasons(old, new)
    reasons += interface_reasons(current["interface"], candidate["interface"])
    for key in sorted(set(current["resources"]) - set(candidate["resources"])):
        reasons.append("resource:" + key + ": previous ID was removed")
    return {"status": "needs_migration" if reasons else "ok",
            "code": "MIGRATION_REQUIRED" if reasons else "COMPATIBILITY_PRECHECK_PASSED",
            "details": reasons, "eligibleForSmoke": not reasons,
            "currentReleaseId": old["releaseId"], "candidateReleaseId": new["releaseId"],
            "unchanged": old["releaseId"] == new["releaseId"]}
