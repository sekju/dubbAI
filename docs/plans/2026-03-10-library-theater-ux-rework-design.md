# Library + Theater UX Rework Design

**Date:** 2026-03-10

**Summary:** Rewizja modelu `Library + Theater` tak, aby aplikacja prowadziła użytkownika przez czytelny flow `source -> transcript -> translation -> dubbing`, zamiast eksponować organizację folderów i playlist jako główny sposób obsługi produktu.

## Problem

Obecny interfejs ma trzy główne problemy:

- `Library` jest zorganizowane wokół paneli i kolekcji, a nie wokół zadań użytkownika.
- `Theater` nie pokazuje jasno, jak przejść od surowego materiału do transkrypcji i tłumaczenia.
- Player i napisy mają model techniczny, ale nie mają czytelnego modelu produktu: brak prawdziwego fullscreen, brak sterowania językami i brak spójnego pojęcia głównej oraz dodatkowej ścieżki tekstowej.

Naprawa nie może polegać na łataniu obecnego układu. Potrzebna jest spójna korekta architektury UX oraz modelu danych.

## Założenia

- `Library` ma być ekranem zadaniowym, a nie ekranem menedżera kolekcji.
- `Theater` ma być ekranem pipeline i odtwarzania.
- Foldery i playlisty zostają, ale są funkcją pomocniczą.
- Transkrypcja i tłumaczenie mają być osobnymi etapami produktu.
- Dubbing nie jest implementowany w tej iteracji, ale całość ma być projektowana tak, żeby jego dodanie nie wymagało kolejnego przewracania modeli.
- Styling napisów ma wynikać z roli ścieżki (`primary` / `secondary`), a nie z tego, czy dany tekst jest oryginałem czy tłumaczeniem.

## Wybrany kierunek

### 1. Task-first Library + Stage-driven Theater

- `Library` zaczyna się od intake nowego projektu.
- Lista projektów pokazuje stan pipeline i następny krok.
- `Theater` pokazuje etapy `Source -> Transcript -> Translation -> Dubbing`.
- Playlisty i foldery nie blokują podstawowego flow.

To jest wybrany wariant.

### 2. Wizard po dodaniu projektu

- upload lub URL prowadziłyby do osobnego flow konfiguracji.
- dobre dla pojedynczego projektu, słabe dla pracy na wielu materiałach.

Nie wybieramy tego wariantu.

### 3. Naprawa obecnego układu minimalnymi zmianami

- najmniej pracy, ale utrzymuje nietrafioną architekturę interfejsu.

Ten wariant jest odrzucony.

## Library

### Główny układ

`Library` ma mieć dwa poziomy odpowiedzialności:

- poziom główny: intake i lista projektów
- poziom pomocniczy: organizacja w foldery i playlisty

Układ ekranu:

- szeroki panel `New Project` na górze
- poniżej lista projektów z jasnymi CTA
- panel organizacyjny dla folderów i playlist jako pomocniczy sidebar lub drawer

Nie ma stałego układu `sidebar + grid + inspector + dodatkowy panel`, bo prowadzi to do przeciążenia pionowymi strefami i rozmywa główny cel ekranu.

### Intake nowego projektu

Formularz tworzenia projektu musi zawierać:

- `Project name`
- wybór trybu `Upload` lub `URL`
- `Source language`
- `Target language`

Domyślne zachowanie:

- `English -> Polish`
- `Polish -> English`
- dla innych języków użytkownik wybiera język docelowy jawnie

### Lista projektów

Każdy projekt pokazuje:

- nazwę
- źródło
- języki `source -> target`
- status etapów
- `next action`

Przykładowe CTA:

- `Transcribe`
- `Translate`
- `Open Theater`
- `Retry`

### Organizacja

Foldery i playlisty pozostają w produkcie, ale akcje organizacyjne nie mogą zależeć od wcześniej wybranego „active folder” lub „active playlist” w innym panelu.

Zamiast tego:

- `Move to folder` otwiera wybór folderu
- `Add to playlist` otwiera wybór playlisty

To eliminuje obecny problem szarych, niejasnych przycisków.

## Theater

### Główny model

`Theater` jest ekranem odtwarzania i pipeline. Użytkownik ma zawsze widzieć:

- nazwę projektu
- języki `source -> target`
- playlistę
- status etapów pipeline
- główne CTA dla brakującego etapu

### Pasek etapów

Nagłówek `Theater` pokazuje:

- `Source`
- `Transcript`
- `Translation`
- `Dubbing`

Każdy etap ma stan:

- `not_started`
- `queued`
- `in_progress`
- `ready`
- `failed`

### Zachowanie ekranu

- jeśli brak transcriptu, widoczne jest duże CTA `Start transcription`
- jeśli transcript jest gotowy, ale translation nie jest gotowe, widoczne jest CTA `Start translation`
- jeśli oba etapy są gotowe, użytkownik pracuje w pełnym theater view
- playlist drawer jest pomocniczy, nie dominuje układu

### Fullscreen

Fullscreen musi korzystać z realnego Fullscreen API przeglądarki na kontenerze playera.

W fullscreen:

- player zajmuje ekran
- panele poboczne chowają się
- controls i napisy pozostają dostępne

Sama flaga w store nie jest wystarczająca.

## Model napisów

Obecny model `original / translation / dual` jest zbyt silnie związany z pochodzeniem tekstu.

Nowy model:

- `Primary track`
- `Secondary track`

Każdy slot może wskazywać:

- `original`
- `translation`
- `off` dla secondary

Dodatkowo:

- `Swap tracks`

Zasada typografii:

- styl zależy od roli ścieżki, nie od typu tekstu
- jeśli wyświetlana jest tylko jedna linia, ma wyglądać tak samo niezależnie od tego, czy to oryginał czy tłumaczenie

To daje zgodność z późniejszym dubbingiem, bo napisy stają się niezależną warstwą prezentacji.

## Backend i model danych

### Project

Projekt wymaga nowych pól:

- `source_language`
- `target_language`
- `transcript_status`
- `translation_status`
- `dubbing_status`

Obecne pole `status` może pozostać tymczasowo jako warstwa kompatybilności, ale nowy frontend powinien opierać się na statusach etapowych.

### Transcript i translation

Segmenty transcriptu pozostają:

- `original_text`
- `translated_text`

Nie trzeba ich przebudowywać, ale należy rozdzielić warstwę produktu:

- transkrypcja produkuje warstwę oryginalną
- tłumaczenie produkuje warstwę tłumaczoną

### API

Intake:

- `POST /api/projects/upload`
- `POST /api/projects/import`

Oba endpointy przyjmują:

- `name`
- `source_language`
- `target_language`

Pipeline:

- `POST /api/projects/{id}/transcribe`
- `POST /api/projects/{id}/translate`
- później: `POST /api/projects/{id}/dub`

## Dubbing readiness

W tej iteracji nie implementujemy dubbingu, ale projekt musi przewidywać:

- osobny status `dubbing_status`
- możliwość przechowywania `dubbing_audio_url`
- późniejsze ustawienia głosów i miksu

## Routing

Docelowe trasy pozostają:

- `/library`
- `/theater/[playlistId]/[projectId]`

Stara trasa `/projects/[projectId]` ma pozostać wyłącznie compatibility entrypointem.

## Testowanie

### Backend

- tworzenie projektu z językami
- domyślne mapowanie `en -> pl` i `pl -> en`
- osobne statusy pipeline
- endpoint transkrypcji
- endpoint tłumaczenia
- serializacja library i project detail

### Frontend

- Library task-first layout
- intake z wyborem języków
- next action zależny od statusów
- folder / playlist pickery
- Theater z CTA dla brakujących etapów
- prawdziwy fullscreen
- primary / secondary tracks + swap

### Runtime

- upload
- import URL
- EN -> PL
- PL -> EN
- open Theater
- fullscreen
- retry po błędzie

## Migracja

- nie rozwijamy dalej starego `ProjectWorkspace`
- nowe flow jest implementowane na `Library` i `Theater`
- compatibility route ma przekierowywać do nowego flow
- w lokalnym Dockerze, przy zmianie schematu bazy, trzeba resetować wolumen Postgresa dopóki repo nie ma pełnych migracji
