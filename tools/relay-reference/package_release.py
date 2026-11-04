"""Reproducible four-artifact archives and independent standard-library checks."""
from __future__ import annotations
from pathlib import Path
import shutil
import tempfile

from archive_format import extract_archive, write_archive
from provenance import file_digest, source_receipt, validate_source
from adoption import validate_evidence
from release import canonical, digest, read_json, require, shape, verify

FORMAT = "metriccanvas-relay-archive/1"


def package_files(root, state):
    return {**state["manifest"]["files"], "mc-tools/release.json": file_digest(root / "mc-tools/release.json")}


def archive_kind(path):
    if path.name.endswith(".tar.gz"):
        return "tar.gz"
    require(path.suffix == ".zip", "ARCHIVE_FORMAT_INVALID", "Expected .zip or .tar.gz")
    return "zip"


def receipt_path(archive):
    return Path(str(archive) + ".release.json")


def package_receipt(root, state, archive, source, kind, compatibility_evidence=None):
    manifest = state["manifest"]
    receipt = {"format": FORMAT, "archive": {"format": kind, "sha256": file_digest(archive),
            "bytes": archive.stat().st_size}, "releaseId": manifest["releaseId"],
            "releaseVersion": manifest["releaseVersion"], "interfaceVersion": manifest["interfaceVersion"],
            "runtime": manifest["runtime"], "files": package_files(root, state), "source": source}
    if compatibility_evidence is not None:
        validate_evidence(compatibility_evidence)
        receipt["compatibilityEvidence"] = compatibility_evidence
    return receipt


def validate_receipt(receipt, archive):
    require(archive.is_file() and not archive.is_symlink(), "ARCHIVE_PATH_INVALID", "Expected a regular archive file")
    fields = {"format", "archive", "releaseId", "releaseVersion", "interfaceVersion", "runtime", "files", "source"}
    if "compatibilityEvidence" in receipt:
        fields.add("compatibilityEvidence")
        validate_evidence(receipt["compatibilityEvidence"])
    shape(receipt, fields, "archive receipt")
    require(receipt["format"] == FORMAT, "ARCHIVE_RECEIPT_INVALID", "Unsupported archive receipt")
    shape(receipt["archive"], {"format", "sha256", "bytes"}, "archive")
    require(receipt["archive"]["format"] == archive_kind(archive), "ARCHIVE_FORMAT_INVALID", "Extension/receipt mismatch")
    require(receipt["archive"]["sha256"] == file_digest(archive)
            and receipt["archive"]["bytes"] == archive.stat().st_size,
            "ARCHIVE_DIGEST_MISMATCH", "Archive bytes differ from the receipt")
    validate_source(receipt["source"])


def check_extracted(root, receipt):
    state = verify(root)
    manifest = state["manifest"]
    require(receipt["files"] == package_files(root, state), "ARCHIVE_CONTENT_MISMATCH", "Extracted file inventory differs")
    for field in ("releaseId", "releaseVersion", "interfaceVersion", "runtime"):
        require(receipt[field] == manifest[field], "ARCHIVE_CONTENT_MISMATCH", field)
    if "compatibilityEvidence" in receipt:
        check_evidence_release(receipt["compatibilityEvidence"], manifest["releaseId"])
    return state


def check_evidence_release(evidence, release_id):
    for report in evidence["reports"] + evidence["historicalReports"]:
        for comparison in report["compatibility"]:
            require(comparison["candidateReleaseId"] == release_id,
                    "ARCHIVE_COMPATIBILITY_INVALID", "Evidence belongs to a different candidate")


def unpack_checked(archive, receipt, destination):
    validate_receipt(receipt, archive)
    extract_archive(archive, destination, receipt["archive"]["format"])
    try:
        return check_extracted(destination, receipt)
    except Exception:
        shutil.rmtree(destination)
        raise


def verify_archive(archive, receipt_file=None):
    receipt = read_json(receipt_file or receipt_path(archive))
    with tempfile.TemporaryDirectory(prefix="mc-relay-archive-") as temporary:
        state = unpack_checked(archive, receipt, Path(temporary) / "references")
    report = {"format": "metriccanvas-relay-archive-check/1", "status": "ok", "releaseId": state["manifest"]["releaseId"],
            "files": len(receipt["files"]), "source": receipt["source"],
            "scope": "archive integrity and source receipt; product/Relay execution not tested"}
    if "compatibilityEvidence" in receipt:
        report["compatibilityEvidence"] = receipt["compatibilityEvidence"]
    return report


def pack(candidate, archive, source_root=None, *, source=None, compatibility_evidence=None):
    require(not archive.exists() and not archive.is_symlink() and not receipt_path(archive).exists()
            and not receipt_path(archive).is_symlink(),
            "ARCHIVE_OUTPUT_EXISTS", str(archive))
    require(archive.parent.is_dir(), "ARCHIVE_OUTPUT_INVALID", "Archive parent must exist")
    state = verify(candidate)
    source = source_receipt(source_root, candidate) if source is None else source
    validate_source(source)
    kind = archive_kind(archive)
    names = sorted(package_files(candidate, state))
    stream = archive.open("xb")
    try:
        with stream:
            write_archive(candidate, names, stream, kind)
        receipt = package_receipt(candidate, state, archive, source, kind, compatibility_evidence)
        with tempfile.TemporaryDirectory(prefix="mc-relay-pack-") as temporary:
            unpack_checked(archive, receipt, Path(temporary) / "references")
        write_receipt(receipt_path(archive), receipt)
    except Exception:
        archive.unlink(missing_ok=True)
        raise
    return receipt


def write_receipt(path, receipt):
    output = path.open("xb")
    try:
        with output:
            output.write(canonical(receipt) + b"\n")
    except Exception:
        path.unlink(missing_ok=True)
        raise
