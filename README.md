# Projekt-PJN

Klasyfikacja autora zwrotek polskich utworów rapowych — fine-tuning **Gemma 4 E2B** (QLoRA + głowa klasyfikacyjna) z **Unsloth**.

## Wymagania

- **Python** 3.10–3.13
- **Git** + **Git LFS**
- **GPU NVIDIA** z obsługą CUDA (trening / inferencja lokalnie)
- **Windows** — plik `requirements.txt` (PyTorch `cu128`, `triton-windows`)
- **Linux / Chmura** — plik `requirements-cloud.txt` (osobna instalacja PyTorch)

## Klonowanie repozytorium (Git LFS)

Wagi LoRA (`adapter_model.safetensors`, ~193 MB) są w **Git LFS**. Bez LFS pobierzesz tylko małe wskaźniki zamiast modelu.

### Pierwszy raz na komputerze

```powershell
git lfs install
```

### Klonowanie

```powershell
git clone https://github.com/vadtrex/Projekt-PJN.git
cd Projekt-PJN
```

Przy `git clone` pliki LFS pobierają się automatycznie (jeśli LFS jest zainstalowany).

### Pull (repo już sklonowane)

```powershell
git pull
git lfs pull
```

### Weryfikacja

```powershell
git lfs ls-files
```

Powinny być m.in.:

- `gemma4-e2b-polish-rap-classifier/adapter_model.safetensors`
- `gemma4-e2b-polish-rap-classifier/tokenizer.json`

Jeśli plik z adapterem ma ~130 bajtów, uruchom `git lfs pull`.

---

## Środowisko wirtualne (Windows)

### 1. Utworzenie i aktywacja venv

```powershell
cd Projekt-PJN
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

### 2. Instalacja zależności

`requirements.txt` zawiera PyTorch z indeksu CUDA (`+cu128`). Użyj dodatkowego indexu PyTorch:

```powershell
pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cu128
```

Jeśli instalacja PyTorch się wyłoży, zainstaluj go najpierw osobno:

```powershell
pip install torch==2.11.0+cu128 torchvision==0.26.0+cu128 torchaudio==2.11.0+cu128 --index-url https://download.pytorch.org/whl/cu128
pip install -r requirements.txt
```

---

## Linux / Chmura

Nie używaj `requirements.txt` - zawiera pakiety tylko pod Windows.

```bash
pip install --upgrade pip
pip install torch==2.11.0 torchvision==0.26.0 torchaudio==2.11.0 --index-url https://download.pytorch.org/whl/cu130
pip install -r requirements-cloud.txt
```

---
