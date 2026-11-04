"""Pack/check/replay four artifacts; no activation or Relay state handling."""
from pathlib import Path
import argparse
import os
import sys
import tempfile
import subprocess
import tarfile
import zipfile

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import ROOT, load_config, python_executable
from adoption import aggregate, evaluate, load_policy
from compatibility import compare
from package_release import pack, receipt_path, unpack_checked, verify_archive
from release import canonical, read_json, require, verify
from runtime_probe import probe


def replay_all(candidate, config, current=None):
    return evaluate(candidate, config, [python_executable(), "-I", "-B"], current)


def execute(args, config):
    candidate = (args.candidate or ROOT / config["output"]).absolute()
    if args.command == "replay":
        return replay_all(candidate, config, args.current)
    if args.command == "pack":
        compatibility = replay_all(candidate, config, args.current)
        if compatibility["status"] != "ok":
            return compatibility
        actual_version = verify(candidate)["manifest"]["releaseVersion"]
        archive = (args.output or ROOT / "dist" / ("mc-relay-reference-" + actual_version + ".zip")).absolute()
        receipt = pack(candidate, archive, args.source_root.resolve(), compatibility_evidence=compatibility)
        return {"format": "metriccanvas-relay-package-result/1", "status": "ok", "releaseId": receipt["releaseId"],
                "archiveSha256": receipt["archive"]["sha256"], "consumers": compatibility, "automaticPromotion": False}
    return verify_or_extract(args, config)


def verify_or_extract(args, config):
    archive = args.archive.absolute()
    receipt_file = args.receipt or receipt_path(archive)
    receipt = read_json(receipt_file)
    if args.expected_source:
        require(receipt["source"]["gitCommit"] == args.expected_source,
                "ARCHIVE_SOURCE_MISMATCH", "Archive does not match the expected Git SHA")
    if args.command == "extract":
        state = unpack_checked(archive, receipt, args.destination.absolute())
        return {"status": "ok", "releaseId": state["manifest"]["releaseId"], "automaticPromotion": False,
                "scope": "new staging directory only; no activation"}
    report = verify_archive(archive, receipt_file)
    if args.probe or args.current is not None:
        with tempfile.TemporaryDirectory(prefix="mc-downloaded-") as temporary:
            candidate = Path(temporary) / "四项 installed"
            unpack_checked(archive, receipt, candidate)
            inspected = inspect_product(candidate, config, args.current, args.probe)
            report.update(inspected)
    report["automaticPromotion"] = False
    return report


def inspect_product(candidate, config, current, run_probe):
    if not run_probe:
        gate = replay_all(candidate, config, current)
        return {"status": gate["status"], "compatibility": gate}
    policy = load_policy(config)
    actual = compare(current, candidate) if current is not None else None
    if actual is not None and actual["status"] != "ok":
        gate = aggregate(policy, config, [], [], actual)
        return {"status": gate["status"], "compatibility": gate}
    runtime = probe(candidate, policy["primary"], policy["historical"])
    gate = aggregate(policy, config, runtime["consumers"], runtime["historicalConsumers"], actual)
    return {"status": gate["status"], "compatibility": gate, "runtime": runtime}


def parser():
    value = argparse.ArgumentParser(description=__doc__)
    value.add_argument("command", choices=["pack", "verify", "extract", "replay"])
    value.add_argument("--config", type=Path)
    value.add_argument("--candidate", type=Path)
    value.add_argument("--output", type=Path)
    value.add_argument("--archive", type=Path)
    value.add_argument("--receipt", type=Path)
    value.add_argument("--destination", type=Path)
    value.add_argument("--current", type=Path)
    value.add_argument("--source-root", type=Path, default=ROOT)
    value.add_argument("--expected-source")
    value.add_argument("--probe", action="store_true")
    return value


def main(argv=None):
    args = parser().parse_args(argv)
    try:
        require(args.command not in {"verify", "extract"} or args.archive is not None,
                "ARCHIVE_ARGUMENT_INVALID", "--archive is required")
        require(args.command != "extract" or args.destination is not None,
                "ARCHIVE_ARGUMENT_INVALID", "--destination is required")
        result = execute(args, load_config(args.config))
    except (OSError, ValueError, TypeError, KeyError, ImportError, RuntimeError,
            zipfile.BadZipFile, tarfile.TarError, subprocess.SubprocessError) as error:
        result = {"status": "error", "code": getattr(error, "code", "ARCHIVE_INPUT_INVALID"),
                  "details": [str(error)], "automaticPromotion": False}
    sys.stdout.buffer.write(canonical(result) + b"\n")
    return {"ok": 0, "needs_migration": 2, "error": 3}[result["status"]]


if __name__ == "__main__":
    raise SystemExit(main())
