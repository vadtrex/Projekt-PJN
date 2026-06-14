#!/usr/bin/env python3
"""
Skrypt klasyfikacji zwrotek rapowych przez modele Qwen3.5 i Gemma4.
Modele ładowane SEKWENCYJNIE (MPS → CPU fallback), RAM zwalniany między modelami.

Użycie:
    python classify.py --seed 42 --count 10
    python classify.py --seed 42 --count 5 --output quiz_data.json
"""

import argparse
import gc
import json
import os
import random
import sys

import numpy as np
import torch

# --------------------------------------------------------------------------- #
#  Ścieżki                                                                    #
# --------------------------------------------------------------------------- #
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)  # Projekt-PJN
DATASET_DIR = os.path.join(PROJECT_DIR, "dataset")

from qwen_peft_load import load_qwen_peft_model

QWEN_ADAPTER_DIR = os.path.join(PROJECT_DIR, "qwen3-5-4b-polish-rap-classifier")
GEMMA_ADAPTER_DIR = os.path.join(PROJECT_DIR, "gemma4-e2b-polish-rap-classifier")

QWEN_BASE_MODEL = "unsloth/Qwen3.5-4B"
GEMMA_BASE_MODEL = "unsloth/gemma-4-E2B"

CLASSIFICATION_PROMPT = """Przeczytaj poniższą zwrotkę polskiego utworu rapowego i określ, kto jest wykonawcą.

Tekst zwrotki:
{verse}"""


# --------------------------------------------------------------------------- #
#  Helpers                                                                     #
# --------------------------------------------------------------------------- #
def progress(msg: str) -> None:
    """Wypisz postęp na stderr (odczytywany przez Vite plugin)."""
    print(f"PROGRESS:{msg}", file=sys.stderr, flush=True)


def get_device() -> str:
    """MPS (Apple Silicon) → CUDA → CPU."""
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def free_memory() -> None:
    """Zwolnij pamięć po modelu."""
    gc.collect()
    if torch.backends.mps.is_available():
        torch.mps.empty_cache()
    elif torch.cuda.is_available():
        torch.cuda.empty_cache()


# --------------------------------------------------------------------------- #
#  Dane                                                                        #
# --------------------------------------------------------------------------- #
def load_data(seed: int, count: int):
    """Wczytaj dane, wylosuj zwrotki."""
    train_df_raw = json.load(open(os.path.join(DATASET_DIR, "train.json"), encoding="utf-8"))
    test_df_raw = json.load(open(os.path.join(DATASET_DIR, "test.json"), encoding="utf-8"))

    all_labels = sorted(set(r["label"] for r in train_df_raw))
    label2id = {label: i for i, label in enumerate(all_labels)}
    id2label = {i: label for label, i in label2id.items()}

    # Filtruj test do znanych etykiet
    test_data = [r for r in test_df_raw if r["label"] in label2id]

    rng = random.Random(seed)
    sampled = rng.sample(test_data, min(count, len(test_data)))

    return sampled, all_labels, label2id, id2label


# --------------------------------------------------------------------------- #
#  Inferencja Qwen3.5                                                          #
# --------------------------------------------------------------------------- #
def run_qwen_inference(verses: list[dict], label2id, id2label) -> list[dict]:
    """Załaduj Qwen3.5, klasyfikuj wszystkie zwrotki, zwolnij pamięć."""
    progress("qwen:loading")

    os.environ["UNSLOTH_DISABLE_FAST_GENERATION"] = "1"
    from unsloth import FastModel
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    DEVICE = get_device()
    MAX_LENGTH = 650  # jak w trening-qwen.ipynb
    NUM_LABELS = len(label2id)
    use_16bit = DEVICE != "cpu"

    model, tokenizer = FastModel.from_pretrained(
        model_name=QWEN_BASE_MODEL,
        max_seq_length=MAX_LENGTH,
        load_in_4bit=False,
        load_in_16bit=use_16bit,
        dtype=None if use_16bit else "float32",
        auto_model=AutoModelForSequenceClassification,
        num_labels=NUM_LABELS,
        id2label=id2label,
        label2id=label2id,
        trust_remote_code=False,
        ignore_mismatched_sizes=True,
        use_exact_model_name=True,
        device_map="auto",
    )

    model = load_qwen_peft_model(model, QWEN_ADAPTER_DIR)
    model.eval()

    tokenizer = AutoTokenizer.from_pretrained(QWEN_ADAPTER_DIR)
    if not tokenizer.chat_template:
        tokenizer.chat_template = AutoTokenizer.from_pretrained(QWEN_BASE_MODEL).chat_template
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    text_config = model.config.get_text_config()
    text_config.pad_token_id = tokenizer.pad_token_id
    model.config.pad_token_id = tokenizer.pad_token_id

    progress("qwen:ready")

    results = []
    for i, verse_data in enumerate(verses):
        verse = verse_data["text"]
        messages = [{"role": "user", "content": CLASSIFICATION_PROMPT.format(verse=verse)}]
        formatted = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=False,
            chat_template_kwargs={"enable_thinking": False},
        )
        inputs = tokenizer(
            formatted, truncation=True, max_length=MAX_LENGTH, return_tensors="pt"
        ).to(DEVICE)

        with torch.no_grad():
            probs = model(**inputs).logits.softmax(-1)[0]

        top = probs.topk(1)
        pred_label = id2label[top.indices[0].item()]
        confidence = top.values[0].item()

        results.append({"prediction": pred_label, "confidence": round(confidence, 4)})
        progress(f"qwen:{i + 1}/{len(verses)}")

    # Zwolnij pamięć
    del model, tokenizer
    free_memory()
    progress("qwen:done")

    return results


# --------------------------------------------------------------------------- #
#  Inferencja Gemma4                                                           #
# --------------------------------------------------------------------------- #
def run_gemma_inference(verses: list[dict], label2id, id2label) -> list[dict]:
    """Załaduj Gemma4, klasyfikuj wszystkie zwrotki, zwolnij pamięć."""
    progress("gemma:loading")

    os.environ["UNSLOTH_DISABLE_FAST_GENERATION"] = "1"
    from unsloth import FastModel
    from unsloth.chat_templates import get_chat_template
    from peft import PeftModel
    from transformers import (
        AutoModel,
        AutoModelForSequenceClassification,
        AutoTokenizer,
    )
    from transformers.configuration_utils import PretrainedConfig
    from transformers.modeling_layers import GenericForSequenceClassification
    from transformers.models.auto.modeling_auto import (
        MODEL_FOR_SEQUENCE_CLASSIFICATION_MAPPING,
    )
    from transformers.models.gemma4.configuration_gemma4 import Gemma4Config
    from transformers.models.gemma4.modeling_gemma4 import Gemma4PreTrainedModel

    # Patch Gemma4
    _orig_to_diff_dict = PretrainedConfig.to_diff_dict

    def _safe_to_diff_dict(self):
        if "Gemma4" in self.__class__.__name__:
            return self.to_dict()
        return _orig_to_diff_dict(self)

    PretrainedConfig.to_diff_dict = _safe_to_diff_dict

    class Gemma4ForSequenceClassification(
        GenericForSequenceClassification, Gemma4PreTrainedModel
    ):
        def __init__(self, config):
            Gemma4PreTrainedModel.__init__(self, config)
            self.num_labels = config.num_labels
            setattr(self, self.base_model_prefix, AutoModel.from_config(config))
            self.score = torch.nn.Linear(
                config.get_text_config().hidden_size, self.num_labels, bias=False
            )
            self.post_init()

    MODEL_FOR_SEQUENCE_CLASSIFICATION_MAPPING.register(
        Gemma4Config, Gemma4ForSequenceClassification, exist_ok=True
    )

    DEVICE = get_device()
    MAX_LENGTH = 650
    NUM_LABELS = len(label2id)
    use_16bit = DEVICE != "cpu"

    model, tokenizer = FastModel.from_pretrained(
        model_name=GEMMA_BASE_MODEL,
        max_seq_length=MAX_LENGTH,
        load_in_4bit=False,
        load_in_16bit=use_16bit,
        dtype=None if use_16bit else "float32",
        auto_model=AutoModelForSequenceClassification,
        num_labels=NUM_LABELS,
        id2label=id2label,
        label2id=label2id,
        trust_remote_code=False,
        ignore_mismatched_sizes=True,
        use_exact_model_name=True,
        device_map="auto",
    )

    model = PeftModel.from_pretrained(model, GEMMA_ADAPTER_DIR)
    model.eval()

    tokenizer = AutoTokenizer.from_pretrained(GEMMA_ADAPTER_DIR)
    if not tokenizer.chat_template:
        tokenizer = get_chat_template(tokenizer, chat_template="gemma-4")
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    progress("gemma:ready")

    results = []
    for i, verse_data in enumerate(verses):
        verse = verse_data["text"]
        messages = [{"role": "user", "content": CLASSIFICATION_PROMPT.format(verse=verse)}]
        formatted = tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=False
        )
        # Gemma4: usunięcie <bos>
        if formatted.startswith("<bos>"):
            formatted = formatted[len("<bos>"):]

        inputs = tokenizer(
            formatted, truncation=True, max_length=MAX_LENGTH, return_tensors="pt"
        ).to(DEVICE)

        with torch.no_grad():
            probs = model(**inputs).logits.softmax(-1)[0]

        top = probs.topk(1)
        pred_label = id2label[top.indices[0].item()]
        confidence = top.values[0].item()

        results.append({"prediction": pred_label, "confidence": round(confidence, 4)})
        progress(f"gemma:{i + 1}/{len(verses)}")

    # Zwolnij pamięć
    del model, tokenizer
    free_memory()
    progress("gemma:done")

    return results


# --------------------------------------------------------------------------- #
#  Budowanie opcji odpowiedzi                                                  #
# --------------------------------------------------------------------------- #
def build_options(
    correct: str,
    qwen_pred: str,
    gemma_pred: str,
    all_artists: list[str],
    rng: random.Random,
) -> list[str]:
    """Zbuduj 4 unikalne opcje odpowiedzi."""
    options = {correct}

    if qwen_pred != correct:
        options.add(qwen_pred)
    if gemma_pred != correct:
        options.add(gemma_pred)

    # Uzupełnij losowymi artystami do 4
    remaining = [a for a in all_artists if a not in options]
    while len(options) < 4 and remaining:
        pick = rng.choice(remaining)
        remaining.remove(pick)
        options.add(pick)

    options_list = list(options)
    rng.shuffle(options_list)
    return options_list


# --------------------------------------------------------------------------- #
#  Main                                                                        #
# --------------------------------------------------------------------------- #
def main():
    parser = argparse.ArgumentParser(description="Klasyfikacja zwrotek rapowych")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--count", type=int, default=10, help="Liczba zwrotek")
    parser.add_argument("--output", type=str, default=None, help="Ścieżka wyjściowa JSON")
    args = parser.parse_args()

    progress("start")

    # 1. Dane
    sampled, all_artists, label2id, id2label = load_data(args.seed, args.count)
    progress(f"data:{len(sampled)}")

    # 2. Qwen
    qwen_results = run_qwen_inference(sampled, label2id, id2label)

    # 3. Gemma
    gemma_results = run_gemma_inference(sampled, label2id, id2label)

    # 4. Buduj pytania
    rng = random.Random(args.seed + 1000)  # Osobny seed na opcje
    questions = []
    for i, verse_data in enumerate(sampled):
        options = build_options(
            correct=verse_data["label"],
            qwen_pred=qwen_results[i]["prediction"],
            gemma_pred=gemma_results[i]["prediction"],
            all_artists=all_artists,
            rng=rng,
        )
        questions.append(
            {
                "id": i,
                "verse": verse_data["text"],
                "song": verse_data.get("song", "—"),
                "section": verse_data.get("section", "—"),
                "correct_artist": verse_data["label"],
                "qwen_prediction": qwen_results[i]["prediction"],
                "qwen_confidence": qwen_results[i]["confidence"],
                "gemma_prediction": gemma_results[i]["prediction"],
                "gemma_confidence": gemma_results[i]["confidence"],
                "options": options,
            }
        )

    output = {
        "seed": args.seed,
        "count": len(questions),
        "questions": questions,
        "all_artists": all_artists,
    }

    # Zapisz do pliku
    output_path = args.output or os.path.join(SCRIPT_DIR, "public", "quiz_data.json")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # Wypisz na stdout
    print(json.dumps(output, ensure_ascii=False))

    progress("finished")


if __name__ == "__main__":
    main()
