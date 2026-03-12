# DubbAI Gemini Integration Spec

Data: 2026-03-12
Status: Draft v1
Typ dokumentu: Integration Contract
Zależność nadrzędna: `2026-03-12-dubbai-target-prd.md`

## 1. Cel dokumentu

Ten dokument zamraża kontrakt integracyjny z modelami Gemini dla transkrypcji, tłumaczenia i dubbingu. Celem jest odtworzenie identycznego zachowania produktu niezależnie od stosu technologicznego.

Dokument odpowiada na pytania:

- które modele Gemini są używane,
- do jakich zadań są przypisane,
- jak mają być budowane prompty,
- jak ma wyglądać `Structured Output`,
- jak wygląda normalizacja danych do warstwy produktowej,
- kiedy wynik uznać za poprawny, a kiedy za błąd.

## 2. Zakres

Dokument obejmuje:

- transkrypcję per-word,
- tłumaczenie segmentów roboczych,
- generowanie dubbingu,
- fallback modeli,
- walidację i retry.

Dokument nie obejmuje:

- warstwy UI,
- przechowywania assetów,
- wewnętrznego transportu kolejki zadań.

## 3. Modele Gemini

### 3.1 Modele tekstowe

System musi wspierać dokładnie te modele:

- `gemini-2.5-flash-lite`
- `gemini-2.5-flash`

Zasady użycia:

- `gemini-2.5-flash-lite` jest wariantem domyślnym dla transkrypcji i tłumaczenia,
- `gemini-2.5-flash` jest wariantem jakościowym dla trudniejszych materiałów albo wyższego profilu jakości.

### 3.2 Model TTS

System musi wspierać model:

- `gemini-2.5-flash-preview-tts`

Ten model służy wyłącznie do generowania ścieżki dubbingowej.

## 4. Profile produktowe

Warstwa produktowa może używać nazw:

- `Fast`
- `Balanced`
- `High quality`

Mapowanie wewnętrzne:

- `Fast` -> `gemini-2.5-flash-lite`
- `Balanced` -> `gemini-2.5-flash-lite`
- `High quality` -> `gemini-2.5-flash`

Jeżeli aplikacja pozwala na ręczny wybór modelu, lista modeli musi być ograniczona do modeli z tego dokumentu.

## 5. Wspólne zasady wywołań tekstowych

Każde wywołanie tekstowe do Gemini musi być determinowane kontraktem JSON, nie odpowiedzią swobodną.

### 5.1 Wymagany generation config

Dla transkrypcji i tłumaczenia system musi ustawiać:

- `responseMimeType = "application/json"`
- `maxOutputTokens = 65536` jako domyślną wartość
- `responseJsonSchema` zgodny z typem zadania
- `Structured Output = true` jako ustawienie domyślne

### 5.2 Thinking mode

Dozwolone wartości:

- `off`
- `dynamic`
- `budget`

Mapowanie:

- `off` -> bez `thinkingConfig`
- `dynamic` -> `thinkingBudget = -1`
- `budget` -> jawny `thinkingBudget`

Domyślne budżety:

- `512` dla `gemini-2.5-flash-lite`
- `1024` dla `gemini-2.5-flash`

### 5.3 Timeouty

- transkrypcja audio: `600s`
- tłumaczenie: `120s`
- dubbing: implementacja może ustawić osobny timeout, ale nie krótszy niż `120s`

## 6. Kontrakt transkrypcji

## 6.1 Cel

Transkrypcja jest źródłem prawdy dla warstwy napisów. Źródłem prawdy nie jest segment, akapit ani zdanie, tylko słowo z timingiem.

## 6.2 Wymagania wejścia

Wejściem jest audio wyekstrahowane z materiału źródłowego.

Dodatkowe parametry:

- `target_language`
- `source_language` albo tryb autodetekcji
- `model_name`
- `thinking_mode`
- `thinking_budget`
- `max_output_tokens`
- `structured_output`

## 6.3 Wymagana intencja promptu

Prompt musi wymusić:

- JSON only,
- top-level `words`,
- format per-word,
- pola `start`, `end`, `text`, `keyword`,
- zachowanie interpunkcji,
- oznaczanie słów ważnych przez `keyword = true`,
- brak segmentów zdaniowych i brak komentarzy.

## 6.4 Wymagana treść promptu

```text
Return JSON only in a per-word subtitle format.
Build a top-level "words" array for subtitle rendering.
Each word item must contain "start", "end", "text", and "keyword".
Use timestamp strings like "0:00.681".
Preserve punctuation inside word text.
Mark important words or short key phrases with "keyword": true.
Do not return sentence-level segments or commentary.
Translation target is {target_language}, but this response must contain the original spoken words only.
If source language is unknown: detect the spoken source language automatically.
If source language is known: The spoken source language is {source_language}.
```

## 6.5 Structured Output schema

```json
{
  "type": "object",
  "properties": {
    "words": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "start": { "type": ["string", "number", "integer"] },
          "end": { "type": ["string", "number", "integer"] },
          "text": { "type": "string" },
          "keyword": { "type": "boolean" }
        },
        "required": ["start", "end", "text"]
      }
    }
  },
  "required": ["words"]
}
```

## 6.6 Dopuszczalny payload wyjściowy modelu

Normatywny format:

```json
{
  "words": [
    {
      "start": "0:00.681",
      "end": "0:01.321",
      "text": "custom",
      "keyword": true
    }
  ]
}
```

Parser kompatybilności może tymczasowo akceptować top-level array, ale nowa implementacja ma wymagać formatu obiektowego.

## 6.7 Normalizacja po stronie aplikacji

Każde słowo po normalizacji musi mieć:

```json
{
  "position": 1,
  "start_ms": 681,
  "end_ms": 1321,
  "original_text": "custom",
  "keyword": true
}
```

Zasady:

- `position` jest nadawane sekwencyjnie od `1`,
- `start` i `end` są konwertowane do milisekund,
- `text` mapuje się do `original_text`,
- brakujący `keyword` oznacza `false`.

## 6.8 Walidacja transkrypcji

Warunki poprawności:

- `words` istnieje i jest tablicą,
- tablica `words` nie jest pusta,
- każde słowo ma poprawne `start`, `end`, `text`,
- `text` jest niepustym stringiem,
- `end_ms >= start_ms`,
- wynik nie jest placeholderem ani artefaktem technicznym.

Warunki błędu:

- brak `words`,
- błędny format itemów,
- pusty transcript po retry,
- nieparsowalny JSON po retry.

## 6.9 Retry transkrypcji

System musi wykonać jedno automatyczne retry, jeżeli:

- odpowiedź nie jest poprawnym JSON-em,
- `words` jest puste.

Po drugim nieudanym podejściu etap musi przejść do `failed`.

## 7. Kontrakt tłumaczenia

## 7.1 Cel

Tłumaczenie ma zasilać:

- drugi track napisów,
- przyszły dubbing,
- eksporty napisów i burn-in.

Źródłem prawdy nadal pozostaje transcript per-word. Segmenty są wyłącznie warstwą roboczą.

## 7.2 Wejście

Wejściem jest tablica segmentów roboczych, zbudowana z transcriptu per-word.

Każdy segment wejściowy musi zawierać:

- `start_ms`
- `end_ms`
- `original_text`

## 7.3 Wymagana treść promptu

```text
Return JSON with a top-level "translations" array.
Preserve segment order exactly and return one translated string per input segment.
Translate to {target_language}.
```

Po promptcie musi zostać wysłany payload:

```json
{
  "segments": [
    {
      "start_ms": 0,
      "end_ms": 1000,
      "original_text": "Hello"
    }
  ]
}
```

## 7.4 Structured Output schema

```json
{
  "type": "object",
  "properties": {
    "translations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "translated_text": { "type": "string" }
        },
        "required": ["translated_text"]
      }
    }
  },
  "required": ["translations"]
}
```

## 7.5 Dopuszczalny payload wyjściowy modelu

Normatywny format:

```json
{
  "translations": [
    {
      "translated_text": "Czesc"
    }
  ]
}
```

Parser kompatybilności może akceptować również:

```json
{
  "translations": ["Czesc"]
}
```

## 7.6 Walidacja tłumaczenia

Warunki poprawności:

- `translations` istnieje i jest tablicą,
- liczba wpisów tłumaczenia równa się liczbie segmentów wejściowych,
- każdy wpis redukuje się do pojedynczego stringa tłumaczenia,
- tłumaczenie nie zawiera surowego JSON-a ani artefaktów technicznych.

Warunki błędu:

- błędny kontener,
- błędny item,
- niezgodna liczba elementów,
- brak możliwości zmapowania wyniku na transcript per-word.

## 7.7 Mapowanie tłumaczenia z powrotem na per-word

Po otrzymaniu tłumaczeń segmentowych system musi:

1. zachować transcript per-word jako źródło prawdy,
2. przypisać `translated_text` do słów należących do segmentu,
3. odbudować segmenty wyłącznie jako warstwę pochodną dla renderingu i eksportu.

Ta zasada jest obowiązkowa, ponieważ Theater ma renderować treść na podstawie danych per-word.

## 8. Kontrakt dubbingu

## 8.1 Wejście

Wejściem jest finalne tłumaczenie materiału po zakończonym etapie translation.

## 8.2 Model

- `gemini-2.5-flash-preview-tts`

## 8.3 Wymagania

- wejściem jest tekst docelowy,
- wywołanie zawiera konfigurację głosu,
- wynikiem jest binarny asset audio,
- wynik jest zapisywany jako osobna ścieżka dubbingowa projektu.

## 8.4 Warunki uruchomienia

- `translation_status = ready`

## 8.5 Warunki błędu

- brak gotowego tłumaczenia,
- błąd generacji audio,
- brak używalnego assetu wyjściowego.

Failure dubbingu nie może usuwać transcriptu ani tłumaczenia.

## 9. Fallback modeli

Fallback dotyczy wyłącznie niedostępności modelu, nie błędów logicznych payloadu.

Kolejność dla wywołań tekstowych:

1. skonfigurowany model,
2. opcjonalny wariant preview tej samej rodziny, jeśli istnieje,
3. `gemini-2.5-flash-lite`,
4. `gemini-2.5-flash`.

Jeżeli model zwraca `404`, system przechodzi do kolejnego kandydata.

## 10. Inwarianty produktowe

- transcript źródłowy jest per-word,
- keywordy są częścią kontraktu modelu,
- Structured Output jest domyślnie włączony,
- błędny wynik AI nie może przejść jako sukces,
- warstwa per-word jest źródłem prawdy dla Theater, dubbingu i eksportów.

## 11. Acceptance criteria

1. Transkrypcja zwraca top-level `words[]`.
2. Każdy element transkrypcji daje się znormalizować do `position`, `start_ms`, `end_ms`, `original_text`, `keyword`.
3. Tłumaczenie zwraca top-level `translations[]`.
4. Liczba tłumaczeń odpowiada liczbie segmentów wejściowych.
5. Structured Output używa jawnego `responseJsonSchema` dla obu zadań tekstowych.
6. Pusty lub błędny transcript powoduje jedno automatyczne retry.
7. Po nieudanym retry etap przechodzi do `failed`.
8. Dubbing używa gotowego tłumaczenia i zapisuje osobny asset audio.
