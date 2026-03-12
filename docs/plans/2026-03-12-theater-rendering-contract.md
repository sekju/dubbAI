# DubbAI Theater Rendering Contract

Data: 2026-03-12
Status: Draft v1
Typ dokumentu: UX + Data Contract
Zależność nadrzędna: `2026-03-12-dubbai-target-prd.md`

## 1. Cel dokumentu

Ten dokument opisuje kontrakt działania widoku Theater. Określa:

- jakie dane wejściowe Theater musi dostać,
- kiedy playback jest odblokowany,
- jak grupowane i renderowane są napisy,
- jak działają tracki, autoplay, fullscreen i playlista,
- jak Theater zachowuje się, gdy pipeline nie jest gotowy.

## 2. Dane wejściowe

## 2.1 Project input

Theater musi otrzymać obiekt projektu zawierający co najmniej:

- identyfikator projektu,
- nazwę projektu,
- `sourceUrl`,
- `sourceLanguage`,
- `targetLanguage`,
- `transcriptStatus`,
- `translationStatus`,
- `dubbingStatus`,
- `activeJob`,
- `transcriptWords`.

## 2.2 TranscriptWords

`transcriptWords` jest jedynym poprawnym źródłem prawdy dla renderingu napisów.

Każde słowo musi zawierać:

- `position`
- `startMs`
- `endMs`
- `originalText`
- `translatedText`
- `keyword`

Przechowywane bloki segmentowe nie mogą zastępować warstwy per-word.

## 2.3 Queue input

Theater musi otrzymać kolejkę playlisty zawierającą:

- `playlistId`
- `playlistName`
- uporządkowaną listę `items`

Każdy element kolejki musi zawierać:

- `projectId`
- `title`

## 3. Warunki odblokowania playbacku

Theater może pokazać pełny player tylko wtedy, gdy spełnione są jednocześnie wszystkie warunki:

- istnieje `sourceUrl`,
- `transcriptStatus = ready`,
- `translationStatus = ready`,
- `transcriptWords` nie jest puste,
- co najmniej jedno słowo ma niepusty `translatedText`.

Jeżeli którykolwiek z warunków nie jest spełniony, Theater przechodzi w tryb `pipeline gate`.

## 4. Pipeline gate

Pipeline gate nie może być pustym ekranem oczekiwania. Musi być operacyjnym ekranem kontroli postępu.

Widok gate musi zawierać:

- stage cards dla `Source`, `Transcript`, `Translation`, `Dubbing`,
- aktualny status blokady,
- rekomendowaną następną akcję,
- przyciski `Start` albo `Retry`, jeśli etap to umożliwia,
- panel aktywnego joba z live progress, spinnerem i elapsed time.

## 4.1 Reguły akcji

- `transcriptStatus = not_started` -> pokaż `Start transcription`
- `transcriptStatus = failed` -> pokaż `Retry transcription`
- `transcriptStatus = queued | in_progress` -> pokaż progres i zablokuj playback
- `translationStatus = not_started` przy gotowym transcript -> pokaż `Start translation`
- `translationStatus = failed` -> pokaż `Retry translation`
- `translationStatus = queued | in_progress` -> pokaż progres i zablokuj playback

## 5. Grupowanie napisów

Napisy nie są przechowywane jako gotowe linie. Muszą być deterministycznie grupowane z `transcriptWords`.

## 5.1 Tryby gęstości

System musi wspierać trzy tryby:

- `compact`
- `balanced`
- `sentence`

## 5.2 Maksymalna liczba słów

- `compact` -> do `3` słów
- `balanced` -> do `6` słów
- `sentence` -> brak twardego limitu liczby słów

## 5.3 Reguły łamania cue

Nowa grupa musi zostać rozpoczęta, jeśli:

- luka ciszy między kolejnymi słowami wynosi co najmniej `900ms`,
- aktualne słowo kończy się na `.`, `!` lub `?`,
- osiągnięto limit słów dla danego trybu gęstości.

## 5.4 Reguły łączenia tekstu

Łączenie tokenów musi zachowywać interpunkcję. Znaki interpunkcyjne mają przylegać do odpowiednich słów bez sztucznych spacji.

## 5.5 Grupowanie per track

Track `original` i track `translation` są grupowane niezależnie, ale na bazie tej samej osi czasu słów.

Jeżeli `translatedText` dla danego słowa jest puste, renderer tłumaczenia może użyć `originalText` jako fallbacku do budowy tekstu grupy.

## 6. Aktywne cue i aktywne słowo

## 6.1 Aktywna grupa

Aktywną grupą jest ta, dla której:

- `startMs <= currentTimeMs <= endMs`

Jeżeli nie znaleziono grupy dokładnie pasującej, renderer może użyć pierwszej grupy jako bezpiecznego fallbacku startowego.

## 6.2 Aktywne słowo

Słowo jest aktywne, jeśli:

- `startMs <= currentTimeMs <= endMs`

Aktywność słowa jest osobnym sygnałem wizualnym i nie może zależeć od tego, czy `keyword = true`.

## 6.3 Keyword

`keyword = true` musi być przekazane do rendererów jako osobny sygnał stylowania.

Keyword:

- nie zmienia timingu,
- nie zmienia tekstu,
- służy wyłącznie do wyróżnienia wizualnego.

## 7. Tracki napisów

## 7.1 Track główny

Dozwolone wartości:

- `translation`
- `original`

## 7.2 Track pomocniczy

Dozwolone wartości:

- `original`
- `translation`
- `off`

## 7.3 Wartości domyślne

- primary = `translation`
- secondary = `original`

## 7.4 Swap tracks

Akcja `Swap tracks`:

- zamienia primary i secondary,
- nie robi nic, jeśli secondary = `off`.

## 8. Tiktok mode

Tiktok mode jest przełącznikiem per-track.

Wymagania:

- primary ma osobny toggle,
- secondary ma osobny toggle,
- zmiana dotyczy wyłącznie stylowania aktywnego słowa,
- transcript i grouping nie mogą się zmieniać.

## 9. Sterowanie playbackiem

Theater używa własnych kontrolek, a nie natywnych kontrolek odtwarzacza.

Wymagane kontrolki:

- play / pause
- seek `-15s`
- seek `+15s`
- timeline scrubber
- volume
- playback speed
- fullscreen
- settings

## 9.1 Skróty klawiaturowe

- `Space` lub `K` -> play/pause
- `J` -> `-15s`
- `L` -> `+15s`
- `ArrowLeft` -> `-5s`
- `ArrowRight` -> `+5s`
- `ArrowUp` -> volume `+5`
- `ArrowDown` -> volume `-5`
- `F` -> fullscreen

## 10. Overlay

Overlay playera:

- pojawia się po interakcji,
- ukrywa się po `2500ms` bezczynności,
- wraca po ruchu myszy,
- jest wymuszany jako widoczny po `pause`,
- jest wymuszany jako widoczny po zakończeniu odtwarzania.

## 11. Fullscreen

Fullscreen dotyczy kontenera playera, nie całej powłoki strony.

Konsekwencje fullscreen:

- Theater wchodzi w czystszy layout,
- drawer playlisty ma zostać zamknięty,
- poboczna nawigacja i chrome shell mogą zostać ukryte.

## 12. Settings panel

Panel settings musi obsługiwać:

- wybór tracku primary,
- wybór tracku secondary,
- swap tracks,
- tiktok mode per track,
- density mode,
- playback speed,
- autoplay toggle.

## 13. Queue i autoplay

## 13.1 Queue state

Stan kolejki Theater musi zawierać:

- identyfikator playlisty,
- listę uporządkowanych elementów,
- aktualny indeks,
- flagę autoplay.

## 13.2 Zasady ładowania queue

Przy załadowaniu playlisty system musi znaleźć indeks aktualnego projektu w kolejce.

## 13.3 Nawigacja

- `goNext` zwiększa indeks, ale nie przekracza końca listy,
- `goPrevious` zmniejsza indeks, ale nie schodzi poniżej zera,
- kliknięcie elementu draweru otwiera wybrany projekt.

## 13.4 Autoplay

- autoplay domyślnie = `true`,
- po końcu materiału system przechodzi do następnego projektu, jeśli autoplay jest aktywny i istnieje kolejny element.

## 14. Playlist drawer

Drawer playlisty:

- jest domyślnie zamknięty,
- otwiera się na żądanie,
- pokazuje nazwę playlisty i kolejność projektów,
- wyróżnia aktualny projekt,
- znika w fullscreen.

## 15. Live progress i polling

Jeśli istnieje `activeJob` i nie jest terminalny, Theater musi:

- odpytywać status joba,
- odświeżać dane projektu,
- aktualizować progress bar,
- aktualizować elapsed time,
- zatrzymać polling po stanie terminalnym.

Wymagane interwały:

- standardowy polling: `1500ms`
- retry po błędzie pollingu: `2500ms`

Panel live joba musi zawierać:

- spinner,
- procent postępu,
- elapsed timer,
- etykietę etapu, np. `Transcription` albo `Translation`.

## 16. Inwarianty

- transcript per-word jest jedynym źródłem prawdy dla napisów,
- Theater nie może uznać samych statusów za wystarczające, jeśli dane tekstowe są puste,
- grouping jest deterministyczny,
- keyword i active-word highlighting są niezależnymi sygnałami,
- Theater musi być użyteczny także przed odblokowaniem playbacku.

## 17. Acceptance criteria

1. Playback odblokowuje się tylko przy gotowych statusach i realnie używalnych danych tekstowych.
2. Grupowanie w `compact`, `balanced`, `sentence` daje powtarzalne wyniki dla tych samych `transcriptWords`.
3. Cisza `>= 900ms` rozpoczyna nowe cue.
4. `.` `!` `?` kończą cue.
5. Aktywne słowo i keyword mogą być stylowane niezależnie.
6. Overlay znika po `2500ms` bezczynności i wraca po interakcji.
7. Autoplay może przejść do kolejnego projektu z playlisty po zakończeniu materiału.
8. Theater w trybie pipeline pokazuje realne akcje i progres, a nie pusty placeholder.
