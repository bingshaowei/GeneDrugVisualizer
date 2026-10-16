import os
from pathlib import Path
import subprocess
import sys
import unittest


class BackendStartupEncodingTests(unittest.TestCase):
    def test_chinese_startup_log_survives_english_windows_redirected_output(self):
        app_path = Path(__file__).resolve().parents[1] / "app.py"
        # Isolate only data loading and the blocking server; execute the real entry point.
        source = '''import runpy, sys, types
pandas = types.ModuleType("pandas")
pandas.read_csv = lambda *args, **kwargs: object()
sys.modules["pandas"] = pandas
api = types.ModuleType("api")
class App:
    def run(self, **kwargs):
        print("SERVER_STARTED")
api.create_app = lambda *args: App()
sys.modules["api"] = api
runpy.run_path(sys.argv[1], run_name="__main__")
'''
        result = subprocess.run(
            [sys.executable, "-B", "-c", source, str(app_path)],
            env={**os.environ, "PYTHONIOENCODING": "cp1252"},
            capture_output=True, timeout=10,
        )
        self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", errors="replace"))
        output = result.stdout.decode("utf-8")
        self.assertIn("Flask 启动成功", output)
        self.assertIn("SERVER_STARTED", output)


if __name__ == "__main__":
    unittest.main()
