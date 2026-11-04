"""Deterministic ZIP/tar.gz bytes and portable, file-only extraction."""
from __future__ import annotations
import gzip
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import tarfile
import unicodedata
import zipfile

from release import TOP_LEVEL, relative_path, require

MAX_FILES = 20000
MAX_MEMBER = 128 * 1024 * 1024
MAX_TOTAL = 1024 * 1024 * 1024


def portable_part(part):
    return (not part.endswith((".", " ")) and not any(ord(char) < 32 for char in part)
            and not re.fullmatch(r"CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9]", part.split(".")[0], re.IGNORECASE))


def member_name(name):
    relative_path(name)
    parts = PurePosixPath(name).parts
    require(unicodedata.normalize("NFC", name) == name and all(portable_part(part) for part in parts),
            "ARCHIVE_PATH_INVALID", "Non-portable archive path: " + name)
    require(parts[0] in TOP_LEVEL, "ARCHIVE_LAYOUT_INVALID", name)
    require((len(parts) == 1) == (parts[0] in {"mc-content.md", "mc-tool.md"}),
            "ARCHIVE_LAYOUT_INVALID", name)
    return name


def check_members(entries):
    require(0 < len(entries) <= MAX_FILES, "ARCHIVE_LIMIT_EXCEEDED", "Invalid member count")
    seen, total = set(), 0
    for name, size in entries:
        member_name(name)
        key = name.casefold()
        require(key not in seen, "ARCHIVE_PATH_INVALID", "Duplicate/case collision: " + name)
        require(0 <= size <= MAX_MEMBER, "ARCHIVE_LIMIT_EXCEEDED", name)
        seen.add(key)
        total += size
    require(total <= MAX_TOTAL, "ARCHIVE_LIMIT_EXCEEDED", "Archive is too large")
    for name, _ in entries:
        parents = PurePosixPath(name).parents
        require(not any(str(parent).casefold() in seen for parent in parents),
                "ARCHIVE_PATH_INVALID", "File/directory collision: " + name)


def write_zip(root, names, stream):
    with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_STORED) as archive:
        for name in names:
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            info.compress_type = zipfile.ZIP_STORED
            with (root / name).open("rb") as source, archive.open(info, "w") as target:
                shutil.copyfileobj(source, target)


def write_tar(root, names, stream):
    with gzip.GzipFile(fileobj=stream, mode="wb", filename="", mtime=0, compresslevel=9) as compressed:
        with tarfile.open(fileobj=compressed, mode="w|", format=tarfile.USTAR_FORMAT, encoding="utf-8") as archive:
            for name in names:
                info = tarfile.TarInfo(name)
                info.size = (root / name).stat().st_size
                info.mode = 0o644
                info.mtime = info.uid = info.gid = 0
                info.uname = info.gname = ""
                with (root / name).open("rb") as source:
                    archive.addfile(info, source)


def write_archive(root, names, stream, kind):
    entries = [(name, (root / name).stat().st_size) for name in names]
    check_members(entries)
    if kind == "zip":
        write_zip(root, names, stream)
    else:
        require(kind == "tar.gz", "ARCHIVE_FORMAT_INVALID", kind)
        write_tar(root, names, stream)


def zip_members(archive):
    require(not archive.comment, "ARCHIVE_METADATA_INVALID", "ZIP comment is not allowed")
    members = archive.infolist()
    for item in members:
        mode = item.external_attr >> 16
        require(item.filename == item.orig_filename and not item.is_dir() and stat.S_ISREG(mode),
                "ARCHIVE_MEMBER_INVALID", item.orig_filename)
        require(item.date_time == (1980, 1, 1, 0, 0, 0) and item.create_system == 3,
                "ARCHIVE_METADATA_INVALID", item.filename)
        require(not item.extra and not item.comment and not item.flag_bits & ~0x800 and mode == stat.S_IFREG | 0o644
                and item.compress_type == zipfile.ZIP_STORED,
                "ARCHIVE_METADATA_INVALID", item.filename)
    check_members([(item.orig_filename, item.file_size) for item in members])
    return members


def tar_members(archive):
    members = archive.getmembers()
    for item in members:
        require(item.isfile() and not item.pax_headers, "ARCHIVE_MEMBER_INVALID", item.name)
        require(item.mtime == item.uid == item.gid == 0 and item.mode == 0o644
                and item.uname == item.gname == "", "ARCHIVE_METADATA_INVALID", item.name)
    check_members([(item.name, item.size) for item in members])
    return members


def copy_member(source, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("xb") as target:
        shutil.copyfileobj(source, target)


def extract_zip(path, destination):
    with zipfile.ZipFile(path) as archive:
        members = zip_members(archive)
        destination.mkdir()
        try:
            for item in members:
                with archive.open(item) as source:
                    copy_member(source, destination / item.filename)
        except Exception:
            shutil.rmtree(destination)
            raise


def extract_tar(path, destination):
    with path.open("rb") as source:
        require(source.read(10) == b"\x1f\x8b\x08\x00\x00\x00\x00\x00\x02\xff",
                "ARCHIVE_METADATA_INVALID", "Expected fixed gzip metadata")
    with tarfile.open(path, "r:gz", encoding="utf-8") as archive:
        members = tar_members(archive)
        destination.mkdir()
        try:
            for item in members:
                with archive.extractfile(item) as source:
                    copy_member(source, destination / item.name)
        except Exception:
            shutil.rmtree(destination)
            raise


def extract_archive(path, destination, kind):
    require(not destination.exists() and not destination.is_symlink(), "ARCHIVE_OUTPUT_EXISTS", str(destination))
    require(destination.parent.is_dir(), "ARCHIVE_OUTPUT_INVALID", "Destination parent must exist")
    if kind == "zip":
        extract_zip(path, destination)
    else:
        require(kind == "tar.gz", "ARCHIVE_FORMAT_INVALID", kind)
        extract_tar(path, destination)
