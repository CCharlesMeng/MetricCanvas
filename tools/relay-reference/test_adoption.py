"""First baseline approval never grants an upgrade or rewrites old evidence."""
from copy import deepcopy
from pathlib import Path
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from adoption import aggregate, evaluate, load_policy, pinned, validate_evidence, validate_review
from compatibility import compare_states
from config import load_config
from frozen_consumer import snapshot_bytes, snapshot_json
from package_release import check_evidence_release, pack, receipt_path, verify_archive
from release import METADATA_FIELDS, ReleaseError, canonical, digest, read_json, seal, verify
from test_archive import fixture_source
from test_release import BASE_METADATA, fixture


class AdoptionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = load_config()
        cls.policy = load_policy(cls.config)

    def reports(self):
        primary, old = self.policy["primary"][0], self.policy["historical"][0]
        good = {"status": "ok", "compatibility": [compare_states(primary, primary)],
                "checks": [{"operation": vector["operation"], "requestId": vector["request"]["requestId"],
                            "passed": True, "details": []} for vector in primary["vectors"]]}
        historical = {"status": "needs_migration", "compatibility": [compare_states(old, primary)],
                      "checks": deepcopy(self.policy["expectedHistory"]["checks"])}
        return [good], [historical]

    def gate(self):
        reports, historical = self.reports()
        return aggregate(self.policy, self.config, reports, historical)

    def test_pins_baselines_and_preserves_behavior_during_public_path_migration(self):
        self.assertEqual(self.policy["primary"][0]["manifest"]["defaultPageSchema"], "6.89")
        self.assertEqual(len(self.policy["primary"][0]["vectors"]), 46)
        self.assertEqual(len(self.policy["historical"][0]["vectors"]), 23)
        expected = self.policy["expectedHistory"]
        self.assertEqual(expected["status"], "needs_migration")
        self.assertEqual(sum(not item["passed"] for item in expected["checks"]), 8)
        self.assertEqual(len(expected["contractReasons"][0]), 6)
        self.assertEqual(self.policy["primary"][0]["interface"]["entrypoint"], "mc-tools/cli.py")
        old_ops = self.policy["historical"][0]["interface"]["operations"]
        positives = {v["operation"] for v in self.policy["primary"][0]["vectors"] if v["expected"]["status"] == "ok"}
        self.assertTrue(set(self.policy["primary"][0]["interface"]["operations"]) - set(old_ops) <= positives)

    def test_plural_baseline_keeps_all_35_previous_requests_and_expectations(self):
        previous = snapshot_json(Path(__file__).with_name("fixtures") / "consumer-0.2.0-schema683.json")
        primary = snapshot_json(Path(__file__).with_name("fixtures") / "consumer-0.3.0-tools-plural.json")
        self.assertEqual(primary["vectors"], previous["vectors"])
        self.assertEqual(primary["interface"]["operations"], previous["interface"]["operations"])
        report = compare_states(previous, primary)
        self.assertEqual(report["status"], "needs_migration")
        self.assertEqual(report["details"], ["interfaceVersion: incompatible version",
            "entrypoint: explicit integration upgrade required", "publicPaths: previous public path was removed"])

    def test_schema684_review_preserves_requests_and_stale_report_rejection(self):
        folder = Path(__file__).with_name("fixtures")
        previous = snapshot_json(folder / "consumer-0.3.0-tools-plural.json")
        primary = snapshot_json(folder / "consumer-0.3.3-schema684.json")
        self.assertEqual([v["request"] for v in primary["vectors"][:35]],
                         [v["request"] for v in previous["vectors"]])
        review = read_json(folder / "schema684-plural-consumer-review-v1.json")
        checked = validate_review(review, previous, primary)
        self.assertEqual(sum(not check["passed"] for check in checked["checks"]), 13)
        stale = next(v for v in primary["vectors"] if v["request"]["requestId"] == "consumer-0.2.0-new-2")
        self.assertEqual(stale["expected"]["diagnostics"][0]["code"], "ANALYSIS_BASELINE_STALE")
        self.assertEqual([(v["expected"]["status"], v["expected"]["exitCode"]) for v in primary["vectors"][-2:]],
                         [("ok", 0), ("error", 2)])

    def test_schema685_review_preserves_684_requests_and_checks_new_header_parameters(self):
        folder = Path(__file__).with_name("fixtures")
        previous = snapshot_json(folder / "consumer-0.3.3-schema684.json")
        self.assertEqual(digest(snapshot_bytes(folder / "consumer-0.3.3-schema684.json")),
                         "205207b7f51218ff6ed891940d0c0146556ee96bcdcca6dc98f107915de05019")
        primary = snapshot_json(folder / "consumer-0.3.5-schema685.json")
        self.assertEqual([v["request"] for v in primary["vectors"][:37]],
                         [v["request"] for v in previous["vectors"]])
        review = read_json(folder / "schema685-previous-consumer-review-v1.json")
        checked = validate_review(review, previous, primary)
        self.assertEqual(sum(not check["passed"] for check in checked["checks"]), 13)
        stale = primary["vectors"][35]
        self.assertEqual(stale["expected"]["diagnostics"][0]["code"], "ANALYSIS_BASELINE_STALE")
        self.assertEqual([(v["expected"]["status"], v["expected"]["exitCode"]) for v in primary["vectors"][-4:]],
                         [("ok", 0), ("error", 2), ("ok", 0), ("error", 2)])
        self.assertIn("互斥", primary["vectors"][-1]["expected"]["diagnostics"][0]["message"])

    def test_schema689_review_preserves_685_requests_and_checks_chart_conditions(self):
        folder = Path(__file__).with_name("fixtures")
        previous_path = folder / "consumer-0.3.5-schema685.json"
        self.assertEqual(digest(snapshot_bytes(previous_path)),
                         "a49bd16f44ca8ff322d63c3f2f864e2fc201a0aba49667ed3b7a3980d5aace76")
        previous, primary = snapshot_json(previous_path), self.policy["primary"][0]
        self.assertEqual([v["request"] for v in primary["vectors"][:41]],
                         [v["request"] for v in previous["vectors"]])
        review = read_json(folder / "schema689-previous-consumer-review-v1.json")
        validate_review(review, previous, primary)
        self.assertEqual(primary["vectors"][37]["expected"]["diagnostics"][0]["code"], "ANALYSIS_BASELINE_STALE")
        self.assertEqual([(v["expected"]["status"], v["expected"]["exitCode"]) for v in primary["vectors"][-5:]],
                         [("ok", 0), ("error", 2), ("ok", 0), ("error", 2), ("error", 2)])
        self.assertIn("6.89", primary["vectors"][-2]["expected"]["diagnostics"][0]["message"])

    def test_initial_gate_keeps_historical_migration_visible(self):
        report = self.gate()
        self.assertEqual(report["status"], "ok")
        self.assertEqual(report["mode"], "initial-adoption")
        self.assertEqual(report["historicalReports"][0]["status"], "needs_migration")
        self.assertFalse(report["automaticPromotion"])

    def test_actual_current_migration_is_checked_before_replay_and_cannot_be_bypassed(self):
        current = {"status": "needs_migration", "details": ["defaultPageSchema changed"]}
        with patch("adoption.compare", return_value=current) as check, patch("adoption.replay") as run:
            report = evaluate(Path("/candidate"), self.config, ["python"], Path("/old-682"))
        check.assert_called_once_with(Path("/old-682"), Path("/candidate"))
        run.assert_not_called()
        self.assertEqual(report["mode"], "update")
        self.assertEqual(report["status"], "needs_migration")
        self.assertEqual(report["current"], current)
        self.assertFalse(report["eligibleForSmoke"])

    def test_compatible_actual_current_can_enter_smoke_without_automatic_activation(self):
        reports, historical = self.reports()
        result = aggregate(self.policy, self.config, reports, historical, {"status": "ok"})
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["mode"], "update")
        self.assertFalse(result["automaticPromotion"])

    def test_missing_or_changed_history_and_failed_new_consumer_fail_closed(self):
        reports, historical = self.reports()
        self.assertEqual(aggregate(self.policy, self.config, reports, [])["status"], "needs_migration")
        changed = deepcopy(historical)
        changed[0]["checks"][0]["details"].append("unexpected difference")
        self.assertEqual(aggregate(self.policy, self.config, reports, changed)["status"], "needs_migration")
        reports[0]["status"] = "needs_migration"
        self.assertEqual(aggregate(self.policy, self.config, reports, historical)["status"], "needs_migration")

    def test_cannot_remove_historical_consumer_by_changing_config(self):
        config = deepcopy(self.config)
        config["consumers"] = []
        with self.assertRaises(ReleaseError):
            load_policy(config)
        config = deepcopy(self.config)
        config.pop("adoption")
        with self.assertRaises(KeyError):
            load_policy(config)

    def test_changed_adoption_or_review_bytes_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "record.json"
            path.write_bytes(b"{}\n")
            with self.assertRaises(ReleaseError) as error:
                pinned({"path": "record.json", "sha256": "0" * 64}, Path(directory))
            self.assertEqual(error.exception.code, "ADOPTION_INPUT_CHANGED")

    def test_receipt_cannot_drop_history_or_turn_it_green(self):
        for replacement in ([], [{"status": "ok"}]):
            evidence = self.gate()
            evidence["historicalReports"] = replacement
            with self.assertRaises(ReleaseError):
                validate_evidence(evidence)
        evidence = self.gate()
        evidence["current"] = {"status": "needs_migration"}
        with self.assertRaises(ReleaseError):
            validate_evidence(evidence)

    def test_archive_receipt_round_trip_preserves_full_historical_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            candidate = Path(directory) / "candidate"
            fixture(candidate)
            seal(candidate, deepcopy(BASE_METADATA))
            release_id = verify(candidate)["manifest"]["releaseId"]
            evidence = self.gate()
            for report in evidence["reports"] + evidence["historicalReports"]:
                report["compatibility"][0]["candidateReleaseId"] = release_id
            archive = Path(directory) / "fixture.zip"
            pack(candidate, archive, source=fixture_source(), compatibility_evidence=evidence)
            self.assertEqual(read_json(receipt_path(archive))["compatibilityEvidence"], evidence)
            self.assertEqual(verify_archive(archive)["compatibilityEvidence"], evidence)
            self.assertEqual(evidence["historicalReports"][0]["status"], "needs_migration")

    def test_archive_evidence_for_other_candidate_is_rejected(self):
        with self.assertRaises(ReleaseError):
            check_evidence_release(self.gate(), "0" * 64)


@unittest.skipUnless(os.environ.get("METRICCANVAS_RELAY_CANDIDATE"), "Actual candidate is provided by CI or a local review run")
class ActualCurrentGateTests(unittest.TestCase):
    def test_actual_cli_rejects_verified_current_with_682_default(self):
        self.assert_current_requires_migration("6.82", "0.1.0")

    def test_actual_cli_rejects_verified_current_with_684_default(self):
        self.assert_current_requires_migration("6.84", "0.3.4")

    def assert_current_requires_migration(self, schema, release):
        candidate = Path(os.environ["METRICCANVAS_RELAY_CANDIDATE"])
        with tempfile.TemporaryDirectory(prefix="actual-current-old-schema-") as directory:
            current = Path(directory) / "current-682"
            shutil.copytree(candidate, current)
            # A verified current-tree compatibility fixture, not a historical product implementation.
            manifest = verify(current)["manifest"]
            metadata = {key: manifest[key] for key in METADATA_FIELDS}
            metadata.update(defaultPageSchema=schema, releaseVersion=release)
            (current / "mc-tools/release.json").unlink()
            seal(current, metadata)
            command = [sys.executable, "-I", "-S", "-B", str(Path(__file__).with_name("package_cli.py")),
                       "replay", "--candidate", str(candidate), "--current", str(current)]
            result = subprocess.run(command, capture_output=True, cwd=directory, timeout=60)
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report["mode"], "update")
        self.assertEqual(report["current"]["status"], "needs_migration")
        self.assertIn("defaultPageSchema: explicit integration upgrade required", report["current"]["details"])


if __name__ == "__main__":
    unittest.main()
