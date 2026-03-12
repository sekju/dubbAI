# DubbAI Target PRD

Data: 2026-03-12
Status: Draft v1
Typ dokumentu: Product Requirements Document
Cel dokumentu: opisać docelowy produkt w sposób niezależny od obecnej implementacji i technologii, tak aby agent AI lub zespół mógł odtworzyć aplikację od zera w modelu spec-driven development.

## 1. Streszczenie produktu

DubbAI to aplikacja do przygotowywania wielojęzycznych wersji wideo. Użytkownik dostarcza materiał źródłowy, system tworzy transkrypcję z precyzją na poziomie słowa, tłumaczy treść, pozwala przejrzeć wynik w dedykowanym widoku review, generuje dubbing, umożliwia stylowanie napisów i finalnie pozwala pobrać napisy lub wyeksportować wideo z wypalonymi napisami.

Produkt ma wspierać pełny workflow operacyjny:

1. Dodanie materiału.
2. Organizacja projektu w bibliotece.
3. Transkrypcja i analiza treści.
4. Tłumaczenie.
5. Review materiału w widoku odtwarzania.
6. Generowanie dubbingu.
7. Konfiguracja stylu napisów.
8. Eksport i pobrania.

Ten dokument opisuje produkt docelowy, a nie bieżący stan kodu.

## 2. Problem do rozwiązania

Dzisiejszy workflow lokalizacji materiałów wideo jest rozproszony między wiele narzędzi. Użytkownik zwykle musi osobno:

- zaimportować materiał,
- przygotować transkrypcję,
- przetłumaczyć treść,
- dopasować napisy do czasu,
- wygenerować ścieżkę dubbingową,
- sprawdzić wynik na timeline,
- przygotować eksport końcowy.

Powoduje to straty czasu, błędy w synchronizacji i brak jednego źródła prawdy dla projektu. DubbAI ma zintegrować ten proces w jednym produkcie i prowadzić użytkownika od źródła do gotowego assetu publikacyjnego.

## 3. Cele produktu

### Cele główne

- Skrócić czas od dostarczenia materiału do gotowego assetu dubbingowego i napisowego.
- Uporządkować cały proces w modelu projektu, a nie pojedynczych plików.
- Zapewnić review w kontekście odtwarzania, a nie tylko w tabeli tekstu.
- Pozwolić użytkownikowi szybko przełączać się między projektami i playlistami review.
- Dostarczyć eksporty przydatne operacyjnie: napisy do pobrania oraz wideo z wypalonymi napisami.

### Cele jakościowe

- Każdy etap pipeline musi być jawny, śledzalny i retryowalny.
- System nie może udawać sukcesu, jeśli wynik AI jest pusty, błędny lub niespójny.
- Widok odtwarzania ma używać danych opartych o timing na poziomie słowa.
- Użytkownik ma widzieć, który etap jest gotowy, który trwa i co trzeba zrobić dalej.

## 4. Non-goals

Ten dokument celowo nie obejmuje:

- opisu technologii, frameworków, baz danych i dostawców chmurowych,
- wewnętrznej architektury wdrożeniowej,
- systemu billingowego i rozliczeń,
- zaawansowanej kolaboracji wieloosobowej w czasie rzeczywistym,
- zaawansowanej edycji audio/video typu NLE,
- ręcznego montażu timeline na poziomie profesjonalnego edytora wideo.

## 5. Użytkownicy i role

### 5.1 Główna rola

`Content localization operator`

Osoba odpowiedzialna za przygotowanie lokalnej wersji materiału wideo. Jej celem jest szybko doprowadzić materiał do stanu gotowego do publikacji lub dalszej obróbki.

### 5.2 Dodatkowe role

`Reviewer`

Osoba, która sprawdza jakość transkrypcji, tłumaczenia, synchronizacji i dubbingu.

`Producer / content manager`

Osoba zarządzająca biblioteką projektów, playlistami review i eksportami końcowymi.

## 6. Główne encje domenowe

### 6.1 Projekt

Podstawowa jednostka pracy. Projekt reprezentuje jedno źródłowe wideo i wszystkie jego pochodne:

- materiał źródłowy,
- ustawienia językowe,
- transkrypcję,
- tłumaczenie,
- dubbing,
- ustawienia napisów,
- eksporty.

### 6.2 Folder

Struktura organizacyjna w bibliotece służąca do grupowania projektów.

### 6.3 Playlista

Uporządkowana lista projektów służąca do sekwencyjnego review w widoku Theater.

### 6.4 Transcript Word

Atomem danych tekstowych jest słowo z przypisanym timingiem. Każdy element powinien zawierać:

- pozycję w sekwencji,
- czas startu,
- czas końca,
- tekst oryginalny,
- tekst tłumaczenia,
- znacznik słowa istotnego.

### 6.5 Track

Ścieżka renderowana w playerze. Produkt musi wspierać co najmniej:

- ścieżkę napisów oryginalnych,
- ścieżkę napisów tłumaczonych,
- ścieżkę audio źródłową,
- ścieżkę audio dubbingową.

### 6.6 Preset stylu napisów

Zestaw ustawień wizualnych używany w podglądzie i eksporcie:

- font,
- rozmiar,
- kolor,
- outline,
- tło lub cień,
- przezroczystość,
- pozycja,
- gęstość prezentacji tekstu.

### 6.7 Export

Wynik końcowy przygotowany do pobrania, np.:

- plik napisów,
- wideo z wypalonymi napisami,
- paczka materiałów do publikacji.

## 7. Docelowy workflow produktu

## 7.1 Intake projektu

Użytkownik tworzy projekt z jednego z dwóch źródeł:

- upload pliku wideo,
- import z URL.

Na etapie intake użytkownik podaje:

- nazwę projektu,
- język źródłowy lub tryb autodetekcji,
- język docelowy.

Po utworzeniu projekt natychmiast pojawia się w bibliotece i może zostać przypisany do folderu lub playlisty, nawet jeśli pipeline jeszcze się nie rozpoczął.

### Wymagania

- System musi zaakceptować źródło lokalne i zdalne.
- Projekt musi być widoczny w bibliotece od razu po utworzeniu.
- System powinien automatycznie proponować domyślną parę językową dla najczęstszych przypadków, ale użytkownik musi móc ją zmienić.

## 7.2 Library

Library jest centralnym widokiem zarządzania projektami. To nie jest tylko lista plików, ale operacyjny panel zarządzania pipeline.

W Library użytkownik może:

- przeglądać wszystkie projekty,
- filtrować i sortować projekty,
- przeglądać status pipeline,
- tworzyć foldery,
- tworzyć playlisty,
- przypisywać projekt do folderu,
- dodawać projekt do playlisty,
- usuwać projekt,
- otworzyć projekt w Theater,
- rozpocząć lub wznowić kolejny etap pracy.

### Wymagania

- Każdy projekt musi mieć widoczny stan oraz sugerowaną następną akcję.
- Library musi jasno odróżniać projekt gotowy do review od projektu zablokowanego przez pipeline.
- Działania operacyjne, takie jak transcribe, translate, retry i open in Theater, muszą być dostępne bez wchodzenia do osobnego panelu administracyjnego.

## 7.3 Pipeline AI

Pipeline jest sekwencyjny i etapowy. Każdy etap ma własny status, własne błędy i możliwość retry.

Docelowe etapy:

1. `Source ready`
2. `Transcription`
3. `Translation`
4. `Dubbing`
5. `Export`

Każdy etap może mieć status:

- `not_started`,
- `queued`,
- `in_progress`,
- `ready`,
- `failed`.

### Wymagania

- System musi blokować etapy zależne, jeśli wcześniejszy etap nie jest gotowy.
- System musi pozwalać na retry etapu bez konieczności usuwania całego projektu.
- Retry musi czyścić tylko dane zależne od danego etapu i dalszych etapów, nie cały projekt.
- System musi pokazywać użytkownikowi progres aktywnego zadania.
- System nie może oznaczyć etapu jako `ready`, jeśli wynik AI nie przejdzie walidacji jakości i struktury.

## 7.4 Theater

Theater to widok review i odtwarzania projektu. Ma służyć do oglądania materiału w kontekście napisów, tłumaczenia i dubbingu, a nie do zarządzania biblioteką.

W Theater użytkownik może:

- odtwarzać materiał,
- przełączać track główny i pomocniczy,
- oglądać napisy oryginalne i tłumaczone,
- przełączać gęstość grupowania napisów,
- korzystać z trybu full screen,
- przełączać autoplay następnego projektu w playliście,
- przechodzić do kolejnego lub poprzedniego projektu w playliście,
- obserwować postęp pipeline, jeśli projekt jest jeszcze w przetwarzaniu.

### Wymagania

- Player musi działać na danych słowo-po-słowie z timingiem.
- Aktywne słowo musi być możliwe do podświetlenia zgodnie z czasem odtwarzania.
- Theater musi wspierać co najmniej dwa jednoczesne tracki napisów: główny i pomocniczy.
- Widok Theater musi działać zarówno jako ekran review pojedynczego projektu, jak i jako ekran pracy na playliście.
- Jeśli pipeline jeszcze trwa, Theater nie może być pusty. Musi pokazać stan, progres, elapsed time i możliwą następną akcję.

## 7.5 Dubbing

Dubbing jest osobnym etapem po przygotowaniu tekstu. Celem jest wygenerowanie ścieżki audio w języku docelowym na podstawie zatwierdzonego tłumaczenia.

### Zakres funkcjonalny

- wygenerowanie docelowej ścieżki audio,
- podpięcie ścieżki dubbingowej do projektu,
- odsłuch źródła i dubbingu w Theater,
- możliwość przełączenia między audio źródłowym a dubbingowym,
- przygotowanie dubbingu do eksportu końcowego.

### Wymagania

- Dubbing musi używać tekstu docelowego jako źródła prawdy, a nie surowego tekstu oryginalnego.
- System musi przechowywać status dubbingu niezależnie od statusu tłumaczenia.
- Użytkownik musi widzieć, czy dubbing jest gotowy, trwa, czy wymaga retry.
- Theater musi umieć odtworzyć projekt z aktywną ścieżką dubbingową.

## 7.6 Subtitle styling

Produkt musi pozwalać skonfigurować wygląd napisów zarówno do preview, jak i do eksportu.

Konfigurowalne parametry:

- font,
- rozmiar,
- kolor tekstu,
- kolor i grubość outline,
- przezroczystość tekstu lub tła,
- pozycja napisów,
- maksymalna gęstość i sposób grupowania tekstu,
- ewentualne wyróżnienie słów aktywnych lub słów kluczowych.

### Wymagania

- Każda zmiana stylu musi być widoczna w podglądzie przed eksportem.
- Te same ustawienia muszą być używane do generowania finalnych napisów i burn-in exportu.
- System musi umożliwiać zapisanie ustawień stylu na poziomie projektu.
- Ustawienia stylu nie mogą zmieniać treści ani timingu transcriptu.

## 7.7 Export i pobrania

Produkt musi umożliwiać pobranie wyników pracy w kilku formach.

### Minimalny zakres eksportów

- pobranie napisów jako osobnego pliku,
- pobranie wideo z wypalonymi napisami,
- pobranie wideo lub paczki z aktywną ścieżką dubbingową, jeśli dubbing został wygenerowany.

### Wymagania

- Użytkownik musi wiedzieć, jaki wariant eksportu pobiera.
- Eksport musi korzystać z aktualnej wersji transcriptu, tłumaczenia i stylu napisów przypisanych do projektu.
- Burn-in export musi odwzorowywać wygląd napisów z podglądu projektowego.
- System musi odróżniać gotowe eksporty od eksportów w trakcie przetwarzania.

## 8. Użycie modeli Gemini i kontrakt AI

## 8.1 Cel tej sekcji

Ta sekcja jest celowo bardziej techniczna niż reszta PRD. Jej celem nie jest opis frameworka ani języka implementacji, ale zamrożenie kontraktu z modelami Gemini, aby kolejna implementacja nie musiała od nowa wymyślać:

- które modele są używane,
- do jakich zadań są przypisane,
- jak mają być konstruowane prompty,
- jak musi wyglądać `Structured Output`,
- jak walidować odpowiedzi,
- kiedy uznać wynik za poprawny, a kiedy za `failed`.

To jest normatywna specyfikacja zachowania AI.

## 8.2 Mapowanie modeli Gemini na zadania

### Modele tekstowe

System ma wspierać dokładnie dwa modele tekstowe Gemini:

- `gemini-2.5-flash-lite`
- `gemini-2.5-flash`

Mapowanie produktowe:

- `gemini-2.5-flash-lite` jest domyślnym modelem dla transkrypcji i tłumaczenia.
- `gemini-2.5-flash` jest wariantem jakościowym dla trudniejszych materiałów lub gdy użytkownik wybiera wyższy profil jakości.

### Model TTS / dubbingowy

System ma używać modelu:

- `gemini-2.5-flash-preview-tts`

Ten model odpowiada za generowanie ścieżki dubbingowej na podstawie finalnego tłumaczenia.

### Zasada produktowa

Interfejs użytkownika może eksponować profile jakości typu:

- `Fast`
- `Balanced`
- `High quality`

ale implementacja wewnętrzna musi mapować te profile na konkretne modele Gemini wymienione wyżej.

## 8.3 Globalne zasady wywołań Gemini

Każde wywołanie do modeli tekstowych musi używać odpowiedzi JSON, a nie swobodnego tekstu.

Wymagane pola konfiguracyjne dla wywołań tekstowych:

- `responseMimeType = application/json`
- `maxOutputTokens = 65536` jako domyślny limit
- `Structured Output = true` jako ustawienie domyślne i rekomendowane
- `responseJsonSchema` ustawione jawnie dla każdego typu odpowiedzi

### Thinking mode

System ma wspierać trzy tryby:

- `off`
- `dynamic`
- `budget`

Zasady:

- dla `off` nie przekazujemy `thinkingConfig`,
- dla `dynamic` przekazujemy `thinkingBudget = -1`,
- dla `budget` przekazujemy wskazaną wartość budżetu,
- jeśli tryb `budget` nie ma jawnej wartości, domyślny budżet powinien wynosić `512` dla `gemini-2.5-flash-lite` i `1024` dla `gemini-2.5-flash`.

### Timeouty

- transkrypcja audio musi używać dłuższego timeoutu: `600s`,
- tłumaczenie i pozostałe tekstowe wywołania mogą używać standardowego timeoutu: `120s`.

## 8.4 Specyfikacja promptu dla transkrypcji

Transkrypcja ma być generowana jako transcript per-word. System nie może prosić modelu o segmenty zdaniowe jako źródło prawdy.

### Intencja promptu

Prompt transkrypcyjny musi wymuszać:

- odpowiedź wyłącznie w JSON,
- top-level collection o nazwie `words`,
- strukturę słowo-po-słowie,
- pola `start`, `end`, `text`, `keyword`,
- zachowanie interpunkcji wewnątrz pola `text`,
- oznaczanie istotnych słów lub krótkich key phrases przez `keyword = true`,
- brak komentarzy, objaśnień i bloków markdown,
- brak segmentów zdaniowych jako podstawowego wyniku.

### Wymagana treść promptu

Prompt dla transkrypcji powinien odpowiadać tej intencji:

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

### Structured Output schema dla transkrypcji

System musi przekazywać do Gemini ten schemat JSON:

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

### Wymagana odpowiedź logiczna po normalizacji

Po stronie aplikacji odpowiedź Gemini musi zostać znormalizowana do formatu:

```json
{
  "words": [
    {
      "position": 1,
      "start_ms": 681,
      "end_ms": 1321,
      "original_text": "custom",
      "keyword": true
    }
  ]
}
```

### Zasady walidacji transkrypcji

Każdy element `words[]` musi spełniać:

- `start` i `end` muszą być stringiem czasu albo liczbą,
- `text` musi być niepustym stringiem,
- `keyword` musi być booleanem; jeśli go brak, należy przyjąć `false`,
- po konwersji `end_ms >= start_ms`,
- lista `words` nie może być pusta.

### Zasady parsowania

- System może tolerować odpowiedź w fenced code block i przed parsowaniem ma usunąć znaczniki typu ```json.
- System może tolerować historyczny wariant top-level array, ale normatywny kontrakt ma wymagać formatu obiektowego `{ "words": [...] }`.
- Timestampy muszą zostać znormalizowane do milisekund.
- `position` ma być nadawane sekwencyjnie podczas normalizacji.

### Zasady retry dla transkrypcji

System musi wykonać jedno automatyczne ponowienie wywołania, jeśli:

- model zwróci błędny JSON,
- model zwróci pustą listę `words`.

System musi zakończyć etap jako `failed`, jeśli:

- payload nie zawiera `words`,
- elementy `words` mają błędną strukturę,
- transcript pozostaje pusty po retry.

## 8.5 Specyfikacja promptu dla tłumaczenia

Tłumaczenie nie może działać na swobodnym bloku tekstu. Wejściem do tłumaczenia ma być uporządkowana lista segmentów roboczych zbudowanych z transcriptu per-word. Segmenty są warstwą roboczą do przekazania modelowi, ale nie zastępują transcriptu per-word jako źródła prawdy.

### Intencja promptu

Prompt tłumaczeniowy musi wymuszać:

- odpowiedź wyłącznie w JSON,
- top-level collection o nazwie `translations`,
- zachowanie kolejności segmentów 1:1,
- dokładnie jedną wartość tłumaczenia na każdy segment wejściowy,
- brak komentarzy i dodatkowego tekstu.

### Wymagana treść promptu

Prompt dla tłumaczenia powinien odpowiadać tej intencji:

```text
Return JSON with a top-level "translations" array.
Preserve segment order exactly and return one translated string per input segment.
Translate to {target_language}.
```

Po tym fragmencie system musi dołączyć wejściowy payload JSON:

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

### Structured Output schema dla tłumaczenia

System musi przekazywać do Gemini ten schemat JSON:

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

### Dopuszczalna odpowiedź po stronie parsera

Parser może zaakceptować:

- `{"translations":[{"translated_text":"Czesc"}]}`
- `{"translations":["Czesc"]}`

Natomiast normatywny format docelowy ma być obiektowy:

```json
{
  "translations": [
    {
      "translated_text": "Czesc"
    }
  ]
}
```

### Zasady walidacji tłumaczenia

- `translations` musi być listą,
- liczba elementów tłumaczenia musi odpowiadać liczbie segmentów wejściowych,
- każdy element musi dać się zredukować do pojedynczego `translated_text`,
- odpowiedź nie może być surowym JSON-em zapisanym jako string w polu tłumaczenia,
- błędny kontener lub błędny item ma kończyć etap jako `failed`.

### Mapowanie z powrotem na transcript per-word

Po uzyskaniu tłumaczeń segmentów system musi:

- zachować transcript per-word jako źródło prawdy,
- rozdzielić tłumaczenie segmentu na słowa przypisane do tego segmentu,
- zapisać `translated_text` na poziomie każdego słowa,
- odbudować warstwę segmentową tylko jako pochodną warstwę renderującą.

To jest kluczowe wymaganie, bo Theater ma działać na danych per-word, a nie na statycznych blokach tekstu.

## 8.6 Specyfikacja dubbingu

Dubbing musi używać finalnego tłumaczenia jako wejścia i generować osobny asset audio projektu.

### Model

- `gemini-2.5-flash-preview-tts`

### Minimalne wymagania wywołania

- wejściem jest finalny tekst docelowy,
- wywołanie musi zawierać konfigurację głosu,
- wynikiem ma być binarna ścieżka audio,
- audio ma zostać zapisane jako osobny asset projektu i podłączone do Theater oraz eksportu.

### Zasady pipeline

- dubbing wolno uruchomić dopiero po statusie `translation = ready`,
- failure dubbingu nie może usuwać transcriptu ani tłumaczenia,
- retry dubbingu ma dotyczyć wyłącznie artefaktów dubbingowych.

## 8.7 Fallbacki modeli Gemini

System ma wspierać fallback 404 dla modeli tekstowych według tej logiki:

- jeśli skonfigurowany model nie istnieje, próbujemy kolejnego kandydata,
- dla rodziny `gemini-3.1-flash-lite` można próbować także wariantu `gemini-3.1-flash-lite-preview`,
- ostateczna bezpieczna ścieżka dla tekstu to:
  - `gemini-2.5-flash-lite`
  - `gemini-2.5-flash`

Fallback nie może maskować błędów logicznych payloadu. Dotyczy tylko niedostępności modelu.

## 8.8 Wymagania jakościowe dla AI

- Brak pustych transcriptów.
- Brak placeholderów.
- Brak segmentów udających transcript per-word.
- Brak tłumaczeń zapisanych jako artefakty techniczne lub surowy JSON.
- Błędna odpowiedź modelu musi oznaczać `failed`, nie `ready`.
- Structured Output ma być domyślnie włączony i traktowany jako wymóg jakościowy, nie jako opcjonalny dodatek.

## 8.9 Acceptance criteria dla integracji Gemini

1. Transkrypcja zwraca top-level `words[]` z polami `start`, `end`, `text`, `keyword`.
2. System normalizuje transcript do `position`, `start_ms`, `end_ms`, `original_text`, `keyword`.
3. Tłumaczenie zwraca top-level `translations[]` i zachowuje kolejność segmentów 1:1.
4. Structured Output używa jawnego `responseJsonSchema` dla transkrypcji i tłumaczenia.
5. Błędny JSON albo puste `words[]` powodują jedno automatyczne retry transkrypcji.
6. Malformed payload po retry kończy etap statusem `failed`.
7. Theater otrzymuje dane per-word z przypisanymi keywordami i może ich użyć do highlightingu oraz renderingu napisów.

## 9. Szczegółowe wymagania funkcjonalne

### FR-1 Tworzenie projektu

- Użytkownik może utworzyć projekt z uploadu lub URL.
- System zapisuje nazwę projektu i parę językową.
- Projekt pojawia się w bibliotece od razu po utworzeniu.

### FR-2 Organizacja biblioteki

- Użytkownik może tworzyć foldery.
- Użytkownik może tworzyć playlisty.
- Użytkownik może przypisywać projekt do folderu.
- Użytkownik może dodawać projekty do playlisty i zmieniać ich kolejność.

### FR-3 Transkrypcja

- Użytkownik może uruchomić transkrypcję ręcznie.
- System tworzy transcript oparty o słowa z timingiem.
- Niepoprawny transcript kończy etap statusem `failed`.

### FR-4 Tłumaczenie

- Użytkownik może uruchomić tłumaczenie po gotowej transkrypcji.
- System tworzy warstwę tłumaczenia powiązaną z transcriptem.
- Tłumaczenie zasila Theater i dubbing.

### FR-5 Review w Theater

- Użytkownik może oglądać materiał z napisami.
- Użytkownik może przełączać źródłowy i tłumaczony track.
- Użytkownik może sterować autoplay playlisty.
- Użytkownik może przejść do kolejnego projektu w playliście.

### FR-6 Dubbing

- Użytkownik może uruchomić generowanie dubbingu po gotowym tłumaczeniu.
- Użytkownik może odsłuchać dubbing w Theater.
- Dubbing może być częścią eksportu.

### FR-7 Styling napisów

- Użytkownik może skonfigurować font, kolor, outline i przezroczystość.
- Użytkownik może zobaczyć wynik w preview.
- Styl zapisuje się do projektu.

### FR-8 Eksport i pobieranie

- Użytkownik może pobrać napisy jako osobny plik.
- Użytkownik może uruchomić eksport wideo z wypalonymi napisami.
- Użytkownik może pobrać wynik eksportu po zakończeniu przetwarzania.

### FR-9 Retry i odporność na błędy

- Każdy etap AI może zostać zretryowany.
- System jasno komunikuje, który etap zawiódł.
- Retry czyści tylko zależne artefakty.

## 10. Wymagania UX i zachowania systemu

- Produkt ma prowadzić użytkownika do kolejnej akcji zamiast tylko pokazywać status.
- Widok biblioteki ma odpowiadać na pytanie: `co mam zrobić dalej z tym projektem`.
- Widok Theater ma odpowiadać na pytanie: `czy wynik jest gotowy i jak wygląda w ruchu`.
- Użytkownik nie powinien być zmuszany do rozumienia nazw modeli, budżetów tokenów i parametrów wewnętrznych, nawet jeśli implementacja wewnętrzna ma je zdefiniowane precyzyjnie.
- Komunikaty błędów mają być operacyjne i naprawialne, np. `retry transcription`, a nie techniczne stack trace.

## 11. Acceptance criteria dla pełnego workflow

Produkt uznajemy za zgodny z tym PRD, jeśli:

1. Użytkownik może dodać materiał przez upload lub URL i od razu zobaczyć projekt w bibliotece.
2. Użytkownik może zainicjować transkrypcję i widzieć progres oraz finalny wynik w statusach projektu.
3. Po gotowej transkrypcji użytkownik może uruchomić tłumaczenie i oglądać wynik w Theater jako drugi track.
4. Theater renderuje napisy w oparciu o słowa z timingiem, a nie o statyczne bloki tekstu.
5. Użytkownik może uruchomić dubbing i odtworzyć wygenerowaną ścieżkę audio.
6. Użytkownik może zmienić styl napisów i zobaczyć efekt w preview.
7. Użytkownik może pobrać plik napisów.
8. Użytkownik może wyeksportować wideo z wypalonymi napisami.
9. Nieudany etap transkrypcji, tłumaczenia lub dubbingu może zostać zretryowany bez utraty całego projektu.
10. Użytkownik może pracować zarówno na pojedynczym projekcie, jak i na playliście review.

## 12. Otwarte założenia produktowe

Na potrzeby tej wersji PRD przyjmujemy:

- projekt ma jedną główną parę językową naraz,
- jeden projekt reprezentuje jedno źródłowe wideo,
- dubbing dotyczy jednej docelowej ścieżki językowej na projekt,
- style napisów są zapisywane per projekt,
- playlisty służą do review operacyjnego, nie do publikacji jako kolekcje publiczne.

## 13. Kierunek dalszej specyfikacji

Ten PRD powinien być punktem wyjścia do kolejnych dokumentów spec-driven:

- specyfikacji domeny i modelu danych,
- specyfikacji stanów pipeline,
- specyfikacji UX dla Library,
- specyfikacji UX dla Theater,
- specyfikacji dubbingu,
- specyfikacji eksportów i subtitle styling,
- planu implementacyjnego pod epiki i acceptance tests.
