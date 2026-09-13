import pandas as pd
import os
import sys

# ===== 自动定位目录结构 =====
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from api import create_app

BUILD_DIR = os.environ.get('FRONTEND_BUILD_DIR', os.path.join(BASE_DIR, 'build'))

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


expression_df = load_csv_or_excel(os.path.join(BASE_DIR, 'data', 'expression.csv'))
drug_df = load_csv_or_excel(os.path.join(BASE_DIR, 'data', 'drug.csv'))
app = create_app(expression_df, drug_df, BUILD_DIR)


# ====== 启动 ======
if __name__ == '__main__':
    print(f"Flask 启动成功！将在 {BUILD_DIR} 查找前端静态文件")
    app.run(host='127.0.0.1', port=5000, debug=False)


