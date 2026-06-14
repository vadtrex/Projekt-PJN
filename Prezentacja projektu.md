---
marp: true
theme: gaia
class: invert
headingDivider: 2
paginate: true
size: 16:9
style: |
  :root {
    --color-background: #1c1c1c;
    --color-foreground: #d4d4d4;
    --color-highlight: #f5f5f5;
    --color-dimmed: #888;
    --color-background-code: #2a2a2a;
    --color-background-paginate: rgba(255, 255, 255, 0.08);
  }
  section {
    font-size: 24px;
    line-height: 1.3;
    font-family: 'Segoe UI', sans-serif;
    justify-content: flex-start;
    padding: 48px 56px 40px;
    background: #1c1c1c;
    color: #d4d4d4;
  }
  h2 {
    font-size: 1.35em;
    margin: 0 0 0.35em 0;
    color: #f5f5f5 !important;
    font-weight: 600;
  }
  p, ul, ol {
    margin: 0.2em 0;
  }
  li {
    margin: 0.1em 0;
    font-size: 0.9em;
    line-height: 1.28;
    color: #d4d4d4;
  }
  li::marker {
    color: #888;
  }
  strong {
    color: #f5f5f5 !important;
    font-weight: 600;
  }
  em {
    color: #b0b0b0 !important;
  }
  code {
    background: #2a2a2a !important;
    color: #e0e0e0 !important;
  }
  table {
    font-size: 0.72em;
    width: 100%;
    margin-top: 0.25em;
    border-collapse: collapse;
  }
  th, td {
    color: #d4d4d4 !important;
    background: #242424 !important;
    border: 1px solid #555 !important;
    padding: 0.2em 0.45em;
  }
  th {
    background: #333 !important;
    color: #f5f5f5 !important;
    font-weight: 600;
  }
  section.lead {
    justify-content: center;
    text-align: center;
  }
  section.lead h2 {
    font-size: 1.6em;
  }
  section.lead p {
    font-size: 1.05em;
    color: #b0b0b0 !important;
  }
---

<!-- _class: lead -->

## Prezentacja projektu

**Model LLM do klasyfikacji zwrotek polskiego rapu**

## Zakres projektu

- **Cel:** dostrojenie **Qwen3.5-4B** i **Gemma-4-E2B** metodą **LoRA** do klasyfikacji zwrotek polskiego rapu (**20** klas - artystów).
- **Dane:** samodzielne przygotowanie datasetu przez pobranie tekstów z Genius, parsowanie na zwrotki i czyszczenie.

## Proces

- **Etap 1 — przygotowanie danych (`dataset.ipynb`):** pobieranie tekstów z Genius, parsowanie utworów na zwrotki, czyszczenie, podział train/test.
- **Etap 2 — trening modeli (`trening-qwen.ipynb`, `trening-gemma.ipynb`):** dostrajanie modeli w Jupyterze z biblioteką **Unsloth** i **Transformers**.
- **Etap 3 — inferencja (`inferencja-qwen.ipynb`, `inferencja-gemma.ipynb`, `classify.py`):** klasyfikacja zwrotek z adapterów LoRA i zapis wyników.
- **Etap 4 — frontend (`quiz-app/`):** aplikacja **React + Vite** z endpointem uruchamiającym skrypt Pythona w tle.

## Pobieranie danych z Genius API

Teksty utworów pobierane automatycznie z platformy **Genius** poprzez bibliotekę **lyricsgenius**.

- **Lista artystów:** 18 polskich raperów/hip-hopowców - m.in. Pezet, Mata, Quebonafide, Sobel, Kabe, Żabson, Sentino, Diho, Young Igi, Young Leosia, Guzior, Avi, OG Olgierd, Bedoes 2115, Malik Montana, White 2115, Oki, Zeamsone.
- **Parametry pobierania:** do **250** najpopularniejszych utworów na artystę, **3** wątki pobierania utworów.
- **Cache:** surowe odpowiedzi API zapisywane w `dataset/lyrics/` (jeden plik JSON na artystę) - ponowne uruchomienie nie wymaga ponownego pobierania.
- **Obsługa błędów:** retry przy HTTP 429 (60 s) i błędach sieciowych (30 s), odrzucanie remiksów, wersji live i demo.

## Przetwarzanie tekstów na zwrotki

Surowe teksty utworów dzielone na pojedyncze sekcje z przypisanym wykonawcą.

- **Wykrywanie zwrotek:** regex `[Zwrotka 1: Mata]`, `[Refren]`, `[Bridge]` itd.
- **Parsowanie wykonawców:** obsługa separatorów `&`, `,`, `+`, `/`, `i`, `oraz`, `x`, `feat.`, `ft.` - np. "Mata & Quebonafide" - "Mata", "Quebonafide".
- **Czyszczenie:** usuwanie śmieci z Genius, odrzucanie sekcji krótszych niż **10 słów**.
- **Normalizacja etykiet:** aliasy (`Bedoes 2115` → `Bedoes`, `Avi (POL)` → `Avi`), sortowanie i deduplikacja współautorów.

## Przygotowanie zbioru treningowego i testowego

Każdy rekord zawiera pola: `song`, `section`, `text`, `label`.

- **Przed filtrowaniem:** **9793** zwrotek, **8018** po czyszczeniu (min. **30** zwrotek na etykietę, usunięcie rzadkich gościnnych wersów).
- **Klasy:** **20** unikalnych etykiet (artystów) - m.in. Pezet (~547), Bedoes (~532), Żabson (~466), Sobel (~444), Mata (~426).
- **Podział główny:** **6815** zwrotek treningowych + **1203** testowych (`train_test_split`, **stratyfikacja** 85% / 15%, `random_state=42`).
- **Podział walidacyjny:** z train wydzielono **6133** na trening + **682** na walidację pod early stopping i wybór najlepszego checkpointu.
- **Pliki:** `dataset/train.json`, `dataset/test.json` - gotowe do wczytania w notebookach treningowych.

## Zadanie klasyfikacji

Modele LLM dostrajane do **klasyfikacji sekwencji**, nie do generowania tekstu.

- **Wejście:** tekst zwrotki opakowany w prompt instrukcyjny: _"Przeczytaj poniższą zwrotkę polskiego utworu rapowego i określ, kto jest wykonawcą."_
- **Format:** chat template modelu (role `user`) → tokenizacja → forward pass → softmax na logitach głowicy klasyfikacyjnej.
- **Wyjście:** predykcja z jedną z **20** etykiet (artystów) + prawdopodobieństwo dla każdej klasy.
- **Metryki ewaluacji:** **accuracy** (dokładność), **macro-F1** (uśredniony F1 Score liczony po klasach), **top-3 accuracy** (dokładność w top 3 predykcjach).

## Trening modeli — konfiguracja

Oba modele trenowane metodą **LoRA** (Parameter-Efficient Fine-Tuning) - trenowane są adaptery, nie cały model.

- **Modele bazowe:** `Qwen3.5-4B` oraz `Gemma-4-E2B`.
- **LoRA:** `r=32`, `lora_alpha=64`, `lora_dropout=0.0`; trenowana głowica klasyfikacyjna (`modules_to_save=["score"]`).
- **Hiperparametry:** batch 32 (train) / 64 (eval), LR LoRA **2e-4**, LR głowicy **1e-3**, label smoothing **0.1**.
- **Trening:** Qwen — **9** epok, Gemma — zastopowane po **9. epoce**, early stopping wg **eval_f1_macro**, max długość sekwencji **650** tokenów (~99. percentyl).

## Przebieg treningu — Qwen3.5-4B

Walidacyjny **macro-F1** rośnie szybko i stabilizuje się ok. epoki 8 (najlepszy checkpoint).

| Epoka | Train loss | Val loss   | Val macro-F1 |
| ----- | ---------- | ---------- | ------------ |
| 1     | 3,3971     | 3,2223     | 0,0238       |
| 2     | 2,8476     | 2,6708     | 0,3312       |
| 3     | 1,8396     | 2,2976     | 0,4712       |
| 4     | 1,2791     | 2,1723     | 0,5784       |
| 5     | 1,1242     | 2,0636     | 0,5703       |
| 6     | 1,0740     | 2,0379     | 0,5897       |
| 7     | 1,0614     | 2,0789     | 0,6043       |
| **8** | **1,0736** | **2,0813** | **0,6316**   |
| 9     | 1,0596     | 2,1043     | 0,6215       |

## Przebieg treningu — Gemma4-E2B

Early stopping zatrzymał trening po **9. epoce**; najlepszy checkpoint to **epoka 7**.

| Epoka | Train loss | Val loss   | Val macro-F1 |
| ----- | ---------- | ---------- | ------------ |
| 1     | 3,4699     | 3,3164     | 0,0163       |
| 2     | 2,9889     | 2,8195     | 0,2597       |
| 3     | 2,1955     | 2,5778     | 0,4017       |
| 4     | 1,5814     | 2,5131     | 0,5019       |
| 5     | 1,2714     | 2,6305     | 0,5308       |
| 6     | 1,2483     | 2,0518     | 0,5850       |
| **7** | **1,1413** | **2,0329** | **0,5928**   |
| 8     | 1,1818     | 2,2719     | 0,5803       |
| 9     | 1,1329     | 2,0406     | 0,5828       |

## Trening modeli — wyniki

Porównanie na zbiorze testowym (**1203** zwrotek, niewidziane podczas treningu):

| Model          | Accuracy   | Macro-F1   | Top-3 accuracy |
| -------------- | ---------- | ---------- | -------------- |
| **Qwen3.5-4B** | **64,42%** | **0,6311** | **73,15%**     |
| **Gemma4-E2B** | **57,19%** | **0,5968** | **72,57%**     |

- **Qwen** osiąga wyższą dokładność top-1 — lepsze rozróżnianie artystów przy pierwszej predykcji.
- **Top-3** obu modeli jest zbliżone (~73%) — model często ma poprawnego artystę w gronie trzech najbardziej prawdopodobnych.

## Inferencja

Notebooki inferencyjne (`inferencja-qwen.ipynb`, `inferencja-gemma.ipynb`) pokazują, jak wytrenowany model klasyfikuje nowe zwrotki — krok po kroku.

- **Co można tam zobaczyć:** wczytanie modelu, predykcję pojedynczej zwrotki i ranking artystów z poziomem pewności (np. "Sobel 78%, Mata 11%…”).
- **Ładowanie:** `FastModel.from_pretrained` (model bazowy) + `PeftModel.from_pretrained` (adaptery LoRA i głowica `score`).
- **Urządzenia:** automatyczny wybór **CUDA** / **MPS** (Apple Silicon) / **CPU**.
- **Wyjście:** nazwa artysty + prawdopodobieństwo (softmax po logitach głowicy klasyfikacyjnej).

## Aplikacja quizowa

Nie byliśmy pewni jak interpretować metryki uzyskane w notebookach... A może by się tak po prostu zmierzyć z modelami?
Powstała aplikacja quizowa "Quiz Rapowy", która zamiast metryk oferuje pojedynek - **Człowiek vs AI**.
