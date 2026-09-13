import os

from flask import Flask, jsonify, request, send_from_directory

from data_service import DataService, METRICS


MAX_IDS = 2000
MAX_CONTENT_LENGTH = 256 * 1024


def create_app(expression_df, drug_df, build_dir):
    app = Flask(__name__, static_folder=build_dir, static_url_path="/")
    app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH
    service = DataService(expression_df, drug_df)
    app.extensions["data_service"] = service

    @app.after_request
    def security_headers(response):
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; "
            "worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    def error(message, status=400):
        return jsonify({"error": message}), status

    def json_object():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            raise ValueError("请求体必须是 JSON 对象")
        return data

    def metric_from(data):
        metric = data.get("metric", "Z_SCORE")
        if metric not in METRICS:
            raise ValueError("不支持的药物指标")
        return metric

    def cosmic_ids_from(data, field):
        values = data.get(field, [])
        if not isinstance(values, list):
            raise ValueError(f"{field} 必须是数组")
        result = []
        seen = set()
        for value in values:
            if isinstance(value, bool):
                raise ValueError(f"{field} 包含非法 COSMIC_ID")
            try:
                normalized = int(value)
            except (TypeError, ValueError):
                raise ValueError(f"{field} 包含非法 COSMIC_ID") from None
            if normalized <= 0:
                raise ValueError(f"{field} 包含非法 COSMIC_ID")
            if normalized not in seen:
                seen.add(normalized)
                result.append(normalized)
        return result

    @app.errorhandler(413)
    def request_too_large(_error):
        return error("请求体超过 256 KB 限制", 413)

    @app.errorhandler(500)
    def internal_error(server_error):
        app.logger.error("未处理的后端异常", exc_info=server_error.original_exception)
        return error("服务器内部错误", 500)

    @app.get("/health")
    def health():
        return jsonify({"service": "gene-drug-visualizer", "status": "ready"})

    @app.get("/autocomplete")
    def autocomplete():
        return jsonify(service.autocomplete(request.args.get("q", type=str, default="")))

    @app.get("/expression/<gene>")
    def expression(gene):
        return jsonify(service.expression_records(gene))

    @app.post("/drug_response")
    def drug_response():
        try:
            data = json_object()
            metric_from(data)
            cosmic_ids = cosmic_ids_from(data, "cosmic_ids")
            if len(cosmic_ids) > MAX_IDS:
                raise ValueError(f"cosmic_ids 最多允许 {MAX_IDS} 个")
            drug_name = data.get("drug_name")
            if drug_name is not None and not isinstance(drug_name, str):
                raise ValueError("drug_name 必须是字符串")
            return jsonify(service.drug_response(cosmic_ids, drug_name))
        except ValueError as exc:
            return error(str(exc))

    @app.post("/drug_group_summary")
    def drug_group_summary():
        try:
            data = json_object()
            metric = metric_from(data)
            high_ids = cosmic_ids_from(data, "high_cosmic_ids")
            low_ids = cosmic_ids_from(data, "low_cosmic_ids")
            if len(high_ids) + len(low_ids) > MAX_IDS:
                raise ValueError(f"样本 ID 总数最多允许 {MAX_IDS} 个")
            if set(high_ids) & set(low_ids):
                raise ValueError("高低表达组不能包含相同 COSMIC_ID")
            return jsonify(service.group_summary(high_ids, low_ids, metric))
        except ValueError as exc:
            return error(str(exc))

    @app.get("/drug_details/<drug_name>")
    def drug_details(drug_name):
        details = service.drug_details(drug_name)
        if details is None:
            return error("药物信息未找到", 404)
        return jsonify(details)

    @app.get("/cell_line_map")
    def cell_line_map():
        return jsonify(service.cell_line_mapping())

    @app.get("/")
    def serve_index():
        return app.send_static_file("index.html")

    @app.get("/<path:path>")
    def static_proxy(path):
        file_path = os.path.join(app.static_folder, path)
        if os.path.isfile(file_path):
            return send_from_directory(app.static_folder, path)
        return app.send_static_file("index.html")

    return app
