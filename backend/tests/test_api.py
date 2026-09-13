import sys
import tempfile
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from api import create_app
from test_data_service import make_drug_frame, make_expression_frame


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        build_dir = Path(self.temp_dir.name)
        (build_dir / "index.html").write_text("ok", encoding="utf-8")
        app = create_app(make_expression_frame(), make_drug_frame(), str(build_dir))
        app.testing = True
        self.app = app
        self.client = app.test_client()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_health_identifies_ready_service(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"service": "gene-drug-visualizer", "status": "ready"})
        self.assertIn("default-src 'self'", response.headers["Content-Security-Policy"])
        self.assertNotIn("Access-Control-Allow-Origin", response.headers)

    def test_autocomplete_is_limited_and_prefixes_come_first(self):
        response = self.client.get("/autocomplete?q=tp")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), ["TP53"])

    def test_expression_rejects_metadata_as_gene(self):
        self.assertEqual(self.client.get("/expression/histology").get_json(), [])

    def test_drug_response_rejects_non_object_json(self):
        response = self.client.post("/drug_response", json=None)
        self.assertEqual(response.status_code, 400)

    def test_drug_response_rejects_invalid_metric_and_id_type(self):
        self.assertEqual(self.client.post("/drug_response", json={"cosmic_ids": [1], "metric": "BAD"}).status_code, 400)
        self.assertEqual(self.client.post("/drug_response", json={"cosmic_ids": "1", "metric": "AUC"}).status_code, 400)
        self.assertEqual(self.client.post("/drug_response", json={"cosmic_ids": ["abc"], "metric": "AUC"}).status_code, 400)

    def test_drug_response_allows_2000_ids_and_rejects_more(self):
        allowed = self.client.post("/drug_response", json={"cosmic_ids": list(range(1, 2001)), "metric": "AUC"})
        rejected = self.client.post("/drug_response", json={"cosmic_ids": list(range(1, 2002)), "metric": "AUC"})
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(rejected.status_code, 400)

    def test_group_summary_rejects_overlapping_groups(self):
        response = self.client.post(
            "/drug_group_summary",
            json={"high_cosmic_ids": [1], "low_cosmic_ids": [1], "metric": "AUC"},
        )
        self.assertEqual(response.status_code, 400)

    def test_request_body_over_256_kib_returns_413(self):
        response = self.client.post(
            "/drug_response",
            data=b"{" + (b" " * (256 * 1024)) + b"}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 413)

    def test_internal_errors_return_generic_json(self):
        self.app.config["PROPAGATE_EXCEPTIONS"] = False
        self.app.logger.disabled = True
        @self.app.get("/test-error")
        def test_error():
            raise RuntimeError("sensitive detail")

        response = self.client.get("/test-error")
        self.app.logger.disabled = False
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.get_json(), {"error": "服务器内部错误"})
        self.assertNotIn(b"sensitive detail", response.data)


if __name__ == "__main__":
    unittest.main()
