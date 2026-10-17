"""Exercise the packaged backend over real HTTP without installing the NSIS package."""
import argparse
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import build_opener, ProxyHandler, Request


class IndexAssets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and attrs.get("src"):
            self.assets.append((attrs["src"], "script"))
        elif tag == "link" and attrs.get("href") and attrs.get("rel") in ("stylesheet", "modulepreload"):
            self.assets.append((attrs["href"], "style" if attrs["rel"] == "stylesheet" else "script"))


def verify_runtime(resources, timeout=30, port=5000, python_executable=None):
    resources = Path(resources).resolve()
    python = Path(python_executable) if python_executable else resources / "python-embedded" / "python.exe"
    backend = resources / "backend"
    if not python.is_file():
        raise RuntimeError(f"Packaged Python is missing: {python}")
    if not (backend / "app.py").is_file():
        raise RuntimeError("Packaged backend app.py is missing")
    with socket.socket() as probe:
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        try:
            probe.bind(("127.0.0.1", port))
        except OSError as exc:
            raise RuntimeError(f"Backend port {port} is occupied; existing services were not stopped") from exc

    base_url = f"http://127.0.0.1:{port}"
    opener = build_opener(ProxyHandler({}))

    def request(route, payload=None, request_timeout=2):
        data = None if payload is None else json.dumps(payload).encode("utf8")
        req = Request(urljoin(base_url, route), data=data, headers={"Content-Type": "application/json"} if data else {})
        with opener.open(req, timeout=request_timeout) as response:
            return response.read(), response.headers.get_content_type()

    def request_json(route, payload=None, request_timeout=2):
        body, content_type = request(route, payload, request_timeout)
        if content_type != "application/json":
            raise RuntimeError(f"Expected JSON response: {route}")
        return json.loads(body)

    env = dict(os.environ)
    for key in ("PYTHONHOME", "PYTHONPATH"):
        env.pop(key, None)
    env.update(FRONTEND_BUILD_DIR=str(backend / "build"), PYTHONUNBUFFERED="1", PYTHONDONTWRITEBYTECODE="1", PYTHONNOUSERSITE="1")
    started = time.monotonic()
    # A file avoids pipe-buffer deadlocks while retaining backend diagnostics on failure.
    with tempfile.TemporaryFile(mode="w+b") as log:
        try:
            process = subprocess.Popen([str(python), "-B", str(backend / "app.py")], cwd=backend,
                                       env=env, stdout=log, stderr=log,
                                       creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        except OSError as exc:
            raise RuntimeError(f"Packaged Python could not start: {exc}") from exc
        result = None
        try:
            deadline = started + timeout
            last_error = "no health response"
            while True:
                if process.poll() is not None:
                    raise RuntimeError(f"Backend exited before ready (code {process.returncode})")
                if time.monotonic() >= deadline:
                    raise RuntimeError(f"Backend not ready before timeout ({timeout}s): {last_error}")
                try:
                    health = request_json("/health", request_timeout=min(1, deadline - time.monotonic()))
                except (OSError, URLError, ValueError) as exc:
                    last_error = str(exc)
                    health = None
                if time.monotonic() >= deadline:
                    raise RuntimeError(f"Backend not ready before timeout ({timeout}s): {last_error}")
                if health is not None:
                    if health != {"service": "gene-drug-visualizer", "status": "ready"}:
                        raise RuntimeError(f"Unexpected backend health identity: {health}")
                    break
                time.sleep(min(.1, max(0, deadline - time.monotonic())))

            ready_ms = round((time.monotonic() - started) * 1000)
            index, index_type = request("/")
            if index_type != "text/html" or not index:
                raise RuntimeError("Packaged homepage is missing or not HTML")
            parser = IndexAssets()
            parser.feed(index.decode("utf8"))
            if not any(kind == "script" for _, kind in parser.assets):
                raise RuntimeError("Packaged homepage references no script asset")
            for asset, kind in parser.assets:
                url = urljoin(base_url + "/", asset)
                if urlsplit(url).netloc != urlsplit(base_url).netloc or urlsplit(url).scheme != "http":
                    raise RuntimeError(f"Unexpected external asset: {asset}")
                try:
                    body, content_type = request(url)
                except (OSError, URLError) as exc:
                    raise RuntimeError(f"Packaged asset request failed: {asset}: {exc}") from exc
                allowed = ("text/javascript", "application/javascript") if kind == "script" else ("text/css",)
                if not body or content_type not in allowed:
                    raise RuntimeError(f"Packaged asset is empty or has wrong content type: {asset}: {content_type}")

            expression = request_json("/expression/TP53")
            if not isinstance(expression, list) or not expression:
                raise RuntimeError("TP53 expression query returned no data")
            ids = []
            for row in expression:
                if not isinstance(row, dict) or "COSMIC_ID" not in row or "value" not in row:
                    raise RuntimeError("TP53 expression query has invalid rows")
                cosmic_id = int(row["COSMIC_ID"])
                if cosmic_id > 0 and cosmic_id not in ids:
                    ids.append(cosmic_id)
                if len(ids) == 2000:
                    break
            if not ids:
                raise RuntimeError("TP53 expression query has no sample IDs")
            drug = request_json("/drug_response", {"cosmic_ids": ids, "metric": "AUC"})
            if not isinstance(drug, list) or not drug or not all(
                isinstance(row, dict) and row.get("COSMIC_ID") in ids and row.get("Drug_Name") and "AUC" in row for row in drug
            ):
                raise RuntimeError("Invalid or empty drug response")
            if process.poll() is not None:
                raise RuntimeError("Backend exited during runtime validation")
            result = {"status": "passed", "readyWithinMs": ready_ms, "assetsChecked": len(parser.assets),
                      "gene": "TP53", "expressionRows": len(expression), "drugResponseRows": len(drug)}
        except Exception as exc:
            # Terminate before reading the log so that the final diagnostic output is available.
            if process.poll() is None:
                process.terminate()
            process.wait(timeout=5)
            log.seek(0)
            detail = log.read().decode("utf8", errors="replace")[-8000:]
            raise RuntimeError(f"{exc}\nBackend log:\n{detail}") from exc
        finally:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
        result["backendStopped"] = process.poll() is not None
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--resources", required=True, type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(verify_runtime(args.resources)))
    except Exception as exc:
        print(f"Runtime validation failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
