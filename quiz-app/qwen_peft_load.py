"""Load Qwen3.5 PEFT adapters saved with Unsloth's legacy parameter names."""

from __future__ import annotations

import os

from peft import PeftModel
from safetensors import safe_open


def remap_qwen_adapter_key(key: str) -> str:
    """Remap checkpoint keys from Unsloth training format to PeftModel inference format."""
    if "language_model" not in key and ".model.model.layers." in key:
        key = key.replace(
            "base_model.model.model.layers.",
            "base_model.model.model.language_model.layers.",
        )
    if key.endswith(".lora_A.weight"):
        key = key[: -len(".weight")] + ".default.weight"
    elif key.endswith(".lora_B.weight"):
        key = key[: -len(".weight")] + ".default.weight"
    return key


def load_qwen_peft_model(model, adapter_dir: str) -> PeftModel:
    """
    Attach a Qwen PEFT adapter and load LoRA weights whose keys were saved
    under Unsloth's flattened ``model.layers`` path during training.

    The classification head is loaded by ``PeftModel.from_pretrained``; this
    function additionally restores MLP LoRA weights (attention LoRA was not
    written to the checkpoint).
    """
    adapter_path = os.path.join(adapter_dir, "adapter_model.safetensors")
    model = PeftModel.from_pretrained(model, adapter_dir)

    remapped: dict[str, object] = {}
    with safe_open(adapter_path, framework="pt") as f:
        for key in f.keys():
            if "lora" not in key:
                continue
            remapped[remap_qwen_adapter_key(key)] = f.get_tensor(key)

    params = dict(model.named_parameters())
    loaded = 0
    for key, tensor in remapped.items():
        param = params.get(key)
        if param is None:
            continue
        param.data.copy_(tensor.to(device=param.device, dtype=param.dtype))
        loaded += 1

    print(
        f"Załadowano {loaded}/{len(remapped)} wag LoRA MLP "
        f"(attention LoRA nie było w checkpointcie treningowym)"
    )
    return model
