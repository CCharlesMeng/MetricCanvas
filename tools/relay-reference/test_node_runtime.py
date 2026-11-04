"""Executable resolution at the Windows process boundary, without a shell."""
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

import product_runtime
from release import ReleaseError

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/mc-content/scripts"))
import mc_runtime
from mc_resources import ContentError

NODE = "C:\\Program Files\\nodejs\\node.exe"


class NodeRuntimeTests(unittest.TestCase):
    def test_product_version_check_launches_resolved_executable(self):
        with patch("product_runtime.shutil.which", return_value=NODE), patch(
            "product_runtime.subprocess.run", return_value=subprocess.CompletedProcess([], 0, "v22.1.0\n", "")
        ) as launch:
            product_runtime.runtime_check({"runtime": {"dependencies": {}}})
        self.assertEqual(launch.call_args.args[0], [NODE, "--version"])
        self.assertEqual(launch.call_args.kwargs["encoding"], "utf-8")

    def test_product_dispatch_keeps_guard_and_utf8_bytes_with_space_path(self):
        root = Path("/tmp/四项 installed").resolve()
        result = subprocess.CompletedProcess([], 0, b'{"status":"ok","data":{},"diagnostics":[]}', b'')
        with patch("product_runtime.shutil.which", return_value=NODE), patch(
            "product_runtime.subprocess.run", return_value=result
        ) as launch:
            receipt = product_runtime.node_operation(root, {"path": "scripts/page.mjs"}, "page.scan", {"title": "中文"})
        self.assertEqual(receipt["status"], "ok")
        self.assertEqual(launch.call_args.args[0][:2], [NODE, "--import"])
        self.assertIn("network_guard.mjs", launch.call_args.args[0][2])
        self.assertIn("中文".encode(), launch.call_args.kwargs["input"])
        self.assertEqual(launch.call_args.kwargs["env"]["NODE_OPTIONS"], "")

    def test_missing_node_is_a_structured_product_environment_error(self):
        with patch("product_runtime.shutil.which", return_value=None), patch("product_runtime.subprocess.run") as launch:
            with self.assertRaises(ReleaseError) as raised:
                product_runtime.node_executable()
        self.assertEqual(raised.exception.code, "PRODUCT_RUNTIME_UNAVAILABLE")
        launch.assert_not_called()

    def test_content_execution_and_preflight_use_same_resolved_path(self):
        with patch("mc_runtime.shutil.which", return_value=NODE), patch(
            "mc_runtime.subprocess.run", return_value=subprocess.CompletedProcess([], 0, '{"title":"中文"}', "")
        ) as launch:
            self.assertEqual(mc_runtime.run_node(["reader.mjs"]), {"title": "中文"})
        self.assertEqual(launch.call_args.args[0], [NODE, "reader.mjs"])
        self.assertEqual(launch.call_args.kwargs["encoding"], "utf-8")
        with patch("mc_runtime.shutil.which", return_value=NODE), patch(
            "mc_runtime.subprocess.run", return_value=subprocess.CompletedProcess([], 0, "v22.1.0\n", "")
        ) as launch:
            self.assertEqual(mc_runtime.node_check()["executable"], NODE)
        self.assertEqual(launch.call_args.args[0], [NODE, "--version"])

    def test_content_missing_node_does_not_invoke_a_bare_name(self):
        with patch("mc_runtime.shutil.which", return_value=None), patch("mc_runtime.subprocess.run") as launch:
            with self.assertRaises(ContentError) as raised:
                mc_runtime.run_node(["reader.mjs"])
            self.assertEqual(mc_runtime.node_check()["status"], "not_run")
        self.assertEqual(raised.exception.issue["code"], "CONTENT_RUNTIME_UNAVAILABLE")
        launch.assert_not_called()


if __name__ == "__main__":
    unittest.main()
