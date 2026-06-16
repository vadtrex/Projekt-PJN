# Klasyfikator zwrotek polskiego rapu

Projekt fine-tuningu modeli **Qwen3.5-4B** i **Gemma4-E2B** (LoRA) do rozpoznawania wykonawcy po tekście zwrotki oraz interaktywnej aplikacji quizowej **Quiz Rapowy**.

## Wymagania

| Komponent | Wersja / uwagi |
|-----------|----------------|
| **Python** | 3.11+ (testowane na 3.13) |
| **Node.js** | 18+ (do aplikacji quizowej) |
| **RAM** | min. ~16 GB (klasyfikacja ładuje modele sekwencyjnie) |
| **GPU** | opcjonalne — CUDA (Windows/Linux) lub MPS (Apple Silicon); działa też na CPU (wolniej) |
| **Dysk** | ~20 GB wolnego miejsca (modele bazowe z Hugging Face przy pierwszym uruchomieniu) |

W repozytorium są już:
- wytrenowane adaptery: `qwen3-5-4b-polish-rap-classifier/`, `gemma4-e2b-polish-rap-classifier/`
- zbiór danych: `dataset/train.json`, `dataset/test.json`

## Szybki start — aplikacja quizowa

### 1. Środowisko Pythona (katalog główny projektu)

```powershell
cd Projekt-PJN
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**Windows (GPU NVIDIA)** — najpierw PyTorch z CUDA, potem reszta zależności:

```powershell
pip install torch==2.11.0+cu128 torchvision==0.26.0+cu128 torchaudio==2.11.0+cu128 --index-url https://download.pytorch.org/whl/cu128
pip install -r requirements.txt
```

**Linux (trening w chmurze)** — użyj `requirements-cloud.txt` zamiast `requirements.txt`.

**Tylko CPU** — zainstaluj standardowy PyTorch z [pytorch.org](https://pytorch.org), następnie pozostałe pakiety z `requirements.txt` (pominąc linie `torch*`, `triton-windows`, `xformers`, jeśli instalacja się wyłoży).

### 2. Frontend (katalog `quiz-app/`)

```powershell
cd quiz-app
npm install
npm run dev
```

### 3. Otwórz w przeglądarce

```
http://localhost:5173
```

Na ekranie startowym ustaw liczbę zwrotek (3–20) i seed, kliknij start. Aplikacja:
1. uruchomi `classify.py` w tle (przez endpoint `/api/classify`),
2. załaduje kolejno Qwen3.5 i Gemma4,
3. wygeneruje pytania quizowe i przejdzie do gry.

Serwer deweloperski Vite automatycznie szuka Pythona w `.venv` w katalogu głównym projektu. Jeśli używasz innej ścieżki, ustaw zmienną:

```powershell
$env:VITE_PYTHON = "C:\ścieżka\do\python.exe"
```

## Uruchomienie klasyfikacji z linii poleceń

Możesz też uruchomić skrypt bez frontendu (z katalogu `quiz-app/`):

```powershell
cd quiz-app
..\.venv\Scripts\python.exe classify.py --seed 42 --count 10
```

Opcjonalnie zapis do pliku:

```powershell
python classify.py --seed 42 --count 10 --output public\quiz_data.json
```

Przy pierwszym uruchomieniu pobierane są modele bazowe z Hugging Face:
- `unsloth/Qwen3.5-4B`
- `unsloth/gemma-4-E2B`

## Notebooki

| Plik | Opis |
|------|------|
| `dataset.ipynb` | Pobieranie tekstów z Genius API i budowa `dataset/train.json` |
| `Multinomial_Naive_Bayes.ipynb` | Baseline: TF-IDF + Multinomial Naive Bayes |
| `trening-qwen.ipynb`, `trening-gemma.ipynb` | Fine-tuning LoRA (wymaga GPU) |
| `inferencja-qwen.ipynb`, `inferencja-gemma.ipynb` | Testowanie wytrenowanych modeli |

Uruchom Jupyter z aktywowanym `.venv`:

```powershell
jupyter notebook
```

### Token Genius (tylko do `dataset.ipynb`)

Wygeneruj token na [genius.com/api-clients](https://genius.com/api-clients) i ustaw:

```powershell
$env:GENIUS_ACCESS_TOKEN = "twój_token"
```