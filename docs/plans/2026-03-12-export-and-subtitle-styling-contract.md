# DubbAI Export And Subtitle Styling Contract

Data: 2026-03-12
Status: Draft v1
Typ dokumentu: Output Contract
Zależność nadrzędna: `2026-03-12-dubbai-target-prd.md`

## 1. Cel dokumentu

Ten dokument definiuje docelowy kontrakt dla:

- stylowania napisów,
- renderingu napisów do preview i eksportu,
- rodzajów eksportów,
- miksu audio,
- assetów wyjściowych i pobrań.

## 2. Założenie główne

Theater preview jest kanoniczną referencją wizualną. Eksport ma możliwie wiernie odwzorowywać preview dla tego samego projektu, tracku i presetów stylu.

Źródłem prawdy dla tekstu i timingu pozostaje transcript per-word.

## 3. Kanoniczny obiekt stylu napisów

Każdy projekt musi posiadać zapisany obiekt stylu napisów.

Minimalne pola:

- `fontFamily`
- `fontSize`
- `textColor`
- `outlineColor`
- `outlineWidth`
- `backgroundMode`
- `backgroundColor`
- `shadowEnabled`
- `opacity`
- `verticalPosition`
- `alignment`
- `densityMode`
- `keywordEmphasisMode`
- `activeWordEmphasisMode`

## 3.1 Zasady obiektu stylu

- obiekt stylu jest zapisywany per projekt,
- ten sam obiekt zasila preview i eksport,
- zmiana stylu nie może zmieniać tekstu ani timingu transcriptu,
- styl musi mieć wersjonowanie logiczne, aby eksport wiedział z jakiego wariantu korzysta.

## 4. Preview vs export parity

Produkt musi jawnie rozróżniać:

- efekty, które muszą być odwzorowane 1:1 w eksporcie,
- efekty, które mogą być tylko preview-only.

## 4.1 Efekty obowiązkowe do zachowania

- font
- rozmiar
- kolor tekstu
- kolor outline
- grubość outline
- przezroczystość
- pozycja pionowa
- alignment
- wybór tracku napisów
- grouping według density mode

## 4.2 Efekty zależne od formatu wyjściowego

- keyword emphasis może zostać zachowane w `ASS` i burn-in `MP4`,
- active-word highlight jest co do zasady preview-only dla plików statycznych,
- `SRT` i `VTT` mogą utracić część bogatego stylowania.

## 5. Rendering napisów

## 5.1 Źródło danych

Napisy eksportowe są pochodną:

- transcriptu per-word,
- wybranego tracku,
- density mode,
- obiektu stylu.

## 5.2 Zasada renderingu

Domyślnie eksportowane napisy mają być budowane z tych samych grouped cues co Theater preview.

Wyjątek:

- jeśli produkt wprowadzi osobny tryb `raw word-timed export`, musi to być świadoma opcja eksportu, a nie domyślne zachowanie.

## 5.3 Grouping

Domyślne grouping dla eksportu ma dziedziczyć:

- `compact` -> do `3` słów
- `balanced` -> do `6` słów
- `sentence` -> bez twardego limitu, do przerwy interpunkcyjnej lub czasowej

## 5.4 Keyword policy

System musi jednoznacznie rozróżnić:

- `preview keyword emphasis`
- `export keyword emphasis`

Zasady:

- `SRT` i `VTT` nie muszą zachowywać keyword emphasis,
- `ASS` może zachowywać keyword emphasis,
- burn-in `MP4` może zachowywać keyword emphasis, jeśli styl i renderer to wspierają.

## 6. Rodzaje eksportów

Produkt musi wspierać co najmniej te wyjścia:

- plik napisów `srt`
- plik napisów `vtt`
- plik napisów `ass`
- wideo `mp4` z opcjonalnym burn-in

## 6.1 Macierz wyjść

### Subtitle-only

- `srt`
- `vtt`
- `ass`

### Video export

- `mp4` z audio źródłowym
- `mp4` z dubbingiem
- `mp4` z miksem source + dubbing
- każdy z wariantów opcjonalnie z burn-in subtitles

## 7. Kontrakt requestu eksportu

Żądanie eksportu musi zawierać co najmniej:

- `projectId`
- `outputType`
- `subtitleFormat`
- `subtitleTrack`
- `burnSubtitles`
- `audioMode`
- `originalVolume`
- `dubbingVolume`
- `stylePresetVersion`
- opcjonalny `label`

## 7.1 Dozwolone audioMode

- `source_only`
- `dubbing_only`
- `mixed`

## 7.2 Reguły audio

- `source_only` ignoruje `dubbingVolume`
- `dubbing_only` ignoruje `originalVolume`
- `mixed` używa obu poziomów głośności

Obie głośności muszą być wyrażone w skali `0-100`.

## 8. Lifecycle eksportu

Eksport jest osobnym etapem pipeline i posiada statusy:

- `not_started`
- `queued`
- `in_progress`
- `ready`
- `failed`

Równolegle istnieje job runtime state:

- `queued`
- `started`
- `retry`
- `success`
- `failure`

## 8.1 Rezultat gotowego eksportu

Gotowy eksport musi zwracać nie tylko informację o sukcesie, ale także metadane artefaktu:

- `artifactId`
- `projectId`
- `outputType`
- `format`
- `track`
- `stylePresetVersion`
- `fileName`
- `downloadUrl`
- `createdAt`

## 8.2 Retry eksportu

Retry eksportu:

- czyści tylko nieaktualne assety eksportowe dla danego wariantu,
- nie czyści transcriptu,
- nie czyści tłumaczenia,
- nie czyści dubbingu.

## 9. Subtitle file contracts

## 9.1 SRT

`SRT` ma zachowywać:

- czytelny grouping,
- kolejność cue,
- timing cue.

`SRT` nie musi zachowywać:

- fontu,
- outline,
- opacity,
- keyword emphasis.

## 9.2 VTT

`VTT` ma zachowywać:

- czytelny grouping,
- kolejność cue,
- timing cue.

`VTT` może wspierać ograniczone dodatkowe style, ale produkt nie powinien zakładać pełnej zgodności wizualnej z preview.

## 9.3 ASS

`ASS` jest preferowanym formatem bogatego stylowania.

`ASS` powinien być traktowany jako najbogatsza reprezentacja stylu:

- font,
- kolor,
- outline,
- alignment,
- pozycjonowanie,
- keyword emphasis, jeśli wspierane.

## 10. Burn-in MP4 contract

Burn-in export:

- korzysta z tego samego stylu co preview,
- korzysta z grouped cues wybranego tracku,
- renderuje napisy jako część finalnego obrazu,
- może wymagać re-encode video, jeśli napisy są wypalane.

## 10.1 Warianty audio

Burn-in MP4 musi wspierać:

- audio źródłowe,
- dubbing,
- miks source + dubbing.

## 11. Download contract

Użytkownik musi mieć możliwość pobrania gotowego artefaktu po zakończeniu eksportu.

UI powinno rozróżniać:

- eksport gotowy,
- eksport w trakcie,
- eksport nieudany.

Pobranie musi być oparte o jawny `downloadUrl` lub równoważny identyfikator artefaktu.

## 12. Otwarta decyzja produktowa

Domyślny wariant eksportu napisów powinien używać grouped cues, nie surowych słów per-word.

Jeżeli produkt ma wspierać raw word-timed export, musi to być osobna, zaawansowana opcja ekspercka.

## 13. Inwarianty

- preview i eksport korzystają z tego samego źródła danych tekstowych,
- styl napisów jest trwałą częścią projektu,
- eksport nie mutuje transcriptu,
- ASS jest preferowaną reprezentacją bogatego stylu,
- gotowy eksport musi prowadzić do realnego artefaktu do pobrania.

## 14. Acceptance criteria

1. Projekt ma zapisany kanoniczny obiekt stylu napisów.
2. Ten sam styl zasila preview i eksport.
3. Eksport `srt`, `vtt`, `ass` i `mp4` jest opisany jednym spójnym kontraktem.
4. Request eksportu pozwala określić track napisów, audio mode i style preset version.
5. Gotowy eksport zwraca metadane artefaktu oraz ścieżkę pobrania.
6. Retry eksportu nie usuwa danych źródłowych projektu.
7. `ASS` zachowuje więcej stylu niż `SRT` i `VTT`.
8. Burn-in `MP4` odwzorowuje preview w granicach możliwości formatu.
