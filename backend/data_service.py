import math

import pandas as pd


METADATA_COLUMNS = {"TCGA_DESC", "COSMIC_ID", "CELL_LINE", "site", "histology"}
METRICS = {"Z_SCORE", "LN_IC50", "AUC", "RMSE"}


def json_value(value):
    if pd.isna(value):
        return None
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if hasattr(value, "item"):
        value = value.item()
    return value


class DataService:
    def __init__(self, expression_df, drug_df):
        self.expression_df = expression_df.copy()
        self.drug_df = drug_df.copy()
        self.gene_names = [
            column for column in self.expression_df.columns if column not in METADATA_COLUMNS
        ]
        self._gene_lookup = {gene.upper(): gene for gene in self.gene_names}

        self._responses_by_id = {}
        self._drug_details = {}
        for _, row in self.drug_df.iterrows():
            cosmic_id = int(row["COSMIC_ID"])
            entry = {
                "Drug_Name": json_value(row["DRUG_NAME"]),
                "Z_SCORE": json_value(row.get("Z_SCORE")),
                "LN_IC50": json_value(row.get("LN_IC50")),
                "AUC": json_value(row.get("AUC")),
                "RMSE": json_value(row.get("RMSE")),
                "TCGA_DESC": json_value(row.get("TCGA_DESC", "Unknown")),
            }
            self._responses_by_id.setdefault(cosmic_id, []).append(entry)

            drug_name = str(row["DRUG_NAME"])
            self._drug_details.setdefault(
                drug_name,
                {
                    "DRUG_NAME": drug_name,
                    "PUTATIVE_TARGET": json_value(row.get("PUTATIVE_TARGET", "")),
                    "PATHWAY_NAME": json_value(row.get("PATHWAY_NAME", "")),
                },
            )

    def autocomplete(self, query, limit=10):
        query_upper = query.strip().upper()
        if not query_upper:
            return []
        starts = [gene for gene in self.gene_names if gene.upper().startswith(query_upper)]
        contains = [
            gene
            for gene in self.gene_names
            if query_upper in gene.upper() and gene not in starts
        ]
        return (starts + contains)[:limit]

    def expression_records(self, gene):
        match = self._gene_lookup.get(gene.upper())
        if match is None:
            return []
        columns = ["COSMIC_ID", "CELL_LINE", "site", "histology", "TCGA_DESC", match]
        records = self.expression_df.loc[:, columns].rename(columns={match: "value"})
        return [
            {key: json_value(value) for key, value in record.items()}
            for record in records.to_dict(orient="records")
        ]

    def drug_response(self, cosmic_ids, drug_name=None):
        result = []
        for cosmic_id in dict.fromkeys(int(value) for value in cosmic_ids):
            for entry in self._responses_by_id.get(cosmic_id, []):
                if drug_name is not None and entry["Drug_Name"] != drug_name:
                    continue
                result.append({**entry, "COSMIC_ID": cosmic_id})
        return result

    def group_summary(self, high_cosmic_ids, low_cosmic_ids, metric):
        high_ids = set(high_cosmic_ids)
        low_ids = set(low_cosmic_ids)
        relevant = self.drug_df[self.drug_df["COSMIC_ID"].isin(high_ids | low_ids)].copy()
        drug_names = sorted(relevant["DRUG_NAME"].dropna().astype(str).unique())
        relevant[metric] = pd.to_numeric(relevant[metric], errors="coerce")
        relevant = relevant[relevant[metric].map(lambda value: pd.notna(value) and math.isfinite(value))]

        records = []
        for drug_name in drug_names:
            drug_rows = relevant[relevant["DRUG_NAME"].astype(str) == drug_name]
            high_values = drug_rows[drug_rows["COSMIC_ID"].isin(high_ids)][metric]
            low_values = drug_rows[drug_rows["COSMIC_ID"].isin(low_ids)][metric]
            records.append(
                {
                    "drug_name": drug_name,
                    "high_mean": float(high_values.mean()) if len(high_values) else None,
                    "low_mean": float(low_values.mean()) if len(low_values) else None,
                    "high_n": int(len(high_values)),
                    "low_n": int(len(low_values)),
                }
            )
        return records

    def drug_details(self, drug_name):
        return self._drug_details.get(drug_name)

    def cell_line_mapping(self):
        return {
            str(int(cosmic_id)): json_value(cell_line)
            for cosmic_id, cell_line in zip(
                self.expression_df["COSMIC_ID"], self.expression_df["CELL_LINE"]
            )
        }
