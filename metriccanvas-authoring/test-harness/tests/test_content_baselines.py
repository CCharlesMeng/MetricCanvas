import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tool"))
from metriccanvas_authoring.application.content_ports import ContentBaseline, ContentBaselineError
from metriccanvas_authoring.application.edit_page import create_edit_page, document_sha256
from metriccanvas_authoring.adapters.relay.content_baselines import FileContentBaselines
from test_page_editing import page, title

TOKEN = "trusted-baseline-token"


class ContentBaselinesTest(unittest.IsolatedAsyncioTestCase):
    def envelope(self):
        document = page()
        return {"ref": {"pageId": document["id"], "revisionId": "r-opaque", "resourceId": "resource-opaque"}, "document": document, "documentSha256": document_sha256(document)}

    async def test_trusted_file_only_read_with_exact_ref_and_raw_hash(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / f"{TOKEN}.json"
            value = self.envelope(); path.write_text(json.dumps(value)); original = path.read_bytes()
            result = await create_edit_page(FileContentBaselines(Path(directory)))(TOKEN, {"operations": [title()]})
            self.assertTrue(result["ok"])
            self.assertEqual(result["artifactEnvelope"]["artifact"]["baseRef"], value["ref"])
            self.assertEqual(path.read_bytes(), original)
            self.assertEqual(len(list(Path(directory).iterdir())), 1)
            self.assertNotIn("private-region", json.dumps(result["modelSummary"]))

    async def test_wrong_hash_or_ref_never_produces_artifact(self):
        for key in ("hash", "pageId", "revisionId"):
            with self.subTest(key=key), tempfile.TemporaryDirectory() as directory:
                value = self.envelope()
                if key == "hash": value["documentSha256"] = "0" * 64
                elif key == "pageId": value["ref"][key] = "another"
                else: value["ref"][key] = ""
                (Path(directory) / f"{TOKEN}.json").write_text(json.dumps(value))
                result = await create_edit_page(FileContentBaselines(Path(directory)))(TOKEN, {"operations": [title()]})
                self.assertFalse(result["ok"])
                self.assertIsNone(result["artifactEnvelope"])

    async def test_old_baseline_hash_is_checked_before_normalizing(self):
        with tempfile.TemporaryDirectory() as directory:
            value = self.envelope(); d = value["document"]; d["schemaVersion"] = "6.0"; d["layoutForm"] = d.pop("layout")
            value["documentSha256"] = document_sha256(d)
            (Path(directory) / f"{TOKEN}.json").write_text(json.dumps(value))
            result = await create_edit_page(FileContentBaselines(Path(directory)))(TOKEN, {"operations": [title()]})
            self.assertTrue(result["ok"])
            artifact = result["artifactEnvelope"]["artifact"]
            self.assertEqual(artifact["baseDocumentSha256"], value["documentSha256"])
            self.assertEqual(artifact["document"]["layout"], "report")

    async def test_paths_symlinks_missing_and_unconfigured_are_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            reader = FileContentBaselines(Path(directory))
            for token in ("../secret", "/etc/passwd", TOKEN):
                with self.assertRaises(ContentBaselineError): await reader.read(token)
            (Path(directory) / f"{TOKEN}.json").symlink_to(Path(directory) / "target")
            with self.assertRaises(ContentBaselineError): await reader.read(TOKEN)
        with self.assertRaises(ContentBaselineError) as error: await FileContentBaselines(None).read(TOKEN)
        self.assertEqual(error.exception.code, "BASELINE_CAPABILITY_UNAVAILABLE")
