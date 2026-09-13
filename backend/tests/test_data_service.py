import math
import sys
import unittest
from pathlib import Path

import pandas as pd


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from data_service import DataService


def make_expression_frame():
    return pd.DataFrame(
        [
            {
                "TCGA_DESC": "LUAD",
                "COSMIC_ID": 1,
                "CELL_LINE": "A",
                "site": "lung",
                "histology": "adenocarcinoma",
                "TP53": 1.5,
                "EGFR": 2.5,
            },
            {
                "TCGA_DESC": "BRCA",
                "COSMIC_ID": 2,
                "CELL_LINE": "B",
                "site": "breast",
                "histology": "carcinoma",
                "TP53": 3.5,
                "EGFR": 4.5,
            },
        ]
    )


def make_drug_frame():
    return pd.DataFrame(
        [
            {"COSMIC_ID": 1, "DRUG_NAME": "DrugA", "Z_SCORE": -1.0, "LN_IC50": 1.0, "AUC": 0.2, "RMSE": 0.1, "TCGA_DESC": "LUAD", "PUTATIVE_TARGET": "X", "PATHWAY_NAME": "P"},
            {"COSMIC_ID": 2, "DRUG_NAME": "DrugA", "Z_SCORE": 1.0, "LN_IC50": 3.0, "AUC": 0.8, "RMSE": 0.2, "TCGA_DESC": "BRCA", "PUTATIVE_TARGET": "X", "PATHWAY_NAME": "P"},
            {"COSMIC_ID": 1, "DRUG_NAME": "DrugB", "Z_SCORE": float("nan"), "LN_IC50": 2.0, "AUC": 0.4, "RMSE": 0.3, "TCGA_DESC": "LUAD", "PUTATIVE_TARGET": "Y", "PATHWAY_NAME": "Q"},
        ]
    )


class DataServiceTests(unittest.TestCase):
    def setUp(self):
        self.service = DataService(make_expression_frame(), make_drug_frame())

    def test_gene_names_exclude_all_metadata_columns(self):
        self.assertEqual(self.service.gene_names, ["TP53", "EGFR"])

    def test_expression_records_include_cell_line_and_tcga(self):
        records = self.service.expression_records("tp53")
        self.assertEqual(records[0]["CELL_LINE"], "A")
        self.assertEqual(records[0]["TCGA_DESC"], "LUAD")
        self.assertEqual(records[0]["value"], 1.5)
        self.assertEqual(self.service.expression_records("histology"), [])

    def test_drug_response_deduplicates_ids_and_filters_drug(self):
        records = self.service.drug_response(["1", 1, 2], "DrugA")
        self.assertEqual([record["COSMIC_ID"] for record in records], [1, 2])
        self.assertTrue(all(record["Drug_Name"] == "DrugA" for record in records))

    def test_group_summary_uses_finite_values_and_reports_counts(self):
        records = self.service.group_summary([1], [2], "Z_SCORE")
        drug_a = next(record for record in records if record["drug_name"] == "DrugA")
        drug_b = next(record for record in records if record["drug_name"] == "DrugB")
        self.assertEqual(drug_a, {"drug_name": "DrugA", "high_mean": -1.0, "low_mean": 1.0, "high_n": 1, "low_n": 1})
        self.assertIsNone(drug_b["high_mean"])
        self.assertEqual(drug_b["high_n"], 0)
        self.assertFalse(any(math.isnan(value) for record in records for value in record.values() if isinstance(value, float)))

    def test_cell_line_mapping_does_not_mutate_expression_ids(self):
        original_dtype = self.service.expression_df["COSMIC_ID"].dtype
        self.assertEqual(self.service.cell_line_mapping(), {"1": "A", "2": "B"})
        self.assertEqual(self.service.expression_df["COSMIC_ID"].dtype, original_dtype)


if __name__ == "__main__":
    unittest.main()
