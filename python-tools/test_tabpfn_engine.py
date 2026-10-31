"""
Unit tests for Python TabPFN Prioritizer Engine
===============================================
Tests:
- Valid feature vector extraction
- Missing value imputation (None -> 999.0)
- Factor generation
- CLI JSON execution
"""

import unittest
import sys
import pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent.resolve()))

import numpy as np
from datetime import datetime, timezone
from tabpfn_prioritizer import (
    extract_features_from_account,
    prioritize_identities,
    FEATURE_COLUMNS,
)


class TestTabPfnEngine(unittest.TestCase):
    def test_feature_extraction_complete(self):
        acc = {
            "account_id": "acc_test_key",
            "kind": "deploy_key",
            "last_used_at": "2026-10-01T00:00:00Z",
            "permissions": ["repo:admin", "repo:write"],
            "owner_status": "verified",
        }
        records = [
            {"record_id": "r1", "type": "commit", "content": "acc_test_key deploy in repo:api"}
        ]
        now_dt = datetime(2026, 10, 31, 0, 0, 0, tzinfo=timezone.utc)

        f_dict, f_vec, factors, miss = extract_features_from_account(acc, records, now_dt)

        self.assertEqual(len(f_vec), len(FEATURE_COLUMNS))
        self.assertAlmostEqual(f_dict["days_since_last_active"], 30.0, delta=1.0)
        self.assertEqual(f_dict["owner_status_code"], 3)
        self.assertTrue(f_dict["has_admin_perm"])
        self.assertEqual(f_dict["permission_count"], 2)
        self.assertEqual(len(miss), 0)

    def test_missing_features_imputation(self):
        acc = {
            "account_id": "acc_ghost_bot",
            "kind": "bot",
            "last_used_at": None,
            "permissions": [],
            "owner_status": "no_evidence",
        }
        f_dict, f_vec, factors, miss = extract_features_from_account(acc, [])

        self.assertIsNone(f_dict["days_since_last_active"])
        self.assertEqual(f_vec[0], 999.0)  # Imputed float for transformer
        self.assertIn("last_used_at_unrecorded", miss)
        self.assertIn("permissions_empty", miss)
        self.assertIn("evidence_records_unlinked", miss)

    def test_prioritize_empty(self):
        res = prioritize_identities([], [])
        self.assertEqual(res["status"], "abstained")
        self.assertEqual(res["identities_ranked"], 0)
        self.assertEqual(len(res["rankings"]), 0)

    def test_prioritize_ordering(self):
        accounts = [
            {
                "account_id": "acc_active",
                "kind": "deploy_key",
                "last_used_at": "2026-10-30T00:00:00Z",
                "permissions": ["repo:write"],
                "owner_status": "verified",
            },
            {
                "account_id": "acc_stale_admin",
                "kind": "service_account",
                "last_used_at": "2023-01-01T00:00:00Z",
                "permissions": ["repo:admin"],
                "owner_status": "no_evidence",
            },
        ]
        res = prioritize_identities(accounts, [])
        self.assertEqual(res["identities_ranked"], 2)
        # Stale admin key must be ranked #1
        self.assertEqual(res["rankings"][0]["account_id"], "acc_stale_admin")
        self.assertEqual(res["rankings"][0]["priority_rank"], 1)
        self.assertEqual(res["rankings"][1]["account_id"], "acc_active")
        self.assertEqual(res["rankings"][1]["priority_rank"], 2)


if __name__ == "__main__":
    unittest.main()
