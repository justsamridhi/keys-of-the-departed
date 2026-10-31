"""
Keys of the Departed — Machine Identity Prioritization 3-Way Benchmark
========================================================================
Compares:
1. Simple Inactivity Baseline
2. Isolation Forest Baseline (scikit-learn)
3. TabPFN (Nature 2022 checkpoint)

Dataset Protocol:
- N = 40 frozen synthetic machine identity profiles
- 50/50 stratified Train/Test split (20 train, 20 test) to strictly prevent data leakage
- Ground Truth: Triage Urgency Label (1 = Urgent investigation required, 0 = Routine/Normal)

Metrics:
- AUROC
- Precision@5
- Recall
- False Positive Rate (FPR)
- Ranking Stability (Spearman rank correlation across repeated seeded runs)
- Inference Latency (ms)
"""

import sys
import json
import time
import numpy as np
from sklearn.metrics import roc_auc_score
from sklearn.ensemble import IsolationForest
from scipy.stats import spearmanr

# --------------------------------------------------------------------------
# Frozen Synthetic Dataset (40 Machine Identities: 20 Urgent, 20 Routine)
# Features: [days_active, owner_code, perms, admin, repos, deploys, kind, records, conf_owner]
# --------------------------------------------------------------------------
DATASET_X = np.array([
    # --- Class 1: Urgent / Elevated Triage (20 instances) ---
    [420.0, 0.0, 5.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0],
    [310.0, 1.0, 4.0, 0.0, 3.0, 1.0, 2.0, 4.0, 1.0],
    [540.0, 0.0, 8.0, 1.0, 5.0, 0.0, 2.0, 1.0, 0.0],
    [180.0, 0.0, 3.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0],
    [90.0,  1.0, 6.0, 1.0, 2.0, 2.0, 1.0, 3.0, 1.0],
    [600.0, 0.0, 2.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0],
    [240.0, 0.0, 4.0, 1.0, 2.0, 0.0, 1.0, 2.0, 0.0],
    [195.0, 1.0, 3.0, 0.0, 4.0, 1.0, 2.0, 3.0, 1.0],
    [365.0, 0.0, 6.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0],
    [150.0, 0.0, 5.0, 1.0, 2.0, 0.0, 2.0, 2.0, 0.0],
    [280.0, 1.0, 3.0, 0.0, 3.0, 1.0, 1.0, 2.0, 1.0],
    [400.0, 0.0, 7.0, 1.0, 4.0, 0.0, 2.0, 1.0, 0.0],
    [210.0, 0.0, 4.0, 0.0, 1.0, 0.0, 1.0, 2.0, 0.0],
    [130.0, 1.0, 5.0, 1.0, 2.0, 1.0, 1.0, 3.0, 1.0],
    [500.0, 0.0, 3.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0],
    [220.0, 0.0, 6.0, 1.0, 3.0, 0.0, 2.0, 2.0, 0.0],
    [175.0, 1.0, 4.0, 0.0, 2.0, 1.0, 2.0, 3.0, 1.0],
    [330.0, 0.0, 5.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0],
    [160.0, 0.0, 4.0, 1.0, 2.0, 0.0, 2.0, 1.0, 0.0],
    [270.0, 1.0, 5.0, 0.0, 3.0, 2.0, 1.0, 4.0, 1.0],

    # --- Class 0: Routine / Normal (20 instances) ---
    [3.0,   3.0, 1.0, 0.0, 2.0, 12.0, 1.0, 15.0, 0.0],
    [1.0,   3.0, 2.0, 0.0, 1.0, 25.0, 2.0, 30.0, 0.0],
    [7.0,   2.0, 1.0, 0.0, 1.0, 5.0,  1.0, 6.0,  0.0],
    [14.0,  3.0, 3.0, 0.0, 4.0, 8.0,  2.0, 10.0, 0.0],
    [2.0,   3.0, 1.0, 0.0, 1.0, 18.0, 0.0, 22.0, 0.0],
    [21.0,  2.0, 2.0, 0.0, 1.0, 4.0,  1.0, 5.0,  0.0],
    [4.0,   3.0, 1.0, 0.0, 2.0, 15.0, 1.0, 18.0, 0.0],
    [2.0,   3.0, 2.0, 0.0, 1.0, 20.0, 2.0, 25.0, 0.0],
    [9.0,   2.0, 1.0, 0.0, 1.0, 6.0,  1.0, 8.0,  0.0],
    [16.0,  3.0, 3.0, 0.0, 3.0, 10.0, 2.0, 12.0, 0.0],
    [1.0,   3.0, 1.0, 0.0, 1.0, 22.0, 0.0, 28.0, 0.0],
    [25.0,  2.0, 2.0, 0.0, 1.0, 3.0,  1.0, 4.0,  0.0],
    [5.0,   3.0, 1.0, 0.0, 2.0, 14.0, 1.0, 16.0, 0.0],
    [3.0,   3.0, 2.0, 0.0, 1.0, 21.0, 2.0, 26.0, 0.0],
    [8.0,   2.0, 1.0, 0.0, 1.0, 7.0,  1.0, 9.0,  0.0],
    [12.0,  3.0, 3.0, 0.0, 4.0, 9.0,  2.0, 11.0, 0.0],
    [2.0,   3.0, 1.0, 0.0, 1.0, 19.0, 0.0, 24.0, 0.0],
    [20.0,  2.0, 2.0, 0.0, 1.0, 4.0,  1.0, 5.0,  0.0],
    [6.0,   3.0, 1.0, 0.0, 2.0, 13.0, 1.0, 15.0, 0.0],
    [10.0,  2.0, 2.0, 0.0, 1.0, 5.0,  1.0, 7.0,  0.0],
], dtype=np.float32)

DATASET_Y = np.array([1]*20 + [0]*20, dtype=np.int64)


def run_prioritization_benchmark():
    # 50/50 Stratified Train/Test split: First 10 of each class for train, second 10 for test
    train_indices = list(range(0, 10)) + list(range(20, 30))
    test_indices = list(range(10, 20)) + list(range(30, 40))

    X_train, y_train = DATASET_X[train_indices], DATASET_Y[train_indices]
    X_test, y_test = DATASET_X[test_indices], DATASET_Y[test_indices]

    results = {}

    # ----------------------------------------------------
    # Method 1: Inactivity Baseline (Days Inactive Rank)
    # ----------------------------------------------------
    t0 = time.perf_counter()
    inactivity_scores = X_test[:, 0] / np.max(X_test[:, 0])
    inactivity_latency = round((time.perf_counter() - t0) * 1000.0, 2)

    auc_m1 = roc_auc_score(y_test, inactivity_scores)
    top5_idx_m1 = np.argsort(inactivity_scores)[-5:]
    p5_m1 = np.mean(y_test[top5_idx_m1])
    preds_m1 = (inactivity_scores >= 0.5).astype(int)
    recall_m1 = np.sum((preds_m1 == 1) & (y_test == 1)) / np.sum(y_test == 1)
    fpr_m1 = np.sum((preds_m1 == 1) & (y_test == 0)) / np.sum(y_test == 0)

    # Stability across perturbations
    corrs_m1 = []
    for seed in [1, 2, 3]:
        np.random.seed(seed)
        noise = np.random.normal(0, 0.01, size=inactivity_scores.shape)
        r, _ = spearmanr(inactivity_scores, inactivity_scores + noise)
        corrs_m1.append(r)
    stability_m1 = round(float(np.mean(corrs_m1)), 4)

    results["inactivity_baseline"] = {
        "auroc": round(float(auc_m1), 4),
        "precision_at_5": round(float(p5_m1), 4),
        "recall": round(float(recall_m1), 4),
        "false_positive_rate": round(float(fpr_m1), 4),
        "ranking_stability": stability_m1,
        "inference_latency_ms": max(0.1, inactivity_latency),
    }

    # ----------------------------------------------------
    # Method 2: Isolation Forest Baseline (scikit-learn)
    # ----------------------------------------------------
    t0 = time.perf_counter()
    iso_forest = IsolationForest(n_estimators=50, random_state=42)
    iso_forest.fit(X_train)
    # Anomaly score: lower is more anomalous -> invert so higher = more urgent
    iso_scores = -iso_forest.score_samples(X_test)
    iso_latency = round((time.perf_counter() - t0) * 1000.0, 2)

    auc_m2 = roc_auc_score(y_test, iso_scores)
    top5_idx_m2 = np.argsort(iso_scores)[-5:]
    p5_m2 = np.mean(y_test[top5_idx_m2])
    iso_norm = (iso_scores - np.min(iso_scores)) / (np.max(iso_scores) - np.min(iso_scores) + 1e-8)
    preds_m2 = (iso_norm >= 0.5).astype(int)
    recall_m2 = np.sum((preds_m2 == 1) & (y_test == 1)) / np.sum(y_test == 1)
    fpr_m2 = np.sum((preds_m2 == 1) & (y_test == 0)) / np.sum(y_test == 0)

    corrs_m2 = []
    for seed in [1, 2, 3]:
        iso_alt = IsolationForest(n_estimators=50, random_state=seed)
        iso_alt.fit(X_train)
        alt_scores = -iso_alt.score_samples(X_test)
        r, _ = spearmanr(iso_scores, alt_scores)
        corrs_m2.append(r)
    stability_m2 = round(float(np.mean(corrs_m2)), 4)

    results["isolation_forest"] = {
        "auroc": round(float(auc_m2), 4),
        "precision_at_5": round(float(p5_m2), 4),
        "recall": round(float(recall_m2), 4),
        "false_positive_rate": round(float(fpr_m2), 4),
        "ranking_stability": stability_m2,
        "inference_latency_ms": iso_latency,
    }

    # ----------------------------------------------------
    # Method 3: TabPFN (Nature 2022 Foundation Model)
    # ----------------------------------------------------
    t0 = time.perf_counter()
    from tabpfn import TabPFNClassifier
    clf = TabPFNClassifier(device="cpu", N_ensemble_configurations=2)
    clf.fit(X_train, y_train)
    probs = clf.predict_proba(X_test)[:, 1]
    tabpfn_latency = round((time.perf_counter() - t0) * 1000.0, 2)

    auc_m3 = roc_auc_score(y_test, probs)
    top5_idx_m3 = np.argsort(probs)[-5:]
    p5_m3 = np.mean(y_test[top5_idx_m3])
    preds_m3 = (probs >= 0.5).astype(int)
    recall_m3 = np.sum((preds_m3 == 1) & (y_test == 1)) / np.sum(y_test == 1)
    fpr_m3 = np.sum((preds_m3 == 1) & (y_test == 0)) / np.sum(y_test == 0)

    # Ranking stability across ensemble configurations
    corrs_m3 = []
    for n_ens in [2, 4]:
        clf_alt = TabPFNClassifier(device="cpu", N_ensemble_configurations=n_ens)
        clf_alt.fit(X_train, y_train)
        alt_probs = clf_alt.predict_proba(X_test)[:, 1]
        r, _ = spearmanr(probs, alt_probs)
        corrs_m3.append(r)
    stability_m3 = round(float(np.mean(corrs_m3)), 4)

    results["tabpfn"] = {
        "auroc": round(float(auc_m3), 4),
        "precision_at_5": round(float(p5_m3), 4),
        "recall": round(float(recall_m3), 4),
        "false_positive_rate": round(float(fpr_m3), 4),
        "ranking_stability": stability_m3,
        "inference_latency_ms": tabpfn_latency,
    }

    return results


if __name__ == "__main__":
    benchmark = run_prioritization_benchmark()
    print(json.dumps(benchmark, indent=2))
