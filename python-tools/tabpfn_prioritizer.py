"""
Keys of the Departed — TabPFN Machine Identity Prioritization Engine
===================================================================
Analyzes structured machine identity features and prioritizes investigation urgency.

Important:
- TabPFN prioritization indicates investigation triage urgency and ambiguity.
- It does NOT determine ownership, declare an identity malicious, or replace deterministic verification.

Model Specification:
- Implementation: TabPFN (Nature 2022 checkpoint: prior_diff_real_checkpoint_n_0_epoch_42.cpkt)
- Version: 0.1.11
- Execution: Isolated local CPU PyTorch inference
"""

import sys
import json
import argparse
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

# Feature Column Definitions
FEATURE_COLUMNS = [
    "days_since_last_active",     # float (imputed with 999.0 if missing/null)
    "owner_status_code",          # 0=no_evidence, 1=conflicting, 2=supported, 3=verified
    "permission_count",           # int >= 0
    "has_admin_perm",             # 1.0 or 0.0
    "repo_count",                 # int >= 0
    "recent_deploy_count",        # int >= 0
    "account_kind_code",          # 0=bot, 1=deploy_key, 2=service_account
    "evidence_record_count",      # int >= 0
    "has_conflicting_ownership",  # 1.0 or 0.0
]

# Canonical in-context reference set for TabPFN in-context learning
# Label 1 = Needs Urgent/Elevated Investigation Review
# Label 0 = Routine/Normal Operational Identity
REFERENCE_CONTEXT_X = np.array([
    # [days_active, owner_code, perm_count, admin, repo_cnt, dep_cnt, kind_code, rec_cnt, conf_owner]
    # Class 1: Urgent/Elevated Review Needed (stale, high perms, abandoned, conflicting owner, missing docs)
    [420.0, 0.0, 5.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0],  # Stale deploy key with admin perms & no owner
    [310.0, 1.0, 4.0, 0.0, 3.0, 1.0, 2.0, 4.0, 1.0],  # Service account with conflicting owners
    [540.0, 0.0, 8.0, 1.0, 5.0, 0.0, 2.0, 1.0, 0.0],  # Abandoned high-privilege service account
    [180.0, 0.0, 3.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0],  # Unowned key inactive 6 months
    [90.0,  1.0, 6.0, 1.0, 2.0, 2.0, 1.0, 3.0, 1.0],  # Conflicting ownership key with admin rights
    [600.0, 0.0, 2.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0],  # Stale bot with no known owner

    # Class 0: Routine/Normal Operational (actively maintained, verified owner, routine deploy key)
    [3.0,   3.0, 1.0, 0.0, 2.0, 12.0, 1.0, 15.0, 0.0], # Active verified deploy key
    [1.0,   3.0, 2.0, 0.0, 1.0, 25.0, 2.0, 30.0, 0.0], # Active service runner with verified owner
    [7.0,   2.0, 1.0, 0.0, 1.0, 5.0,  1.0, 6.0,  0.0], # Supported deploy key in active use
    [14.0,  3.0, 3.0, 0.0, 4.0, 8.0,  2.0, 10.0, 0.0], # Normal CI/CD pipeline service account
    [2.0,   3.0, 1.0, 0.0, 1.0, 18.0, 0.0, 22.0, 0.0], # Verified automated release bot
    [21.0,  2.0, 2.0, 0.0, 1.0, 4.0,  1.0, 5.0,  0.0], # Routine key used regularly
], dtype=np.float32)

REFERENCE_CONTEXT_Y = np.array([1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0], dtype=np.int64)


def extract_features_from_account(
    acc: Dict[str, Any],
    evidence_records: List[Dict[str, Any]],
    now_dt: Optional[datetime] = None
) -> Tuple[Dict[str, Any], List[float], List[str], List[str]]:
    """
    Extracts structured feature vector and human-readable factor explanations from an account.
    """
    if now_dt is None:
        now_dt = datetime.now(timezone.utc)

    missing_inputs: List[str] = []
    contributing_factors: List[str] = []

    # 1. Days since last active
    last_used_str = acc.get("last_used_at")
    days_since_last_active: Optional[float] = None
    if last_used_str:
        try:
            last_used_dt = datetime.fromisoformat(last_used_str.replace("Z", "+00:00"))
            days_since_last_active = max(0.0, (now_dt - last_used_dt).total_seconds() / 86400.0)
        except Exception:
            missing_inputs.append("last_used_at_invalid")
            days_since_last_active = None
    else:
        missing_inputs.append("last_used_at_unrecorded")
        days_since_last_active = None

    # 2. Owner status code
    owner_status = acc.get("owner_status", "no_evidence")
    owner_status_map = {"no_evidence": 0, "conflicting": 1, "supported": 2, "verified": 3}
    owner_status_code = owner_status_map.get(owner_status, 0)
    has_conflicting = (owner_status == "conflicting")

    # 3. Permissions
    permissions = acc.get("permissions", [])
    if not permissions:
        missing_inputs.append("permissions_empty")
    perm_count = len(permissions)
    has_admin = any("admin" in str(p).lower() for p in permissions)

    # 4. Account Kind
    kind = acc.get("kind", "deploy_key")
    kind_map = {"bot": 0, "deploy_key": 1, "service_account": 2}
    kind_code = kind_map.get(kind, 1)

    # 5. Evidence context matches
    acc_id = acc.get("account_id", "")
    matching_records = [
        r for r in evidence_records
        if acc_id in r.get("content", "") or r.get("actor_account_id") == acc_id
    ]
    evidence_record_count = len(matching_records)
    if evidence_record_count == 0:
        missing_inputs.append("evidence_records_unlinked")

    # Count distinct repositories and deployment logs in matching records
    repos = set()
    deploy_count = 0
    for r in matching_records:
        content = r.get("content", "")
        if "repo:" in content or "github.com/" in content:
            repos.add(content)
        if r.get("type") == "deploy_log" or "deploy" in content.lower():
            deploy_count += 1
    repo_count = max(1, len(repos)) if evidence_record_count > 0 else 0

    # 6. Contributing factor explanations
    if days_since_last_active is not None and days_since_last_active > 180:
        contributing_factors.append(f"Extended inactivity: ~{int(days_since_last_active)} days since last observed use")
    elif days_since_last_active is None:
        contributing_factors.append("No record of activity timestamp available")

    if has_conflicting:
        contributing_factors.append("Conflicting engineering ownership claims detected in commits")
    elif owner_status_code == 0:
        contributing_factors.append("Zero verified or supported owner references found in engineering records")

    if has_admin:
        contributing_factors.append("Broad administrative permissions assigned (repo:admin / full access)")

    if kind == "deploy_key" and repo_count > 2:
        contributing_factors.append(f"Single deploy key associated across multiple ({repo_count}) repositories")

    if not contributing_factors:
        contributing_factors.append("Routine operational parameters with verified evidence trail")

    feature_dict = {
        "days_since_last_active": days_since_last_active,
        "owner_status_code": owner_status_code,
        "permission_count": perm_count,
        "has_admin_perm": has_admin,
        "repo_count": repo_count,
        "recent_deploy_count": deploy_count,
        "account_kind_code": kind_code,
        "evidence_record_count": evidence_record_count,
        "has_conflicting_ownership": has_conflicting,
    }

    # Vector for TabPFN (handle None with explicit 999.0 imputation)
    vector = [
        999.0 if days_since_last_active is None else float(days_since_last_active),
        float(owner_status_code),
        float(perm_count),
        1.0 if has_admin else 0.0,
        float(repo_count),
        float(deploy_count),
        float(kind_code),
        float(evidence_record_count),
        1.0 if has_conflicting else 0.0,
    ]

    return feature_dict, vector, contributing_factors, missing_inputs


def prioritize_identities(
    accounts: List[Dict[str, Any]],
    evidence_records: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Runs TabPFN prioritization over extracted machine identity accounts.
    """
    start_time = time.perf_counter()
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    if not accounts:
        return {
            "status": "abstained",
            "model_name": "tabpfn",
            "model_version": "0.1.11",
            "executed_at": now_iso,
            "latency_ms": 0.0,
            "identities_ranked": 0,
            "rankings": [],
            "disclaimer": "Prioritization indicates evidence ambiguity and review urgency; it is not a security verdict or proof of maliciousness."
        }

    # Extract features for each account
    feature_dicts = []
    feature_vectors = []
    contributing_factors_list = []
    missing_inputs_list = []

    for acc in accounts:
        f_dict, f_vec, factors, miss = extract_features_from_account(acc, evidence_records)
        feature_dicts.append(f_dict)
        feature_vectors.append(f_vec)
        contributing_factors_list.append(factors)
        missing_inputs_list.append(miss)

    X_query = np.array(feature_vectors, dtype=np.float32)

    # Perform TabPFN inference
    try:
        from tabpfn import TabPFNClassifier
        clf = TabPFNClassifier(device="cpu", N_ensemble_configurations=2)
        clf.fit(REFERENCE_CONTEXT_X, REFERENCE_CONTEXT_Y)
        proba = clf.predict_proba(X_query)
        # Class 1 = Urgency probability
        urgency_scores = proba[:, 1].tolist()
        model_status = "completed"
    except Exception as e:
        sys.stderr.write(f"[TabPFN] Model inference error: {e}\n")
        # Deterministic heuristic fallback if TabPFN is unavailable
        urgency_scores = []
        for vec in feature_vectors:
            score = 0.1
            if vec[0] > 180: score += 0.35  # Stale
            if vec[1] == 0:  score += 0.30  # No owner
            if vec[1] == 1:  score += 0.40  # Conflicting owner
            if vec[3] == 1.0: score += 0.20 # Admin
            urgency_scores.append(min(0.99, score))
        model_status = "model_unavailable"

    # Build ranking objects
    rankings_raw = []
    for i, acc in enumerate(accounts):
        score = float(np.clip(urgency_scores[i], 0.01, 0.99))
        tier = "NORMAL"
        if score >= 0.75:
            tier = "URGENT"
        elif score >= 0.50:
            tier = "ELEVATED"
        elif score >= 0.25:
            tier = "ROUTINE"

        rankings_raw.append({
            "account_id": acc.get("account_id", f"acc_{i}"),
            "priority_score": round(score, 4),
            "priority_rank": 0,  # Assigned after sorting
            "triage_tier": tier,
            "features": feature_dicts[i],
            "contributing_factors": contributing_factors_list[i],
            "missing_inputs": missing_inputs_list[i],
        })

    # Sort descending by priority_score
    rankings_raw.sort(key=lambda r: r["priority_score"], reverse=True)
    for rank_idx, item in enumerate(rankings_raw, start=1):
        item["priority_rank"] = rank_idx

    latency_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

    return {
        "status": model_status,
        "model_name": "tabpfn",
        "model_version": "0.1.11",
        "executed_at": now_iso,
        "latency_ms": latency_ms,
        "identities_ranked": len(rankings_raw),
        "rankings": rankings_raw,
        "disclaimer": "Prioritization indicates evidence ambiguity and review urgency; it is not a security verdict or proof of maliciousness."
    }


def main():
    parser = argparse.ArgumentParser(description="TabPFN Prioritization CLI")
    parser.add_argument("--json-input", type=str, help="Path to input JSON file or direct JSON string")
    parser.add_argument("--stdin", action="store_true", help="Read input JSON from stdin")
    args = parser.parse_args()

    input_data = None
    if args.stdin:
        input_data = json.loads(sys.stdin.read())
    elif args.json_input:
        if args.json_input.startswith("{") or args.json_input.startswith("["):
            input_data = json.loads(args.json_input)
        else:
            with open(args.json_input, "r", encoding="utf-8") as f:
                input_data = json.load(f)
    else:
        # Default self-test payload
        input_data = {
            "accounts": [
                {
                    "account_id": "acc_deploy_key_881",
                    "kind": "deploy_key",
                    "last_used_at": "2024-01-10T00:00:00Z",
                    "permissions": ["repo:admin", "repo:write"],
                    "owner_status": "no_evidence"
                },
                {
                    "account_id": "acc_service_runner_404",
                    "kind": "service_account",
                    "last_used_at": "2026-10-25T00:00:00Z",
                    "permissions": ["repo:write"],
                    "owner_status": "verified"
                }
            ],
            "records": []
        }

    accounts = input_data.get("accounts", [])
    records = input_data.get("records", [])

    results = prioritize_identities(accounts, records)
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
