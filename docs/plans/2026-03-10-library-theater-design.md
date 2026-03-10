# Library + Theater Design

**Date:** 2026-03-10

**Summary:** Przebudowa frontendu DubbAI na model `Library + Theater`, gdzie biblioteka służy do zarządzania materiałami, folderami i playlistami, a Theater jest osobnym, minimalistycznym ekranem odtwarzacza z wysuwanym panelem playlisty.

## Założenia

- Aplikacja ma być minimalistyczna i produktowa, bez marketingowego copy w samym obszarze pracy.
- Główne rozdzielenie UX: `Library` do organizacji, `Theater` do oglądania.
- Organizacja materiałów: `foldery + playlisty`.
- Theater działa jak dojrzały player: overlay znika po bezruchu i wraca po ruchu myszy, klawiaturze albo tapnięciu.
- Fullscreen zachowuje player i pozwala wysunąć panel playlisty po kliknięciu.
- Auto-play next istnieje, ale jest przełączalne `on/off`.

## Podejścia

### 1. Route-based split

- `Library` i `Theater` działają jako osobne trasy
- najczystszy podział odpowiedzialności
- najlepszy fullscreen i najmniejszy chaos stanu

### 2. Single-screen with layout switching

- jeden ekran przełącza się między biblioteką i playerem
- mniej zmian w routingu
- większa złożoność stanu i słabszy efekt kinowy

### 3. App shell with docked panels

- stały shell z centralnym obszarem roboczym
- duża elastyczność
- wysokie ryzyko przeładowania UI

**Wybrany wariant:** `Route-based split`.

## Model produktu

### Library

Library jest głównym ekranem zarządzania:

- foldery do porządkowania projektów
- playlisty do kolejności oglądania
- widok listy lub siatki projektów
- wyszukiwanie, filtrowanie i sortowanie
- batch actions dla większej liczby materiałów

Główne akcje:

- dodanie materiału
- usunięcie materiału
- przeniesienie do folderu
- dodanie do jednej lub wielu playlist
- uruchomienie materiału albo playlisty w Theater

### Theater

Theater jest osobnym ekranem oglądania:

- centralny, szeroki player
- ukrywane sterowanie typu YouTube
- wysuwany panel z listą filmów z aktualnej playlisty
- fullscreen bez zbędnych opisów
- sterowanie napisami, autoplay i szybkością odtwarzania przez panel ustawień

## Theater UX

Układ:

- środek: player
- prawa strona: wysuwany panel playlisty
- fullscreen: ten sam player, panel dostępny po kliknięciu

Widoczne sterowanie:

- play/pause
- timeline
- current time / duration
- volume
- playback speed
- fullscreen

Panel ustawień:

- subtitle mode: `translation / original / dual`
- subtitle density: `compact / balanced / sentence`
- autoplay: `on / off`
- kolejne style napisów w następnych iteracjach

Skróty:

- `Space` / `K`: play/pause
- `J`: -15s
- `L`: +15s
- `←` / `→`: -5s / +5s
- `↑` / `↓`: volume
- `F`: fullscreen
- `M`: mute

Kluczowa zasada:

- aktywny cue, karaoke i napisy muszą być napędzane prawdziwym `currentTime` odtwarzacza

## Library UX

Układ:

- lewy panel: foldery, playlisty, przyciski tworzenia
- środek: zawartość wybranego folderu albo playlisty
- prawy panel kontekstowy: akcje na zaznaczonym projekcie

Model organizacji:

- projekt należy do jednego folderu
- projekt może należeć do wielu playlist
- playlista ma własną kolejność materiałów

Użyteczność przy dużej liczbie materiałów zapewniają:

- sticky toolbar
- wyszukiwarka
- filtry i sortowanie
- multi-select
- czytelne badge statusów

## Routing

- `/library`
- `/theater/[playlistId]/[projectId]`
- opcjonalny fallback: `/theater/project/[projectId]`

## Stan frontendu

### Library store

- foldery
- playlisty
- zaznaczenia
- filtry
- sortowanie

### Player store

- play/pause
- currentTime
- duration
- volume
- speed
- subtitle mode
- subtitle density
- autoplay
- fullscreen UI state
- visibility overlay

### Theater queue store

- aktualna playlista
- indeks bieżącego materiału
- next/previous
- stan panelu playlisty

## Backend data model

Do dołożenia:

- `folders`
- `playlists`
- `playlist_items`
- rozszerzenie `projects` o `folder_id`

Endpointy:

- CRUD folderów
- CRUD playlist
- przypinanie projektów do playlist
- usuwanie projektów z playlist
- pobranie playlisty z kolejnością
- usuwanie projektu

## Plan migracji

1. Dołożyć nowe modele i endpointy bez usuwania obecnego flow.
2. Zbudować nową trasę `/library`.
3. Zbudować nową trasę `/theater/...`.
4. Przepiąć obecne CTA z dashboardu na Theater.
5. Usunąć stare tymczasowe elementy workspace po pełnej migracji.

## Testowanie

### Frontend

- time-sync playera
- zmiana aktywnego cue
- show/hide overlay
- skróty klawiaturowe
- autoplay next
- wysuwany panel playlisty
- CRUD interactions w Library

### Backend

- CRUD folderów
- CRUD playlist
- kolejność `playlist_items`
- usuwanie projektu i odpinanie relacji
