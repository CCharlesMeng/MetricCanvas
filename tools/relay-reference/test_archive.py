"""Archive-format fixtures; actual product probes are tested separately."""
from copy import deepcopy
import io
import gzip
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import unittest
import zipfile

from archive_format import check_members, extract_archive
from package_release import pack, receipt_path, unpack_checked, verify_archive
from provenance import file_digest, source_inputs
from release import ReleaseError, canonical, digest, read_json, seal
from test_release import BASE_METADATA, fixture


def fixture_source():
    inputs = {"fixture.py": digest(b"archive test input")}
    return {"format": "metriccanvas-relay-source/1", "gitCommit": "a" * 40, "gitTree": "b" * 40,
            "dirty": True, "inputSha256": digest(canonical(inputs)), "inputs": inputs}


def write_zip(path, names, *, mode=stat.S_IFREG | 0o644, timestamp=(1980, 1, 1, 0, 0, 0)):
    with zipfile.ZipFile(path, "w") as archive:
        for name, content in names:
            info = zipfile.ZipInfo(name, timestamp)
            info.create_system = 3
            info.external_attr = mode << 16
            archive.writestr(info, content)


def write_tar_item(path, item, archive_format=tarfile.USTAR_FORMAT):
    with path.open("wb") as output:
        with gzip.GzipFile(fileobj=output, mode="wb", filename="", mtime=0, compresslevel=9) as compressed:
            with tarfile.open(fileobj=compressed, mode="w|", format=archive_format) as archive:
                archive.addfile(item, io.BytesIO(b""))


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="relay-archive-test-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.candidate = self.root / "candidate"
        fixture(self.candidate)
        seal(self.candidate, deepcopy(BASE_METADATA))

    def test_zip_and_tar_are_byte_reproducible_with_fixed_metadata(self):
        for suffix in (".zip", ".tar.gz"):
            left, right = self.root / ("one" + suffix), self.root / ("two" + suffix)
            first = pack(self.candidate, left, source=fixture_source())
            for file in self.candidate.rglob("*"):
                if file.is_file():
                    os.utime(file, (1700000000, 1700000000))
            second = pack(self.candidate, right, source=fixture_source())
            self.assertEqual(left.read_bytes(), right.read_bytes())
            self.assertEqual(first, second)
            self.assertEqual(receipt_path(left).read_bytes(), receipt_path(right).read_bytes())
            self.assertEqual(verify_archive(left)["status"], "ok")

    def test_archive_receipt_and_destination_never_overwrite(self):
        archive = self.root / "release.zip"
        receipt = pack(self.candidate, archive, source=fixture_source())
        before = archive.read_bytes()
        with self.assertRaises(ReleaseError):
            pack(self.candidate, archive, source=fixture_source())
        self.assertEqual(archive.read_bytes(), before)
        other = self.root / "reserved.zip"
        receipt_path(other).write_bytes(b"reserved receipt")
        with self.assertRaises(ReleaseError):
            pack(self.candidate, other, source=fixture_source())
        self.assertFalse(other.exists())
        destination = self.root / "existing"
        destination.mkdir()
        (destination / "keep").write_bytes(b"keep")
        with self.assertRaises(ReleaseError):
            unpack_checked(archive, receipt, destination)
        self.assertEqual((destination / "keep").read_bytes(), b"keep")

    def test_archive_byte_tampering_and_mismatched_source_are_rejected(self):
        archive = self.root / "release.zip"
        pack(self.candidate, archive, source=fixture_source())
        archive.write_bytes(archive.read_bytes() + b"tampered")
        with self.assertRaises(ReleaseError) as error:
            verify_archive(archive)
        self.assertEqual(error.exception.code, "ARCHIVE_DIGEST_MISMATCH")

    def test_changed_payload_with_forged_archive_digest_fails_release_check(self):
        archive = self.root / "release.zip"
        receipt = pack(self.candidate, archive, source=fixture_source())
        with zipfile.ZipFile(archive) as source:
            entries = [(item.filename, source.read(item)) for item in source.infolist()]
        write_zip(archive, [(name, b"changed" if name == "mc-content/page.md" else value) for name, value in entries])
        receipt["archive"]["sha256"] = file_digest(archive)
        receipt["archive"]["bytes"] = archive.stat().st_size
        destination = self.root / "failed-extract"
        with self.assertRaises(ReleaseError):
            unpack_checked(archive, receipt, destination)
        self.assertFalse(destination.exists())

    def test_traversal_absolute_drive_backslash_alias_and_reserved_paths_are_rejected(self):
        for index, name in enumerate(["../outside", "/outside", "C:/outside", "mc-tool/../outside",
            "mc-tool\\outside", "mc-tool//a", "mc-tool/CON.txt", "mc-tool/end.", "mc-content.md/child", "unexpected/file"]):
            archive = self.root / (str(index) + ".zip")
            write_zip(archive, [(name, b"bad")])
            destination = self.root / ("dest-" + str(index))
            with self.assertRaises(ReleaseError, msg=name):
                extract_archive(archive, destination, "zip")
            self.assertFalse(destination.exists())
        self.assertFalse((self.root.parent / "outside").exists())

    def test_duplicate_case_and_file_directory_collisions_are_rejected(self):
        for entries in [[("mc-tool/a", 1), ("mc-tool/A", 1)],
                        [("mc-tool/a", 1), ("mc-tool/a", 1)],
                        [("mc-tool/a", 1), ("mc-tool/a/b", 1)]]:
            with self.assertRaises(ReleaseError):
                check_members(entries)

    def test_zip_symlinks_and_nonfixed_metadata_are_rejected(self):
        archive = self.root / "link.zip"
        write_zip(archive, [("mc-tool/link", b"../outside")], mode=stat.S_IFLNK | 0o777)
        with self.assertRaises(ReleaseError):
            extract_archive(archive, self.root / "link-target", "zip")
        archive = self.root / "timestamp.zip"
        write_zip(archive, [("mc-tool/file", b"x")], timestamp=(2026, 1, 1, 0, 0, 0))
        with self.assertRaises(ReleaseError):
            extract_archive(archive, self.root / "timestamp-target", "zip")

    def test_tar_symlink_hardlink_device_fifo_directory_and_pax_are_rejected(self):
        types = [tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.CHRTYPE, tarfile.FIFOTYPE, tarfile.DIRTYPE]
        for index, kind in enumerate(types):
            archive = self.root / (str(index) + ".tar.gz")
            item = tarfile.TarInfo("mc-tool/link")
            item.type, item.mode, item.linkname = kind, 0o644, "../../outside"
            write_tar_item(archive, item)
            with self.assertRaises(ReleaseError):
                extract_archive(archive, self.root / ("tar-" + str(index)), "tar.gz")
        item = tarfile.TarInfo("mc-tool/file")
        item.mode, item.pax_headers = 0o644, {"comment": "not fixed metadata"}
        archive = self.root / "pax.tar.gz"
        write_tar_item(archive, item, tarfile.PAX_FORMAT)
        with self.assertRaises(ReleaseError):
            extract_archive(archive, self.root / "pax", "tar.gz")

    def test_receipt_duplicate_json_and_source_digest_change_are_rejected(self):
        archive = self.root / "release.zip"
        receipt = pack(self.candidate, archive, source=fixture_source())
        receipt["source"]["inputs"]["fixture.py"] = "0" * 64
        receipt_path(archive).write_bytes(canonical(receipt) + b"\n")
        with self.assertRaises(ReleaseError):
            verify_archive(archive)
        receipt_path(archive).write_bytes(b'{"format":1,"format":2}')
        with self.assertRaises(ReleaseError):
            verify_archive(archive)

    def test_source_drift_is_detected_from_actual_input_bytes(self):
        source = self.root / "source"
        source.mkdir()
        (source / "input.py").write_bytes(b"old")
        runtime = self.candidate / "mc-content/runtime"
        runtime.mkdir()
        (runtime / "source-identity.json").write_bytes(canonical({"files": [{"file": "input.py", "sha256": digest(b"old")}]}))
        for actual, author in [("mc-tool/cli.py", "product_cli.py"), ("mc-content.md", "guides/mc-content.md"), ("mc-tool.md", "guides/mc-tool.md")]:
            path = source / "tools/relay-reference" / author
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes((self.candidate / actual).read_bytes())
        self.assertEqual(source_inputs(source, self.candidate)["input.py"], digest(b"old"))
        (source / "input.py").write_bytes(b"new")
        with self.assertRaises(ReleaseError) as error:
            source_inputs(source, self.candidate)
        self.assertEqual(error.exception.code, "ARCHIVE_SOURCE_DRIFT")

    def test_standard_library_cli_checks_and_extraction_with_no_site_packages(self):
        archive = self.root / "release.zip"
        pack(self.candidate, archive, source=fixture_source())
        cli = Path(__file__).with_name("package_cli.py")
        child = subprocess.run([sys.executable, "-I", "-S", "-B", str(cli), "verify", "--archive", str(archive),
            "--expected-source", "a" * 40], capture_output=True, cwd=self.root)
        self.assertEqual(child.returncode, 0, child.stdout + child.stderr)
        self.assertEqual(json.loads(child.stdout)["status"], "ok")
        destination = self.root / "四项 unpacked"
        child = subprocess.run([sys.executable, "-I", "-S", "-B", str(cli), "extract", "--archive", str(archive),
            "--destination", str(destination)], capture_output=True, cwd=self.root)
        self.assertEqual(child.returncode, 0, child.stdout + child.stderr)
        self.assertEqual(len(list(destination.iterdir())), 4)


if __name__ == "__main__":
    unittest.main()
