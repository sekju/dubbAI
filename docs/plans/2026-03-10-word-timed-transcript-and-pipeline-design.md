# Word-Timed Transcript And Pipeline UX Design

**Date:** 2026-03-10

**Summary:** Przebudowa pipeline transkrypcji, tłumaczenia i renderu napisów tak, aby źródłem prawdy był transcript `per-word` z timestampami i flagą `keyword`, a `Theater` przestał wyglądać jak martwy ekran podczas długich etapów przetwarzania.

## Problem

Aktualny model transcriptu i pipeline ma trzy fundamentalne wady:

- backend dopuszcza placeholdery i fałszywy sukces zamiast prawdziwego wyniku AI,
- player opiera się na segmentach tekstowych, więc nie potrafi poprawnie renderować `sentence`, podświetlać słów ani wyróżniać keywordów,
- UX pipeline pokazuje tylko statusy etapów, ale nie daje użytkownikowi czytelnego sygnału, że coś realnie trwa.

To nie jest problem jednego komponentu. Źródło prawdy dla napisów, kontrakt API i render playera są obecnie zbyt ubogie dla produktu, który ma obsługiwać podświetlanie i późniejszy dubbing.

## Założenia

- transcript źródłowy ma być zapisywany `per-word`,
- każde słowo ma mieć `start`, `end`, `text`, `keyword`,
- interpunkcja ma być zachowana w tekście,
- `sentence` i inne tryby napisów są widokami pochodnymi, a nie źródłem prawdy,
- `Primary track` i `Secondary track` zachowują się niezależnie,
- `Tiktok mode` ma być przełączalny osobno dla każdej aktywnej ścieżki napisów,
- backend nie może oznaczać etapu jako `ready`, jeśli model nie zwrócił poprawnej struktury danych,
- pipeline musi być żywy: spinner, elapsed time, progress, retry.

## Wybrany kierunek

### 1. Transcript `per-word` jako źródło prawdy

Model bazowy transcriptu ma odpowiadać strukturze podobnej do:

```json
[
  {
    "start": "0:00.681",
    "end": "0:01.321",
    "text": "Let's",
    "keyword": false
  }
]
```

Na poziomie backendu wartości czasu będą normalizowane do `start_ms` i `end_ms`, ale semantyka pozostaje `per-word`.

### 2. Segmenty jako widok pochodny

UI nadal może używać fraz i sentence grouping, ale te grupy będą budowane z listy słów. Oznacza to:

- `compact` może pokazywać krótkie okna słów,
- `balanced` może budować krótkie frazy,
- `sentence` ma grupować pełne zdania lub logiczne frazy z transcriptu,
- żaden z trybów nie może już polegać na pojedynczym `original_text` zapisanym jako blok.

### 3. Tiktok mode jako warstwa renderu

`Tiktok mode` nie zmienia danych transcriptu. Zmienia tylko sposób prezentacji:

- aktywne słowo lub aktywna fraza są podświetlane dynamicznie,
- słowa z `keyword=true` mają własny styl wyróżnienia,
- `Primary` i `Secondary` mają osobne przełączniki `Tiktok on/off`.

To pozwala mieć klasyczne napisy i tiktokowy render bez duplikowania danych.

## Backend

### Transcript data model

Obecny model `TranscriptSegment` jest za słaby, bo przechowuje tylko tekst segmentu i pustą listę `words` w schema. Potrzebny jest trwały model słów.

Rekomendowany kierunek:

- dodać tabelę `transcript_words`,
- powiązać ją z projektem i opcjonalnie z wyliczonym segmentem renderowym,
- przechowywać:
  - `id`
  - `project_id`
  - `position`
  - `speaker`
  - `start_ms`
  - `end_ms`
  - `original_text`
  - `translated_text`
  - `keyword`

`translated_text` na poziomie słowa lub tokenu pozwala później budować ścieżkę translated bez utraty synchronizacji.

### Contract for Gemini

Transkrypcja ma używać promptu wymuszającego strukturę gotową do renderu:

- timestamp `per-word`,
- interpunkcja,
- `keyword`,
- poprawny JSON.

Backend ma walidować wynik. Jeśli odpowiedź nie spełnia kontraktu:

- etap kończy się `failed`,
- nie zapisujemy placeholderów,
- UI pokazuje retry.

### Translation

Tłumaczenie nie może już zwracać luźnych stringów bez struktury. Powinno mapować się na istniejące słowa lub tokeny i zwracać dane dające się przypiąć do transcriptu.

Pierwszy pragmatyczny wariant:

- tłumaczenie nadal może operować segmentami wejściowymi zbudowanymi z transcript words,
- ale wynik musi być rozbijany z powrotem na renderable token/phrase units,
- backend ma odrzucać odpowiedzi niezgodne ze strukturą.

## Frontend

### Player data model

Player nie powinien przyjmować tylko `TranscriptCue[]` z blokami tekstu. Potrzebuje dwóch warstw:

- `TranscriptWord[]` jako źródło czasu i podświetleń,
- `RenderedCue[]` jako wynik grupowania dla bieżącego trybu.

### Rendering modes

- `compact`: małe grupy kilku słów,
- `balanced`: krótkie frazy,
- `sentence`: pełna logiczna sentencja zbudowana z words, a nie jeden surowy blok.

### Tiktok mode

Każdy subtitle slot dostaje:

- `tiktokEnabled: boolean`

Zachowanie:

- aktywne słowo rośnie i/lub zmienia kolor,
- keywordy mają osobny styl bazowy,
- przy wyłączonym tiktok mode działa zwykły render.

### Pipeline feedback

`Theater` musi pokazywać nie tylko status etapu, ale też trwającą aktywność:

- spinner wheel,
- elapsed timer od startu joba,
- label typu `Transcribing audio`, `Building translated track`,
- progress bar,
- komunikat, że aplikacja żyje i sama odświeży player,
- retry na `failed`.

To ma być widoczne zarówno w gate panelu, jak i w stage cards.

## Retry behavior

Retry nie może wymagać usuwania projektu.

Potrzebne są:

- `Retry transcription`
- `Retry translation`

Retry czyści tylko dane zależne od danego etapu:

- retry transcription czyści transcript words, segmenty i translation output,
- retry translation czyści tylko translated output.

## API

Payload projektu powinien zwracać:

- pipeline stages,
- active job,
- transcript words,
- render-ready grouped cues, jeśli backend udostępnia derived view,
- ustawienia lub capability flags potrzebne do playera.

Pragmatycznie można to zrobić etapami:

- najpierw zwracać `transcript_words`,
- grupowanie robić w frontendzie,
- później ewentualnie przenieść część derived views do backendu.

## Error handling

- brak poprawnej odpowiedzi AI = `failed`, nie placeholder,
- response shape mismatch = `failed`,
- timeout = `failed` z retry,
- UI ma pokazywać czytelny stan i kolejną akcję.

## Testing

### Backend

- walidacja odpowiedzi Gemini dla transcriptu `per-word`,
- brak placeholder success,
- retry czyszczący właściwe dane,
- serializacja transcript words,
- translation parser dla structured items.

### Frontend

- sentence mode grupuje words poprawnie,
- active word highlighting działa po czasie,
- keyword style działa,
- tiktok mode można włączyć i wyłączyć niezależnie per track,
- live pipeline feedback pokazuje spinner i timer,
- retry actions są dostępne po `failed`.

## Routing and migration

Docelowe entrypointy pozostają te same:

- `/library`
- `/theater/[playlistId]/[projectId]`

Zmienia się kontrakt danych i render playera. Istniejące projekty z placeholderami lub starym transcriptem trzeba traktować jako legacy data:

- można dodać migrację naprawczą,
- albo oznaczać takie projekty do retry.

Rekomendowany kierunek: wykrywać legacy transcript i wymuszać retry, zamiast próbować zgadywać poprawne word timing z błędnych danych.
