"""Reviewed first-consumer baseline; never overrides an actual-current migration."""
from pathlib import Path

from compatibility import compare, compare_states
from consumer import content_errors, envelope_errors, load_consumer, replay
from release import canonical, digest, read_json, require, shape, version

ROOT = Path(__file__).resolve().parents[2]
HISTORICAL_SHA = "f7df720d08a8334a1d976cc7f1c28c7a9f4a3dec1612da204dd59b420ac886e1"


def pinned(reference, root):
    shape(reference, {"path", "sha256"}, "pinned adoption input")
    path = root / reference["path"]
    require(digest(path.read_bytes()) == reference["sha256"], "ADOPTION_INPUT_CHANGED", reference["path"])
    return read_json(path)


def historical_projection(report):
    return {"status": report["status"], "checks": report["checks"],
            "contractReasons": [item["details"] for item in report["compatibility"]]}


def reviewed_checks(before, after):
    require(len(after["vectors"]) >= len(before["vectors"]), "ADOPTION_REVIEW_INVALID", "Old requests were removed")
    checks = []
    for old, new in zip(before["vectors"], after["vectors"]):
        require(canonical(old["request"]) == canonical(new["request"]) and old["operation"] == new["operation"],
                "ADOPTION_REVIEW_INVALID", "Old request changed")
        expected = new["expected"]
        result = {"format": "metriccanvas-mc-result/1", "requestId": new["request"]["requestId"],
                  "operation": new["operation"], "status": expected["status"],
                  "data": expected.get("data", expected.get("dataProjection")), "diagnostics": expected["diagnostics"]}
        errors = envelope_errors(result, old) + content_errors(result, old["expected"])
        if expected["exitCode"] != old["expected"]["exitCode"]:
            errors.append("exit code changed")
        checks.append({"operation": old["operation"], "requestId": old["request"]["requestId"],
                       "passed": not errors, "details": errors})
    return checks


def validate_review(review, before, after):
    report = compare_states(before, after)
    checks = reviewed_checks(before, after)
    require(review["contractReasons"] == report["details"], "ADOPTION_REVIEW_INVALID", "Contract reasons differ")
    require(review["fromReleaseId"] == before["sourceReleaseId"]
            and review["toReleaseId"] == after["sourceReleaseId"], "ADOPTION_REVIEW_INVALID", "Review source differs")
    changed = {item["requestId"]: item for item in checks if not item["passed"]}
    require([item["requestId"] for item in review["changedCalls"]] == list(changed),
            "ADOPTION_REVIEW_INVALID", "Changed calls differ")
    for item in review["changedCalls"]:
        require(item["details"] == changed[item["requestId"]]["details"], "ADOPTION_REVIEW_INVALID", "Call reasons differ")
    validate_review_values(review, before, after)
    return {"status": "needs_migration", "checks": checks, "contractReasons": [report["details"]]}


def validate_review_values(review, before, after):
    old = {item["request"]["requestId"]: item["expected"] for item in before["vectors"]}
    new = {item["request"]["requestId"]: item["expected"] for item in after["vectors"]}
    for item in review["changedCalls"]:
        key = item["requestId"]
        require(canonical(item["old"]) == canonical(old[key]) and canonical(item["new"]) == canonical(new[key]),
                "ADOPTION_REVIEW_INVALID", "Reviewed values differ from immutable consumer snapshots")


def load_policy(config, root=ROOT):
    record = pinned(config["adoption"], root)
    shape(record, {"format", "id", "decision", "consumer", "historicalConsumer", "review", "baseline"}, "adoption record")
    require(record["format"] == "metriccanvas-first-adoption/1", "ADOPTION_RECORD_INVALID", "Unknown adoption format")
    require(config["consumers"] == [record["consumer"]], "ADOPTION_RECORD_INVALID", "Formal consumer was removed or replaced")
    require(record["historicalConsumer"]["sha256"] == HISTORICAL_SHA,
            "ADOPTION_RECORD_INVALID", "Historical 0.1.0 consumer must remain pinned")
    primary = load_consumer(root / record["consumer"]["path"], record["consumer"]["sha256"])
    historical = load_consumer(root / record["historicalConsumer"]["path"], HISTORICAL_SHA)
    review = pinned(record["review"], root)
    require(review["fromConsumerSha256"] == HISTORICAL_SHA and review["toConsumerSha256"] == record["consumer"]["sha256"],
            "ADOPTION_REVIEW_INVALID", "Review does not bind both consumers")
    validate_baseline(config, record, primary)
    expected = validate_review(review, historical, primary)
    return {"record": record, "primary": [primary], "historical": [historical], "expectedHistory": expected}


def validate_baseline(config, record, primary):
    baseline = record["baseline"]
    for name in ("releaseVersion", "interfaceVersion", "defaultPageSchema"):
        require(primary["manifest"][name] == baseline[name], "ADOPTION_RECORD_INVALID", "Baseline " + name)
    require(primary["sourceReleaseId"] == baseline["sourceReviewReleaseId"], "ADOPTION_RECORD_INVALID", "Review release differs")
    require(version(config["releaseVersion"]) >= version(baseline["releaseVersion"]), "ADOPTION_RECORD_INVALID", "Baseline downgrade")
    require(version(config["interfaceVersion"]) >= version(baseline["interfaceVersion"]), "ADOPTION_RECORD_INVALID", "Interface downgrade")


def aggregate(policy, config, reports, historical, current=None):
    history_matches = (len(historical) == 1 and historical_projection(historical[0]) == policy["expectedHistory"])
    passed = bool(reports) and all(report["status"] == "ok" for report in reports) and history_matches
    if current is not None:
        passed = passed and current["status"] == "ok"
    return {"format": "metriccanvas-release-consumers/2", "status": "ok" if passed else "needs_migration",
            "mode": "update" if current is not None else "initial-adoption", "reports": reports,
            "historicalReports": historical, "historicalReportReviewed": history_matches, "current": current,
            "adoption": {"id": policy["record"]["id"], "record": config["adoption"], "baseline": policy["record"]["baseline"],
                         "review": policy["record"]["review"]},
            "eligibleForSmoke": passed, "automaticPromotion": False}


def evaluate(candidate, config, python_prefix, current=None, root=ROOT):
    policy = load_policy(config, root)
    actual = compare(current, candidate) if current is not None else None
    if actual is not None and actual["status"] != "ok":
        return aggregate(policy, config, [], [], actual)
    reports = [replay(candidate, consumer, python_prefix=python_prefix) for consumer in policy["primary"]]
    historical = [replay(candidate, consumer, python_prefix=python_prefix) for consumer in policy["historical"]]
    return aggregate(policy, config, reports, historical, actual)


def validate_evidence(evidence):
    require(isinstance(evidence, dict) and evidence.get("format") == "metriccanvas-release-consumers/2",
            "ARCHIVE_COMPATIBILITY_INVALID", "Missing versioned consumer evidence")
    require(evidence["status"] == "ok" and evidence["eligibleForSmoke"] is True
            and evidence["automaticPromotion"] is False, "ARCHIVE_COMPATIBILITY_INVALID", "Release gate did not pass")
    require(evidence["reports"] and all(item["status"] == "ok" for item in evidence["reports"]),
            "ARCHIVE_COMPATIBILITY_INVALID", "Formal consumer did not pass")
    require(all(item["checks"] and all(check["passed"] for check in item["checks"]) for item in evidence["reports"]),
            "ARCHIVE_COMPATIBILITY_INVALID", "Formal consumer checks are missing or failed")
    history = evidence["historicalReports"]
    require(len(history) == 1 and history[0]["status"] == "needs_migration" and evidence["historicalReportReviewed"] is True,
            "ARCHIVE_COMPATIBILITY_INVALID", "Historical migration evidence was removed or rewritten")
    require(evidence["current"] is None or evidence["current"]["status"] == "ok",
            "ARCHIVE_COMPATIBILITY_INVALID", "Actual current release needs migration")
