import sys
import numpy as np

try:
    import tabpfn
    import importlib.metadata
    ver = importlib.metadata.version("tabpfn")
    print(f"tabpfn version: {ver}")
    from tabpfn import TabPFNClassifier
    print("TabPFNClassifier imported successfully.")

    # Small test on synthetic 2-class dataset
    X_train = np.array([[1.0, 2.0], [2.0, 3.0], [5.0, 6.0], [6.0, 7.0]])
    y_train = np.array([0, 0, 1, 1])
    X_test = np.array([[1.5, 2.5], [5.5, 6.5]])

    clf = TabPFNClassifier(device="cpu", N_ensemble_configurations=2)
    clf.fit(X_train, y_train)
    probs = clf.predict_proba(X_test)
    print("Inference successful. Probs shape:", probs.shape)
    print("Sample probabilities:", probs.tolist())
except Exception as e:
    import traceback
    print(f"Error testing TabPFN: {e}", file=sys.stderr)
    traceback.print_exc()
    sys.exit(1)
