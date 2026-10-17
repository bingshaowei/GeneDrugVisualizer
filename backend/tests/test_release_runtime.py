import importlib.util
import json
from pathlib import Path
import socket
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "verify-runtime.py"


def load_verifier():
    if not SCRIPT.is_file():
        raise AssertionError("Missing real release runtime verifier")
    spec = importlib.util.spec_from_file_location("release_runtime", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ReleaseRuntimeTests(unittest.TestCase):
    def setUp(self):
        self.resources = Path(tempfile.mkdtemp(prefix="GDV release runtime "))
        (self.resources / "backend" / "build" / "assets").mkdir(parents=True)
        (self.resources / "backend" / "build" / "index.html").write_text('<script src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css">')
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            self.port = listener.getsockname()[1]

    def fixture(self, mode="ready"):
        source = '''import json, os, time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
MODE = MODE_VALUE
if MODE == "exit":
    raise SystemExit(7)
if MODE == "slow":
    time.sleep(10)
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def do_GET(self):
        status, content_type = 200, "application/json"
        if self.path == "/health":
            if MODE == "late-health":
                time.sleep(.6)
            body = json.dumps({"service": "gene-drug-visualizer", "status": "ready"})
        elif self.path == "/":
            content_type = "text/html"
            body = Path(os.environ["FRONTEND_BUILD_DIR"], "index.html").read_text()
        elif self.path == "/assets/app.js":
            content_type, body = "text/javascript", "console.log('ok')"
            if MODE == "missing":
                status = 404
            if MODE == "fallback":
                content_type, body = "text/html", "<html>fallback</html>"
        elif self.path == "/assets/app.css":
            content_type, body = "text/css", "body {color: black}"
        elif self.path == "/expression/TP53":
            body = json.dumps([{"COSMIC_ID": 1, "value": 1.5}])
        else:
            status, body = 404, "missing"
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.end_headers()
        self.wfile.write(body.encode())
    def do_POST(self):
        data = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        valid = self.path == "/drug_response" and data["cosmic_ids"] == [1] and data["metric"] == "AUC"
        body = [{"COSMIC_ID": 1, "Drug_Name": "DrugA", "AUC": .2}] if valid and MODE != "empty-drug" else []
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())
HTTPServer(("127.0.0.1", PORT_VALUE), Handler).serve_forever()
'''
        (self.resources / "backend" / "app.py").write_text(source.replace("MODE_VALUE", repr(mode)).replace("PORT_VALUE", str(self.port)), encoding="utf8")

    def run_verifier(self, mode="ready", timeout=10):
        self.fixture(mode)
        return load_verifier().verify_runtime(self.resources, timeout=timeout, port=self.port, python_executable=sys.executable)

    def assert_port_released(self):
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", self.port))

    def test_real_requests_and_owned_process_cleanup(self):
        result = self.run_verifier()
        self.assertEqual(result["status"], "passed")
        self.assertEqual(result["gene"], "TP53")
        self.assertEqual(result["assetsChecked"], 2)
        self.assertGreater(result["drugResponseRows"], 0)
        self.assertTrue(result["backendStopped"])
        self.assert_port_released()

    def test_occupied_port_is_rejected_without_stopping_listener(self):
        verifier = load_verifier()
        self.fixture()
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", self.port))
            listener.listen()
            with self.assertRaisesRegex(RuntimeError, "occupied"):
                verifier.verify_runtime(self.resources, timeout=1, port=self.port, python_executable=sys.executable)
            self.assertEqual(listener.getsockname()[1], self.port)

    def test_backend_early_exit_is_reported(self):
        with self.assertRaisesRegex(RuntimeError, "exited"):
            self.run_verifier("exit")
        self.assert_port_released()

    def test_timeout_stops_owned_process(self):
        with self.assertRaisesRegex(RuntimeError, "ready.*timeout"):
            self.run_verifier("slow", timeout=.3)
        self.assert_port_released()

    def test_late_health_response_fails_and_cleans_up(self):
        with self.assertRaisesRegex(RuntimeError, "ready.*timeout"):
            self.run_verifier("late-health", timeout=.3)
        self.assert_port_released()

    def test_missing_asset_fails_and_cleans_up(self):
        with self.assertRaisesRegex(RuntimeError, "asset"):
            self.run_verifier("missing")
        self.assert_port_released()

    def test_spa_html_fallback_is_not_an_asset_success(self):
        with self.assertRaisesRegex(RuntimeError, "asset"):
            self.run_verifier("fallback")
        self.assert_port_released()

    def test_empty_drug_response_is_not_a_success(self):
        with self.assertRaisesRegex(RuntimeError, "drug response"):
            self.run_verifier("empty-drug")
        self.assert_port_released()

    def test_missing_python_is_reported(self):
        self.fixture()
        with self.assertRaisesRegex(RuntimeError, "Python"):
            load_verifier().verify_runtime(self.resources, port=self.port)


if __name__ == "__main__":
    unittest.main()
