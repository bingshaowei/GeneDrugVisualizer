from flask import Flask, request, jsonify, send_from_directory
import pandas as pd
import os
from flask_cors import CORS

# ===== 自动定位目录结构 =====
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.join(BASE_DIR, 'build')

# ===== 初始化 Flask =====
app = Flask(__name__, static_folder=BUILD_DIR, static_url_path='/')
CORS(app)

# ====== 加载数据 ======
def load_csv_or_excel(file_path):
    try:
        df = pd.read_csv(file_path, encoding='utf-8')
        return df
    except Exception:
        try:
            df = pd.read_csv(file_path, encoding='gbk')  # 兼容中文系统
            return df
        except Exception:
            try:
                df = pd.read_excel(file_path, engine='openpyxl')
                return df
            except Exception:
                try:
                    df = pd.read_excel(file_path, engine='xlrd')
                    return df
                except Exception as ex2:
                    raise RuntimeError(f"无法读取文件 {file_path}: {ex2}")


# 加载 expression.csv
expression_df = load_csv_or_excel(os.path.join(BASE_DIR, 'data', 'expression.csv'))
gene_names = list(expression_df.columns[4:])

# 加载 drug.csv
drug_df = load_csv_or_excel(os.path.join(BASE_DIR, 'data', 'drug.csv'))
drug_data = {}
for idx, row in drug_df.iterrows():
    cosmic_id = row['COSMIC_ID']
    entry = {
        "Drug_Name": row["DRUG_NAME"],
        "Z_SCORE": row["Z_SCORE"],
        "LN_IC50": row["LN_IC50"],
        "AUC": row["AUC"],
        "RMSE": row["RMSE"],
        "TCGA_DESC": row.get("TCGA_DESC", "Unknown")
    }
    drug_data.setdefault(cosmic_id, []).append(entry)

# 药物详情缓存
drug_details_cache = {}
for idx, row in drug_df.iterrows():
    drug_name = row['DRUG_NAME']
    if drug_name not in drug_details_cache:
        drug_details_cache[drug_name] = {
            'DRUG_NAME': drug_name,
            'PUTATIVE_TARGET': row.get('PUTATIVE_TARGET', ''),
            'PATHWAY_NAME': row.get('PATHWAY_NAME', '')
        }

# ====== API 路由 ======
@app.route('/autocomplete')
def autocomplete():
    query = request.args.get('q', default='', type=str)
    if not query:
        return jsonify([])
    q_upper = query.upper()
    matches = [gene for gene in gene_names if q_upper in gene.upper()]
    return jsonify(matches)

@app.route('/expression/<gene>')
def get_expression(gene):
    gene_upper = gene.upper()
    match = None
    for g in gene_names:
        if g.upper() == gene_upper:
            match = g
            break
    if match is None:
        return jsonify([])
    sub_df = expression_df.loc[:, ["COSMIC_ID", "site", "histology", match]]
    sub_df = sub_df.rename(columns={match: "value"})
    records = sub_df.to_dict(orient='records')
    return jsonify(records)

@app.route('/drug_response', methods=['POST'])
def drug_response():
    data = request.get_json(force=True)
    cosmic_ids = data.get("cosmic_ids", [])
    drug_name = data.get("drug_name", None)
    
    result = []
    for cid in cosmic_ids:
        try:
            cid_int = int(cid)
        except:
            cid_int = cid
        if cid_int in drug_data:
            for entry in drug_data[cid_int]:
                if drug_name and entry["Drug_Name"] != drug_name:
                    continue
                record = entry.copy()
                record["COSMIC_ID"] = cid_int
                result.append(record)
    return jsonify(result)

@app.route('/drug_details/<drug_name>')
def get_drug_details(drug_name):
    if drug_name in drug_details_cache:
        return jsonify(drug_details_cache[drug_name])
    else:
        return jsonify({"error": "药物信息未找到"}), 404

# ====== 静态文件路由 ======
@app.route('/')
def serve_index():
    return app.send_static_file('index.html')

@app.route('/<path:path>')
def static_proxy(path):
    file_path = os.path.join(app.static_folder, path)
    if os.path.exists(file_path):
        return send_from_directory(app.static_folder, path)
    else:
        return app.send_static_file('index.html')

@app.route('/cell_line_map')
def get_cell_line_map():
    try:
        df = expression_df
        # 确保 COSMIC_ID 是字符串（与前端 JSON 对应）
        df['COSMIC_ID'] = df['COSMIC_ID'].astype(str)
        mapping = dict(zip(df['COSMIC_ID'], df['CELL_LINE']))
        return jsonify(mapping)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ====== 启动 ======
if __name__ == '__main__':
    print(f"Flask 启动成功！将在 {BUILD_DIR} 查找前端静态文件")
    app.run(host='0.0.0.0', port=5000, debug=True)


