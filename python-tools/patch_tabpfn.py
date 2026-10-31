import pathlib

p = pathlib.Path(r"C:\Users\HP\AppData\Roaming\Python\Python313\site-packages\tabpfn\layer.py")
if p.exists():
    text = p.read_text(encoding="utf-8")
    old_target = "from torch.nn.modules.transformer import _get_activation_fn, Module, Tensor, Optional, MultiheadAttention, Linear, Dropout, LayerNorm"
    new_target = """from typing import Optional
from torch.nn import Module, MultiheadAttention, Linear, Dropout, LayerNorm
from torch import Tensor
try:
    from torch.nn.modules.transformer import _get_activation_fn
except ImportError:
    import torch.nn.functional as F
    def _get_activation_fn(activation):
        if activation == "relu": return F.relu
        elif activation == "gelu": return F.gelu
        raise RuntimeError(f"activation should be relu/gelu, not {activation}")"""
    if old_target in text:
        text = text.replace(old_target, new_target)
        p.write_text(text, encoding="utf-8")
        print("Patched tabpfn/layer.py for PyTorch 2.x compatibility.")
    else:
        print("tabpfn/layer.py already patched or target not found.")

p2 = pathlib.Path(r"C:\Users\HP\AppData\Roaming\Python\Python313\site-packages\tabpfn\scripts\transformer_prediction_interface.py")
if p2.exists():
    text2 = p2.read_text(encoding="utf-8")
    if "force_all_finite=False" in text2:
        text2 = text2.replace("force_all_finite=False", "ensure_all_finite=False")
        p2.write_text(text2, encoding="utf-8")
        print("Patched transformer_prediction_interface.py for scikit-learn 1.6+ compatibility.")
    elif "force_all_finite" in text2:
        text2 = text2.replace("force_all_finite", "ensure_all_finite")
        p2.write_text(text2, encoding="utf-8")
        print("Patched transformer_prediction_interface.py force_all_finite.")
    else:
        print("transformer_prediction_interface.py already patched.")

