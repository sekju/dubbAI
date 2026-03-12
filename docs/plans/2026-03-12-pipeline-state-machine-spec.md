# DubbAI Pipeline State Machine Spec

Data: 2026-03-12
Status: Draft v1
Typ dokumentu: Execution Spec
Zależność nadrzędna: `2026-03-12-dubbai-target-prd.md`

## 1. Cel dokumentu

Ten dokument definiuje stanową logikę projektu i etapów pipeline. Ma jednoznacznie określić:

- jakie etapy istnieją,
- jakie statusy są dozwolone,
- kiedy można uruchomić kolejny etap,
- jakie dane są czyszczone przy retry,
- kiedy UI pokazuje akcję, blokadę albo gotowość.

## 2. Encje stanu

## 2.1 Status projektu

Projekt posiada status ogólny używany do wysokopoziomowej komunikacji produktu.

Dozwolone wartości operacyjne:

- `queued`
- `uploaded`
- `transcription_queued`
- `transcribing`
- `transcribed`
- `translation_queued`
- `translated`
- `transcription_failed`
- `translation_failed`
- `dubbing_failed`

Status ogólny jest warstwą kompatybilności i skrótem komunikacyjnym. Źródłem prawdy dla gatingu produktu są statusy etapowe.

## 2.2 Statusy etapowe

Każdy etap ma własny status z tego zbioru:

- `not_started`
- `queued`
- `in_progress`
- `ready`
- `failed`

Dotyczy to etapów:

- `transcript`
- `translation`
- `dubbing`
- `export`

## 2.3 Job runtime state

Aktywne zadanie tła posiada osobny status wykonania:

- `queued`
- `started`
- `retry`
- `success`
- `failure`

Job zawiera:

- `job_id`
- `project_id`
- `state`
- `progress`
- `queue`

## 3. Etapy pipeline

## 3.1 Source ready

Warunek wejścia:

- projekt został utworzony,
- materiał źródłowy jest znany lub został poprawnie zapisany.

Rezultat:

- projekt jest widoczny w bibliotece,
- można rozpocząć transkrypcję.

## 3.2 Transcription

Warunek wejścia:

- źródło jest gotowe,
- `transcript_status = not_started` albo `failed`,
- `translation_status = not_started`.

Rezultat `ready`:

- istnieje transcript per-word,
- można uruchomić translation.

## 3.3 Translation

Warunek wejścia:

- `transcript_status = ready`,
- `translation_status = not_started` albo `failed`,
- transkrypcja nie jest aktywnie wykonywana.

Rezultat `ready`:

- słowa mają uzupełnione `translated_text`,
- Theater może pokazać oba tracki,
- można uruchomić dubbing.

## 3.4 Dubbing

Warunek wejścia:

- `translation_status = ready`,
- `dubbing_status = not_started` albo `failed`.

Rezultat `ready`:

- projekt ma gotowy asset audio dubbingowego.

## 3.5 Export

Warunek wejścia:

- transcript jest gotowy dla eksportu napisów,
- translation jest gotowe dla eksportów dwujęzycznych lub docelowych,
- subtitle styling jest zapisany,
- jeśli eksport wymaga dubbingu, `dubbing_status = ready`.

Rezultat `ready`:

- istnieje gotowy plik eksportowy do pobrania.

## 4. Dozwolone przejścia

## 4.1 Transcription

Dozwolone:

- `not_started -> queued`
- `queued -> in_progress`
- `in_progress -> ready`
- `in_progress -> failed`
- `failed -> queued`

Niedozwolone:

- start transkrypcji po rozpoczętym tłumaczeniu,
- start transkrypcji, gdy etap już jest `queued` lub `in_progress`.

## 4.2 Translation

Dozwolone:

- `not_started -> queued`
- `queued -> in_progress`
- `in_progress -> ready`
- `in_progress -> failed`
- `failed -> queued`

Niedozwolone:

- start tłumaczenia przed gotową transkrypcją,
- start tłumaczenia, gdy transkrypcja jest `queued` lub `in_progress`,
- ponowny start tłumaczenia, gdy etap ma już `ready` i użytkownik nie wykonał świadomego resetu.

## 4.3 Dubbing

Dozwolone:

- `not_started -> queued`
- `queued -> in_progress`
- `in_progress -> ready`
- `in_progress -> failed`
- `failed -> queued`

Niedozwolone:

- start dubbingu przed gotowym tłumaczeniem.

## 4.4 Export

Dozwolone:

- `not_started -> queued`
- `queued -> in_progress`
- `in_progress -> ready`
- `in_progress -> failed`
- `failed -> queued`

## 5. Zasady retry i czyszczenia danych

## 5.1 Retry transcription

Retry transcription musi:

- usunąć transcript per-word,
- usunąć segmenty pochodne transcriptu,
- usunąć tłumaczenia zależne od starego transcriptu,
- wyczyścić dane zależne dalszych etapów, jeśli istnieją,
- zachować projekt, źródło i organizację biblioteki.

Po retry:

- `transcript_status = queued`
- `translation_status = not_started`
- `dubbing_status = not_started`

## 5.2 Retry translation

Retry translation musi:

- usunąć `translated_text` na poziomie słów,
- usunąć pochodne segmenty tłumaczenia,
- unieważnić dubbing zależny od starego tłumaczenia,
- zachować transcript źródłowy.

Po retry:

- `translation_status = queued`
- `dubbing_status = not_started`

## 5.3 Retry dubbing

Retry dubbing musi:

- usunąć jedynie assety dubbingowe,
- zachować transcript i tłumaczenie.

Po retry:

- `dubbing_status = queued`

## 5.4 Retry export

Retry export musi:

- usunąć tylko nieaktualne assety eksportowe dla danego wariantu,
- zachować wszystkie dane źródłowe projektu.

## 6. Reguły aktywnego joba

Projekt może mieć zero lub jeden aktywny job per etap.

UI powinno traktować job jako aktywny, jeśli:

- kolejka odpowiada etapowi projektu,
- `state` należy do `queued`, `started`, `retry`.

UI powinno traktować job jako zakończony, jeśli:

- `state = success`
- `state = failure`

## 7. Reguły widoczności w UI

## 7.1 Library next action

System musi wyliczać sugerowaną akcję projektu:

- jeśli dowolny etap ma `failed` -> `retry`
- jeśli `transcript_status = not_started` -> `transcribe`
- jeśli `transcript_status` jest aktywny -> `open_theater`
- jeśli `translation_status = not_started` -> `translate`
- w pozostałych przypadkach -> `open_theater`

## 7.2 Theater gate

Theater może wejść w jeden z dwóch trybów:

- `playback unlocked`
- `pipeline gate`

Warunki `playback unlocked`:

- źródło multimedialne istnieje,
- `transcript_status = ready`,
- `translation_status = ready`,
- transcript per-word nie jest pusty,
- przynajmniej jedna warstwa tłumaczenia jest renderowalna.

W przeciwnym razie Theater pokazuje gate z:

- stanem etapu,
- opisem blokady,
- aktywnym jobem, jeśli istnieje,
- akcją `start` albo `retry`, jeśli jest dozwolona.

## 8. Reguły samonaprawy stanu

System może wykonywać lekkie `state healing`, ale tylko w granicach spójności biznesowej.

Przykłady:

- jeśli etap jest aktywny, ale nie ma aktywnego joba, a dane są gotowe, można przejść do `ready`,
- jeśli transcript oznaczony jako `ready` zawiera placeholdery lub brak danych per-word, etap powinien przejść do `failed`,
- jeśli tłumaczenie zawiera artefakty techniczne zamiast normalnego tekstu, etap powinien przejść do `failed`.

System nie może jednak ukrywać błędów przez sztuczne oznaczanie etapu jako `ready` bez poprawnych danych.

## 9. Kontrakt progresu

Każdy job musi udostępniać:

- `progress` w skali `0-100`,
- `queue`,
- `state`.

Widok UI ma pokazywać:

- etykietę etapu,
- procent,
- elapsed time,
- opis operacyjny typu `Processing now`.

## 10. Scenariusze referencyjne

## 10.1 Happy path

1. Utworzenie projektu.
2. `transcript: not_started -> queued -> in_progress -> ready`
3. `translation: not_started -> queued -> in_progress -> ready`
4. `dubbing: not_started -> queued -> in_progress -> ready`
5. `export: not_started -> queued -> in_progress -> ready`

## 10.2 Transcript failure

1. Transkrypcja przechodzi do `in_progress`.
2. Wynik Gemini jest pusty lub błędny.
3. System wykonuje retry wewnętrzny.
4. Jeśli dalej brak poprawnego transcriptu:
5. `transcript_status = failed`
6. UI pokazuje `Retry transcription`.

## 10.3 Translation failure

1. Translation przechodzi do `in_progress`.
2. Wynik ma złą strukturę lub złą liczbę segmentów.
3. `translation_status = failed`
4. UI pokazuje `Retry translation`.

## 11. Acceptance criteria

1. Żaden etap zależny nie startuje przed spełnieniem warunków wejścia.
2. Retry transcription czyści transcript i artefakty zależne, ale nie usuwa projektu.
3. Retry translation czyści tylko dane tłumaczeniowe i zależne od nich artefakty.
4. Retry dubbingu nie usuwa transcriptu ani tłumaczenia.
5. Library zawsze potrafi wyliczyć `next action`.
6. Theater odróżnia stan blokady pipeline od gotowego playbacku.
7. Błędne dane AI kończą etap jako `failed`, a nie `ready`.
