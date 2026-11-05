"""Read frozen JSON snapshots from lossless storage without changing their byte pins."""
import gzip
import json
from pathlib import Path

from release import finite_float, reject_constant, unique_object


def snapshot_bytes(path):
    path = Path(path)
    if path.is_file():
        return path.read_bytes()
    return gzip.decompress(path.with_name(path.name + ".gz").read_bytes())


def snapshot_json(path):
    return json.loads(snapshot_bytes(path).decode("utf-8"), object_pairs_hook=unique_object,
                      parse_constant=reject_constant, parse_float=finite_float)
